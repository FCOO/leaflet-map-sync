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

                    if ( map._mapSync_showShadowCursor() &&
                         ((key in this._panKeys) || (key in this._zoomKeys)) ){
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
        //Create a marker to be used as 'shadow' cursor
        this.options.mapSync.cursorMarker =
            L.marker(this.getCenter(), {
                icon: L.divIcon({
                    className : 'map-sync-cursor-icon',
                    iconSize  : ns.iconSize,
                }),
                pane: this.maySyncPaneCursor
            });

        this.options.mapSync.cursorMarker.addTo(this);
    }

    function map_on_zoomstart_cursor(){
        var mapSync = this._mapSync;
        if (this._mapSync_showShadowCursor() && !mapSync.mapWithFirstZoomstart){
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
        if (this._mapSyncOptions())
            this._mapSync._updateCursor( mouseEvent.latlng );
    }

    function map_setCursorFromMouseEvent( mouseEvent ){
        if (this._mapSyncOptions())
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

        if (this._mapSyncOptions())
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

    var maySyncPaneOutline = 'map-sync-outline',
        maySyncPaneCursor  = 'map-sync-cursor',
        mapSyncId          = 0;

    /***********************************************************
    Extentions for L.Map

    New events
        Event-name               Fired in
        ------------------------ ----------------------------------------
        mapsyncenabled           MapSync.enable( map )
        mapsyncdisabled          MapSync.disable( map )
        mapsynczoomoffsetchanged MapSync.setZoomOffset( map, zoomOffset )

    ***********************************************************/
    L.Map.include({
        _mapSync_NO_ANIMATION: {
            animate: false,
            reset  : true,
            disableViewprereset: true
        },

        _addToMapSync: function( mapSync, options ){
            this.$container = this.$container || $(this.getContainer());
            this._mapSync = mapSync;
            this._syncOffsetFns = {};
            this.options = this.options || {};
            this.options.mapSync = options;
            this.options.mapSync.id = 'mapSync' + mapSyncId++;
            this.$container.addClass('map-sync-container');

            //Create a container to contain the outline of other maps as div
            //z-index for div-outlines = just below controls
            this.options.mapSync.zIndex = parseInt($(this._controlContainer).children().css('z-index')) - 20;

            this.$mapSyncOutlineContainer = this.$mapSyncOutlineContainer ||
                $('<div/>')
                    .addClass('map-sync-outline-container show-for-leaflet-map-sync-outline')
                    .appendTo( this.$container );

            //Create pane to contain cursor and outline as rectangles for map.
            if (!this.getPane(maySyncPaneOutline)){
                this.createPane(maySyncPaneOutline);
                this.maySyncPaneOutline = this.getPane(maySyncPaneOutline);
                $(this.maySyncPaneOutline).addClass('show-for-leaflet-map-sync-outline');

                this.createPane(maySyncPaneCursor);
                this.maySyncPaneCursor = this.getPane(maySyncPaneCursor);
                $(this.maySyncPaneCursor).addClass('show-for-leaflet-map-sync-cursor');

                this.whenReady( function(){
                    var zIndex = parseInt($(this.getPanes().popupPane).css('z-index'));
                    //Shadow cursor is palced above popups
                    $(this.maySyncPaneCursor).css('z-index', zIndex + 1 );
                    //Outlines are placed below popups
                    $(this.maySyncPaneOutline).css('z-index', zIndex - 1 );
                }, this);
            }
        },


        _mapSyncSetClass: function(){
            var enabled      = this.options.mapSync.enabled,
                isMainMap    = this.options.mapSync.isMainMap,
                inclDisabled = this._mapSync.options.inclDisabled;
            this.$container
                .toggleClass('map-sync-main',    enabled &&  isMainMap)
                .toggleClass('map-sync-normal',  enabled && !isMainMap)
                .toggleClass('map-sync-visible', !enabled  &&  inclDisabled)
                .toggleClass('map-sync-hidden',  !enabled  && !inclDisabled);
        },

        /***********************************
        _mapSyncOptions(optionsId, testVisible)
        Return true if mapSync[optionsId] is true and check if this is vissible if testVisible == true
        ***********************************/
        _mapSyncOptions: function(optionsId, testVisible){
            var mapSync = this._mapSync,
                result = mapSync &&
                         (!optionsId || mapSync.options[optionsId]);
            if (result)
                result = mapSync.options.inclDisabled || (this.options.mapSync && this.options.mapSync.enabled);
            if (result && testVisible){
                result = mapSync.options.mapIsVisible(this);
            }
            return !!result;
        },

        /***********************************
        _mapSync_showShadowCursor()
        ***********************************/
        _mapSync_showShadowCursor: function(){
            return this._mapSyncOptions('showShadowCursor');
        },

        /***********************************
        _mapSync_showOutline()
        ***********************************/
        _mapSync_showOutline: function(){
            return this._mapSyncOptions('showOutline', true);
        },

        /***********************************
        _mapSync_allOtherMaps(mapFunction, arg, allowDisabled)
        mapFunction = function(map, arg[0], arg[1],..., arg[N])
        Visit all the other enabled amps from this._mapSync and call
        mapFunction(map, arg[0], arg[1],..., arg[N])
        ***********************************/
        _mapSync_allOtherMaps: function (mapFunction, arg, allowDisabled){
            if (this._mapSync && this.options.mapSync && this.options.mapSync.enabled || allowDisabled)
                this._mapSync._forEachMap({
                    mapFunction  : mapFunction,
                    arguments    : arg,
                    excludeMap   : this,
                    inclDisabled : false,
                    allowDisabled: allowDisabled
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

                if (!this.options.mapSync.enabled){
                    this.setMinZoom( this.options.mapSync.minZoomOriginal, true );
                    this.setMaxZoom( this.options.mapSync.maxZoomOriginal, true );
                }
            }
            return this;
        },

        /***********************************
        _mapSync_adjustMinMaxZoom()
        Adjust min- and max-zoom according to min- and max-zoom of the main map
        ***********************************/
        _mapSync_adjustMinMaxZoom: function(){
            var mainMap = this._mapSync.mainMap,
                minZoom = mainMap.getMinZoom() + this.options.mapSync.zoomOffset,
                maxZoom = mainMap.getMaxZoom() + this.options.mapSync.zoomOffset;

            this.options.minZoom = minZoom;
            this.options.maxZoom = maxZoom;

            if (this.options.mapSync.enabled)
                    mainMap._selfSetView();
            else
                //Adjust zoom to new min and max
                if ((this.getZoom() > maxZoom) || (this.getZoom() < minZoom))
                    this.setZoom( Math.min( maxZoom, Math.max( minZoom, this.getZoom() ) ) );
        },

        _selfSetView: function (/*event*/) {
            // reset the map, and let setView synchronize the others.
            this.setView(this.getCenter(), this.getZoom(), this._mapSync_NO_ANIMATION);
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
                    var newMainZoom = zoom - this.options.mapSync.zoomOffset;
                    this._mapSync_allOtherMaps( function(otherMap) {
                        sandwich(otherMap, function (/*obj*/) {
                            var newMapZoom = newMainZoom + otherMap.options.mapSync.zoomOffset;
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

(function ($, L, window/*, document, undefined*/) {
    "use strict";

    /**********************************************************
    Outline reprecent a outline of one map in another map.
    If mapSync.options.inclDisabled => create a rectangle to be used when a map is disabled
    **********************************************************/

    L.MapSync_outline = function(map, insideMap){
        this.map   = map;
        this.mapId = map.options.mapSync.id;

        this.insideMap   = insideMap;
        this.insideMapId = insideMap.options.mapSync.id;

        this.mapSync = map._mapSync;

        /*
        Create the outline for this.map in this.insideMap
        There are two versions:
            div      : used when two maps are enabled => they have the same center and there outlines are div centered on the other map
            rectangle: used when one or both the maps are disabled BUT inclDisabled is set in mapSync => They are rectangles with fixed positions
        */
        this.$div =
            $('<div><div/></div>')
                .addClass('map-sync-outline')
                .css('z-index', this.map.options.mapSync.zIndex )
                .appendTo( this.insideMap.$mapSyncOutlineContainer);

        this.rectangle = null; //Created in update
    };


    L.MapSync_outline.prototype = {

		/*************************************************
        update - Update and show/hide the outline of this.map in this.insideMap
        **************************************************/
		update: function( mapIsActive ){
            var _this           = this,
                map             = this.map,
                //mapId           = this.mapId,
                mapBounds       = this.mapBounds = map.getBounds(),
                insideMap       = this.insideMap,
                //insideMapId     = this.insideMapId,
                insideMapBounds = insideMap.getBounds(),

                mapSync         = map._mapSync,
                mapIsVisible    = mapSync.options.mapIsVisible,

                //maxMargin = 2% of lat-lng-range to avoid two maps almost same size to be outlined inside each other
                maxMargin       = 2 * Math.max(
                                          Math.abs( insideMapBounds.getWest() - insideMapBounds.getEast() ),
                                          Math.abs( insideMapBounds.getSouth() - insideMapBounds.getNorth() )
                                      ) / 100,
                displayAsDiv    = this.displayAsDiv = (map.options.mapSync.enabled && insideMap.options.mapSync.enabled),
                show            = false;


            if (!displayAsDiv && !this.rectangle){
                this.rectangle = L.rectangle(
                    map.getBounds(), {
                        pane     : insideMap.maySyncPaneOutline,
                        className: 'map-sync-outline',
                        noClip   : true
                    });
                this.rectangle.addTo( insideMap );
            }

            if (mapIsVisible(map) && mapIsVisible(insideMap)){
                //Detect if the outline of map is visible in insideMap
                if (displayAsDiv){
                    //Both map and insideMap is enabled => they have same center-position => check if map fits inside insideMap
                    show = !mapBounds.equals(insideMapBounds, maxMargin) && insideMapBounds.contains( mapBounds );
                    if (!show)
                        //If map don't coner insideMap and map is zoomed out compared to outline map => show the outline
                        show =  !mapBounds.contains( insideMapBounds ) && (map.getZoom() > insideMap.getZoom());
                }
                else
                    if (map._mapSync_showOutline() && insideMap._mapSync_showOutline()) {
                        //Show if the outline of map inside insideMap is less that the container of insideMap
                        //Scale the size of map's container to same zoom as insideMap and check if resized container of map is bigger that insideMap's container
                        var zoomScale = map.getZoomScale( insideMap.getZoom(), map.getZoom());
                        show = ( zoomScale*map.$container.height() < insideMap.$container.height() ) ||
                               ( zoomScale*map.$container.width()  < insideMap.$container.width() );
                    }
            }

            if (show){
                if (displayAsDiv){
                    //Adjust outline-div
                    var topLeft     = insideMap.latLngToContainerPoint( mapBounds.getNorthWest() ),
                        bottomRight = insideMap.latLngToContainerPoint( mapBounds.getSouthEast() );
                    this.$div.css({
                        top   : topLeft.y,
                        left  : topLeft.x,
                        width : bottomRight.x - topLeft.x,
                        height: bottomRight.y - topLeft.y
                    });
                }
                else {
                    this.rectangle.setBounds( mapBounds );
                }
            }

            //Set class for outline map container to show/hide outline and border
            this.$element = displayAsDiv ? this.$div : $(this.rectangle._path);
            this.setShow(show);
            this.$element.toggleClass('map-sync-outline-dragging', show && !!mapIsActive);

            //Adjust the style-class to be equal that of the map
            $.each(['map-sync-main', 'map-sync-normal', 'map-sync-visible'], function(index, className){
                _this.$element.toggleClass(className, map.$container.hasClass(className));
            });

            return show;
		},

        setShow: function(show){
            this.show = show;
            this.$element.toggleClass('map-sync-outline-show', show);
        }

	};

    /**********************************************************
    Extend L.Map with methods for may-sync outlines
    **********************************************************/
    L.Map.include({

        /***************************************************
        _mapSync_update_outline
        Draw/updates the outlines of this in other maps and
        the outline of other maps in this.
        *****************************************************/
        _mapSync_update_outline: function( isActiveMap ){
            // The outline of mapA is shown in mapB if
            //    - mapB cover mapA, or
            //    - mapA and mapB overlaps AND mapA.zoom > mapB.zoom
            var _this  = this,
                thisId = this.options.mapSync.id;

            //Draw outline maps of this in all other maps
            var outlineVisibleInOtherMaps = false;
            $.each( _this.options.mapSync.outlineList, function( id, outline ){
                outlineVisibleInOtherMaps = outline.update(isActiveMap) || outlineVisibleInOtherMaps;
            });
            if (outlineVisibleInOtherMaps)
                this.$container.addClass('map-sync-outline');

            //Draw outline maps of all other maps in this
            this._mapSync_allOtherMaps( function( otherMap ){
                otherMap.$container
                    .toggleClass(
                        'map-sync-outline',
                        otherMap.options.mapSync.outlineList[thisId].update(false)
                    );
            }, [], true);


            //Hide duplets outlines (if any) in the map
            var visibleOutlines = [];
            this._mapSync_allOtherMaps(function(otherMap){
                var outline = otherMap.options.mapSync.outlineList[thisId];
                if (outline.show)
                    visibleOutlines.push(outline);
            }, [], true);

            visibleOutlines.sort(function(outline1, outline2){ return (outline1.show?1:0) + (outline2.show?-1:0); });

            for (var map1Index=1; map1Index < visibleOutlines.length; map1Index++){
                var bounds1 = visibleOutlines[map1Index].mapBounds;
                for (var map2Index=0; map2Index < map1Index; map2Index++)
                    //if "map2" is the same as "map1" => hide "map1"
                    if (bounds1.equals( visibleOutlines[map2Index].mapBounds )){
                        visibleOutlines[map1Index].setShow(false);
                        break;
                    }
            }
        }, //end of _mapSync_update_outline

        /***************************************************
        _mapSync_hide_outlines
        Hide all outline of other maps and reset own border etc.
        ***************************************************/
        _mapSync_hide_outlines: function(){
            this.$container.find('.map-sync-outline-show').removeClass('map-sync-outline-show');
            this.$container.removeClass('map-sync-dragging' );
        }

    }); //End of  L.Map.include({...

    //Show outline map
    function map_on_dragstart_outline(){
        var _this = this;

        //Hide the shadow cursors in all maps while dragging
        this._mapSync.options.save_showShadowCursor = this._mapSync.options.save_showShadowCursor || this._mapSync.options.showShadowCursor;
        this._mapSync.disableShadowCursor();

        if (this._mapSync_showOutline()){
            this._mapSync_update_outline(true);
            this.options.mapSync.dragging = true;
            this.$container.addClass('map-sync-dragging');
            window.modernizrOn('leaflet-map-sync-dragging');
            this.rectangleList = [];

            //Create list of rectangles to be updated on drag = visible outlines of this in other maps as rectangles
            this.rectangleList = [];
            $.each(this.options.mapSync.outlineList, function(id, outline){
                if (outline.show && !outline.displayAsDiv)
                    _this.rectangleList.push(outline.rectangle);
            });
        }
    }

    //Only if inclDisabled: Update outline of disabled maps in this or this in other maps if this is disabled
    function map_on_drag_outline(){
        if (this.callDragstartOnNextDrag){
            this.callDragstartOnNextDrag = false;
            this.fire('dragstart');
        }


        if (this._mapSync_showOutline()){
            var bounds = this.getBounds();
            for(var i=0; i<this.rectangleList.length; i++)
                this.rectangleList[i].setBounds(bounds);
        }
    }

    //Hide outlines map
    function map_on_dragend_outline(){
        this.callDragstartOnNextDrag = false;

        //Show the shadow cursors in all maps after dragging
        if (this._mapSync.options.save_showShadowCursor){
            this._mapSync.enableShadowCursor();
            this._mapSync.options.save_showShadowCursor = false;
        }

        if (this._mapSync_showOutline()){
            this._mapSync._hide_outlines();
            this.options.mapSync.dragging = false;
            this.$container.removeClass('map-sync-dragging map-sync-outline');
            window.modernizrOff('leaflet-map-sync-dragging');
            this.rectangleList = [];
        }
    }

    //Redraw outlines for all disabled maps when zoom ends (and inclDisabled == true)
    function map_on_zoomend_outline(){
        //If zoom is made during dragging => reset and update on next drag
        if (this.$container.hasClass('map-sync-dragging')){
            this.fire('dragend');
            this.callDragstartOnNextDrag = true;
        }
    }

    L.Map.include({
        _mapSync_addEvents_outline: function(){
            this.on('dragstart', map_on_dragstart_outline);
            this.on('dragend',   map_on_dragend_outline  );
            if (this._mapSync.options.inclDisabled){
                this.on('drag', map_on_drag_outline);
                this.on('zoomend', map_on_zoomend_outline );
            }
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

    /********************************************************************
    L.MapSync
    ********************************************************************/
    L.MapSync = L.Class.extend({
        options: {
            VERSION : "2.3.2",
            iconName: 'hand',
            showShadowCursor: true,
            showOutline     : true,
            inclDisabled    : false,
            mapIsVisible    : function(/*map*/){ return true; }
        },

        /***********************************************************
        initialize
        ***********************************************************/
        initialize: function(options) {
            L.setOptions(this, options);
            this.list = {};

            this.enableShadowCursor( this.options.showShadowCursor );
            this.enableOutline( this.options.showOutline );
            this.save_showShadowCursor = false;
        },

        /***********************************************************
        add
        ************************************************************/
        add: function(map, options) {
            options = L.Util.extend( {
                enabled       : true,
                zoomOffset    : 0,
            }, options || {});

            map._addToMapSync( this, options );

            this.mainMap = this.mainMap ? this.mainMap : map;
            map.options.mapSync.isMainMap = (map == this.mainMap);

            if (map.options.mapSync.isMainMap){
                //Main map is always on
                map.options.mapSync.enabled = true;
                map.options.mapSync.zoomOffset = 0;
            }
            else
                //Set no-main on-loaded maps to match the main map
                if (!map._loaded)
                    map.setView(this.mainMap.getCenter(), this.mainMap.getZoom() +  options.zoomOffset, map._mapSync_NO_ANIMATION );

            //Add all events for map sync
            map._mapSync_addEvents_map();

            //Add all events for shadow-cursor
            map._mapSync_addEvents_cursor();

            /*********************************************************************************************
            Create and add events and overwrite methods to show, hide, and update outlines
            showing either the active map in other maps or the main map in the active map
            *********************************************************************************************/
            /*
            Create a outline in all other maps and create a outline inside the map for all other maps
            There are two versions:
                div      : used when two maps are enabled => they have the same center and there outlines are div centered on the other map
                rectangle: used when one or both the maps ar disabled BUT inclDisabled is set in mapSync => They are rectangles with fixed positions
            */
            map.options.mapSync.outlineList = {};

            $.each( this.list, function( id, otherMap ){
                //Create div-outline and rectangle-outline of map in the other map
                map.options.mapSync.outlineList[id] = new L.MapSync_outline(map, otherMap);

                //Craete div-outline and rectangle-outline of the other map in map
                otherMap.options.mapSync.outlineList[map.options.mapSync.id] = new L.MapSync_outline(otherMap, map);
            });
            map._mapSync_addEvents_outline();

            //Add to list
            this.list[map.options.mapSync.id] = map;

            //Save original min- and max-zoom
            map.options.mapSync.minZoomOriginal = map.getMinZoom();
            map.options.mapSync.maxZoomOriginal = map.getMaxZoom();

            //Enable the map
            if (options.enabled)
                this.enable( map );
            else
                this.disable( map );

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

                map.options.mapSync.enabled = true;

                //Set the maps min- and max-zoom
                map._mapSync_adjustMinMaxZoom();

                //If the cursor is over an enabled map => fire a mouseover to update the other maps
                this._forEachMap({
                    mapFunction: function( map ) {
                        if (map.$container.hasClass( 'map-sync-mouseover' ) )
                            map._mapSync._onMouseOverMap( map );
                    }
                });
                map._mapSyncSetClass();
                map.fire("mapsyncenabled");
            }
        },

        //**************************************************************************
        //disable( map );
        disable: function( map ){

            //Check if map has been added to a MapSync-object
            if (map.options && map.options.mapSync && (map._mapSync == this) && !map.options.mapSync.isMainMap){

                var mouseIsOver = map.$container.hasClass( 'map-sync-mouseover' );
                //If the cursor is over the enabled map => fire a mouseout to update the other maps
                if (mouseIsOver)
                    this._onMouseOutMap( map );

                map.options.mapSync.enabled = false;

                if (mouseIsOver)
                    this._onMouseOverMap( map );

                //Reset the maps min- and max-zoom
                map.setMinZoom( map.options.mapSync.minZoomOriginal, true );
                map.setMaxZoom( map.options.mapSync.maxZoomOriginal, true );

                map._mapSyncSetClass();
                map.fire("mapsyncdisabled");
            }
        },

        //**************************************************************************
        //setZoomOffset( map, zoomOffset ) - Change the zoom-offset for map relative to main-map
        setZoomOffset: function( map, zoomOffset ){
            if (map.options && map.options.mapSync && (map._mapSync == this) && !map.options.mapSync.isMainMap){
                map.options.mapSync.zoomOffset = zoomOffset;

                map._mapSync_adjustMinMaxZoom();

                map.fire("mapsynczoomoffsetchanged");
            }
        },

        //**************************************************************************
        //remove( map )
        remove: function( map ){
            delete this.list[map.options.mapSync.id];
        },

        //**************************************************************************
        //forEachMap( function( index, map ) ) - Call the function with each map
        forEachMap: function( mapFunction, inclDisabled ){
            $.each(this.list, function(id, map){
                if (inclDisabled || map.options.mapSync.enabled)
                    mapFunction( id, map );
            });
        },

        /**************************************************************************
        _forEachMap( options )
        options =
            function(map) OR
            {mapFunction: function(map, arg), arguments: [], excludeMap: leaflet-map, inclDisabled: boolean } )
        **************************************************************************/
        _forEachMap: function( options ){
            var _this = this,
                nextArg;
            if ($.isFunction(options))
                $.each(this.list, function(index, map){
                    options(map);
                });
            else
                $.each(this.list, function(id, map){
                    if ((map != options.excludeMap) && (map.options.mapSync.enabled || options.inclDisabled || (options.allowDisabled && _this.options.inclDisabled))){
                        nextArg = [map];
                        options.mapFunction.apply(undefined, nextArg.concat(options.arguments || []) );
                    }
                });
        },

        //**************************************************************************
        //_updateMaps - Update the center and zoom for all enabled maps to be equal mainMap
        _updateMaps: function(){
            this.mainMap.setView( this.mainMap.getCenter(), this.mainMap.getZoom() );
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
            map.$container.addClass( 'map-sync-mouseover' );

            //Add passive-class to all sibling-maps
            map._mapSync_allOtherMaps(
                function(otherMap){
                    otherMap.$container.addClass( 'map-sync-passive' );
                },
                null,   //arguments
                true    //allowDisabled
            );
        },

        //**************************************************************************
        //_onMouseOutMap - call when mouseout from map._container
        _onMouseOutMap: function ( map ){
            map.$container.removeClass( 'map-sync-mouseover' );

            //Remove passive-class from all maps
            this._forEachMap({
                mapFunction : function(map){
                    map.$container.removeClass( 'map-sync-passive' );
                },
                inclDisabled: true
            });
        },

        //**************************************************************************
        //_updateCursor - Update the latlng-position of all the shadow-cursors
        _updateCursor: function( latlng ){
            if (latlng)
                this._forEachMap({
                    mapFunction : function( map, latlng ) { map.options.mapSync.cursorMarker.setLatLng( latlng ); },
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