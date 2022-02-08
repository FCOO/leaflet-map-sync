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
            VERSION : "{VERSION}",
            iconName: 'hand',
            showShadowCursor: true,
            showOutline     : true,
            inclDisabled    : false,
            maxZoomOffset   : 2,    //Expected max different in zoom-level between any maps. No check is preformed.
            mapIsVisible    : function(/*map*/){ return true; }
        },

        /***********************************************************
        initialize
        ***********************************************************/
        initialize: function(options) {
            L.setOptions(this, options);
            this.list = {};

            //Using maxZoomOffset to calc the number of pixels to round to when panBy is called to ensure that all maps get a hole number of x,y to pan
            this.panBy_RoundTo = Math.pow(2, this.options.maxZoomOffset);

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