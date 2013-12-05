var version = "0.0.1";

module.exports = function(grunt) {
  grunt.initConfig({
    clean: {
      copy: "dist/*"
    },
    copy: {
      main: {
        files: [{
          expand: true,
          cwd: 'src/',
          src: ['css/**', 'demo/**', 'images/**', 'lib/**'],
          dest: 'dist/',
          filter: 'isFile'
        }, ]
      },
    },
    concat: {
      dist: {
        src: ['src/js/head.js', 'src/js/util.js', 'src/js/editor.js', 'src/js/control.js', 'src/js/tool.js', 'src/js/jquery.textae.js', 'src/js/main.js', 'src/js/tail.js'],
        dest: 'dist/js/lib-textae-' + version + '.js',
      }
    },
    jshint: {
      files: ['Gruntfile.js', 'src/js/*.js'],
      options: {
        ignores: ['src/js/head.js', 'src/js/tail.js']
      }
    },
    qunit: {
      all: 'test/src/util.html',
    },
    watch: {
      javascript: {
        files: ['Gruntfile.js', 'src/js/*.js'],
        tasks: ['jshint']
      },
      static_files: {
        files: ['src/index.html', 'src/js/*.js', 'src/css/*.css'],
        options: {
          livereload: true
        }
      },
    },
    connect: {
      developmentServer: {
        options: {
          middleware: function(connect, options) {
            return [connect.static(options.base),
              function(req, res) {
                if (req.method === "POST") {
                  // concat recieved data.
                  var fullBody = '';
                  req.on('data', function(chunk) {
                    fullBody += chunk.toString();
                  });

                  req.on('end', function() {
                    var decodedBody = require('querystring').parse(fullBody); // decode to object.
                    require("fs").writeFile(req.url.substr(1) + ".dev_data", decodedBody.annotations); // url as saved filename.
                    res.end();
                  });
                } else {
                  res.statusCode = 404;
                  res.end();
                }
              }];
          },
        },
      }
    },
  });

  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-qunit');
  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.registerTask('dist', ['jshint', 'qunit', 'clean', 'concat', 'copy']);
  grunt.registerTask('dev', ['connect', 'watch']);
};