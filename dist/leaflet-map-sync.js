/****************************************************************************
	leaflet-map-sync, Sync two or more maps with regard to center, zoom and pan

	(c) 2015, FCOO

	https://github.com/fcoo/leaflet-map-sync
	https://github.com/fcoo

	Based on the great Leaflet.Sync by Bjorn Sandvik https://github.com/turban/
****************************************************************************/

;(function ($, L, window, document, undefined) {
	"use strict";

  /************************************************************************
  All icon-classes and cooresponding css cursor-styles. * = Not supported
  icon-class	 css-class
  ----------   ---------
  cursor       auto
  pointer      pointer
  cursor       default
  none         none
  *            context-menu
  *            help
  wait         progress, wait
  cell         cell
  crosshair    crosshair
  *            text
  *            vertical-text
  *            alias
  *            copy
  move         move, all-scroll
  not-allowed  no-drop, not-allowed
  initial
  inherit
  ns-resize    ns-resize, n-resize, s-resize
  ew-resize    ew-resize, e-resize, w-resize
  ne-resize    ne-resize, sw-resize, nesw-resize
  nw-resize    nw-resize, se-resize, nwse-resize
  *            col-resize
  *            row-resize
  zoom-in      zoom-in
  zoom-out     zoom-out
  grab         grab, -webkit-grab
  grabbing     grabbing, -webkit-grabbing
  ************************************************************************/

	var iconSize					= [ 22,  26],
			iconList = {
    'cursor'       : { iconMargin: [ -1,  0],	cssClasses: ['auto', 'default', 'initial', 'inherit'] },
		'pointer'      : { iconMargin: [ -7, -2], cssClasses: ['pointer'] },
		'none'         : { iconMargin: [  0,  0], cssClasses: ['none'] },
    'wait'         : { iconMargin: [-11,-10], cssClasses: ['progress', 'wait'] },
		'cell'         : { iconMargin: [-11,-11],	cssClasses: ['cell'] },
		'crosshair'    : { iconMargin: [-11,-10], cssClasses: ['crosshair'] },
    'move'         : { iconMargin: [-11, -9], cssClasses: ['move', 'all-scroll'] },
		'not-allowed'  : { iconMargin: [-11,-11],	cssClasses: ['no-drop', 'not-allowed'] },
		'ns-resize'    : { iconMargin: [-11, -9],	cssClasses: ['ns-resize', 'n-resize', 's-resize'] },
		'ew-resize'    : { iconMargin: [-11, -9],	cssClasses: ['ew-resize', 'e-resize', 'w-resize'] },
		'ne-resize'    : { iconMargin: [-11,-10],	cssClasses: ['ne-resize', 'sw-resize', 'nesw-resize'] },
    'nw-resize'    : { iconMargin: [-11,-10],	cssClasses: ['nw-resize', 'se-resize', 'nwse-resize'] },
    'zoom-in'      : { iconMargin: [-10, -9],	cssClasses: ['zoom-in'] },
    'zoom-out'     : { iconMargin: [-10, -9], cssClasses: ['zoom-out'] },
    'grab'         : { iconMargin: [ -8, -8],	cssClasses: ['grab', '-webkit-grab', '-moz-grab'] },
    'grabbing'     : { iconMargin: [ -8, -8],	cssClasses: ['grabbing', '-webkit-grabbing', '-moz-grabbing'] },
	};


	//Create a fast look-up object
	var cssCursorToIconName = {},
			cssClasses;
	for (var iconName in iconList){
		cssClasses = iconList[iconName].cssClasses;
		for (var i=0; i<cssClasses.length; i++ )
			cssCursorToIconName[ cssClasses[i] ] = iconName;
	}


	var NO_ANIMATION =  {
				animate: false,
				reset: true
			};


	L.MapSync = L.Class.extend({
		options: {
			VERSION	: "0.1.0",
			iconName: 'hand'
		},

		/**************************************************************************************
		initialize
		**************************************************************************************/
		initialize: function(options) {
			L.setOptions(this, options);
			this.list = [];
			this.onlySetViewOnTarget = false;
			this.show();
	  },

		/**************************************************************************************
		add
		**************************************************************************************/
		add: function(map, options) {
			options = L.Util.extend(options || {}, {});
			this.list.push(map);

			this.masterMap =	this.masterMap ? this.masterMap : map;
			if (map != this.masterMap)
				map.setView(this.masterMap.getCenter(), this.masterMap.getZoom(), NO_ANIMATION/*{animate:false, reset:true}*/);

			map.mapSync = this;
			map.options = map.options || {};
			map.options.mapSync = {
				enabled				: false,
				$map_container: $(map._container)
			};


			/*******************************************************
			Add events and overwrite methods to keep maps sync
			********************************************************/

			//Overwrite original methods
			L.extend(map, {
				setView	:
					function( setView ) {
						return function(){
							//Original function/method
							setView.apply(this, arguments);
							if (this.options.mapSync.enabled && !this.mapSync.onlySetViewOnTarget)
								this.mapSync._forEachMap({
									mapFunction	: function( map, arg ){ L.Map.prototype.setView.apply(map, arg); },
									arguments		: arguments,
									excludeMap	: map
								});
							return this;
						};
					} (L.Map.prototype.setView),

				panBy:
					function( panBy ) {
						return function () {
							//Original function/method
							panBy.apply(this, arguments);

							//New extended code
							if (this.options.mapSync.enabled)
								this.mapSync._forEachMap({
									mapFunction	: function( map, arg ){ L.Map.prototype.panBy.apply(map, arg); },
									arguments		: arguments,
									excludeMap	: this
							});
							return this;
						};
					} (L.Map.prototype.panBy),

				_onResize	:
					function( _onResize ){
						return function ()	{
							//Original function/method
							_onResize.apply(this, arguments);

							if (this.options.mapSync.enabled)
								this.mapSync._forEachMap({
									mapFunction	: function( map, arg ){ L.Map.prototype._onResize.apply(map, arg); },
									arguments		: arguments,
									excludeMap	: this
								});
							return this;
						};
					} (L.Map.prototype._onResize),


			});

			map.dragging._draggable._updatePosition =
				function ( _updatePosition ) {
					return function(){
						//Original function/method
						_updatePosition.apply(this, arguments);

						if (map.options.mapSync.enabled)
							map.mapSync._forEachMap({
								mapFunction	: function( map, activeMap ){
																L.DomUtil.setPosition(map.dragging._draggable._element, activeMap._newPos);
																map.fire('moveend');
															},
								arguments		: [this],
								excludeMap	: map
						});
					};
				}( L.Draggable.prototype._updatePosition );

			//Special case to catch a box-zoom: Only call setView on the map that was box-zoomed.
			map.boxZoom._finish =
				function( _finish ){
					return function(){
						this._map.mapSync.onlySetViewOnTarget = true;

						//Original function/method
						_finish.apply(this, arguments);
					};
				} ( L.Map.BoxZoom.prototype._finish );


			//Add events
			map.on('boxzoomend', function(){
				this.mapSync.onlySetViewOnTarget = false;
			});

			map.on('zoomend', function( /*event*/ ){
				//call setView for all maps (except the target)
				if (this.options.mapSync.enabled)
					this.mapSync._forEachMap({
						mapFunction	: function( map, activeMap ) { map.setView(activeMap.getCenter(), activeMap.getZoom(), NO_ANIMATION/*{animate: false,reset: false}*/); },
						arguments		: [this],
						excludeMap	: this
				});
			});



			/*******************************************************
			Create and add events and overwrite methods to show, hide,
			and update 'shadow' cursors
			********************************************************/

			//Create a marker to be used as 'shadow' cursor and move it to a popupPane to make the cursor apear over the popups
			var divIcon = L.divIcon({ className: 'map-sync-cursor-icon', iconSize: iconSize });
			map.options.mapSync.cursorMarker = L.marker( map.getCenter(), {icon: divIcon} ).addTo(map);

			//Create a new pane above everything and move the shadow-cursor from markerPane to this pane
			map.options.mapSync.cursorContainer = L.DomUtil.create( 'div', 'map-sync-cursor-container', map._mapPane );

			map._panes.markerPane.removeChild( map.options.mapSync.cursorMarker._icon );
			map.options.mapSync.cursorContainer.appendChild( map.options.mapSync.cursorMarker._icon );


			//Add all events
			var THIS = this;

			//*******************************************************
			//Events to hide or show the cursor
			map.on('mouseover', function(){ THIS._onMouseOverMap( map ); });
			map.on('mouseout',	function(){ THIS._onMouseOutMap ( map ); });



			//*******************************************************
			//Events to update/change the position of the cursor

			map.on('mousemove', function( mouseEvent ){
				//Update the position of the shadow-cursor
				if (map.options.mapSync.enabled)
					//Not used at the moment: map.options.mapSync.containerPoint = mouseEvent.containerPoint;
					map.mapSync._updateCursor( mouseEvent.latlng );
			});

			// Since no mousemove-event is fired when the map is panned or zoomed using the keyboard,
			// the following workaround is implemented:
			// The shadow-cursor is hidden when zoom or move startes.
			// When zoom or move endes the shadow-cursor is shown again the first time the mouse is moved
			map.on('zoomstart movestart', function(){
				if (map.options.mapSync.enabled){
					map.mapSync.hide();
				}
			});
			map.on('zoomend moveend', function(){
				if (map.options.mapSync.enabled){
					map.mapSync._showOnFirstMove();
				}
			});


			//*******************************************************
			//Overwrite map.keyboard._onKeyDown to update cursor on pan by keyboard - NOT USED because it makes the cursor blink
/*
			map.keyboard._onKeyDown =
				function( _onKeyDown ){
					return function(){
						//Original function/method
						_onKeyDown.apply(this, arguments);

						//Find the map with the mouse over (if any)
						var mapWithMouseOver = null;
						map.mapSync._forEachMap({
							mapFunction	: function( map ) { 
								if (map.options.mapSync.$map_container.hasClass( 'map-sync-mouseover' ) )
									mapWithMouseOver = map;
							}
						});
						if (mapWithMouseOver){
							var newLatLng = mapWithMouseOver.containerPointToLatLng(mapWithMouseOver.options.mapSync.containerPoint) ;
							map.mapSync._updateCursor( newLatLng );
  
						}

					};
				} ( L.Map.Keyboard.prototype._onKeyDown );
*/


			//*******************************************************
			//Events to update/change the cursor-type

			//Adds mouseover-event to the maps container and different panes to trace current cursor
			var setCursorFromMouseEvent = function( mouseEvent ){
						if (map.options.mapSync.enabled)
							THIS._setCursorFromMouseEvent( mouseEvent );
					};
			$( map._controlContainer ).on('mouseover', setCursorFromMouseEvent );
			$( map._container ).on('mouseover', setCursorFromMouseEvent );
			for (var pane in map._panes)
				$( map._panes[pane] ).on('mouseover', setCursorFromMouseEvent );


			var setCursorFromMapContainer = function(){
						THIS._setCursorFromElement( map._container );
					};

			//Change and reset cursor on dragging
			map.on('dragstart', function() {
				if (map.options.mapSync.enabled)
				  map.once('mousemove', setCursorFromMapContainer );
			});

			map.on('dragend zoomend moveend boxzoomend', function(){
				if (map.options.mapSync.enabled){
					setCursorFromMapContainer();
				}
			});


			/***********************************************
			Enable the map
			***********************************************/

			this.enable( map );
		},

		//**************************************************************************
		//show();
		show: function(){
			$('html').removeClass('no-map-sync');
			$('html').addClass('map-sync');
		},

		//**************************************************************************
		//hide();
		hide: function(){
			$('html').addClass('no-map-sync');
			$('html').removeClass('map-sync');
		},

		//**************************************************************************
		//enable( map );
		enable: function( map ){
			//Check if map has been added to a MapSync-object
			if (map.options && map.options.mapSync && map.mapSync == this){

				//Find the first (if any) enabled map and sync the map with that map
				var i, nextMap;
				for (i=0; i<this.list.length; i++ ){
					nextMap = this.list[i];
					if ((nextMap != map) && (nextMap.options.mapSync.enabled)){
						map.setView(nextMap.getCenter(), nextMap.getZoom(), NO_ANIMATION/*{animate:false, reset:true}*/);
						break;
					}
				}

				map.options.mapSync.$map_container.addClass( 'map-sync-enabled' );
				map.options.mapSync.enabled = true;

				//If the cursor is over an enabled map => fire a mouseover to update the other maps
				this._forEachMap({
					mapFunction	: function( map ) { 
						if (map.options.mapSync.$map_container.hasClass( 'map-sync-mouseover' ) )
							map.mapSync._onMouseOverMap( map );
					}
				});
	
				this._showOnFirstMove();
			
			
			}
		},

		//**************************************************************************
		//disable( map );
		disable: function( map ){
			//Check if map has been added to a MapSync-object
			if (map.options && map.options.mapSync && map.mapSync == this){

				var mouseIsOver = map.options.mapSync.$map_container.hasClass( 'map-sync-mouseover' );
				//If the cursor is over the enabled map => fire a mouseout to update the other maps
				if (mouseIsOver)
					this._onMouseOutMap( map );
				
				map.options.mapSync.$map_container.removeClass( 'map-sync-enabled' );
				map.options.mapSync.enabled = false;

				if (mouseIsOver)
					this._onMouseOverMap( map );
			
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
		//forEachMap( function( map, index ) ) - Call the function with each map
		forEachMap: function( mapFunction, inclDisabled ){
			for (var i=0; i<this.list.length; i++ ){
				if (inclDisabled || this.list[i].options.mapSync.enabled)
					mapFunction( this.list[i], i );
			}
		},


		//**************************************************************************
		//_forEachMap
		//options = {mapFunction=function(map, arg), arguments: [], excludeMap: leaflet-map, inclDisabled: boolean }
		_forEachMap: function( options ){
			var i, nextMap, nextArg;
			for (i=0; i<this.list.length; i++ ){
				nextMap = this.list[i];
				if ((nextMap != options.excludeMap) && (options.inclDisabled || nextMap.options.mapSync.enabled)){
					nextArg = [nextMap];
					options.mapFunction.apply(undefined, nextArg.concat(options.arguments || []) );
				}
			}
		},


		//**************************************************************************
		//_onMouseOverMap - call when mouseover map._container
		_onMouseOverMap: function ( map ){
			map.options.mapSync.$map_container.addClass( 'map-sync-mouseover' );

			//Add passive-class to all sibling-maps
			if (map.options.mapSync.enabled)
				this._forEachMap({
					mapFunction	: function(map){ map.options.mapSync.$map_container.addClass( 'map-sync-passive' ); },
					excludeMap	: map
			});
		},

		//**************************************************************************
		//_onMouseOutMap - call when mouseout from map._container
		_onMouseOutMap: function ( map ){
			map.options.mapSync.$map_container.removeClass( 'map-sync-mouseover' );

			//Remove passive-class from all maps
			if (map.options.mapSync.enabled)
				this._forEachMap({
					mapFunction	: function(map){ map.options.mapSync.$map_container.removeClass( 'map-sync-passive' ); },
					inclDisabled: true
			});
		},


		//**************************************************************************
		//_updateCursor - Update the latlng-position of all the shadow-cursors
		_updateCursor: function( latlng ){
			this._forEachMap({
				mapFunction	: function( map, latlng ) { map.options.mapSync.cursorMarker.setLatLng( latlng ); },
				arguments		: [latlng],
				inclDisabled: true
			});
		},

		//**************************************************************************
		//_showOnFirstMove - call this.show() the first time the mouse is moved on one of the maps
		_showOnFirstMove: function(){
			var THIS = this;
			this._forEachMap({
				mapFunction	: function( map ) { map.once('mousemove', THIS.show, THIS ); },
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
			this._changeCursor( cssCursorToIconName[ cursor ] || 'default' );
		},

		//**************************************************************************
		//_changeCursor
		_changeCursor: function( newIconName ){
			var iconMargin = iconList[newIconName].iconMargin || [0,0];
			this._forEachMap({
				mapFunction:	function( map, oldIconName, newIconName, iconMargin ) {
												var $icon = $(map.options.mapSync.cursorMarker._icon);
												$icon.removeClass( 'icon-' + oldIconName );
												$icon.addClass( 'icon-' + newIconName );
												$icon.css({ marginLeft: iconMargin[0]+'px', marginTop: iconMargin[1]+'px'});
											},
				arguments		: [this.options.iconName, newIconName, iconMargin],
				inclDisabled: true

			});
			this.options.iconName = newIconName;
		}

	}); //End of L.MapSync

}(jQuery, L, this, document));

