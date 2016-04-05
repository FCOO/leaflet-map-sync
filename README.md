# leaflet-map-sync
>


## Description
Sync two or more maps with regard to center, zoom and pan.
When the cursor is over one of the maps (the `main` map) a 'shadow cursor' is shown in the other maps.
The shape of the 'shadow cursor' is (almost) the same as the cursor over the main map

Based on the great [Leaflet.Sync](https://github.com/turban/Leaflet.Sync) by [Bjorn Sandvik](https://github.com/turban/)

## Installation
### bower
`bower install https://github.com/FCOO/leaflet-map-sync.git --save`

## Demo
http://FCOO.github.io/leaflet-map-sync/demo/ 

## Usage
	var mapSync = new L.MapSync( options );
	mapSync.add(map);
	mapSync.add(map2);
	mapSync.add(map3);

### Methods

	MapSync.add( map ); //Adds map to the sync	
	MapSync.forEachMap( function( map, index ) ); //Call the function wth each map
	MapSync.remove( map ); 	//Remove the map from the sync
	MapSync.disable( map );	//Disables the map from the sync
	MapSync.enable( map );	//Enables the map to the sync
	MapSync.show(): //Show the shadow-cursor
	MapSync.hide(): //Hide the shadow-cursor

## Copyright and License
This plugin is licensed under the [MIT license](https://github.com/FCOO/leaflet-map-sync/LICENSE).

Copyright (c) 2015 [FCOO](https://github.com/FCOO)

## Contact information

NielsHolt nho@fcoo.dk


## Credits and acknowledgements

[Leaflet.Sync](https://github.com/turban/Leaflet.Sync) by [Bjorn Sandvik](https://github.com/turban/)


