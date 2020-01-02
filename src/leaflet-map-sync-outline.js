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