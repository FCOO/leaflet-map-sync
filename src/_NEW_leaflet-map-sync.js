/****************************************************************************
    leaflet-map-sync, Sync two or more maps with regard to center, zoom and pan

    (c) 2015, FCOO

    https://github.com/fcoo/leaflet-map-sync
    https://github.com/fcoo

    Based on the great Leaflet.Sync by Bjorn Sandvik https://github.com/turban/

    There are tree main groups of tasks/actions:
    1: Synchronizing the maps center and zoom
    2: Creating and updating the 'shadow' cursor
    3: Creating and updating the 'shadow' map

    The number is used in comments to the different methods

****************************************************************************/

(function ($, L, window, document, undefined) {
    "use strict";

  /************************************************************************
  All icon-classes and cooresponding css cursor-styles. * = Not supported
  icon-class    css-class
  ----------    ---------
  cursor        auto, default, initial, inherit, context-menu, help, progress, alias, copy
  pointer       pointer
  none          none
  wait          progress, wait
  cell          cell
  crosshair     crosshair
  text          text
  vertical-text vertical-text
  move          move, all-scroll
  not-allowed   no-drop, not-allowed
  ns-resize     ns-resize, n-resize, s-resize
  ew-resize     ew-resize, e-resize, w-resize
  ne-resize     ne-resize, sw-resize, nesw-resize
  nw-resize     nw-resize, se-resize, nwse-resize
  col-resize    col-resize
  row-resize    row-resize
  zoom-in       zoom-in
  zoom-out      zoom-out
  grab          grab, -webkit-grab
  grabbing      grabbing, -webkit-grabbing
  ************************************************************************/
    var iconSize = [22, 26],
        iconList = {
            'cursor'       : { iconMargin: [ -1,  0], cssClasses: ['auto', 'default', 'initial', 'inherit', 'context-menu', 'help', 'progress', 'alias', 'copy'] },
            'pointer'      : { iconMargin: [ -7, -2], cssClasses: ['pointer'] },
            'none'         : { iconMargin: [  0,  0], cssClasses: ['none'] },
            'wait'         : { iconMargin: [-11,-10], cssClasses: ['progress', 'wait'] },
            'cell'         : { iconMargin: [-11,-11], cssClasses: ['cell'] },
            'crosshair'    : { iconMargin: [-11,-10], cssClasses: ['crosshair'] },
            'move'         : { iconMargin: [-11, -9], cssClasses: ['move', 'all-scroll'] },
            'not-allowed'  : { iconMargin: [-11,-11], cssClasses: ['no-drop', 'not-allowed'] },
            'ns-resize'    : { iconMargin: [-11, -9], cssClasses: ['ns-resize', 'n-resize', 's-resize'] },
            'ew-resize'    : { iconMargin: [-11, -9], cssClasses: ['ew-resize', 'e-resize', 'w-resize'] },
            'ne-resize'    : { iconMargin: [-11,-10], cssClasses: ['ne-resize', 'sw-resize', 'nesw-resize'] },
            'nw-resize'    : { iconMargin: [-11,-10], cssClasses: ['nw-resize', 'se-resize', 'nwse-resize'] },
            'zoom-in'      : { iconMargin: [-10, -9], cssClasses: ['zoom-in'] },
            'zoom-out'     : { iconMargin: [-10, -9], cssClasses: ['zoom-out'] },
            'grab'         : { iconMargin: [ -8, -8], cssClasses: ['grab', '-webkit-grab', '-moz-grab'] },
            'grabbing'     : { iconMargin: [ -8, -8], cssClasses: ['grabbing', '-webkit-grabbing', '-moz-grabbing'] },
            'col-resize'   : { iconMargin: [-11, -8], cssClasses: ['col-resize'] },
            'row-resize'   : { iconMargin: [ -8,-11], cssClasses: ['row-resize'] },
            'text'         : { iconMargin: [ -2, -8], cssClasses: ['text'] },
            'vertical-text': { iconMargin: [ -8, -3], cssClasses: ['vertical-text'] },

    };

    //Create a fast look-up object
    var cssCursorToIconName = {},
        cssClasses;
    for (var iconName in iconList){
        cssClasses = iconList[iconName].cssClasses;
        for (var i=0; i<cssClasses.length; i++ )
            cssCursorToIconName[ cssClasses[i] ] = iconName;
    }
//HER
//HER    var //ANIMATION          =  { animate: true               },
//HER        NO_ANIMATION       =  { animate: false              },
//HER        NO_ANIMATION_RESET =  { animate: false, reset: true },
//HER
//HER        panZoomOptionsZoomEnd = NO_ANIMATION,      /* 1 */
//HER        panZoomOptionsOther   = NO_ANIMATION,   /* 2 */
//HER        panZoomOptionsDragEnd = NO_ANIMATION;   /* 3 */
//HER/*
//HERTESTS AF FORSKELLIGE MODES
//HER                                                        Desktop                             Touch
//HER1           2               3                       pan         zoom                    pan         zoom
//HERANIMATION   NO_ANIMATION    NO_ANIMATION            Ok          NO                      ukendt      ukendt
//HERANIMATION   NO_ANIMATION    NO_ANIMATION_RESET      NO          NO                      ukendt      ukendt
//HER
//HER
//HER*/

    /***********************************************************
    ************************************************************
    Extentions for L.Map

    New events
        Event-name               Fired in
        ------------------------ ----------------------------------------
        mapsyncenabled           MapSync.enable( map )
        mapsyncdisabled          MapSync.disable( map )
        mapsynczoomenabled       MapSync.enableZoom( map )
        mapsynczoomdisabled      MapSync.disableZoom( map )
        mapsynczoomoffsetchanged MapSync.setZoomOffset( map, zoomOffset )

    ************************************************************
    ***********************************************************/


    /********************************************************************
    *********************************************************************
    1: SYNCHRONIZING THE MAPS CENTER AND ZOOM
    *********************************************************************
    ********************************************************************/

    /********************************************************************
    1: Map.include
    ********************************************************************/
    L.Map.include({

        /***********************************
        setMinZoom, setMaxZoom (1)
        ***********************************/
        setMinZoom: function( setMinZoom ){
            return function( zoom, usePrototype ){
                //If in mapSync => use _mapSync_setMinMaxZoom
                if (this._mapSync && !usePrototype)
                    return this._mapSync_setMinMaxZoom( zoom, undefined );
                else
                    //Original function/method
                    return setMinZoom.call(this, zoom);
            };
        } (L.Map.prototype.setMinZoom),

        setMaxZoom: function( setMaxZoom ){
            return function( zoom, usePrototype  ){
                //If in mapSync => use _mapSync_setMinMaxZoom
                if (this._mapSync && !usePrototype)
                    return this._mapSync_setMinMaxZoom( undefined, zoom );
                else
                    //Original function/method
                    return setMaxZoom.call(this, zoom);
            };
        } (L.Map.prototype.setMaxZoom),

        /***********************************
        _mapSync_setMinMaxZoom(minZoom, maxZoom)
        ***********************************/
        _mapSync_setMinMaxZoom: function (minZoom, maxZoom){
            if (this.options.mapSync.isMainMap){
                //Set min- and/or max-zoom for the main-map and update all other maps
                if (minZoom !== undefined)
                    this.setMinZoom( minZoom, true );
                if (maxZoom !== undefined)
                    this.setMaxZoom( maxZoom, true );
                this._mapSync._updateAllMinMaxZoom();
            }
            else {
                //Save the new min/max as original to be used if/when the map is disabled
                //If the map is disabled => use the new values
                this.options.mapSync.minZoomOriginal = minZoom !== undefined ? minZoom : this.options.mapSync.minZoomOriginal;
                this.options.mapSync.maxZoomOriginal = maxZoom !== undefined ? maxZoom : this.options.mapSync.maxZoomOriginal;

                if (!this.options.mapSync.enabled || this.options.mapSync.zoomEnabled){
                    this.setMinZoom( this.options.mapSync.minZoomOriginal, true );
                    this.setMaxZoom( this.options.mapSync.maxZoomOriginal, true );
                }
            }
            return this;
        },

        /***********************************
        _mapSync_setMinMaxZoom()
        Adjust min- and max-zoom according to min- and max-zoom of the main map
        ***********************************/
        _mapSync_adjustMinMaxZoom: function(){
            this.setMinZoom( this._mapSync.mainMap.getMinZoom() + this.options.mapSync.zoomOffset, true );
            this.setMaxZoom( this._mapSync.mainMap.getMaxZoom() + this.options.mapSync.zoomOffset, true );
        },

//HER        /***********************************
//HER        setView
//HER        ***********************************/
//HER        setView: function( setView ) {
//HER            return function(center, zoom/*, zoomPanOptions*/){
//HER                var mapSync = this._mapSync;
//HER
//HER                //If in mapSync calc new zoom for mainMap
//HER                if (mapSync && this.options.mapSync.enabled){
//HER                    var newMainZoom = this.options.mapSync.zoomEnabled ? zoom - this.options.mapSync.zoomOffset : null;
//HER
//HER                    mapSync._forEachMap({
//HER                        mapFunction: function( map, center, newMainZoom ){
//HER                            var newMapZoom = (newMainZoom !== null) && map.options.mapSync.zoomEnabled ? newMainZoom + map.options.mapSync.zoomOffset : map.getZoom();
//HER                            setView.call(map, center, newMapZoom, panZoomOptionsOther);
//HER                        },
//HER                        arguments  : [center, newMainZoom],
//HER                        excludeMap : this
//HER                    });
//HER                }
//HER
//HER                //Original function/method
//HER                return setView.apply(this, arguments);
//HER            };
//HER        } (L.Map.prototype.setView),


//HER        /***********************************
//HER        panTo
//HER        ***********************************/
//HER        panTo: function( panTo ) {
//HER            return function(){
//HER                //Original function/method
//HER                panTo.apply(this, arguments);
//HER                 if (this._mapSync && this.options.mapSync.enabled)
//HER                    this._mapSync._forEachMap({
//HER                        mapFunction: function( map, arg ){
//HER                            panTo.apply(map, arg);
//HER                        },
//HER                        arguments  : arguments,
//HER                        excludeMap : this
//HER                    });
//HER
//HER                return this;
//HER            };
//HER        } (L.Map.prototype.panTo),

//HER        /***********************************
//HER        panBy
//HER        ***********************************/
//HER        panBy: function( panBy ) {
//HER            return function ( point ) {
//HER
//HER                //Original function/method
//HER                panBy.apply(this, arguments);
//HER
//HER                //pan the other maps if the pan is by keyboard
//HER                if (this._mapSync && this.options.mapSync.enabled)
//HER                    this._mapSync._forEachMap({
//HER                        mapFunction: function( map, point, activeMap ){
//HER                            point = $.isArray(point) ? L.point(point) : point;
//HER                            var factor = Math.pow( 2, map.getZoom() - activeMap.getZoom() );
//HER                            panBy.call(map, point.multiplyBy( factor ));
//HER                        },
//HER                        arguments  : [point, this],
//HER                        excludeMap : this
//HER                });
//HER                return this;
//HER            };
//HER        } (L.Map.prototype.panBy),

//HER        /***********************************
//HER        _onResize
//HER        ***********************************/
//HER        _onResize: function( _onResize ){
//HER            return function (){
//HER                //Original function/method
//HER                _onResize.apply(this, arguments);
//HER
//HER                if (this._mapSync && this.options.mapSync.enabled)
//HER                    this._mapSync._forEachMap({
//HER                        mapFunction: function( map, arg ){
//HER                            _onResize.apply(map, arg);
//HER                        },
//HER                        arguments  : arguments,
//HER                        excludeMap : this
//HER                    });
//HER                return this;
//HER            };
//HER        } (L.Map.prototype._onResize)
    });


    /********************************************************************
    1: Events
    ********************************************************************/
//HER    function map_on_zoomend_sync(){
//HER        this.setView( this.getCenter(), this.getZoom(), panZoomOptionsZoomEnd);
//HER    }

//HER    function map_on_dragend_sync(){
//HER        if (this.options.mapSync.enabled)
//HER            this.setView( this.getCenter(), this.getZoom(), panZoomOptionsDragEnd);
//HER    }

//HER    function addMapEvents_sync( map ){
//HER        map.on('zoomend',    map_on_zoomend_sync   );
//HER        map.on('dragend',    map_on_dragend_sync   );
//HER
//HER        //Extend this.dragging._draggable._updatePosition (1)
//HER        map.dragging._draggable._updatePosition = function ( _updatePosition ) {
//HER            return function(){
//HER                //Original function/method
//HER                _updatePosition.apply(this, arguments);
//HER
//HER                if (map.options.mapSync.enabled)
//HER                    map._mapSync._forEachMap({
//HER                        mapFunction: function( map, _currentDraggable, activeMap ){
//HER                            //Adjust _newPos by the different in zoom between the active (dragging) map and the map
//HER                            var factor = Math.pow( 2, map.getZoom() - activeMap.getZoom() );
//HER                            L.DomUtil.setPosition(
//HER                                map.dragging._draggable._element,
//HER                                _currentDraggable._newPos.multiplyBy( factor )
//HER                            );
//HER                            //Fire 'moveend' to force updating the map
//HER                            map.fire('moveend');
//HER                        },
//HER                        arguments : [this, map],
//HER                        excludeMap: map
//HER                    });
//HER            };
//HER        }( L.Draggable.prototype._updatePosition );
//HER    }

    /********************************************************************
    *********************************************************************
    2: CREATING AND UPDATING THE 'SHADOW' CURSOR
    *********************************************************************
    ********************************************************************/

    /********************************************************************
    2: Map.include
    ********************************************************************/
    L.Map.include({
        /***********************************
        _mapSync_updateShadow (2)
        Draw/updates the shadowa of this in other maps and
        the shadow of otrher maps in this.
        If onlyInMap !== null only this' shadow in onlyInMap are updated
        ***********************************/
        _mapSync_updateShadow: function(){
            // The 'shadow' map of mapA is shown in mapB if
            //    - mapB cover mapA, or
            //    - mapA and mapB overlaps AND mapA.zoom > mapB.zoom

            //************************************************************************************
            function setShadowMap( map, shadowMap, $mapShadow, role ){
                var shadowBounds = shadowMap.getBounds(),
                    mapBounds    = map.getBounds(),
                    showShadow   = false;

                if ( map.options.mapSync.enabled && shadowMap.options.mapSync.enabled && (shadowMap != map) && !shadowBounds.equals(mapBounds) ){

                    if (mapBounds.contains( shadowBounds ) )
                        showShadow = true;
                    else {
                        //If Shadow map don't coner map and map is zoomed out compared to shadow map => show the shadow
                        showShadow = !shadowBounds.contains( mapBounds ) && (shadowMap.getZoom() > map.getZoom());
                    }
                    if (showShadow){
                        //Adjust shadow-div
                        var topLeft     = map.latLngToContainerPoint( shadowBounds.getNorthWest() ),
                            bottomRight = map.latLngToContainerPoint( shadowBounds.getSouthEast() );
                        $mapShadow.css({
                            top   : topLeft.y,
                            left  : topLeft.x,
                            width : bottomRight.x - topLeft.x,
                            height: bottomRight.y - topLeft.y
                         });
                    }
                }

                //Set class for shadow map container to show/hide shadow and border
                if ($mapShadow)
                    $mapShadow
                        .toggleClass('map-sync-shadow-show',   showShadow)
                        .toggleClass('map-sync-shadow-main',   showShadow && (role == 'MAIN')   )
                        .toggleClass('map-sync-shadow-second', showShadow && (role == 'SECOND') );

                return showShadow;
            }
            //************************************************************************************

            var _this = this;

            //Draw 'yellow' shadow maps of this in all other maps
            $.each( this._mapSync.list, function( index, otherMap ){
                var $mapShadow = _this.options.mapSync.shadowList[ index ]; // = the shadow map of _this in otherMap
                if ( setShadowMap(  otherMap, _this, $mapShadow ) )
                    _this.options.mapSync.$map_container.addClass('map-sync-active-dragging');
            });

            //Draw 'open yellow' (or 'blue' for main map) shadow maps of all other maps in this
            $.each( this._mapSync.list, function( index, otherMap ){
                var thisIndexInList = _this.options.mapSync.indexInList,
                    $mapShadow = otherMap.options.mapSync.shadowList[ thisIndexInList ], // = the shadow map of otherMap in _this
                    otherMapIsMain = _this._mapSync.mainMap == otherMap;

                if ( setShadowMap(  _this, otherMap, $mapShadow, otherMapIsMain ? 'MAIN' : 'SECOND' ) ){
                    otherMap.options.mapSync.$map_container.addClass( otherMapIsMain ? 'map-sync-main-dragging' : 'map-sync-second-dragging');

                    //Hide the shadow map if there already is a exact copy
                    for (var i=0; i<index; i++ )
                        if (i != thisIndexInList){
                            var $otherMapShadow = _this._mapSync.list[i].options.mapSync.shadowList[ thisIndexInList ];

                            //If the two shadows $mapShadow and $otherMapShadow are equal => hide $mapShadow
                            if (
                                ( $mapShadow.css("left") == $otherMapShadow.css("left") ) &&
                                ( $mapShadow.css("top") == $otherMapShadow.css("top") ) &&
                                ( $mapShadow.css("width") == $otherMapShadow.css("width") ) &&
                                ( $mapShadow.css("height") == $otherMapShadow.css("height") ) &&
                                ( $mapShadow.attr("class") == $otherMapShadow.attr("class") )
                               ){
                                $mapShadow.removeClass('map-sync-shadow-show');
                                break;
                            }
                        }
                }
            });

        }, //end of _mapSync_updateShadow

        /***********************************
        _mapSync_hideShadowMaps (2)
        Hide all shadow maps in other maps and reset own border etc.
        ***********************************/
        _mapSync_hideShadowMaps: function(){
            for (var i=0; i<this._mapSync.list.length; i++ ){
                var $mapShadow = this.options.mapSync.shadowList[i]; // = the shadow map of _this in otherMap
                if ($mapShadow)
                  $mapShadow.removeClass('map-sync-shadow-show map-sync-shadow-main map-sync-shadow-second');
            }
            this.options.mapSync.$map_container.removeClass('map-sync-main-dragging map-sync-active-dragging map-sync-second-dragging' );
        }

    }); //End of  L.Map.include({...

    /********************************************************************
    2: Events
    function map_on_XX_cursor(){
    ********************************************************************/
//HER    function map_whenReady_cursor(){
//HER        //Create a marker to be used as 'shadow' cursor and move it to a popupPane to make the cursor apear over the popups
//HER        var divIcon = L.divIcon({ className: 'map-sync-cursor-icon', iconSize: iconSize });
//HER        this.options.mapSync.cursorMarker = L.marker( this.getCenter(), {icon: divIcon} ).addTo(this);
//HER
//HER        //Create a new pane above everything and move the shadow-cursor from markerPane to this pane
//HER        var cursorContainer = L.DomUtil.create( 'div', 'map-sync-cursor-container', this._mapPane );
//HER        this._panes.markerPane.removeChild( this.options.mapSync.cursorMarker._icon );
//HER        cursorContainer.appendChild( this.options.mapSync.cursorMarker._icon );
//HER    }

    function map_on_mouseover_cursor(){
        if (this._mapSync)
            this._mapSync._onMouseOverMap( this );
    }
    function map_on_mouseout_cursor(){
        if (this._mapSync)
            this._mapSync._onMouseOutMap ( this );
    }

//HER    function map_on_mousemove_cursor( mouseEvent ){
//HER        //Update the position of the shadow-cursor
//HER        if (this._mapSync && this.options.mapSync.enabled)
//HER            this._mapSync._updateCursor( mouseEvent.latlng );
//HER    }

    // Since no mousemove-event is fired when the map is panned or zoomed using the keyboard,
    // the following workaround is implemented:
    // The shadow-cursor is hidden when zoom or move startes.
    // When zoom or move endes the shadow-cursor is shown again the first time the mouse is moved
    function map_on_xxstart_cursor(){
        if (this._mapSync && this.options.mapSync.enabled)
            this._mapSync.hide();
    }
    function map_on_xxend_cursor(){
        if (this._mapSync && this.options.mapSync.enabled)
            this._mapSync._showOnFirstMove();
    }


    function map_setCursorFromMouseEvent( mouseEvent ){
        if (this._mapSync && this.options.mapSync.enabled)
            this._mapSync._setCursorFromMouseEvent( mouseEvent );
    }
    function map_setCursorFromMapContainer(){
        if (this._mapSync && this.options.mapSync.enabled)
            this._mapSync._setCursorFromElement( this._container );
    }

    function addMapEvents_cursor(map){
//HER        map.whenReady( map_whenReady_cursor, map);

        //Events to hide or show the cursor
        map.on('mouseover', map_on_mouseover_cursor);
        map.on('mouseout',  map_on_mouseout_cursor);

        //Events to update/change the position of the cursor
//HER        map.on('mousemove', map_on_mousemove_cursor);

        map.on('zoomstart dragstart movestart', map_on_xxstart_cursor);
        map.on('zoomend dragend moveend',       map_on_xxend_cursor  );

        /*
        Events to update/change the cursor-type
        Adds mouseover-event to the maps container and different panes to trace current cursor
        */
        L.DomEvent.on( map._controlContainer, 'mouseover', map_setCursorFromMouseEvent, map );
        L.DomEvent.on( map._container,        'mouseover', map_setCursorFromMouseEvent, map );
        for (var pane in map._panes)
            L.DomEvent.on( map._panes[pane],  'mouseover', map_setCursorFromMouseEvent, map );

        //Change and reset cursor on dragging
        map.on('dragstart', function() {
            map.once('mousemove', map_setCursorFromMapContainer, map );
        });
        map.on('dragend zoomend moveend boxzoomend', map_setCursorFromMapContainer, map );

        $('.cursor-div').on('mouseover', $.proxy(map_setCursorFromMouseEvent, map ));
    }


    /********************************************************************
    *********************************************************************
    3: CREATING AND UPDATING THE 'SHADOW' MAP
    *********************************************************************
    ********************************************************************/
    //Show 'shadow' map
    function map_on_dragstart_shadow(){
        if (this._mapSync && this.options.mapSync.enabled){
            this._mapSync._updateShadowMaps( this );
            this.options.mapSync.dragging = true;
        }
    }

    //Hide 'shadow' map
    function map_on_dragend_shadow(){
        if (this._mapSync && this.options.mapSync.enabled){
            this._mapSync._updateShadowMaps( this );
            this._mapSync._hideShadowMaps();
            this.options.mapSync.dragging = false;
        }
    }

    //Redraw shadows for all no-zoom-sync maps when zoom ends
    function map_on_zoomend_shadow(){
        var _this = this;
        if (this._mapSync && this.options.mapSync.dragging)
            $.each( this._mapSync.list, function( index, otherMap ){
                if (otherMap.options.mapSync.enabled && !otherMap.options.mapSync.zoomEnabled){
                    _this._mapSync._updateShadowMaps( _this );
                    return false;
                }
            });
    }

    function addMapEvents_shadow(map){
        map.on('dragstart', map_on_dragstart_shadow);
        map.on('dragend',   map_on_dragend_shadow  );
        map.on('zoomend',   map_on_zoomend_shadow  );
    }

    /********************************************************************
    *********************************************************************
    L.MapSync
    *********************************************************************
    ********************************************************************/
    L.MapSync = L.Class.extend({
        options: {
//HER            VERSION : "{VERSION}",
            iconName: 'hand'
        },

        /***********************************************************
        initialize
        ***********************************************************/
        initialize: function(options) {
            L.setOptions(this, options);
            this.list = [];
            this.show();
        },

        /***********************************************************
        add
        ************************************************************/
        add: function(map, options) {
            options = L.Util.extend( {
                enabled       : true,
                zoomOffset    : 0,
                zoomEnabled   : true,
                $map_container: $(map.getContainer())
            }, options || {});


            map._mapSync = this;
            map.options = map.options || {};
            map.options.mapSync = options;
            map.options.mapSync.$map_container.addClass('map-sync-container');

            this.mainMap = this.mainMap ? this.mainMap : map;
            map.options.mapSync.isMainMap = (map == this.mainMap);

            if (map.options.mapSync.isMainMap){
                //Main map is always on
                map.options.mapSync.enabled = true;
                map.options.mapSync.zoomOffset = 0;
                map.options.mapSync.zoomEnabled = true;
            }
//HER            else
//HER                //Set no-main on-loaded maps to match the main map
//HER                if (!map._loaded)
//HER                    map.setView(this.mainMap.getCenter(), this.mainMap.getZoom() +  options.zoomOffset, NO_ANIMATION_RESET );

//HER            /*********************************************************************************************
//HER            1: Events for sync
//HER            *********************************************************************************************/
//HER            addMapEvents_sync( map );


            //NEW use jieter/Leaflet.Sync to sync the map with the other added maps
            var _map = map;

            map.whenReady(function(){
                var divIcon = L.divIcon({ className: 'map-sync-cursor-icon', iconSize: iconSize });
//HER                _map.cursor = L.marker( _map.getCenter(), {_icon: divIcon} ).addTo(_map);

                //_map.cursor = L.circleMarker([0, 0], options.syncCursorMarkerOptions).addTo(_map);

                $.each(this.list, function(index, anotherMap){
                    _map.sync(anotherMap,  {syncCursor: true});
                    anotherMap.sync(_map,  {syncCursor: true});
                });
            }, this);


            /*********************************************************************************************
            2: Events for "shadow" cursor
            *********************************************************************************************/
//TEMP            addMapEvents_cursor( map );

            /*********************************************************************************************
            3: Create and add events and overwrite methods to show, hide, and update
               'shadow' map showing either the active map in other maps or the main map in the active map
            *********************************************************************************************/
/*
            //Create the 'shadow' map showing either the active map in other maps or the main map in the active map
            map.options.mapSync.$mapShadow = $('<div class="map-sync-shadow"><div/></div>');
            map.options.mapSync.$map_container.append( map.options.mapSync.$mapShadow );


            //Create a shadow in all other maps and create a shadow inside the map for all other maps
            map.options.mapSync.shadowList = [];
            map.options.mapSync.indexInList = this.list.length;
            $.each( this.list, function( index, otherMap ){
                //Create shadow of map in the other map
                var $mapShadow = $('<div class="map-sync-shadow"><div/></div>');
                otherMap.options.mapSync.$map_container.append( $mapShadow );
                map.options.mapSync.shadowList[ index ] = $mapShadow;

                //Craete shadow of the other map in map
                $mapShadow = $('<div class="map-sync-shadow"><div/></div>');
                map.options.mapSync.$map_container.append( $mapShadow );
                otherMap.options.mapSync.shadowList[ map.options.mapSync.indexInList ] = $mapShadow;

            });
            addMapEvents_shadow(map);
*/

            //Add to list
            this.list.push(map);

            //Enable the map
            if (options.enabled)
                this.enable( map );

            return map;
        }, //end of add


        //**************************************************************************
        //show();
        show: function(){
            window.modernizrOn('map-sync');
        },

        //**************************************************************************
        //hide();
        hide: function(){
            window.modernizrOff('map-sync');
        },

        //**************************************************************************
        //enable( map );
        enable: function( map ){
return; //HER

            //Check if map has been added to a MapSync-object
            if (map.options && map.options.mapSync && map._mapSync == this){

                //Save original min- and max-zoom
                map.options.mapSync.minZoomOriginal = map.getMinZoom();
                map.options.mapSync.maxZoomOriginal = map.getMaxZoom();

                //Set the maps min- and max-zoom
//HER                map.setView(this.mainMap.getCenter(), this.mainMap.getZoom() + map.options.mapSync.zoomOffset, NO_ANIMATION_RESET );
                map._mapSync_adjustMinMaxZoom();

                map.options.mapSync.$map_container.addClass( 'map-sync-enabled' );
                map.options.mapSync.enabled = true;
/*
                //If the cursor is over an enabled map => fire a mouseover to update the other maps
                this._forEachMap({
                    mapFunction: function( map ) {
                        if (map.options.mapSync.$map_container.hasClass( 'map-sync-mouseover' ) )
                            map._mapSync._onMouseOverMap( map );
                    }
                });


                this._showOnFirstMove();
*/
                map.fire("mapsyncenabled");
            }
        },

        //**************************************************************************
        //disable( map );
        disable: function( map ){

            //Check if map has been added to a MapSync-object
            if (map.options && map.options.mapSync && (map._mapSync == this) && !map.options.mapSync.isMainMap){

                //Reset the maps min- and max-zoom
                map.setMinZoom( map.options.mapSync.minZoomOriginal, true );
                map.setMaxZoom( map.options.mapSync.maxZoomOriginal, true );

                var mouseIsOver = map.options.mapSync.$map_container.hasClass( 'map-sync-mouseover' );
                //If the cursor is over the enabled map => fire a mouseout to update the other maps
                if (mouseIsOver)
                    this._onMouseOutMap( map );

                map.options.mapSync.$map_container.removeClass( 'map-sync-enabled' );
                map.options.mapSync.enabled = false;

                if (mouseIsOver)
                    this._onMouseOverMap( map );

                map.fire("mapsyncdisabled");
            }
        },

        //**************************************************************************
        //enableZoom( map ) - enable the sync of zoom for map
        enableZoom: function( map ){
            if (map.options && map.options.mapSync && (map._mapSync == this) && !map.options.mapSync.isMainMap){
                map.options.mapSync.zoomEnabled = true;
                if (map.options.mapSync.enabled)
                    //Adjust zoom (center is already in sync)
                    map.setView(map.getCenter(), this.mainMap.getZoom() + map.options.mapSync.zoomOffset); //HER, NO_ANIMATION_RESET );

                map.fire("mapsynczoomenabled");
            }
        },

        //**************************************************************************
        //disableZoom( map ) - disable the sync of zoom for map
        disableZoom: function( map ){
            if (map.options && map.options.mapSync && (map._mapSync == this) && !map.options.mapSync.isMainMap){
                map.options.mapSync.zoomEnabled = false;
                map.fire("mapsynczoomdisabled");
            }
        },

        //**************************************************************************
        //setZoomOffset( map, zoomOffset ) - Change the zoom-offset for map relative to main-map
        setZoomOffset: function( map, zoomOffset ){
            if (map.options && map.options.mapSync && (map._mapSync == this) && !map.options.mapSync.isMainMap){
                map.options.mapSync.zoomOffset = zoomOffset;
                map._mapSync_adjustMinMaxZoom();

                if (map.options.mapSync.enabled && map.options.mapSync.zoomEnabled)
                    map.setView(this.mainMap.getCenter(), this.mainMap.getZoom() + map.options.mapSync.zoomOffset);//HER, NO_ANIMATION_RESET );

                map.fire("mapsynczoomoffsetchanged");
            }
        },

        //**************************************************************************
        //remove( map )
        remove: function( map ){
            for (var i=0; i<this.list.length; i++ )
                if (this.list[i] == map){
                    this.list.splice(i, 1);
                    break;
                }
        },

        //**************************************************************************
        //forEachMap( function( index, map ) ) - Call the function with each map
        forEachMap: function( mapFunction, inclDisabled ){
            for (var i=0; i<this.list.length; i++ )
                if (inclDisabled || this.list[i].options.mapSync.enabled)
                    mapFunction( i, this.list[i] );
        },

        //**************************************************************************
        //_forEachMap( {mapFunction: function(map, arg), arguments: [], excludeMap: leaflet-map, inclDisabled: boolean } )
        _forEachMap: function( options ){
            var i, nextMap, nextArg;
            for (i=0; i<this.list.length; i++ ){
                nextMap = this.list[i];
                if ((nextMap != options.excludeMap) && (options.inclDisabled || nextMap.options.mapSync.enabled)){
                    nextArg = [nextMap];
                    options.mapFunction.apply(undefined, nextArg.concat(options.arguments || []) );
                }
            }
        },

//HER        //**************************************************************************
//HER        //_updateMaps - Update the center and zoom for all enabled maps to be equal mainMap
//HER        _updateMaps: function(){
//HER            this.mainMap.setView( this.mainMap.getCenter(), this.mainMap.getZoom() );
//HER        },

        //**************************************************************************
        //_updateShadowMaps - set dimentions, color and display for all 'shadow' maps
        // activeMap = the map being dragged
        _updateShadowMaps: function( activeMap ){
return; //HER
            //Clean up: Hide all shadow-maps
            this._hideShadowMaps();

            //Draw all shadow maps
            activeMap._mapSync_updateShadow();

        },

        //**************************************************************************
        //_hideShadowMaps - hide all 'shadow' maps
        _hideShadowMaps: function(){
            this._forEachMap({
                mapFunction : function(map){
                    map._mapSync_hideShadowMaps();
                },
                inclDisabled: true
            });
        },


        //**************************************************************************
        //_updateAllMinMaxZoom - Update all maps min- and maxZoom acording to the
        //main-map
        _updateAllMinMaxZoom: function(){
            this._forEachMap({
                mapFunction: function ( map ){
                    map._mapSync_adjustMinMaxZoom();
                },
                excludeMap: this.mainMap
            });
        },

        //**************************************************************************
        //_onMouseOverMap - call when mouseover map._container
        _onMouseOverMap: function ( map ){
            map.options.mapSync.$map_container.addClass( 'map-sync-mouseover' );

            //Add passive-class to all sibling-maps
            if (map.options.mapSync.enabled)
                this._forEachMap({
                    mapFunction: function(map){
                        map.options.mapSync.$map_container.addClass( 'map-sync-passive' );
                    },
                    excludeMap: map
            });
        },

        //**************************************************************************
        //_onMouseOutMap - call when mouseout from map._container
        _onMouseOutMap: function ( map ){
            map.options.mapSync.$map_container.removeClass( 'map-sync-mouseover' );

           //Remove passive-class from all maps
            if (map.options.mapSync.enabled)
                this._forEachMap({
                    mapFunction : function(map){ map.options.mapSync.$map_container.removeClass( 'map-sync-passive' ); },
                    inclDisabled: true
            });
        },


//HER        //**************************************************************************
//HER        //_updateCursor - Update the latlng-position of all the shadow-cursors
//HER        _updateCursor: function( latlng ){
//HER            this._forEachMap({
//HER                mapFunction : function( map, latlng ) {
//HER                    map.options.mapSync.cursorMarker.setLatLng( latlng );
//HER                },
//HER                arguments   : [latlng],
//HER                inclDisabled: true
//HER            });
//HER        },

        //**************************************************************************
        //_showOnFirstMove - call this.show() the first time the mouse is moved on one of the maps
        _showOnFirstMove: function(){
            var _this = this;
            this._forEachMap({
                mapFunction : function( map ) { map.once('mousemove', _this.show, _this ); },
                inclDisabled: true
            });
        },

        //**************************************************************************
        //_setCursorFromMouseEvent
        _setCursorFromMouseEvent: function( mouseEvent ){
            this._setCursorFromElement( mouseEvent.target );
        },

        //**************************************************************************
        //_setCursorFromElement
        _setCursorFromElement: function( element ){
            var cursor = $(element).css('cursor');
            //Adjust 'auto' to specific tagName (primary IE)
            if (cursor == 'auto'){
                switch (element.tagName.toUpperCase()){
                    case 'A': cursor = 'pointer'; break;
                }
            }
            this._changeCursor( cssCursorToIconName[ cursor ] || 'default' );
        },

        //**************************************************************************
        //_changeCursor
        _changeCursor: function( newIconName ){
            var iconMargin = iconList[newIconName] && iconList[newIconName].iconMargin ? iconList[newIconName].iconMargin : [0,0];
            this._forEachMap({
                mapFunction: function( map, oldIconName, newIconName, iconMargin ) {
                    $(map.options.mapSync.cursorMarker._icon)
                        .removeClass( 'icon-' + oldIconName )
                        .addClass( 'icon-' + newIconName )
                        .css({ marginLeft: iconMargin[0]+'px', marginTop: iconMargin[1]+'px'});
                },
                arguments   : [this.options.iconName, newIconName, iconMargin],
                inclDisabled: true

            });
            this.options.iconName = newIconName;
        }

    }); //End of L.MapSync

}(jQuery, L, this, document));

