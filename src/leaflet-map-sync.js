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
            VERSION : "{VERSION}",
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