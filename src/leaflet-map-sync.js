/****************************************************************************
	leaflet-map-sync, Sync two or more maps with regard to center, zoom and pan

	(c) 2015, Niels Holt

	https://github.com/NielsHolt/leaflet-map-sync
	https://github.com/NielsHolt

	Based on the great Leaflet.Sync by Bjorn Sandvik https://github.com/turban/
****************************************************************************/

;(function (L, window, document, undefined) {
	"use strict";

	var iconSize			= [20,20],
			cursorAnchor	= [0,0],	
			icons = {
				'crosshairs'	: L.divIcon({className: 'map-sync-cursor-icon icon-crosshairs',		iconSize:iconSize}),
				'cross'				: L.divIcon({className: 'map-sync-cursor-icon icon-cross',				iconSize:iconSize}),
				'grab'				: L.divIcon({className: 'map-sync-cursor-icon icon-grab',					iconSize:iconSize}),
				'hand'				: L.divIcon({className: 'map-sync-cursor-icon icon-hand',					iconSize:iconSize}),
				'cursor'			: L.divIcon({className: 'map-sync-cursor-icon icon-cursor',				iconSize:iconSize, iconAnchor: cursorAnchor	}),
				'cursor-full'	: L.divIcon({className: 'map-sync-cursor-icon icon-cursor-full',	iconSize:iconSize, iconAnchor: cursorAnchor	}),
	};
	
	L.MapSync = L.Class.extend({
 
		options: { shadowCursor: 'hand'	},
		
		/**************************************************************************************
		initialize
		**************************************************************************************/
		initialize: function(options) {
			L.setOptions(this, options);
			this.list = [];	
			this.onlySetViewOnTarget = false;
	  },
	
		/**************************************************************************************
		add
		**************************************************************************************/
		add: function(map, options) { 
			options = L.Util.extend(options || {}, {});
			this.list.push(map);

			this.masterMap =	this.masterMap ? this.masterMap : map;
			if (map != this.masterMap)
				map.setView(this.masterMap.getCenter(), this.masterMap.getZoom(), {animate:false, reset:true});  

			map.mapSync = this;

			//Create a marker to be used as 'shadow' cursor and move it to a popupPane to make the cursor apear over the popups
			map.mapSync_cursorMarker = L.marker(map.getCenter()).addTo(map);
			this.options.shadowCursor = icons[this.options.shadowCursor] ? this.options.shadowCursor : 'hand';
			this._changeCursor( this.options.shadowCursor );

			map._panes.markerPane.removeChild( map.mapSync_cursorMarker._icon );
			map._panes.popupPane.appendChild( map.mapSync_cursorMarker._icon );

			map.on('mouseover', function( /*mouseEvent*/ ){ 
				//Add passive-class to all sibling-maps
				this.mapSync._forEachMap(	function(map){ L.DomUtil.addClass( map.getContainer(), 'map-sync-passive'); }, null, this );
			});
			map.on('mouseout', function( /*mouseEvent*/ ){ 
				//Remove passive-class from all maps
				this.mapSync._forEachMap( function(map) { L.DomUtil.removeClass( map.getContainer(), 'map-sync-passive'); } );
			});
			map.on('mousemove', function( mouseEvent ){ 
				//Update the position of the shadow-cursor
				this.mapSync._forEachMap( 
					function( map, latlng ) { map.mapSync_cursorMarker.setLatLng( latlng ); },
					[mouseEvent.latlng]
				);
			});
      
			map.on('zoomend',		function ( /*event*/ )	{ 
				//call setView for all maps (except the target)
				this.mapSync._forEachMap( 
					function( map, activeMap ) { map.setView(activeMap.getCenter(), activeMap.getZoom(), {animate: false,reset: false}); },
					this,
					this
				);
			});		
  
			//Change and reset cursor on dragging
      map.on('dragstart', function (){	this.mapSync._changeCursor( 'grab' ); });		
      map.on('dragend',		function (){ this.mapSync._changeCursor( this.mapSync.options.shadowCursor ); });

			//Overwrite original methods
			L.extend(map, {
				setView		: function () { 
					if (this.mapSync.onlySetViewOnTarget)
						L.Map.prototype.setView.apply(this, arguments );	
					else
						this.mapSync._forEachMap( function( map, arg ){ L.Map.prototype.setView.	apply(map, arg); },	arguments );	
					return this;	
				},
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

			//Special case to catch a box-zoom: Only call setView on the map that was box-zoomed.
			map.boxZoom._finish = function(){
				this._map.mapSync.onlySetViewOnTarget = true;
				L.Map.BoxZoom.prototype._finish.call( this );
			};
			map.on('boxzoomend', function(){ this.mapSync.onlySetViewOnTarget = false; });
		
		},

		//**************************************************************************
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

		//_changeCursor
		_changeCursor: function( iconName ){
			var newIcon = icons[iconName];
			if (newIcon)
				this._forEachMap( function( map, icon ) { map.mapSync_cursorMarker.setIcon( icon ); }, [newIcon] );
		}

	}); //End of L.MapSync
}(L, this, document));

