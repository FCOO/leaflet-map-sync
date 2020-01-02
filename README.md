# leaflet-map-sync
>


## Description
Sync two or more maps with regard to center, zoom and pan.


- When the cursor is over one of the maps a 'shadow cursor' is shown in the other maps.
    The shape of the 'shadow cursor' is (almost) the same as the cursor over the main map
- When one of the maps are being dragged a 'shadow' of the dragged map are shown in the other maps, and a 'shadow' of the other maps are shown in the dragged map 
- The first map added is the *main* map. The other maps can have a fixed `zoomOffset` making the different between the zoom of map and the main map constant

Based on the great [Leaflet.Sync](https://github.com/turban/Leaflet.Sync) by [Bjorn Sandvik](https://github.com/turban/)

## Installation
### bower
`bower install https://github.com/FCOO/leaflet-map-sync.git --save`

## Demo
http://FCOO.github.io/leaflet-map-sync/demo/ 

## Usage
	var mapSync = new L.MapSync({
            showOutline     : true, //or false
            showShadowCursor: true  //or false

        });
	mapSync.add(map);
	mapSync.add(map2, {zoomoffset: +2 });
	mapSync.add(map3, {zoomOffset: -2 /*TODO, zoomEnabled: false*/ });

### Methods

	MapSync.add( map, options  ); //Adds map to the sync	

	MapSync.forEachMap( function( map, index ) ); //Call the function for each map
	MapSync.remove( map ); 	//Remove the map from the sync

	MapSync.enable( map );	//Enables the map to the sync
	MapSync.disable( map );	//Disables the map from the sync

	//TODO: MapSync.enableZoom( map );	//Enables the map to the sync
	//TODO: MapSync.disableZoom( map );	//Disables the map from the sync

    MapSync.setZoomOffset( map, zoomOffset ); //Change the offset in zoom between map and the main map

	MapSync.enableShadowCursor(on); //Show the shadow-cursor
	MapSync.disableShadowCursor();  //Hide the shadow-cursor

	MapSync.enableOutline(on); //Show the outline of the other maps when dragging a map
	MapSync.disableOutline();  //Hide the outline of the other maps when dragging a map
        


### `options`
| Option | Type | Default | Description |
| :--: | :--: | :-----: | --- |
| `enabled` | `Boolean` | `true` | If `true` the map will be synchronized. |
| `zoomEnabled` | `Boolean` | `true` | If `true` the zoom of the map will be synchronized with the main map using `options.zoomOffset`. |
| `zoomOffset` | `Number` | `0` | The different in zoom-level between tha main map and the map.<br> `zoomOffset` > 0 means that the map will be zoom more in than the main map |

### Events
The following events are fired on the map:

`"mapsyncenabled"`: when `MapSync.enable( map )` is called
`"mapsyncdisabled"`: when `MapSync.disable( map )` is called
`"mapsynczoomenabled"`: when `MapSync.enableZoom( map )` is called
`"mapsynczoomdisabled"`: when `MapSync.disableZoom( map )` is called
`"mapsynczoomoffsetchanged"`: when `MapSync.setZoomOffset( map, zoomOffset )` is called

### Properties 
When a map is added to a `MapSync` it will get the following new properties

    map._mapSync; //The MapSync-object
    map.options.mapSync; //The options given in add( map, options )

## Copyright and License
This plugin is licensed under the [MIT license](https://github.com/FCOO/leaflet-map-sync/LICENSE).

Copyright (c) 2015 [FCOO](https://github.com/FCOO)

## Contact information

NielsHolt nho@fcoo.dk


## Credits and acknowledgements

[Leaflet.Sync](https://github.com/turban/Leaflet.Sync) by [Bjorn Sandvik](https://github.com/turban/)


