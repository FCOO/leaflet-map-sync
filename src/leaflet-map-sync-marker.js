/****************************************************************************
    leaflet-map-sync-marker,

    Adjusting L.Marker to work with map-sync
****************************************************************************/

(function ($, L/*, window, document, undefined*/) {
    "use strict";



    /********************************************************************


    ********************************************************************/
    L.Marker.prototype.options.autoPanSpeed = 8;
    L.Marker.include({

        initialize: function( initialize ) {
            return function () {

                //Original function/method
                initialize.apply(this, arguments);

                if (this.options.draggable)
                    this.on('dragend', this._syncOnDragend);

            };
        } (L.Marker.prototype.initialize),


        _syncOnDragend: function(){
            var map = this._map;
            if (map && map._mapSync)
                map._selfSetView();
        },
/*
        addTo: function( addTo ) {
            return function () {

                //Original function/method
                return addTo.apply(this, arguments);
            };
        } (L.Marker.prototype.addTo),
*/


    });

/*
                this._mapSync_allOtherMaps(
                    function( otherMap, thisMap, center ){
                        //otherMap._resetView(center, otherMap.getZoom());
                    },
                    [this, this.getCenter()]
                );

*/

}(jQuery, L, this, document));

