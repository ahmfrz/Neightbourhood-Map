var INFOWINDOW_CONTENT = '<div><h1 id="info-heading"></h1></hr></div><div id="pano"></div><div id="moreInfo-button"></div>';
var date = new Date();

var fSquare = {
    clientID: "YOUR_CLIENT_ID",
    clientSecret: "YOUR_CLIENT_SECRET",
    version: date.getFullYear().toString() + (date.getMonth() > 9 ? date.getMonth().toString() : '0' + date.getMonth().toString()) + (date.getDate() > 9 ? date.getDate().toString() : '0' + date.getDate().toString()),
    base_url: "https://api.foursquare.com/v2/venues/explore?",
    format_LatLng: function(latLng) {
        return latLng.lat() + "," + latLng.lng();
    },
    get_url: function(latLng) {
        return this.base_url + $.param({
            'll': this.format_LatLng(latLng),
            'section': 'topPicks',
            'limit': '5',
            'radius': '2500',
            'client_id': this.clientID,
            'client_secret': this.clientSecret,
            'v': this.version
        });
    }
}

var wiki = {
    base_url: "https://en.wikipedia.org/w/api.php?",
    get_url: function(title) {
        return this.base_url + $.param({
            'action': 'opensearch',
            'search': title,
            'format': 'json'
        });
    }
}

// Locations model
var locations = [{
    name: 'Norita Building',
    location: { lat: 19.1179, lng: 72.9080 }
}, {
    name: 'Viviana Mall',
    location: { lat: 19.2087, lng: 72.9713 }
}, {
    name: 'Inorbit Mall',
    location: { lat: 19.0657, lng: 73.0012 }
}, {
    name: 'Hiranandani Garden',
    location: { lat: 19.1154, lng: 72.9091 }
}, {
    name: 'R-City Mall',
    location: { lat: 19.0997, lng: 72.9164 }
}];

function Place(data) {
    this.name = data.name;
    this.location = data.location;
    this.marker = null;
};

$('#nav-trigger').on('change', function() {
    if (this.checked) {
        $('.results-container').removeClass('show-results');
        $('.search-box').focus();
    }
});

function ViewModel(map) {
    var self = this;

    // Create a new blank array for all the location markers.
    self.markers = ko.observableArray();
    self.locations = [];
    self.largeInfoWindow = new google.maps.InfoWindow();

    // This function resets the boundaries
    self.resetBounds = function() {
        // Set boundaries to show all markers
        var bounds = new google.maps.LatLngBounds();
        for (var i = 0; i < self.markers().length; i++) {
            bounds.extend(self.markers()[i].position);
        }

        map.fitBounds(bounds);
    };

    self.hideMarkers = function() {
        self.markers().forEach(function(marker) {
            marker.setMap(null);
        });
    }

    self.showMarkers = function() {
        self.markers().forEach(function(marker) {
            marker.setMap(map);
        });

        self.resetBounds();
    };

    // TODO : Remove this method if not used
    // self.reverseGeocode = function(latLng){
    //     var geocodeService = new google.maps.Geocoder();
    //     geocodeService.geocode({
    //         latLng: latLng,
    //     }, function(response, status){
    //         if(status == google.maps.GeocoderStatus.OK){
    //             console.log(response[0].formatted_address);
    //             return response[0].formatted_address;
    //         }
    //     });
    // };

    self.hideResults = function() {
        $('.results-container').removeClass('show-results');
    }

    self.showMap = function() {
        self.hideMenu();
        self.hideResults();
        self.hideNavInfo();
        self.largeInfoWindow.close();
    };

    self.hideNavInfo = function() {
        $('#map').removeClass('resize-map');
        $('.nav-info p').empty();
        $('.nav-info').addClass('hide-nav-info');
    };

    // TODO : Remove this method if not used
    //     self.setBounds = function(from, to){
    //         var bounds = new google.maps.LatLngBounds();
    //         bounds.extend(from);
    //         bounds.extend(to);
    //         map.fitBounds(bounds);
    //     }

    self.showNavInfo = function(response) {
        $('#map').addClass('resize-map');
        $('.nav-info').removeClass('hide-nav-info');
        $nav_para = $('.nav-info p');
        $nav_para.empty();
        $nav_para.append('<span><b>Total Distance:</b> ' + response.routes[0].legs[0].distance.text + '</span>');
        $nav_para.append('</br><span><b>Total Duration:</b> ' + response.routes[0].legs[0].duration.text + '</span>');
    };

    self.navigate = function(origin, destination, mode) {
        self.hideMarkers();
        var directionService = new google.maps.DirectionsService;
        directionService.route({
            origin: origin,
            destination: destination,
            travelMode: google.maps.TravelMode[mode.toUpperCase()]
        }, function(response, status) {
            self.showNavInfo(response);
            if (status == google.maps.DirectionsStatus.OK) {
                var directionsDisplay = new google.maps.DirectionsRenderer({
                    map: map,
                    directions: response,
                    draggable: true,
                });

                $('.cancel-nav').addClass('cancel-visible');
                $('#navigation-cancel, .cancel-nav').on('click', function() {
                    directionsDisplay.setMap(null);
                    self.showMarkers();
                    self.showMap();
                    $('.cancel-nav').removeClass('cancel-visible');
                });
            } else {
                window.alert('Directions request failed due to ' + status);
            }
        });
    };

    self.getFSquareResults = function(currentMarker) {
        var fsquareTimeout = setTimeout(function() {
            $('.fsquare').prepend("<span>Failed to get FourSquare resources</span>");
        }, 8000);

        $.ajax({
            url: fSquare.get_url(currentMarker.position),
            success: function(data) {
                clearTimeout(fsquareTimeout);
                $fsquare_items = $('.fsquare-items');
                $fsquare_item = $('.fsquare-items li:last-child');

                // Remove old items before adding new items
                $fsquare_items.empty();
                $('.fsquare-details p').empty();
                $('.fsquare-details div').empty();
                var items = data.response.groups[0].items;
                var results_size = items.length;
                if (results_size != 0) {
                    for (var index = 0; index < results_size; index++) {
                        $fsquare_items.append('<li>' + items[index].venue.name + '</li>');
                        $('.fsquare-items li:last-child').on('click', (function(itemCopy) {
                            return function() {
                                $('.fsquare-details p').empty();
                                $('.fsquare-details div').empty();
                                var name = itemCopy.venue.name;
                                $('.fsquare-details p').append('<span><b> ' + name + '</b></span>');
                                $('.fsquare-details p').append('<br/><span><b>Rating:</b> ' + itemCopy.venue.rating + '</span>');
                                $('.fsquare-details p').append('<br/><span><b>Address:</b> ' + itemCopy.venue.location.address + '</span>');
                                $('.fsquare-details p').append('<br/><span><b>Contact:</b> ' + itemCopy.venue.contact.formattedphone + '</span>');
                                $('.fsquare-details div').append('<button class="fsquare-showmap">Navigate</button>');
                                $('.fsquare-showmap').on('click', function() {
                                    var location = { lat: itemCopy.venue.location.lat, lng: itemCopy.venue.location.lng };
                                    self.createMarker(new Place({ name: name, location: location }));
                                    self.showMap();
                                    var current = { lat: currentMarker.position.lat(), lng: currentMarker.position.lng() };
                                    self.navigate(current, location, 'driving');
                                });
                            };
                        })(items[index]));
                    }
                } else {
                    $('.fsquare').prepend("<span>There are no FourSquare results for this place</span>");
                }
            },
            fail: function(data) {
                clearTimeout(fsquareTimeout);
                $('.fsquare').prepend("<span>Unable to get foursquare results</span>");
            }
        });
    }

    self.getWikiArticles = function(currentMarker) {
        var wikiTimeout = setTimeout(function() {
            $('.wiki').text("Failed to get wikipedia resources");
        }, 8000);
        $.ajax({
            url: wiki.get_url(currentMarker.title),
            dataType: 'jsonp',
            crossDomain: true,
            success: function(data) {
                clearTimeout(wikiTimeout);
                $wiki_items = $('.wiki-items');
                $wiki_items.empty();
                var results_size = data[1].length > 5 ? 5 : data[1].length;
                if (results_size != 0) {
                    for (var i = 0; i < results_size; i++) {
                        $('.wiki-items').append("<li class='wiki-links'><a href='" + data[3][i] + "'>" + data[1][i] + "</li>");
                    }
                } else {
                    $('.wiki').prepend("<span>There are no wiki articles for this place</span>");
                }
            },
            fail: function(data) {
                clearTimeout(wikiTimeout);
                $('.wiki').prepend("<span>Failed to get wikipedia resources due to " + data + "</span>");
            }
        });
    };

    self.showResults = function(currentMarker) {
        self.hideMenu();
        $('#accordion').accordion();
        $('.results-container').addClass('show-results');

        // Get five top picks from foursquare
        self.getFSquareResults(currentMarker);

        // Get articles about the area from WikiPedia
        self.getWikiArticles(currentMarker);
    }

    // This function takes in a COLOR, and then creates a new marker
    // icon of that color. The icon will be 21 px wide by 34 high, have an origin
    // of 0, 0 and be anchored at 10, 34).
    self.makeMarkerIcon = function(markerColor) {
        var markerImage = new google.maps.MarkerImage(
            'http://chart.googleapis.com/chart?chst=d_map_spin&chld=1.15|0|' + markerColor +
            '|40|_|%E2%80%A2',
            new google.maps.Size(21, 34),
            new google.maps.Point(0, 0),
            new google.maps.Point(10, 34),
            new google.maps.Size(21, 34));
        return markerImage;
    }

    self.defaultIcon = self.makeMarkerIcon('0091ff');
    self.highlightedIcon = self.makeMarkerIcon('FFFF24');

    self.populateInfoWindow = function(marker, infoWindow) {
        // Clear the infowindow content to give apis
        // time to load.
        infoWindow.setContent('');
        infoWindow.setContent(INFOWINDOW_CONTENT);
        infoWindow.marker = marker;

        // Make sure the marker property is
        // cleared if the infowindow is closed.
        infoWindow.addListener('click', function() {
            infoWindow.marker = null;
        });

        var streetView = new google.maps.StreetViewService();
        var radius = 50;

        // In case the status is OK, which means the pano was found, compute the
        // position of the streetview image, then calculate the heading, then get a
        // panorama from that and set the options
        function getStreetView(data, status) {
            if (status === google.maps.StreetViewStatus.OK) {
                var nearStreetViewLocation = data.location.latLng;
                var heading = google.maps.geometry.spherical.computeHeading(
                    nearStreetViewLocation, marker.position);
                $('#info-heading').html(marker.title);
                var panoOptions = {
                    position: nearStreetViewLocation,
                    pov: {
                        heading: heading,
                        pitch: 10
                    }
                };

                var panorama = new google.maps.StreetViewPanorama(
                    $('#pano')[0], panoOptions);
            } else {
                $('#info-heading').html(marker.title);
                $('#pano').html("No StreetView found");
            }
        };

        // Use streetview service to get the closest streetview image within
        // 50 meters of the markers position
        streetView.getPanoramaByLocation(marker.position,
            radius, getStreetView);

        // Open the infowindow on the correct marker.
        infoWindow.open(map, marker);
        $('#moreInfo-button').append('<button class="moreInfo-button">More Info</button>');
        $('.moreInfo-button').on('click', function(event) {
            self.showResults(marker);
            event.stopPropagation();
        });
    };

    self.animateMarkerWithTimeout = function(marker, timeout, animation) {
        if (marker.getAnimation() !== null) {
            marker.setAnimation(null);
        } else {
            marker.setAnimation(animation);
        }

        marker.setIcon(self.highlightedIcon);

        window.setTimeout(function() {
            marker.setAnimation(null);
            marker.setIcon(self.defaultIcon);
        }, timeout);
    };

    self.showMarker = function(marker) {
        marker.setMap(map);
        self.hideMenu();
        self.animateMarkerWithTimeout(marker, 3000, google.maps.Animation.BOUNCE);
        map.setCenter(marker.position);
        map.setZoom(17);
    }

    // Check if the marker already exists on the map
    self.checkMarkerExists = function(title) {
        for (var i = 0; i < self.markers().length; i++) {
            if (self.markers()[i].title === title) {
                return false;
            }
        }
    };

    self.createMarker = function(place) {
        // Don't add the marker if it already exists
        if (self.checkMarkerExists(place.name) == false) {
            window.alert('Marker already exists for ' + place.name);
            return;
        }

        var markerOptions = {
            map: map,
            position: place.location,
            animation: google.maps.Animation.DROP,
            title: place.name,
            icon: self.defaultIcon,
        };

        place.marker = new google.maps.Marker(markerOptions);
        self.markers.push(place.marker);

        // Two event listeners - one for mouseover, one for mouseout,
        // to change the colors back and forth.
        place.marker.addListener('mouseover', function() {
            this.setIcon(self.highlightedIcon);
        });
        place.marker.addListener('mouseout', function() {
            this.setIcon(self.defaultIcon);
        });

        // Create an onclick event to open the large
        // infowindow at each marker.
        place.marker.addListener('click', function() {
            self.animateMarkerWithTimeout(this, 2000, google.maps.Animation.BOUNCE);
            self.populateInfoWindow(this, self.largeInfoWindow);
        });
    };

    self.hideMenu = function() {
        // Clear search location and hide the menu
        $('.search-box').val('');
        $('#nav-trigger').prop('checked', false);

        // Close info window if opened
        self.largeInfoWindow.close();
    }

    // This function initializes map when page is loaded
    self.initialize = function() {
        // Create a new Place object for every location
        locations.forEach(function(place) {
            self.locations.push(new Place(place));
        });

        // Create marker for every place
        self.locations.forEach(function(place) {
            self.createMarker(place);
        });

        var autoComplete = new google.maps.places.Autocomplete($('.search-box')[0]);

        autoComplete.bindTo('Bounds', map);

        autoComplete.addListener('place_changed', function() {
            var geocoder = new google.maps.Geocoder();
            var place = this.getPlace();
            // Make sure the address isn't blank.
            if (place == '') {
                window.alert('You must enter an area, or address.');
            } else {
                // Geocode the address/area entered to get the center. Then, center the map
                // on it and zoom in
                geocoder.geocode({
                    address: place.formatted_address,
                }, function(results, status) {
                    if (status == google.maps.GeocoderStatus.OK) {
                        var location = results[0].geometry.location;
                        self.createMarker(new Place({
                            name: place.address_components[0].short_name,
                            location: location,
                        }));

                        self.hideMenu();
                        self.resetBounds();
                    } else {
                        window.alert('We could not find that location - try entering a more' +
                            ' specific place.');
                    }
                });
            }
        });

        // Set map boundaries to show all markers
        self.resetBounds();
    };

    // Call initialize to display initial locations
    self.initialize();
};

function initMap() {
    var map = new google.maps.Map($('#map')[0], { center: { lat: 19.2183, lng: 72.9781 }, zoom: 13 });
    ko.applyBindings(new ViewModel(map));
};
