

<script type="text/javascript" src="https://maps.googleapis.com/maps/api/js?key=AIzaSyDBLUIsyilp_QWqXyR0OAT5BqJbSq9fRBg&libraries=places"></script>

var map;
var service;
var infowindow;

 var searchBox = new google.maps.places.SearchBox(
   document.getElementById('places-search'));
   //searchbox to execute a place search


function initialize() {
  var boston = new google.maps.LatLng(42.3601,71.0589);

  map = new google.maps.Map(document.getElementById('map'), {
      center: boston,
      zoom: 15
    });

  var request = {
    location: boston,
    radius: '500',
    query: document.getElementById('places-search').value //place
  };

  service = new google.maps.places.PlacesService(map);
  service.textSearch(request, callback);
}

function callback(results, status) {
  if (status == google.maps.places.PlacesServiceStatus.OK) {
    for (var i = 0; i < results.length; i++) {
      var place = results[i];
      createMarker(results[i]);
    }
  }
}




/*
import React from "react"
import { compose, withProps } from "recompose"
import { withScriptjs, withGoogleMap, GoogleMap, Marker } from "react-google-maps"

const MyMapComponent = compose(
  withProps({
    googleMapURL: "https://maps.googleapis.com/maps/api/js?key=AIzaSyDBLUIsyilp_QWqXyR0OAT5BqJbSq9fRBg&libraries=geometry,drawing,places",
    loadingElement: <div style={{ height: `100%` }} />,
    containerElement: <div style={{ height: `600px` }} />,
    mapElement: <div style={{ height: `100%` }} />,
  }),
  withScriptjs,
  withGoogleMap
)((props) =>
  <GoogleMap
    defaultZoom={8}
    defaultCenter={{ lat: 42.3601, lng: 71.0589 }}
  >
  </GoogleMap>
);


export class Map extends React.PureComponent {

  render() {
    return (
      <MyMapComponent
      />
    )
  }
}
*/