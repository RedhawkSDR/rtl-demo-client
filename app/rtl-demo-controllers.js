/**
 *
 * Controllers for the RTL DEMO application.
 *
 **/
angular.module('rtl-demo-controllers', ['rtl-rest'])
    .controller('Overview', ['$scope', 'rtl',
      function($scope, rtl){
        $scope.survey = rtl.survey;
        $scope.device = rtl.device;

        $scope.task = function(){
          $scope.survey.task($scope.form['frequency'], $scope.form['processing']);
        };
        $scope.halt = function(){
          $scope.survey.halt();
        };
      }
    ])
;