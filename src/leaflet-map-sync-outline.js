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