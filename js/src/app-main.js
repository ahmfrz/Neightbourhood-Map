var date = new Date();

/**
@description Contains all FourSquare API related data
*/
var fSquare = {
    clientID: "YOUR_CLIENT_ID",
    clientSecret: "YOUR_CLIENT_SECRET",
    version: (date.getFullYear().toString() + (date.getMonth() > 9 ? date.getMonth().toString() : '0' + date.getMonth().toString()) + (date.getDate() > 9 ? date.getDate().toString() : '0' + date.getDate().toString())),
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
};

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
};

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
};

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
}

/**
@description Represents a FourSquare venue
@constructor
@param {object} Holds venue related data: name, rating, address, contact, location, type
*/
function Venue(data){
    this.name = data.name;
    this.rating = data.rating ? data.rating : 'Rating not available';
    this.address = data.address;
    this.contact = data.contact || 'Contact info not available';
    this.location = data.location;
    this.type = data.type;
}

/**
@description Main viewmodel for the SPA
@constructor
@param {object} The google map object
*/
function ViewModel(map) {
    var self = this;

    // Define all members
    // Create a new blank array for all the location markers.
    self.markers = ko.observableArray();
    self.markersList = ko.observableArray();
    self.filteredList = ko.observableArray();
    self.fsquareResult = ko.observableArray();
    self.wikiResult = ko.observableArray();
    self.currentFsquareResult = ko.observable();
    self.filterText = ko.observable();
    self.searchbox = ko.observable();
    self.searchFocus = ko.observable(true);
    self.showResultsArea = ko.observable(false);
    self.hideNavInfoArea = ko.observable(true);
    self.navMenuHide = ko.observable(false);
    self.resizeMap = ko.observable(false);
    self.navInfoMarkerText = ko.observable();
    self.navInfoDistanceText = ko.observable();
    self.navInfoDurationText = ko.observable();
    self.fsquareError = ko.observable();
    self.wikiError = ko.observable();
    self.navData = {};
    self.locations = [];
    self.currentMarker = new google.maps.Marker();
    self.directionsDisplay = new google.maps.DirectionsRenderer();

    // Use a single infobubble object instead of creating new object for every click
    self.largeInfoBubble = new InfoBubble();
    self.bounds = new google.maps.LatLngBounds();

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
                place.marker.setVisible(false);
            } else {
                place.marker.setVisible(true);
            }
        });

        return result;
    });

    // Update the boundaries with window size
    google.maps.event.addDomListener(window, 'resize', function() {
        map.fitBounds(self.bounds);
    });

    $('#nav-trigger').on('change', function() {
        if (this.checked) {
            self.showResultsArea(false);
            self.searchFocus(true);
        }
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

        // Close info window if opened
        self.largeInfoBubble.close();
        return true;
    };

    /**
    @description Updates the map
    @param {Place} Place object to make update to
    @param {boolean} The marker's visibility value: True: show marker, False: hide marker
    */
    self.updateMap = function(place, visibilityValue) {
        place.marker.setVisible(visibilityValue);
        place.selected(visibilityValue);
    };

    /**
    @description Filters by selected category
    @param {object} The selected type
    */
    self.filterbyCategory = function(data) {
        self.filteredList.removeAll();
        var boundaries = [];
        self.markersList().forEach(function(place) {
            if (place.type == data) {
                // Update the map
                self.updateMap(place, true);

                // Add LatLng to reset boundaries
                boundaries.push(place.marker.position);
            } else {
                // Hide marker if type does not map
                self.updateMap(place, false);
            }
        });

        // Set boundaries to selected values
        self.setBounds(boundaries);

        // Show the map
        self.showMap();
    };

    /**
    @description Updates the map boundaries
    */
    self.resetBounds = function() {
        // Set boundaries to show all markers
        for (var i = 0; i < self.markersList().length; i++) {
            self.bounds.extend(self.markersList()[i].marker.position);
        }

        map.fitBounds(self.bounds);
    };

    /**
    @description Hides all markers from the map
    */
    self.hideMarkers = function() {
        self.markersList().forEach(function(place) {
            self.updateMap(place, false);
        });
    };

    /**
    @description Shows all markers on the map
    */
    self.showMarkers = function() {
        // Remove all filters
        self.filteredList.removeAll();
        self.markersList().forEach(function(place) {
            self.updateMap(place, true);
        });

        // Reset boundaries to show all markers
        self.resetBounds();
    };

    /**
    @description Shows more information
    */
    self.showInfo = function() {
        self.hideNavInfo();
    };

    /**
    @description Deletes marker from the map
    @param {Place} The corresponding place object
    */
    self.deleteMarker = function(place) {
        self.updateMap(place, false);
        place.marker.setMap(null);
        self.removeFilter(place.marker.title);
        self.markersList.remove(place);
    };

    /**
    @description Hides third party api results area
    */
    self.hideResults = function() {
        self.showResultsArea(false);
    };

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
        self.navMenuHide(false);
        self.resizeMap(false);
        self.hideNavInfoArea(true);
    };

    /**
    @description Toggles clicked marker
    @param {Place} The corresponding place object
    @param {boolean} Returns true to update checkbox
    */
    self.toggleMarker = function(data) {
        if (data.selected()) {
            self.updateMap(data, false);
        } else {
            self.updateMap(data, true);
        }

        return true;
    };

    /**
    @description Adds filter value to filters list
    */
    self.addFilter = function() {
        // Get the value from UI
        var title = self.filterText();

        // Check if the value is valid
        if (self.filteredList().indexOf(title) < 0 && self.checkMarkerExists(title) == false) {
            // Add to filteredlist
            self.filteredList.push(title);

            // Reset the filter textbox
            self.filterText('');

            // Reload markers
            self.filterMarkers();
        }
    };

    /**
    @description Removes filter from the map
    @param {string} The title of the filter
    */
    self.removeFilter = function(data) {
        // Remove marker
        self.filteredList.remove(data);

        // Reload markers
        self.filterMarkers();
    };

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
                    self.updateMap(self.markersList()[index], true);
                    boundaries.push(self.markersList()[index].marker.position);
                }
            }
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
            for (var index = 0; index < boundaries.length; index++) {
                self.bounds.extend(boundaries[index]);
            }

            map.fitBounds(self.bounds);
        }
    };

    /**
    @description Shows the nav info
    */
    self.showNavInfo = function() {
        self.navMenuHide(true);
        self.resizeMap(true);
        self.hideNavInfoArea(false);
        self.navInfoMarkerText('Total Markers [' + self.markersList().length + ']');
        if (self.navData.navInfo != undefined) {
            self.navInfoDistanceText('Total Distance: ' + self.navData.navInfo.distance);
            self.navInfoDurationText('Total Duration: ' + self.navData.navInfo.duration);
        }else{
            self.navInfoDistanceText('');
            self.navInfoDurationText('');
        }
    };

    self.cancelNavigation = function(){
        self.directionsDisplay.setMap(null);
        self.showMarkers();
        self.showMap();
        $('.cancel-nav').removeClass('cancel-visible');

        // Clear nav data object to reset info area
        self.navData.navInfo = undefined;
    }

    /**
    @description Shows navigation
    @param {LatLng} The origin
    @param {LatLng} The destination
    @param {string} The travel mode
    */
    self.navigate = function(origin, destination, mode) {
        self.hideMarkers();
        var directionService = new google.maps.DirectionsService();
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
            };

            // Show the navigation info
            self.showNavInfo();
            if (status == google.maps.DirectionsStatus.OK) {
                // Set directions display
                self.directionsDisplay.setMap(map);
                self.directionsDisplay.setDirections(response);

                $('.cancel-nav').addClass('cancel-visible');
            } else {
                window.alert('Directions request failed due to ' + status);
            }
        });
    };

    /**
    @description Shows Foursquare result of selected venue
    @param {Venue} The current venue
    */
    self.showFsqaureResult = function(venue){
        self.currentFsquareResult(venue);
    }

    /**
    @description Shows navigation to selected Foursquare venue
    @param {Venue} The current venue
    */
    self.navigateToVenue = function(venue){
        self.createMarker(new Place({ name: venue.name, location: venue.location, type: venue.type }));
        self.showMap();
        var current = { lat: self.currentMarker.position.lat(), lng: self.currentMarker.position.lng() };
        self.navigate(current, venue.location, 'driving');
    }

    /**
    @description Gets third party result from Foursquare api
    @param {Marker} The current marker
    */
    self.getFSquareResults = function(currentMarker) {
        // Clear any previous errors
        self.fsquareError('');

        // Get results from FourSquare asynchronously
        $.ajax({
            url: fSquare.get_url(currentMarker.position),
            success: function(data) {
                // Remove old items before adding new items
                self.currentFsquareResult(null);
                self.fsquareResult([]);
                var items = data.response.groups[0].items;
                var results_size = items.length;

                // Parse results
                if (results_size != 0) {
                    for (var index = 0; index < results_size; index++) {
                        self.fsquareResult.push(new Venue({
                            name: items[index].venue.name,
                            rating: items[index].venue.rating,
                            address: items[index].venue.location.address,
                            contact: items[index].venue.contact.formattedPhone,
                            location: { lat: items[index].venue.location.lat, lng: items[index].venue.location.lng },
                            type: items[index].venue.categories[0].name
                        }));
                    }
                } else {
                    self.fsquareError("There are no FourSquare results for this place");
                }
            },
            error: function(data) {
                self.fsquareError("Unable to get foursquare results");
                console.log("Foursquare error details:");
                console.log(data);
            }
        });
    };

    /**
    @description Gets third party result from Wikipedia api
    @param {Marker} The current marker
    */
    self.getWikiArticles = function(currentMarker) {
        // Clear any previous errors
        self.wikiError('');

        // Get results from wikipedia asynchronously
        $.ajax({
            url: wiki.get_url(currentMarker.title),
            dataType: 'jsonp',
            crossDomain: true,
            success: function(data) {
                // Remove previous results
                self.wikiResult([]);

                // Show only 15 results if there are more than 15 results
                var results_size = data[1].length > 15 ? 15 : data[1].length;
                if (results_size != 0) {
                    for (var i = 0; i < results_size; i++) {
                        self.wikiResult.push({link: data[3][i], title: data[1][i]});
                    }
                } else {
                    self.wikiError("There are no wiki articles for this place");
                }
            },
            error: function() {
                self.wikiError("Failed to get wikipedia resources");
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

        self.showResultsArea(true);

        // Get top picks from foursquare
        self.getFSquareResults(currentMarker);

        // Get articles about the area from WikiPedia
        self.getWikiArticles(currentMarker);
    };

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
    };

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


        // Set current marker
        self.currentMarker = marker;
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
        }

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
        // Show the marker
        data.marker.setMap(map);

        // Hide menu
        self.hideMenu();

        // Highlight the marker
        self.animateMarkerWithTimeout(data.marker, 3000, google.maps.Animation.BOUNCE);
        self.populateInfoBubble(data.marker, self.largeInfoBubble);

        // Center in on the marker
        map.setCenter(data.marker.position);
        map.setZoom(17);
    };

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
            map.panTo(this.getPosition());
            self.animateMarkerWithTimeout(this, 2000, google.maps.Animation.BOUNCE);
            self.populateInfoBubble(this, self.largeInfoBubble);
        });
    };

    /**
    @description Hides the menu
    */
    self.hideMenu = function() {
        // Clear search location and hide the menu
        self.searchbox('');
        $('#nav-trigger').prop('checked', false);

        // Close info window if opened
        self.largeInfoBubble.close();
    };

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
}

/**
@description Receives callback from google maps api and applies knockout bindings
*/
function initMap() {
    var map = new google.maps.Map($('#map')[0], { center: { lat: 19.2183, lng: 72.9781 }, zoom: 13 });
    ko.applyBindings(new ViewModel(map));
}

/**
@description Handles error if asynchronous request fails
*/
function mapLoadFailed(){
    window.alert("Map could not be loaded, please try again!");
}