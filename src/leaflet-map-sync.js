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
  icon-class   css-class
  ----------   ---------
  cursor       auto
  pointer      pointer
  cursor       default
  none         none
  *            context-menu
  *            help
  wait         progress, wait
  cell         cell
  crosshair    crosshair
  *            text
  *            vertical-text
  *            alias
  *            copy
  move         move, all-scroll
  not-allowed  no-drop, not-allowed
  initial
  inherit
  ns-resize    ns-resize, n-resize, s-resize
  ew-resize    ew-resize, e-resize, w-resize
  ne-resize    ne-resize, sw-resize, nesw-resize
  nw-resize    nw-resize, se-resize, nwse-resize
  *            col-resize
  *            row-resize
  zoom-in      zoom-in
  zoom-out     zoom-out
  grab         grab, -webkit-grab
  grabbing     grabbing, -webkit-grabbing
  ************************************************************************/

    var iconSize = [22, 26],
        iconList = {
            'cursor'     : { iconMargin: [ -1,  0], cssClasses: ['auto', 'default', 'initial', 'inherit'] },
            'pointer'    : { iconMargin: [ -7, -2], cssClasses: ['pointer'] },
            'none'       : { iconMargin: [  0,  0], cssClasses: ['none'] },
            'wait'       : { iconMargin: [-11,-10], cssClasses: ['progress', 'wait'] },
            'cell'       : { iconMargin: [-11,-11], cssClasses: ['cell'] },
            'crosshair'  : { iconMargin: [-11,-10], cssClasses: ['crosshair'] },
            'move'       : { iconMargin: [-11, -9], cssClasses: ['move', 'all-scroll'] },
            'not-allowed': { iconMargin: [-11,-11], cssClasses: ['no-drop', 'not-allowed'] },
            'ns-resize'  : { iconMargin: [-11, -9], cssClasses: ['ns-resize', 'n-resize', 's-resize'] },
            'ew-resize'  : { iconMargin: [-11, -9], cssClasses: ['ew-resize', 'e-resize', 'w-resize'] },
            'ne-resize'  : { iconMargin: [-11,-10], cssClasses: ['ne-resize', 'sw-resize', 'nesw-resize'] },
            'nw-resize'  : { iconMargin: [-11,-10], cssClasses: ['nw-resize', 'se-resize', 'nwse-resize'] },
            'zoom-in'    : { iconMargin: [-10, -9], cssClasses: ['zoom-in'] },
            'zoom-out'   : { iconMargin: [-10, -9], cssClasses: ['zoom-out'] },
            'grab'       : { iconMargin: [ -8, -8], cssClasses: ['grab', '-webkit-grab', '-moz-grab'] },
            'grabbing'   : { iconMargin: [ -8, -8], cssClasses: ['grabbing', '-webkit-grabbing', '-moz-grabbing'] },
    };

    //Create a fast look-up object
    var cssCursorToIconName = {},
        cssClasses;
    for (var iconName in iconList){
        cssClasses = iconList[iconName].cssClasses;
        for (var i=0; i<cssClasses.length; i++ )
            cssCursorToIconName[ cssClasses[i] ] = iconName;
    }

    var NO_ANIMATION =  {
            animate: false,
            reset  : true
        };

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
        _mapSync_setMinMaxZoom(minZoom, maxZoom) (1)
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
        _mapSync_setMinMaxZoom() (1)
        Adjust min- and max-zoom according to min- and max-zoom of the main map
        ***********************************/
        _mapSync_adjustMinMaxZoom: function(){
            this.setMinZoom( this._mapSync.mainMap.getMinZoom()/* + this.options.mapSync.zoomOffset*/, true );
            this.setMaxZoom( this._mapSync.mainMap.getMaxZoom()/* + this.options.mapSync.zoomOffset*/, true );
        },

        /***********************************
        setView (1)
        ***********************************/
        setView: function( setView ) { 
            return function(center, zoom){ 
                
                //If in mapSync calc new zoom for mainMap
                if (this._mapSync && this.options.mapSync.enabled){

                    var newMainZoom = this.options.mapSync.zoomEnabled ? zoom - this.options.mapSync.zoomOffset : null;
                    this._mapSync._forEachMap({
                        mapFunction: function( map, center, newMainZoom ){ 
                            var newMapZoom = (newMainZoom !== null) && map.options.mapSync.zoomEnabled ? newMainZoom + map.options.mapSync.zoomOffset : map.getZoom();
                            setView.call(map, center, newMapZoom, NO_ANIMATION );
                        },
                        arguments  : [center, newMainZoom],
                        excludeMap : this
                    });
                }

                //Original function/method
                return setView.apply(this, arguments);
            };
        } (L.Map.prototype.setView),

        /***********************************
        panTo (1)
        ***********************************/
        panTo: function( panTo ) {
            return function(){ 
                //Original function/method
                panTo.apply(this, arguments);
                 if (this._mapSync && this.options.mapSync.enabled)
                    this._mapSync._forEachMap({
                        mapFunction: function( map, arg ){ 
                            panTo.apply(map, arg); 
                        },
                        arguments  : arguments, 
                        excludeMap : this
                    });

                return this;
            };
        } (L.Map.prototype.panTo),

        /***********************************
        panBy (1)
        ***********************************/
        panBy: function( panBy ) { 
            return function ( point ) {

                //Original function/method
                panBy.apply(this, arguments);

                //pan the other maps if the pan is by keyboard
                if (this._mapSync && this.options.mapSync.enabled)
                    this._mapSync._forEachMap({
                        mapFunction: function( map, point, activeMap ){ 
                            point = $.isArray(point) ? L.point(point) : point;
                            var factor = Math.pow( 2, map.getZoom() - activeMap.getZoom() );
                            panBy.call(map, point.multiplyBy( factor )); 
                        },
                        arguments  : [point, this],
                        excludeMap : this
                });
                return this;
            };                    
        } (L.Map.prototype.panBy),

        /***********************************
        _onResize (1)
        ***********************************/
        _onResize: function( _onResize ){ 
            return function (){ 
                //Original function/method
                _onResize.apply(this, arguments);

                if (this._mapSync && this.options.mapSync.enabled)
                    this._mapSync._forEachMap({
                        mapFunction: function( map, arg ){ 
                            _onResize.apply(map, arg); 
                        },
                        arguments  : arguments,
                        excludeMap : this
                    });
                return this;
            };
        } (L.Map.prototype._onResize),

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

            var THIS = this;

            //Draw 'yellow' shadow maps of this in all other maps
            $.each( this._mapSync.list, function( index, otherMap ){
                var $mapShadow = THIS.options.mapSync.shadowList[ index ]; // = the shadow map of THIS in otherMap
                if ( setShadowMap(  otherMap, THIS, $mapShadow ) )
                    THIS.options.mapSync.$map_container.addClass('map-sync-active-dragging');
            });
        
            //Draw 'open yellow' (or 'blue' for main map) shadow maps of all other maps in this
            $.each( this._mapSync.list, function( index, otherMap ){
                var thisIndexInList = THIS.options.mapSync.indexInList,
                    $mapShadow = otherMap.options.mapSync.shadowList[ thisIndexInList ], // = the shadow map of otherMap in THIS
                    otherMapIsMain = THIS._mapSync.mainMap == otherMap;
                    
                if ( setShadowMap(  THIS, otherMap, $mapShadow, otherMapIsMain ? 'MAIN' : 'SECOND' ) ){
                    otherMap.options.mapSync.$map_container.addClass( otherMapIsMain ? 'map-sync-main-dragging' : 'map-sync-second-dragging');

                    //Hide the shadow map if there already is a exact copy
                    for (var i=0; i<index; i++ )
                        if (i != thisIndexInList){
                            var $otherMapShadow = THIS._mapSync.list[i].options.mapSync.shadowList[ thisIndexInList ];
                        
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
                var $mapShadow = this.options.mapSync.shadowList[i]; // = the shadow map of THIS in otherMap
                if ($mapShadow)
                  $mapShadow.removeClass('map-sync-shadow-show map-sync-shadow-main map-sync-shadow-second');
            }
            this.options.mapSync.$map_container.removeClass('map-sync-main-dragging map-sync-active-dragging map-sync-second-dragging' ); 
        }
           
    }); //End of  L.Map.include({...

    
    /***********************************************************
    ************************************************************
    L.MapSync
    ************************************************************
    ***********************************************************/
    L.MapSync = L.Class.extend({
        options: {
            VERSION : "{VERSION}",
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
            else
                //Set no-main on-loaded maps to match the main map
                if (!map._loaded)
                    map.setView(this.mainMap.getCenter(), this.mainMap.getZoom() +  options.zoomOffset, NO_ANIMATION );

            /*********************************************************************************************
            Extend methods to make them update all maps (1)
            *********************************************************************************************/
            map.on('zoomend', function(){
                this.setView( this.getCenter(), this.getZoom());
            });
            
            map.on('dragend', function(){
                if (this.options.mapSync.enabled)
                    this.setView( this.getCenter(), this.getZoom(), NO_ANIMATION);
            });

            //Extend this.dragging._draggable._updatePosition (1)
            map.dragging._draggable._updatePosition = function ( _updatePosition ) {
                return function(){ 
                    //Original function/method
                    _updatePosition.apply(this, arguments);

                    if (map.options.mapSync.enabled)
                        map._mapSync._forEachMap({
                            mapFunction: function( map, _currentDraggable, activeMap ){
                                //Adjust _newPos by the different in zoom between the active (dragging) map and the map
                                var factor = Math.pow( 2, map.getZoom() - activeMap.getZoom() );
                                L.DomUtil.setPosition(
                                    map.dragging._draggable._element, 
                                    _currentDraggable._newPos.multiplyBy( factor ) 
                                );
                                //Fire 'moveend' to force updating the map
                                map.fire('moveend');
                            },
                            arguments : [this, map],
                            excludeMap: map
                        });
                };
            }( L.Draggable.prototype._updatePosition );

            
            /*********************************************************************************************
            Create and add events and overwrite methods to show, hide, and update 'shadow' cursors (2)
            *********************************************************************************************/
            //Create a marker to be used as 'shadow' cursor and move it to a popupPane to make the cursor apear over the popups
            var divIcon = L.divIcon({ className: 'map-sync-cursor-icon', iconSize: iconSize });
            map.options.mapSync.cursorMarker = L.marker( map.getCenter(), {icon: divIcon} ).addTo(map);

            //Create a new pane above everything and move the shadow-cursor from markerPane to this pane
            var cursorContainer = L.DomUtil.create( 'div', 'map-sync-cursor-container', map._mapPane );
            map._panes.markerPane.removeChild( map.options.mapSync.cursorMarker._icon );
            cursorContainer.appendChild( map.options.mapSync.cursorMarker._icon );

            //Events to hide or show the cursor
            map.on('mouseover', function(){ 
                if (this._mapSync)
                    this._mapSync._onMouseOverMap( this ); 
            });
            map.on('mouseout', function(){ 
                if (this._mapSync)
                    this._mapSync._onMouseOutMap ( this ); 
            });
            
            //Events to update/change the position of the cursor
            map.on('mousemove', function( mouseEvent ){
                //Update the position of the shadow-cursor
                if (this._mapSync && this.options.mapSync.enabled)
                    this._mapSync._updateCursor( mouseEvent.latlng );
            });


            // Since no mousemove-event is fired when the map is panned or zoomed using the keyboard,
            // the following workaround is implemented:
            // The shadow-cursor is hidden when zoom or move startes.
            // When zoom or move endes the shadow-cursor is shown again the first time the mouse is moved
            map.on('zoomstart dragstart movestart', function(){
                if (this._mapSync && this.options.mapSync.enabled){
                    this._mapSync.hide();
                }
            });
            map.on('zoomend dragend moveend', function(){
                if (this._mapSync && this.options.mapSync.enabled){
                    this._mapSync._showOnFirstMove();
                }
            });

            //Events to update/change the cursor-type
            //Adds mouseover-event to the maps container and different panes to trace current cursor
            function map_setCursorFromMouseEvent( mouseEvent ){ 
                if (this._mapSync && this.options.mapSync.enabled)
                    this._mapSync._setCursorFromMouseEvent( mouseEvent );
            }
            L.DomEvent.on( map._controlContainer, 'mouseover', map_setCursorFromMouseEvent, map );
            L.DomEvent.on( map._container,        'mouseover', map_setCursorFromMouseEvent, map );
            for (var pane in map._panes)
                L.DomEvent.on( map._panes[pane],  'mouseover', map_setCursorFromMouseEvent, map );


            function map_setCursorFromMapContainer(){
                if (this._mapSync && this.options.mapSync.enabled)
                    this._mapSync._setCursorFromElement( this._container );
            }

            //Change and reset cursor on dragging
            map.on('dragstart', function() {
                map.once('mousemove', map_setCursorFromMapContainer );
            });
            map.on('dragend zoomend moveend boxzoomend', map_setCursorFromMapContainer );
            
            
            /*********************************************************************************************
            Create and add events and overwrite methods to show, hide, and update 
            'shadow' map showing either the active map in other maps or the main map in the active map (3)
            *********************************************************************************************/
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


            //Show 'shadow' map
            map.on('dragstart', function(){
                if (this._mapSync && this.options.mapSync.enabled){
                    this._mapSync._updateShadowMaps( this );
                    this.options.mapSync.dragging = true;
                }
            });

            //Hide 'shadow' map
            map.on('dragend', function(){
                if (this._mapSync && this.options.mapSync.enabled){
                    this._mapSync._hideShadowMaps();
                    this.options.mapSync.dragging = false;
                }
            });

            //Redraw shadows for all no-zoom-sync maps when zoom ends
            map.on('zoomend', function(){
                var THIS = this;
                if (this._mapSync && this.options.mapSync.dragging)
                    $.each( this._mapSync.list, function( index, otherMap ){
                        if (otherMap.options.mapSync.enabled && !otherMap.options.mapSync.zoomEnabled){
                            THIS._mapSync._updateShadowMaps( THIS );
                            return false;
                        }
                    });
            });
            
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
            window.modernizrOn( 'map-sync' ); 
        },

        //**************************************************************************
        //hide();
        hide: function(){
            window.modernizrOff( 'map-sync' );
        },

        //**************************************************************************
        //enable( map );
        enable: function( map ){

            //Check if map has been added to a MapSync-object
            if (map.options && map.options.mapSync && map._mapSync == this){

                //Save original min- and max-zoom
                map.options.mapSync.minZoomOriginal = map.getMinZoom();
                map.options.mapSync.maxZoomOriginal = map.getMaxZoom();

                //Set the maps min- and max-zoom
                map.setView(this.mainMap.getCenter(), this.mainMap.getZoom() + map.options.mapSync.zoomOffset, NO_ANIMATION );
                map._mapSync_adjustMinMaxZoom();

                map.options.mapSync.$map_container.addClass( 'map-sync-enabled' );
                map.options.mapSync.enabled = true;
                //If the cursor is over an enabled map => fire a mouseover to update the other maps
                this._forEachMap({
                    mapFunction: function( map ) { 
                        if (map.options.mapSync.$map_container.hasClass( 'map-sync-mouseover' ) )
                            map._mapSync._onMouseOverMap( map );
                    }
                });


                this._showOnFirstMove();

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
                    map.setView(map.getCenter(), this.mainMap.getZoom() + map.options.mapSync.zoomOffset, NO_ANIMATION );

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
                    map.setView(this.mainMap.getCenter(), this.mainMap.getZoom() + map.options.mapSync.zoomOffset, NO_ANIMATION );
                
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

        //**************************************************************************
        //_updateMaps - Update the center and zoom for all enabled maps to be equal mainMap
        _updateMaps: function(){ 
            this.mainMap.setView( this.mainMap.getCenter(), this.mainMap.getZoom(), NO_ANIMATION );
        },

        //**************************************************************************
        //_updateShadowMaps - set dimentions, color and display for all 'shadow' maps
        // activeMap = the map being dragged
        _updateShadowMaps: function( activeMap ){

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


        //**************************************************************************
        //_updateCursor - Update the latlng-position of all the shadow-cursors
        _updateCursor: function( latlng ){
            this._forEachMap({
                mapFunction : function( map, latlng ) { 
                    map.options.mapSync.cursorMarker.setLatLng( latlng ); 
                },
                arguments   : [latlng],
                inclDisabled: true
            });
        },

        //**************************************************************************
        //_showOnFirstMove - call this.show() the first time the mouse is moved on one of the maps
        _showOnFirstMove: function(){
            var THIS = this;
            this._forEachMap({
                mapFunction : function( map ) { map.once('mousemove', THIS.show, THIS ); },
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
            var iconMargin = iconList[newIconName].iconMargin || [0,0];
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

