/**
 *
 * Directives for the RTL DEMO application.
 *
 * Created by Rob Cannon on 8/29/14.
 *
 **/
angular.module('rtl-rest-directives', ['rtl-rest'])
    .directive('deviceStatus', ['rtl',
      function(rtl) {
        return {
          restrict: 'E',
          scope: {},
          templateUrl: 'components/rtl-rest/templates/device-status.html',
          link: function (scope, element, attrs) {
            scope.device = rtl.device;
          }
        };
      }
    ])
;