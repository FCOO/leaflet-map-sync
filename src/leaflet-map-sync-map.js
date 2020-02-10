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
        },
        maySyncPaneOutline = 'map-sync-outline',
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
        _mapSyncOptions(optionsId, testSelfEnabled)
        Return true if mapSync[optionsId] is true and
        check for this.options.mapSync.enabled if testSelfEnabled == true
        ***********************************/
        _mapSyncOptions: function(optionsId, testSelfEnabled){
            var mapSync = this._mapSync,
                result = mapSync &&
                         (!optionsId || mapSync.options[optionsId]);
            if (result && testSelfEnabled)
                result = mapSync.options.inclDisabled || (this.options.mapSync && this.options.mapSync.enabled);
            return !!result;
        },

        /***********************************
        _mapSync_showShadowCursor()
        ***********************************/
        _mapSync_showShadowCursor: function(){
            return this._mapSyncOptions('showShadowCursor', true);
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
        _mapSync_setMinMaxZoom()
        Adjust min- and max-zoom according to min- and max-zoom of the main map
        ***********************************/
        _mapSync_adjustMinMaxZoom: function(){
            this.setMinZoom( this._mapSync.mainMap.getMinZoom() + this.options.mapSync.zoomOffset );
            this.setMaxZoom( this._mapSync.mainMap.getMaxZoom() + this.options.mapSync.zoomOffset );
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