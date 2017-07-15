module.exports = function(grunt){
     /* Load grunt tasks plugin makes sure that all required tasks
    are loaded without the need of 'load npm tasks' */
    require('load-grunt-tasks')(grunt);

    // Read the configuration file
    var config = grunt.file.readYAML('GruntConfig.yaml');
    grunt.initConfig({
        uglify: {
                options: {
                mangle: false
        },
        target:{
            files:[{
                src: [
                config.jsSrcDir + "jquery-3.2.1.min.js",
                config.jsSrcDir + "jquery-ui.js",
                config.jsSrcDir + "knockout-3.4.2.js",
                config.jsSrcDir + "infobubble.js",
                config.jsSrcDir + "app-main.js",
                ],
                dest: config.jsDistDir + 'app.min.js'
            }]
            }
        },
        concat:{
            all:{
                src: [config.cssSrcDir + "*"],
                dest: config.cssSrcDir + 'app.css'
            }
        },
        // Minify css files
        cssmin:{
            target:{
                files:[{
                    src:[config.cssSrcDir + 'app.css'],
                    dest: config.cssDistDir + 'app.min.css',
                    ext: '.min.css'
                }]
            }
        },
        jsdoc : {
            dist : {
                    src: [config.jsSrcDir + 'app-main.js', 'README.md'],
                    options: {
                        destination: 'doc'
                    }
                }
            }
    });

    grunt.registerTask('default',[
        'uglify',
        'concat',
        'cssmin',
        'jsdoc'
        ]);
};