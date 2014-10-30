/**
 * Created by rpcanno on 10/22/14.
 */
angular.module('redhawk-audio-directives', [])
  .directive('streamingAudio', [
    function(){
      return {
        restrict: 'E',
        scope: {
          url: "="
        },
        templateUrl: 'components/redhawk-audio/templates/stream.html',
        link: function (scope, element, attrs) {
        }
      };
    }
  ])
;