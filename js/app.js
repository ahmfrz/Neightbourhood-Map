const DATE = new Date();

/**
@description Contains all FourSquare API related data
*/
var fSquare = {
    clientID: "YOUR_CLIENT_ID",
    clientSecret: "YOUR_CLIENT_SECRET",
    version: (DATE.getFullYear().toString() + (DATE.getMonth() > 9 ? DATE.getMonth().toString() : '0'
            + DATE.getMonth().toString()) + (DATE.getDate() > 9 ? DATE.getDate().toString() : '0'
            + DATE.getDate().toString())),
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

/**
@description Contains all Wiki API related data
*/
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

/**
@description Contains locations to be shown when page is loaded
*/
var locations = [{
    name: 'Norita Building',
    location: { lat: 19.1179, lng: 72.9080 },
    type: 'Building'
}, {
    name: 'Viviana Mall',
    location: { lat: 19.2087, lng: 72.9713 },
    type: 'Mall'
}, {
    name: 'Inorbit Mall',
    location: { lat: 19.0657, lng: 73.0012 },
    type: 'Mall'
}, {
    name: 'Hiranandani Garden',
    location: { lat: 19.1154, lng: 72.9091 },
    type: 'Garden'
}, {
    name: 'R-City Mall',
    location: { lat: 19.0997, lng: 72.9164 },
    type: 'Mall'
}];

/**
@description Contains mapping of types and icons for category filters
*/
var typeMap = {
    'building': 'home',
    'mall': 'shopping_cart',
    'garden': 'all_out',
    'cafe': 'local_cafe',
    'hotel': 'hotel',
    'library': 'local_library',
    'store': 'store',
    'theater': 'theaters',
    'city': 'map',
    'restaurant': 'restaurant',
    'establishment': 'home',
    'point_of_interest': 'explore',
    'default': 'view_quilt'
}

/**
@description Represents a place
@constructor
@param {object} Holds place related data: name, location, type
*/
function Place(data) {
    this.name = data.name;
    this.location = data.location;
    this.type = typeMap[data.type.toLowerCase()] == undefined ? typeMap["default"] : typeMap[data.type.toLowerCase()];
    this.marker = null;
    this.selected = ko.observable(true);
};

$('#nav-trigger').on('change', function() {
    if (this.checked) {
        $('.results-container').removeClass('show-results');
        $('.search-box').focus();
    }
});

/**
@description Main viewmodel for the SPA
@constructor
@param {object} The google map object
*/
function ViewModel(map) {
    var self = this;

    // Create a new blank array for all the location markers.
    self.markers = ko.observableArray();
    self.markersList = ko.observableArray();
    self.filteredList = ko.observableArray();
    self.navData = {};
    self.locations = [];

    // Use a single infobubble object instead of creating new object for every click
    self.largeInfoBubble = new InfoBubble();

    // Refresh filter types list everytime markers list changes
    self.typesList = ko.computed(function() {
        var distinct_types = [];
        self.markersList().forEach(function(place) {
            if (distinct_types.indexOf(place.type) < 0) {
                distinct_types.push(place.type);
            }
        });

        return distinct_types;
    });

    // Select all checkbox
    self.allSelected = ko.computed(function() {
        var result = true;
        self.markersList().forEach(function(place) {
            if (place.selected() === false) {
                result = false;
                place.marker.setMap(null);
            } else {
                place.marker.setMap(map);
            }
        });

        return result;
    });

    /**
    @description Handler for Select all
    @returns {boolean} True to show selected checkbox
    */
    self.selectAll = function() {
        var all = self.allSelected();
        ko.utils.arrayForEach(self.markersList(), function(place) {
            place.selected(!all);
        });

        return true;
    };

    /**
    @description Updates the map
    @param {Place} Place object to make update to
    @param {object} The map value: null or map
    @param {boolean} True: selected, False: not selected
    */
    self.updateMap = function(place, mapValue, selectedValue) {
        place.marker.setMap(mapValue);
        place.selected(selectedValue);
    }

    /**
    @description Filters by selected category
    @param {object} The selected type
    */
    self.filterbyCategory = function(data) {
        var boundaries = [];
        self.markersList().forEach(function(place) {
            if (place.type == data) {
                // Update the map
                self.updateMap(place, map, true);

                // Add LatLng to reset boundaries
                boundaries.push(place.marker.position);
            } else {
                // Hide marker if type does not map
                self.updateMap(place, null, false);
            }
        });

        // Set boundaries to selected values
        self.setBounds(boundaries);

        // Show the map
        self.showMap();
    }

    /**
    @description Updates the map boundaries
    */
    self.resetBounds = function() {
        // Set boundaries to show all markers
        var bounds = new google.maps.LatLngBounds();
        for (var i = 0; i < self.markersList().length; i++) {
            bounds.extend(self.markersList()[i].marker.position);
        }

        map.fitBounds(bounds);
    };

    /**
    @description Hides all markers from the map
    */
    self.hideMarkers = function() {
        self.markersList().forEach(function(place) {
            self.updateMap(place, null, false);
        });
    }

    /**
    @description Shows all markers on the map
    */
    self.showMarkers = function() {
        // Remove all filters
        self.filteredList.removeAll();
        self.markersList().forEach(function(place) {
            self.updateMap(place, map, true)
        });

        // Reset boundaries to show all markers
        self.resetBounds();
    };

    /**
    @description Shows more information
    */
    self.showInfo = function() {
        self.hideNavInfo();
    }

    /**
    @description Deletes marker from the map
    @param {Place} The corresponding place object
    */
    self.deleteMarker = function(place) {
        self.updateMap(place, null, false);
        self.removeFilter(place.marker.title);
        self.markersList.remove(place);
    }

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

    /**
    @description Hides third party api results area
    */
    self.hideResults = function() {
        $('.results-container').removeClass('show-results');
    }

    /**
    @description Shows the map
    @param {Place} The corresponding place object
    */
    self.showMap = function() {
        self.hideMenu();
        self.hideResults();
        self.hideNavInfo();
        self.largeInfoBubble.close();
    };

    /**
    @description Hide navigation info area
    */
    self.hideNavInfo = function() {
        $('label[for="nav-trigger"]').removeClass('nav-menu-hide');
        $('#map').removeClass('resize-map');
        $('.nav-info p').empty();
        $('.nav-info').addClass('hide-nav-info');
    };

    /**
    @description Toggles clicked marker
    @param {Place} The corresponding place object
    @param {boolean} Returns true to update checkbox
    */
    self.toggleMarker = function(data) {
        if (data.selected()) {
            self.updateMap(data, null, false);

        } else {
            self.updateMap(data, map, true);
        }

        return true;
    };

    // TODO : REMOVE THIS IF NOT USED
    // $filterValue = $('.filter-container .search-box');
    // $filterValue.bind('input', function() {
    //     var title = $filterValue[0].value;
    //     if (self.filteredList().indexOf(title) < 0 && self.checkMarkerExists(title) == false) {
    //         self.filteredList.push(title);
    //     $filterValue.val('');
    //     }
    // });

    /**
    @description Adds filter value to filters list
    */
    self.addFilter = function() {
        // Get the value from UI
        $filterValue = $('.filter-container .search-box');
        var title = $filterValue[0].value;

        // Check if the value is valid
        if (self.filteredList().indexOf(title) < 0 && self.checkMarkerExists(title) == false) {
            // Add to filteredlist
            self.filteredList.push(title);

            // Reset the filter textbox
            $filterValue.val('');
        }
    };

    /**
    @description Removes filter from the map
    @param {string} The title of the filter
    */
    self.removeFilter = function(data) {
        self.filteredList.remove(data);
    }

    /**
    @description Shows all filtered markers on the map
    */
    self.showFilteredMarkers = function() {
        var boundaries = [];

        // Show each filtered marker on map
        self.filteredList().forEach(function(title) {
            for (var index = 0; index < self.markersList().length; index++) {
                // Show filtered markers
                if (self.markersList()[index].marker.title == title) {
                    self.updateMap(self.markersList()[index], map, true);
                    boundaries.push(self.markersList()[index].marker.position);
                }
            };
        });

        // Re-adjust the boundaries
        self.setBounds(boundaries);
    };

    /**
    @description Filters markers
    */
    self.filterMarkers = function() {
        // Hide all markers
        self.hideMarkers();

        // Show filtered markers
        self.showFilteredMarkers();

        // Show the map
        self.showMap();
    };

    /**
    @description Sets boundaries
    @param {List} List of latlng to set map bounds to
    */
    self.setBounds = function(boundaries) {
        // Check if there is any latlng in the list
        if (boundaries.length > 0) {
            var bounds = new google.maps.LatLngBounds();
            for (var index = 0; index < boundaries.length; index++) {
                bounds.extend(boundaries[index]);
            }

            map.fitBounds(bounds);
        }
    }

    /**
    @description Shows the nav info
    */
    self.showNavInfo = function() {
        $('label[for="nav-trigger"]').addClass('nav-menu-hide');
        $('#map').addClass('resize-map');
        $('.nav-info').removeClass('hide-nav-info');
        $nav_para = $('.nav-info p');
        $nav_para.empty();
        if (self.navData.navInfo != undefined) {
            $nav_para.append('<span><b>Total Distance:</b> ' + self.navData.navInfo.distance + '</span>');
            $nav_para.append('</br><span><b>Total Duration:</b> ' + self.navData.navInfo.duration + '</span>');
        } else {
            $nav_para.append('<span>Total Markers [' + self.markersList().length + ']');
        }
    };

    /**
    @description Shows navigation
    @param {LatLng} The origin
    @param {LatLng} The destination
    @param {string} The travel mode
    */
    self.navigate = function(origin, destination, mode) {
        self.hideMarkers();
        var directionService = new google.maps.DirectionsService;
        directionService.route({
            origin: origin,
            destination: destination,
            travelMode: google.maps.TravelMode[mode.toUpperCase()]
        }, function(response, status) {
            self.navData = {
                navInfo: {
                    distance: response.routes[0].legs[0].distance.text,
                    duration: response.routes[0].legs[0].duration.text
                }
            }

            // Show the navigation info
            self.showNavInfo();
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

                    // Clear nav data object to reset info area
                    self.navData.navInfo = undefined;
                });
            } else {
                window.alert('Directions request failed due to ' + status);
            }
        });
    };

    /**
    @description Gets third party result from Foursquare api
    @param {Marker} The current marker
    */
    self.getFSquareResults = function(currentMarker) {
        // Set timer to check if the request failed
        var fsquareTimeout = setTimeout(function() {
            $('.fsquare').prepend("<span>Failed to get FourSquare resources</span>");
        }, 8000);

        // Get results from FourSquare asynchronously
        $.ajax({
            url: fSquare.get_url(currentMarker.position),
            success: function(data) {
                // Clear the timer
                clearTimeout(fsquareTimeout);
                $fsquare_items = $('.fsquare-items');
                $fsquare_item = $('.fsquare-items li:last-child');

                // Remove old items before adding new items
                $fsquare_items.empty();
                $('.fsquare-details p').empty();
                $('.fsquare-details div').empty();
                var items = data.response.groups[0].items;
                var results_size = items.length;

                // Parse results
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
                                    self.createMarker(new Place({ name: name, location: location, type: itemCopy.venue.categories[0].name }));
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

    /**
    @description Gets third party result from Wikipedia api
    @param {Marker} The current marker
    */
    self.getWikiArticles = function(currentMarker) {
        // Set timer to check if the request failed
        var wikiTimeout = setTimeout(function() {
            $('.wiki').text("Failed to get wikipedia resources");
        }, 8000);

        // Get results from wikipedia asynchronously
        $.ajax({
            url: wiki.get_url(currentMarker.title),
            dataType: 'jsonp',
            crossDomain: true,
            success: function(data) {
                // Clear the timer
                clearTimeout(wikiTimeout);
                $wiki_items = $('.wiki-items');
                $wiki_items.empty();

                // Show only 15 results if there are more than 15 results
                var results_size = data[1].length > 15 ? 15 : data[1].length;
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

    /**
    @description Shows the third party results area
    @param {Marker} The current marker
    */
    self.showResults = function(currentMarker) {
        self.hideMenu();
        $('#accordion').accordion({
            autoHeight: true,
            heightStyle: "fill",
            collapsible: true,
            active: false
        });

        $('.results-container').addClass('show-results');

        // Get top picks from foursquare
        self.getFSquareResults(currentMarker);

        // Get articles about the area from WikiPedia
        self.getWikiArticles(currentMarker);
    }

    /**
    @description Creates a new marker icon
    @param {COLOR} The color of the marker
    @returns {MarkerImage} The customized marker
    */
    self.makeMarkerIcon = function(markerColor) {
        // The icon will be 21 px wide by 34 high, have an origin
        // of 0, 0 and be anchored at 10, 34)
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

    /**
    @description Populates the info bubble
    @param {Marker} The corresponding marker
    @param {InfoBubble} The infobubble to populate
    */
    self.populateInfoBubble = function(marker, infoBubble) {
        // Clear the infobubble content to give apis
        // time to load.
        infoBubble.setContent('');

        // Create content for infobubble
        var infoContent = document.createElement('div');
        $(infoContent).append('<h1 id="info-heading"></h1>');
        $(infoContent).append('<div id="pano"></div>');
        $(infoContent).append('<div id="moreInfo"></div>');
        infoBubble.setContent(infoContent);
        infoBubble.marker = marker;

        // Make sure the marker property is
        // cleared if the infobubble is closed.
        infoBubble.addListener('click', function() {
            infoBubble.marker = null;
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
                $(infoContent.children[0]).html(marker.title);
                var panoOptions = {
                    position: nearStreetViewLocation,
                    pov: {
                        heading: heading,
                        pitch: 10
                    }
                };

                var panorama = new google.maps.StreetViewPanorama(
                    $(infoContent.children[1])[0], panoOptions);
            } else {
                $(infoContent.children[0]).html(marker.title);
                $(infoContent.children[1]).html("No StreetView found");
            }
        };

        // Use streetview service to get the closest streetview image within
        // 50 meters of the markers position
        streetView.getPanoramaByLocation(marker.position,
            radius, getStreetView);

        // Open the infobubble on the correct marker.
        infoBubble.open(map, marker);
        $(infoContent.children[2]).append('<button class="moreInfo-button">More Info</button>');
        $(infoContent.children[2]).on('click', function(event) {
            self.showResults(marker);
            event.stopPropagation();
        });
    };

    /**
    @description Animates marker icon with timeout
    @param {Marker} The marker to animate
    @param {number} The timeout
    @param {Animation} The animation
    */
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

    /**
    @description Shows marker
    @param {Place} The place containing the marker
    */
    self.showMarker = function(data) {
        data.marker.setMap(map);
        self.hideMenu();
        self.animateMarkerWithTimeout(data.marker, 3000, google.maps.Animation.BOUNCE);
        map.setCenter(data.marker.position);
        map.setZoom(17);
    }

    /**
    @description Checks if marker to be added already exists on the map
    @param {String} The marker title
    */
    self.checkMarkerExists = function(title) {
        for (var i = 0; i < self.markersList().length; i++) {
            if (self.markersList()[i].marker.title === title) {
                return false;
            }
        }
    };

    /**
    @description Creates a new marker for the given place
    @param {Place} The place to add marker to
    */
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
        self.markersList.push(place);

        // Two event listeners - one for mouseover, one for mouseout,
        // to change the colors back and forth.
        place.marker.addListener('mouseover', function() {
            this.setIcon(self.highlightedIcon);
        });
        place.marker.addListener('mouseout', function() {
            this.setIcon(self.defaultIcon);
        });

        // Create an onclick event to open the large
        // infobubble at each marker.
        place.marker.addListener('click', function() {
            self.animateMarkerWithTimeout(this, 2000, google.maps.Animation.BOUNCE);
            self.populateInfoBubble(this, self.largeInfoBubble);
        });
    };

    /**
    @description Hides the menu
    */
    self.hideMenu = function() {
        // Clear search location and hide the menu
        $('.search-box').val('');
        $('#nav-trigger').prop('checked', false);

        // Close info window if opened
        self.largeInfoBubble.close();
    }

    /**
    @description Initializes map when the page is loaded
    */
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

        // Add marker to the map when button is clicked
        self.addMarker = function() {
            var geocoder = new google.maps.Geocoder();
            var place = autoComplete.getPlace();

            // Make sure the address isn't blank.
            if (place === undefined || place === '') {
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
                            type: place.address_components[0].types[place.address_components[0].types.length - 1]
                        }));

                        self.hideMenu();
                        self.resetBounds();
                    } else {
                        window.alert('We could not find that location - try entering a more' +
                            ' specific place.');
                    }
                });
            }
        };

        // Set map boundaries to show all markers
        self.resetBounds();
    };

    // Call initialize to display initial locations
    self.initialize();
};

/**
@description Receives callback from google maps api and applies knockout bindings
*/
function initMap() {
    var map = new google.maps.Map($('#map')[0], { center: { lat: 19.2183, lng: 72.9781 }, zoom: 13 });
    ko.applyBindings(new ViewModel(map));
};
