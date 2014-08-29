module.exports = function(grunt) {

  var htmlminProd = {
    collapseBooleanAttributes: false,
    collapseWhitespace: true,
    removeAttributeQuotes: true,
    removeComments: true, // Only if you don't use comment directives!
    removeEmptyAttributes: true,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true
  };

  var distDir = 'dist';

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    bower: {
      dev: {
        options: {
          copy: false,
          install: true,
          cleanBowerDir: false
        }
      }
    },
    injector: {
      options: {
        addRootSlash: false
      },
      vendor: {
        options: {
          starttag: '<!-- build:{{ext}} lib/vendor.{{ext}} -->',
          endtag: '<!-- endbuild -->'
        },
        files: {
          'index.html': [ 'bower.json' ]
        }
      },
      deps: {
        options: {
          starttag: '<!-- build:{{ext}} {{ext}}/app.{{ext}} -->',
          endtag: '<!-- endbuild -->'
        },
        files: {
          'index.html': ['components/**/*.js', 'app/**/*.js', 'css/**/*.css']
        }
      }
    },

    clean: ['dist'],
    copy: {
      dist: {
        files: [
          {expand: true, src: ['index.html', 'images/**'], dest: distDir},
          {expand: true, cwd: 'bower_components/font-awesome/', src: 'fonts/**', dest: distDir},
          {expand: true, cwd: 'bower_components/bootstrap-css/', src: 'fonts/**', dest: distDir}
        ]
      }
    },
    useminPrepare: {
      html: 'index.html',
      options: {
        dest: distDir
      }
    },
    ngtemplates:  {
      comp: {
        src: 'views/**/*.html',
        dest: distDir+ '/js/views-tpls.js',
        options: {
          module: 'rtl-demo-app',
          usemin: distDir + '/js/app.js',
          htmlmin: htmlminProd
        }
      },
      views: {
        src: 'components/**/*.html',
        dest: distDir + '/js/components-tpls.js',
        options: {
          module: 'rtl-demo-app',
          usemin: distDir + '/js/app.js',
          htmlmin: htmlminProd
        }
      }
    },
    usemin: {
      html: distDir + '/index.html'
    },
    uglify: {
      options: {
          report: 'min',
          mangle: false
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-bower-task');
  grunt.loadNpmTasks('grunt-injector');
  grunt.loadNpmTasks('grunt-usemin');
  grunt.loadNpmTasks('grunt-angular-templates');

  grunt.registerTask('default', ['bower:dev', 'injector:vendor', 'injector:deps']);
  grunt.registerTask('dist', ['clean', 'copy', 'bower', 'useminPrepare', 'ngtemplates', 'concat', 'cssmin', 'uglify', 'usemin']);
};