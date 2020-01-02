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

