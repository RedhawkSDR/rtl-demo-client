/**
 *
 * Main Entry point for the RTL DEMO Application.
 *
 * Created by Rob Cannon on 8/29/14.
 **/
angular.module('rtl-demo-app', ['ngRoute', 'rtl-demo-controllers', 'rtl-rest', 'rtl-rest-directives'])
    .config(['$routeProvider',
      function($routeProvider) {
        $routeProvider
            .when('/overview', {
              templateUrl: 'views/overview.html',
              controller: 'Overview'
            })
            .otherwise({
              redirectTo: '/overview'
            });
      }
    ])
;