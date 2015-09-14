/****************************************************************************
	leaflet-map-sync, Sync two or more maps with regard to center, zoom and pan

	(c) 2015, Niels Holt

	https://github.com/NielsHolt/leaflet-map-sync
	https://github.com/NielsHolt

	Based on the great Leaflet.Sync by Bjorn Sandvik https://github.com/turban/
****************************************************************************/

;(function (L, window, document, undefined) {
	"use strict";
/*
map.dragging.disable();
map.touchZoom.disable();
map.doubleClickZoom.disable();
map.scrollWheelZoom.disable();
map.boxZoom.disable();
map.keyboard.disable();
if (map.tap) map.tap.disable();
document.getElementById('map').style.cursor='default';
turn it on again with

map.dragging.enable();
map.touchZoom.enable();
map.doubleClickZoom.enable();
map.scrollWheelZoom.enable();
map.boxZoom.enable();
map.keyboard.enable();
if (map.tap) map.tap.enable();
document.getElementById('map').style.cursor='grab';

*/

	var mapSync_cursorIcon = L.divIcon({className: 'map-sync-cursor-icon', size:[20,20]});

	var test=0;
	L.MapSync = L.Class.extend({
//		includes: L.Mixin.Events,
    
		options: {
			ratio				: 3/2, 
			allowRotate	: true,
			markerDim		: 20
		},


		
		
		/**************************************************************************************
		initialize
		**************************************************************************************/
		initialize: function(options) {
			L.setOptions(this, options);
			this.list = [];	
			this.lastMouseEvent = {};
	  },
	
		/**************************************************************************************
		add
		**************************************************************************************/
		add: function(map, options) { map.NIELS = test++;
			options = L.Util.extend(options || {}, {});
			this.list.push(map);
			this.masterMap =	this.masterMap ? this.masterMap : map;

			if (map != this.masterMap)
				map.setView(this.masterMap.getCenter(), this.masterMap.getZoom(), {animate:false, reset:true});  
			
			map.mapSync = this;

			//Create a marker to be used as 'shadow' cursor and move it to a new pan: cursorPane
			map.mapSync_cursorMarker = L.marker(map.getCenter(), {icon: mapSync_cursorIcon}).addTo(map);
			map._panes.cursorPane = map._createPane('leaflet-cursor-pane');
			map._panes.markerPane.removeChild( map.mapSync_cursorMarker._icon );
			map._panes.cursorPane.appendChild( map.mapSync_cursorMarker._icon );


			map.on('mouseover', function( /*mouseEvent*/ ){ 
				L.DomUtil.addClass( this.getContainer(), 'map-sync-active'); 
				if (this.mapSync){
					this.mapSync._removeClassFromSibling( 'map-sync-active', this );
					this.mapSync._addClassToSibling( 'map-sync-passive', this );
				}
			});
			map.on('mouseout', function( /*mouseEvent*/ ){ 
				this.mapSync._removeClassFromSibling( 'map-sync-active');
				this.mapSync._removeClassFromSibling( 'map-sync-passive');
			});
			map.on('mousemove', function( mouseEvent ){ 
				this.mapSync._updateMouse( mouseEvent );
			});
      map.on('zoomend', function ( /*event*/ ) {
				this.mapSync._updateView( this );
			});		
		
/* TODO Mulige events to copy:
viewreset					Event					Fired when the map needs to redraw its content (this usually happens on map zoom or load). Very useful for creating custom overlays.
movestart					Event					Fired when the view of the map starts changing (e.g. user starts dragging the map).
move							Event					Fired on any movement of the map view.
moveend						Event					Fired when the view of the map stops changing (e.g. user stopped dragging the map).
dragstart					Event					Fired when the user starts dragging the map.
drag							Event					Fired repeatedly while the user drags the map.
dragend						DragEndEvent	Fired when the user stops dragging the map.
zoomstart					Event					Fired when the map zoom is about to change (e.g. before zoom animation).
zoomend						Event					Fired when the map zoom changes.
zoomlevelschange	Event					Fired when the number of zoomlevels on the map is changed due to adding or removing a layer.
resize						ResizeEvent		Fired when the map is resized.
autopanstart			Event					Fired when the map starts autopanning when opening a popup.
*/
			//Overwrite original methods
			L.extend(map, {
				setView		: function () { this.mapSync._forEachMap( function( map, arg ){ L.Map.prototype.setView.	apply(map, arg); },	arguments );	return this;	},
				panBy			: function () { this.mapSync._forEachMap( function( map, arg ){ L.Map.prototype.panBy.		apply(map, arg); },	arguments );	return this;	},
				_onResize	: function ()	{	this.mapSync._forEachMap( function( map, arg ){ L.Map.prototype._onResize.apply(map, arg); }, arguments );	return this;	},
			});
		
			map.dragging._draggable._updatePosition = function () {
				L.Draggable.prototype._updatePosition.call(this);
				map.mapSync._forEachMap( 
					function( map, activeMap ){ 
						L.DomUtil.setPosition(map.dragging._draggable._element, activeMap._newPos);
						map.fire('moveend');
					},
					this,
					map
				);
			};

		
		
		
		
		
		},

		//_forEachMap
		_forEachMap: function( mapFunction, arg, orgMap ){
			var i, nextMap, nextArg;
			for (i=0; i<this.list.length; i++ ){
				nextMap = this.list[i];
				if (nextMap != orgMap){
					nextArg = [nextMap];
					mapFunction.apply(undefined, nextArg.concat(arg) );
				}
			}
		},

		//_addClassToSibling
		_addClassToSibling: function( className, orgMap){
			this._forEachMap(	function( map, className ) { L.DomUtil.addClass(		map.getContainer(), className); }, [className], orgMap );
		},

		//_removeClassFromSibling
		_removeClassFromSibling: function( className, orgMap){
			this._forEachMap( function( map, className ) { L.DomUtil.removeClass( map.getContainer(), className); }, [className], orgMap );
		},

		//_updateMouse
		_updateMouse: function( mouseEvent ){
			this.lastMouseEvent = mouseEvent || this.lastMouseEvent; 
			this._forEachMap( function( map ) { map.mapSync_cursorMarker._setPos(map.mapSync.lastMouseEvent.layerPoint); });
		},

		//_updateView
		_updateView: function( activeMap ){
			this._forEachMap( 
				function( map, activeMap ) { map.setView(activeMap.getCenter(), activeMap.getZoom(), {animate: false,reset: false}); },
				activeMap,
				activeMap
			);
		},

		
	}); //End of L.MapSync

}(L, this, document));