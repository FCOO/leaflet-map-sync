/****************************************************************************
    leaflet-map-sync-cursor,

    Creating and updating the 'shadow' cursor
****************************************************************************/

(function ($, L/*, window, document, undefined*/) {
    "use strict";

    L.MapSyncCursor = L.MapSyncCursor || {};
    var ns = L.MapSyncCursor;


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
    ns.iconSize = [22, 26];
    ns.iconList = {
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
    ns.cssCursorToIconName = {};
    for (var iconName in ns.iconList){
        var cssClasses = ns.iconList[iconName].cssClasses;
        for (var i=0; i<cssClasses.length; i++ )
            ns.cssCursorToIconName[ cssClasses[i] ] = iconName;
    }


    //Extend L.Map.Keyboard.prototype._onKeyDown
    L.Map.Keyboard.prototype._onKeyDown =
        function( _onKeyDown ){
            return function(event){
                if (!event.altKey && !event.ctrlKey && !event.metaKey) {
                    var key       = event.keyCode,
                        map       = this._map,
                        mapSync   = map._mapSync;

                    if (
                        mapSync && mapSync.options.showShadowCursor &&
                        map.options.mapSync && map.options.mapSync.enabled &&
                        ((key in this._panKeys) || (key in this._zoomKeys))
                    ){
                        //It is a pan or zoom key on a enabled map and there are shadow-cursors => hide shadow-cursor and show them again in 1000ms if no key is pressed before
                        if (mapSync.timeoutId)
                            window.clearTimeout(mapSync.timeoutId);

                        if (!mapSync.updateAfterKeybourdPanOrZoom){
                            mapSync.updateAfterKeybourdPanOrZoom = true;
                            mapSync.disableShadowCursor();
                            mapSync.options.showShadowCursor = true;
                        }
                    }
                }

                //Original method
                return _onKeyDown.apply(this, arguments);
            };
        }( L.Map.Keyboard.prototype._onKeyDown );

    /********************************************************************
    Events
    function map_on_XX_cursor(){
    ********************************************************************/
    function map_whenReady_cursor(){
        //Create a marker to be used as 'shadow' cursor and move it to a popupPane to make the cursor apear over the popups
        var divIcon = L.divIcon({ className: 'map-sync-cursor-icon', iconSize: ns.iconSize });
        this.options.mapSync.cursorMarker = L.marker( this.getCenter(), {icon: divIcon} ).addTo(this);

        //Create a new pane above everything and move the shadow-cursor from markerPane to this pane
        var cursorContainer = L.DomUtil.create( 'div', 'show-for-leaflet-map-sync-cursor map-sync-cursor-container', this._mapPane );
        this._panes.markerPane.removeChild( this.options.mapSync.cursorMarker._icon );
        cursorContainer.appendChild( this.options.mapSync.cursorMarker._icon );
    }

    function map_on_zoomstart_cursor(){
        var mapSync = this._mapSync;
        if (mapSync && mapSync.options.showShadowCursor && this.options.mapSync && this.options.mapSync.enabled && !mapSync.mapWithFirstZoomstart){
            mapSync.mapWithFirstZoomstart = this;
            mapSync.disableShadowCursor();
        }
    }

    function map_on_zoomend_cursor(){
        var mapSync = this._mapSync;
        if (mapSync && (mapSync.mapWithFirstZoomstart == this)){
            mapSync.mapWithFirstZoomstart = null;
            mapSync.enableShadowCursor();
        }
    }

    function map_on_mouseover_cursor(){
        if (this._mapSync)
            this._mapSync._onMouseOverMap( this );
    }
    function map_on_mouseout_cursor(){
        if (this._mapSync)
            this._mapSync._onMouseOutMap ( this );
    }

    function map_on_mousemove_cursor( mouseEvent ){
        //Update the position of the shadow-cursor
        if (this._mapSync && this.options.mapSync.enabled)
            this._mapSync._updateCursor( mouseEvent.latlng );
    }

    function map_setCursorFromMouseEvent( mouseEvent ){
        if (this._mapSync && this.options.mapSync.enabled)
            this._mapSync._setCursorFromMouseEvent( mouseEvent );
    }

    function map_showShadowCursorAgain(){
        var mapSync = this._mapSync;
        if (mapSync.timeoutId)
            window.clearTimeout(mapSync.timeoutId);
        mapSync.updateAfterKeybourdPanOrZoom = false;
        mapSync.enableShadowCursor();
        this.fire('zoomend');
    }

    function map_setCursorFromMapContainer(){
        var mapSync = this._mapSync;
        if (mapSync && mapSync.updateAfterKeybourdPanOrZoom){
            if (mapSync.timeoutId)
                window.clearTimeout(mapSync.timeoutId);
            mapSync.timeoutId = window.setTimeout( $.proxy(map_showShadowCursorAgain, this), 500);
        }

        if (mapSync && this.options.mapSync.enabled)
            mapSync._setCursorFromElement( this._container );
    }

    L.Map.include({

        _mapSync_addEvents_cursor: function(){
            this.whenReady( map_whenReady_cursor, this);

            //Events to hide or show the cursor
            this.on('mouseover', map_on_mouseover_cursor);
            this.on('mouseout',  map_on_mouseout_cursor);

            this.on('zoomstart', map_on_zoomstart_cursor);
            this.on('zoomend',   map_on_zoomend_cursor);

            //Events to update/change the position of the cursor
            this.on('mouseposition', map_on_mousemove_cursor);

            /*
            Events to update/change the cursor-type
            Adds mouseover-event to the maps container and different panes to trace current cursor
            */
            L.DomEvent.on( this._controlContainer, 'mouseover', map_setCursorFromMouseEvent, this );
            L.DomEvent.on( this._container,        'mouseover', map_setCursorFromMouseEvent, this );
            for (var pane in this._panes)
                L.DomEvent.on( this._panes[pane],  'mouseover', map_setCursorFromMouseEvent, this );

            //Change and reset cursor on dragging
            this.on('dragstart', function() {
                this.once('mouseposition', map_setCursorFromMapContainer, this );
            });
            this.on('dragend zoomend moveend boxzoomend', map_setCursorFromMapContainer, this );

            $('.cursor-div').on('mouseover', $.proxy(map_setCursorFromMouseEvent, this ));
        }
    });

}(jQuery, L, this, document));


;
/****************************************************************************
    leaflet-map-sync-map

    Synchronizing the maps center and zoom

****************************************************************************/

(function ($, L, window, document, undefined) {
    "use strict";

    var NO_ANIMATION = {
        animate: false,
        reset  : true,
        disableViewprereset: true
    };

    /***********************************************************
    Extentions for L.Map

    New events
        Event-name               Fired in
        ------------------------ ----------------------------------------
        mapsyncenabled           MapSync.enable( map )
        mapsyncdisabled          MapSync.disable( map )
  TODO: mapsynczoomenabled       MapSync.enableZoom( map )
  TODO: mapsynczoomdisabled      MapSync.disableZoom( map )
        mapsynczoomoffsetchanged MapSync.setZoomOffset( map, zoomOffset )

    ***********************************************************/
    L.Map.include({

        /***********************************
        _mapSync_allOtherMaps(mapFunction, arg)
        mapFunction = function(map, arg[0], arg[1],..., arg[N])
        Visit all the other enabled amps from this._mapSync and call
        mapFunction(map, arg[0], arg[1],..., arg[N])
        ***********************************/
        _mapSync_allOtherMaps: function (mapFunction, arg){
            if (this._mapSync && this.options.mapSync && this.options.mapSync.enabled)
                this._mapSync._forEachMap({
                    'mapFunction' : mapFunction,
                    'arguments'   : arg,
                    'excludeMap'  : this,
                    'inclDisabled': false
                });
        },

        /***********************************
        setMinZoom, setMaxZoom
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

                if (!this.options.mapSync.enabled/*TODO || this.options.mapSync.zoomEnabled*/){
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


        _selfSetView: function (/*event*/) {
            // reset the map, and let setView synchronize the others.
            this.setView(this.getCenter(), this.getZoom(), NO_ANIMATION);
        },

        _syncOnMoveend: function (event) {
            if (this._syncDragend) {
                // This is 'the moveend' after the dragend.
                // Without inertia, it will be right after,
                // but when inertia is on, we need this to detect that.
                this._syncDragend = false; // before calling setView!
                this._selfSetView(event);

                this._mapSync_allOtherMaps( function(otherMap) { otherMap.fire('moveend'); } );
            }
        },

        _syncOnDragend: function (/*event*/) {
            // It is ugly to have state, but we need it in case of inertia.
            this._syncDragend = true;
        },


        /***********************************
        _tryAnimatedZoom
        Force setView to animate zoom for synced maps
        ***********************************/
        _tryAnimatedZoom: function( _tryAnimatedZoom ) {
            return function(center, zoom, options) {
                if (this._mapSync && this.options.mapSync && this.options.mapSync.enabled && !options)
                    options = {animate: true};

                //Original function/method
                return _tryAnimatedZoom.call(this, center, zoom, options);
            };
        } (L.Map.prototype._tryAnimatedZoom),


        /***********************************
        setView
        ***********************************/
        setView: function( setView ) {
            return function(center, zoom, options, sync){

                //*******************************************
                //Use this sandwich to disable and enable viewprereset around setView call
                function sandwich (obj, fn) {
                    var viewpreresets = [];
                    var doit = options && options.disableViewprereset && obj && obj._events;
                    if (doit) {
                        // The event viewpreresets does an invalidateAll,
                        // that reloads all the tiles.
                        // That causes an annoying flicker.
                        viewpreresets = obj._events.viewprereset;
                        obj._events.viewprereset = [];
                    }
                    var result = fn(obj);
                    if (doit) {
                        // restore viewpreresets event to its previous values
                        obj._events.viewprereset = viewpreresets;
                    }
                    return result;
                }
                //*******************************************

                // Looks better if the other maps 'follow' the active one,
                // so call this before _syncMaps
                var result = sandwich(this, function (obj) {
                    return setView.call(obj, center, zoom, options);
                });

                if (!sync && this._mapSync && this.options.mapSync.enabled) {
                    var newMainZoom = zoom - this.options.mapSync.zoomOffset; //TODO var newMainZoom = this.options.mapSync.zoomEnabled ? zoom - this.options.mapSync.zoomOffset : null;
                    this._mapSync_allOtherMaps( function(otherMap) {
                        sandwich(otherMap, function (/*obj*/) {
                            var newMapZoom = newMainZoom + otherMap.options.mapSync.zoomOffset; //TODO var newMapZoom = (newMainZoom !== null) && otherMap.options.mapSync.zoomEnabled ? newMainZoom + otherMap.options.mapSync.zoomOffset : otherMap.getZoom();
                            return otherMap.setView(center, newMapZoom, options, true );
                        });
                    });
                }
                return result;
            };
        } (L.Map.prototype.setView),

        /***********************************
        panBy
        ***********************************/
        panBy: function( panBy ) {
            return function ( point/*, options */) {
                //pan the other maps if the pan is by keyboard
                this._mapSync_allOtherMaps(
                    function( otherMap, point, thisMap ){
                        point = $.isArray(point) ? L.point(point) : point;
                        var factor = Math.pow( 2, otherMap.getZoom() - thisMap.getZoom() );
                        panBy.call(otherMap, point.multiplyBy( factor ));
                    },
                    [point, this]
                );

                this._mapSync_allOtherMaps(
                    function( otherMap, point, thisMap ){
                        point = $.isArray(point) ? L.point(point) : point;
                        var factor = Math.pow( 2, otherMap.getZoom() - thisMap.getZoom() );
                        panBy.call(otherMap, point.multiplyBy( factor ));
                    },
                    [point, this]
                );

                //Original function/method
                return panBy.apply(this, arguments);
            };
        } (L.Map.prototype.panBy),

        /***********************************
        _onResize
        ***********************************/
        _onResize: function( _onResize ){
            return function (){
                this._mapSync_allOtherMaps(
                    function( otherMap, arg ){ _onResize.apply(otherMap, arg); },
                    arguments
                );

                //Original function/method
                return _onResize.apply(this, arguments);
            };
        } (L.Map.prototype._onResize),

        _stop: function ( _stop) {
            return function (){
                _stop.call(this);
                this._mapSync_allOtherMaps( function(otherMap){ _stop.call(otherMap); } );
            };
        } (L.Map.prototype._stop),

    /********************************************************************
    _mapSync_addEvents_map - Add all events and adjust dragging function
    ********************************************************************/
        _mapSync_addEvents_map: function(){

            this.on('resize zoomend', this._selfSetView);
            this.on('moveend',        this._syncOnMoveend);
            this.on('dragend',        this._syncOnDragend);

            //Extend this.dragging._draggable._updatePosition
            var _this = this;
            this.dragging._draggable._updatePosition = function ( _updatePosition ) {
                return function(){
                    //Original function/method
                    _updatePosition.apply(this, arguments);

                    _this._mapSync_allOtherMaps(
                        function( otherMap, _currentDraggable, thisMap ){
                            //Adjust _newPos by the different in zoom between the active (dragging) map and the map
                            var factor = Math.pow( 2, otherMap.getZoom() - thisMap.getZoom() );
                            L.DomUtil.setPosition(
                                otherMap.dragging._draggable._element,
                                _currentDraggable._newPos.multiplyBy( factor )
                            );

                            //Fire 'move' to force updating the map
                            otherMap.fire('move');
                        },
                        [this, _this]
                    );
                };
            }( L.Draggable.prototype._updatePosition );
        }
    }); // L.Map.include({

}(jQuery, L, this, document));
;
/****************************************************************************
    leaflet-map-sync-outline

    Creating and updating the outline of other maps


****************************************************************************/

(function ($, L/*, window, document, undefined*/) {
    "use strict";

    L.Map.include({

        /***********************************
        _mapSync_update_outline
        Draw/updates the outlines of this in other maps and
        the outline of other maps in this.
        If onlyInMap !== null only this' outline in onlyInMap are updated
        ***********************************/
        _mapSync_update_outline: function(){
            // The outline of mapA is shown in mapB if
            //    - mapB cover mapA, or
            //    - mapA and mapB overlaps AND mapA.zoom > mapB.zoom

            //************************************************************************************
            function setOutlineMap( map, outlineMap, $mapOutline, role ){
                var outlineBounds = outlineMap.getBounds(),
                    mapBounds    = map.getBounds(),
                    showOutline   = false;

                if ( map.options.mapSync.enabled && outlineMap.options.mapSync.enabled && (outlineMap != map) && !outlineBounds.equals(mapBounds) ){

                    if (mapBounds.contains( outlineBounds ) )
                        showOutline = true;
                    else {
                        //If Outline map don't coner map and map is zoomed out compared to outline map => show the outline
                        showOutline = !outlineBounds.contains( mapBounds ) && (outlineMap.getZoom() > map.getZoom());
                    }
                    if (showOutline){
                        //Adjust outline-div
                        var topLeft     = map.latLngToContainerPoint( outlineBounds.getNorthWest() ),
                            bottomRight = map.latLngToContainerPoint( outlineBounds.getSouthEast() );
                        $mapOutline.css({
                            top   : topLeft.y,
                            left  : topLeft.x,
                            width : bottomRight.x - topLeft.x,
                            height: bottomRight.y - topLeft.y
                         });
                    }
                }

                //Set class for outline map container to show/hide outline and border
                if ($mapOutline)
                    $mapOutline
                        .toggleClass('map-sync-outline-show',   showOutline)
                        .toggleClass('map-sync-outline-main',   showOutline && (role == 'MAIN')   )
                        .toggleClass('map-sync-outline-second', showOutline && (role == 'SECOND') );

                return showOutline;
            }
            //************************************************************************************

            var _this = this;

            //Draw 'yellow' outline maps of this in all other maps
            $.each( this._mapSync.list, function( index, otherMap ){
                var $mapOutline = _this.options.mapSync.outlineList[ index ]; // = the outline map of _this in otherMap
                if ( setOutlineMap(  otherMap, _this, $mapOutline ) )
                    _this.options.mapSync.$map_container.addClass('map-sync-active-dragging');
            });

            //Draw 'open yellow' (or 'blue' for main map) outline maps of all other maps in this
            $.each( this._mapSync.list, function( index, otherMap ){
                var thisIndexInList = _this.options.mapSync.indexInList,
                    $mapOutline = otherMap.options.mapSync.outlineList[ thisIndexInList ], // = the outline map of otherMap in _this
                    otherMapIsMain = _this._mapSync.mainMap == otherMap;

                if ( setOutlineMap(  _this, otherMap, $mapOutline, otherMapIsMain ? 'MAIN' : 'SECOND' ) ){
                    otherMap.options.mapSync.$map_container.addClass( otherMapIsMain ? 'map-sync-main-dragging' : 'map-sync-second-dragging');

                    //Hide the outline map if there already is a exact copy
                    for (var i=0; i<index; i++ )
                        if (i != thisIndexInList){
                            var $otherMapOutline = _this._mapSync.list[i].options.mapSync.outlineList[ thisIndexInList ];

                            //If the two outlines $mapOutline and $otherMapOutline are equal => hide $mapOutline
                            if (
                                ( $mapOutline.css("left") == $otherMapOutline.css("left") ) &&
                                ( $mapOutline.css("top") == $otherMapOutline.css("top") ) &&
                                ( $mapOutline.css("width") == $otherMapOutline.css("width") ) &&
                                ( $mapOutline.css("height") == $otherMapOutline.css("height") ) &&
                                ( $mapOutline.attr("class") == $otherMapOutline.attr("class") )
                               ){
                                $mapOutline.removeClass('map-sync-outline-show');
                                break;
                            }
                        }
                }
            });

        }, //end of _mapSync_update_outline

        /***********************************
        _mapSync_hide_outlines
        Hide all outline maps in other maps and reset own border etc.
        ***********************************/
        _mapSync_hide_outlines: function(){
            for (var i=0; i<this._mapSync.list.length; i++ ){
                var $mapOutline = this.options.mapSync.outlineList[i]; // = the outline map of _this in otherMap
                if ($mapOutline)
                  $mapOutline.removeClass('map-sync-outline-show map-sync-outline-main map-sync-outline-second');
            }
            this.options.mapSync.$map_container.removeClass('map-sync-main-dragging map-sync-active-dragging map-sync-second-dragging' );
        }

    }); //End of  L.Map.include({...

    //Show outline map
    function map_on_dragstart_outline(){
        if (this._mapSync && this.options.mapSync.enabled){
            this._mapSync._update_outlines( this );
            this.options.mapSync.dragging = true;
        }
    }

    //Hide outlines map
    function map_on_dragend_outline(){
        if (this._mapSync && this.options.mapSync.enabled){
            this._mapSync._update_outlines( this );
            this._mapSync._hide_outlines();
            this.options.mapSync.dragging = false;
        }
    }

    //Redraw outlines for all no-zoom-sync maps when zoom ends
    function map_on_zoomend_outline(){
        var _this = this;
        if (this._mapSync && this.options.mapSync.dragging)
            $.each( this._mapSync.list, function( index, otherMap ){
                if (otherMap.options.mapSync.enabled && !otherMap.options.mapSync.zoomEnabled){
                    _this._mapSync._update_outlines( _this );
                    return false;
                }
            });
    }

    L.Map.include({
        _mapSync_addEvents_outline: function(){
            this.on('dragstart', map_on_dragstart_outline);
            this.on('dragend',   map_on_dragend_outline  );
            this.on('zoomend',   map_on_zoomend_outline  );
        }
    });

}(jQuery, L, this, document));
;
/****************************************************************************
    leaflet-map-sync, Sync two or more maps with regard to center, zoom and pan

    (c) 2015, FCOO

    https://github.com/fcoo/leaflet-map-sync
    https://github.com/fcoo

    Based on the great Leaflet.Sync by Bjorn Sandvik https://github.com/turban/

    There are tree main groups of tasks/actions:
    1: Synchronizing the maps center and zoom
    2: Creating and updating the 'shadow' cursor
    3: Creating and updating the outlines of the other maps

****************************************************************************/

(function ($, L, window, document, undefined) {
    "use strict";

    var NO_ANIMATION = {
            animate: false,
            reset  : true,
            disableViewprereset: true
        };

    /********************************************************************
    L.MapSync
    ********************************************************************/
    L.MapSync = L.Class.extend({
        options: {
            VERSION : "2.0.0",
            iconName: 'hand',
            showShadowCursor: true,
            showOutline     : true
        },

        /***********************************************************
        initialize
        ***********************************************************/
        initialize: function(options) {
            L.setOptions(this, options);
            this.list = [];

            this.enableShadowCursor( this.options.showShadowCursor );
            this.enableOutline( this.options.showOutline );
        },

        /***********************************************************
        add
        ************************************************************/
        add: function(map, options) {
            options = L.Util.extend( {
                enabled       : true,
                zoomOffset    : 0,
                //TODO zoomEnabled   : true,
                $map_container: $(map.getContainer())
            }, options || {});

            map._mapSync = this;
            map._syncOffsetFns = {};
            map.options = map.options || {};
            map.options.mapSync = options;
            map.options.mapSync.$map_container.addClass('map-sync-container');

            this.mainMap = this.mainMap ? this.mainMap : map;
            map.options.mapSync.isMainMap = (map == this.mainMap);

            if (map.options.mapSync.isMainMap){
                //Main map is always on
                map.options.mapSync.enabled = true;
                map.options.mapSync.zoomOffset = 0;
                //TODO map.options.mapSync.zoomEnabled = true;
            }
            else
                //Set no-main on-loaded maps to match the main map
                if (!map._loaded)
                    map.setView(this.mainMap.getCenter(), this.mainMap.getZoom() +  options.zoomOffset, NO_ANIMATION );

            //Add all events for map sync
            map._mapSync_addEvents_map();

            //Add all events for shadow-cursor
            map._mapSync_addEvents_cursor();

            /*********************************************************************************************
            Create and add events and overwrite methods to show, hide, and update outlines
            showing either the active map in other maps or the main map in the active map
            *********************************************************************************************/
            function create_$mapOutline(){
                return $('<div class="show-for-leaflet-map-sync-outline map-sync-outline"><div/></div>');
            }

            //Create the outlines showing either the active map in other maps or the main map in the active map
            map.options.mapSync.$mapOutline = create_$mapOutline();
            map.options.mapSync.$map_container.append( map.options.mapSync.$mapOutline );

            //Create a outline in all other maps and create a outline inside the map for all other maps
            map.options.mapSync.outlineList = [];
            map.options.mapSync.indexInList = this.list.length;
            $.each( this.list, function( index, otherMap ){
                //Create outline of map in the other map
                var $mapOutline = create_$mapOutline();
                otherMap.options.mapSync.$map_container.append( $mapOutline );
                map.options.mapSync.outlineList[ index ] = $mapOutline;

                //Craete outline of the other map in map
                $mapOutline = create_$mapOutline();
                map.options.mapSync.$map_container.append( $mapOutline );
                otherMap.options.mapSync.outlineList[ map.options.mapSync.indexInList ] = $mapOutline;

            });
            map._mapSync_addEvents_outline();

            //Add to list
            this.list.push(map);

            //Enable the map
            if (options.enabled)
                this.enable( map );

            return map;
        }, //end of add


        //**************************************************************************
        //enableShadowCursor();
        enableShadowCursor: function( on ){
            if ( on === undefined )
                on = true;
            this.options.showShadowCursor = !!on;
            window.modernizrToggle('leaflet-map-sync-cursor', this.options.showShadowCursor);
        },

        //disableShadowCursor();
        disableShadowCursor: function(){
            this.enableShadowCursor( false );
        },


        //**************************************************************************
        //enableOutline();
        enableOutline: function( on ){
            if ( on === undefined )
                on = true;
            this.options.showOutline = !!on;
            window.modernizrToggle('leaflet-map-sync-outline', this.options.showOutline);
        },

        //disableOutline();
        disableOutline: function(){
            this.enableOutline( false );
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

                map.fire("mapsyncenabled");
            }
        },

        //**************************************************************************
        //disable( map );
        disable: function( map ){

            //Check if map has been added to a MapSync-object
            if (map.options && map.options.mapSync && (map._mapSync == this) && !map.options.mapSync.isMainMap){

                var mouseIsOver = map.options.mapSync.$map_container.hasClass( 'map-sync-mouseover' );
                //If the cursor is over the enabled map => fire a mouseout to update the other maps
                if (mouseIsOver)
                    this._onMouseOutMap( map );

                map.options.mapSync.$map_container.removeClass( 'map-sync-enabled' );
                map.options.mapSync.enabled = false;

                if (mouseIsOver)
                    this._onMouseOverMap( map );

                //Reset the maps min- and max-zoom
                map.setMinZoom( map.options.mapSync.minZoomOriginal, true );
                map.setMaxZoom( map.options.mapSync.maxZoomOriginal, true );

                map.fire("mapsyncdisabled");
            }
        },

/* TODO
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
*/

        //**************************************************************************
        //setZoomOffset( map, zoomOffset ) - Change the zoom-offset for map relative to main-map
        setZoomOffset: function( map, zoomOffset ){
            if (map.options && map.options.mapSync && (map._mapSync == this) && !map.options.mapSync.isMainMap){
                map.options.mapSync.zoomOffset = zoomOffset;
                map._mapSync_adjustMinMaxZoom();

                if (map.options.mapSync.enabled/*TODO && map.options.mapSync.zoomEnabled*/)
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

        /**************************************************************************
        _forEachMap( options )
        options =
            function(map) OR
            {mapFunction: function(map, arg), arguments: [], excludeMap: leaflet-map, inclDisabled: boolean } )
        **************************************************************************/
        _forEachMap: function( options ){
            var i, nextMap, nextArg;
            if ($.isFunction(options))
                $.each(this.list, function(index, nextMap){ options(nextMap); });
            else
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
            this.mainMap.setView( this.mainMap.getCenter(), this.mainMap.getZoom() );
        },

        //**************************************************************************
        //_update_outlines - set dimentions, color and display for all outlines
        // activeMap = the map being dragged
        _update_outlines: function( activeMap ){

            //Clean up: Hide all outline
            this._hide_outlines();

            //Draw all outline
            activeMap._mapSync_update_outline();

        },

        //**************************************************************************
        //_hide_outlines - hide all outlines of the maps
        _hide_outlines: function(){
            this._forEachMap({
                mapFunction : function(map){
                    map._mapSync_hide_outlines();
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
            map._mapSync_allOtherMaps( function(otherMap){
                otherMap.options.mapSync.$map_container.addClass( 'map-sync-passive' );
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
            if (latlng)
                this._forEachMap({
                    mapFunction : function( map, latlng ) {
                        map.options.mapSync.cursorMarker.setLatLng( latlng );
                    },
                    arguments   : [latlng],
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
            this._changeCursor( L.MapSyncCursor.cssCursorToIconName[ cursor ] || 'default' );
        },

        //**************************************************************************
        //_changeCursor
        _changeCursor: function( newIconName ){
            var iconList = L.MapSyncCursor.iconList;
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