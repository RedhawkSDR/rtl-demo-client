/**
 *
 * Controllers for the RTL DEMO application.
 *
 **/
angular.module('rtl-demo-controllers', ['rtl-rest'])
    .controller('Overview', ['$scope', 'rtl',
      function($scope, rtl){
        $scope.connected = rtl.connected;
        $scope.survey = rtl.survey;
        $scope.device = rtl.device;
        $scope.processors = rtl.processors;
        $scope.doTune = function(cf) {
            $scope.form.frequency = cf / 1e6;
            $scope.task();
        };

        // Default to the device being ready unless we hear otherwise
        $scope.ready = true;
        $scope.$watch('device.status', function(status) {
          $scope.ready = (status == 'ready');
        });
        $scope.$watch('survey.processing', function(processing) {
          $scope.running = (processing != null);
        });

        $scope.form = {
          frequency: undefined,
          processing: undefined
        };

        $scope.$watch('survey.frequency', function(freq) {
          if(freq && !$scope.form.frequency) {
            $scope.form.frequency = freq;
          }
        });

        $scope.$watch('survey.processing', function(processing) {
          if(!$scope.form.processing) {
            $scope.form.processing = processing ? processing : $scope.processors[0];
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