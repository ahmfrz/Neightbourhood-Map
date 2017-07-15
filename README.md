# Neightbourhood-Map
Neighbourhood map with Google Maps API and KnockoutJS

## What is it?
 Neighbourhood map single page application where users can find their favorite places, add markers, filters and have fun

## Features
 * Follows MVC
 * Uses Knockout as organizational framework
 * Uses Google Maps API
 * Uses Foursquare API to get nearby results
 * Uses Wikipedia API to get articles about locality
 * Responsive, supports multiple device sizes from small to big to wide

## Installation steps
 Please follow the steps below:

### Pre-requisites:
 * NodeJS for NPM - https://nodejs.org/en/download/
 * Python - https://www.python.org/downloads/
 * Any text editor for editing the code(Sublime text preferred - https://www.sublimetext.com/download)
 * Developer account on - https://developers.google.com
 * Developer account on  - https://developer.foursquare.com/

### Steps
 1. Download/ Fork(Find steps for forking in 'How to Contribute' section) this repository
 2. Replace 'YOUR_APP_ID' and 'YOUR_CLIENT_SECRET' strings with actual app_id and secret key of your Foursquare app
 3. Run the following commands on command prompt:
      npm install
      grunt
      python -m SimpleHTTPServer
 4. Open your favorite browser and navigate to 'http://localhost:8000/'
 5. Verify that Neighbourhood map webpage is displayed

## Resources

* [JqueryUI accordion documentation](https://jqueryui.com/accordion/)
* [Github flavored markdown reference](https://help.github.com/categories/writing-on-github/)
* [Writing ReadMes](https://github.com/udacity/ud777-writing-readmes/edit/master/README.md)
* [Knockout documentation](http://knockoutjs.com/documentation/introduction.html)
* [Jquery documentation](https://api.jquery.com/)
* [Google Maps API documentation](https://developers.google.com/maps/documentation/)
* [Foursquare documentation](https://developer.foursquare.com/docs/)

## How to Contribute

Find any bugs? Have another feature you think should be included? Contributions are welcome!

First, fork this repository.

![Fork Icon](fork-icon.png)

Next, clone this repository to your desktop to make changes.

```sh
$ git clone {YOUR_REPOSITORY_CLONE_URL}
$ cd folder
```

Once you've pushed changes to your local repository, you can issue a pull request by clicking on the green pull request icon.

![Pull Request Icon](pull-request-icon.png)

## License

The contents of this repository are covered under the [MIT License](LICENSE).
