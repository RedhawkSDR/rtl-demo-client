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
        $scope.processors = rtl.processors;

        $scope.form = {
          frequency: undefined,
          processing: undefined
        };

        $scope.$watch('survey.frequency', function(freq) {
          if(freq && !$scope.form.frequency) {
            console.log("Setting Frequency to "+freq);
            $scope.form.frequency = freq;
          }
        });

        $scope.$watch('survey.processing', function(processing) {
          if(!$scope.form.processing) {
            $scope.form.processing = processing ? processing : $scope.processors[0];
            console.log("Setting processing to "+$scope.form.processing);
          }
        });

        $scope.task = function(){
          $scope.survey.task($scope.form['frequency'], $scope.form['processing']);
        };
        $scope.halt = function(){
          $scope.survey.halt();
        };
      }
    ])
;