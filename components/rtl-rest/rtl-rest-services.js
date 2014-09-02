/**
 *
 * Services to interact with the RTL DEMO Application.
 *
 * Created by rxc on 8/29/14.
 **/
angular.module('rtl-rest', ['ngResource', 'toastr', 'ngAnimate'])
    .config(function(toastrConfig) {
      angular.extend(toastrConfig, {
        positionClass: 'toast-bottom-right'
      });
    })
    .service('RTLRest', ['$resource',
      function($resource){
        var self = this;
        var url = '/rtl';

        self.survey = $resource(url+'/survey', {}, {
          status: {method: 'GET'},
          task: {method: 'POST'},
          halt: {method: 'DELETE'}
        });

        self.device = $resource(url+'/device', {}, {
          status: {method: 'GET'}
        });

      }
    ])
    .factory('rtl', ['RTLRest', 'toastr',
      function(RTLRest, toastr) {

        var log = {
          info:  function(txt) { console.log('INFO:  '+txt); },
          warn:  function(txt) { console.log('WARN:  '+txt); },
          error: function(txt) { console.log('ERROR: '+txt); }
        };

        var Survey = function() {
          var self = this;
          var frequencyConversion = 1000 * 1000;

          self._update = function(data) {
            if(data.hasOwnProperty('frequency') && data['frequency']){
              data['frequency'] /= frequencyConversion;
            }
            angular.extend(self, data);
          };
          self._load = function() {
            RTLRest.survey.status(function(data){
              self._update(data);
            })
          };
          self._reload = function(){ self._load(); };

          self.task = function(frequency, processing) {
            return RTLRest.survey.task({},
                {
                  frequency: parseFloat(frequency) * frequencyConversion,
                  processing: processing
                }, function(data) {
                  if(data['success']) {
                    self._update(data['status']);
                    toastr.success('Successfully tasked to '+frequency+' and '+processing+'.', 'Task');
                    log.info(JSON.stringify(data));
                  } else {
                    log.error(data['error']);
                    toastr.error(data['error'], 'Task');
                  }
                }, function(resp) {
                  log.error(resp['data']['error']);
                  toastr.error(resp['data']['error'], 'Task');
                }
            );
          };

          self.halt = function() {
            return RTLRest.survey.halt({}, {},
              function(data) {
                if(data['success']) {
                  log.info(JSON.stringify(data));
                  toastr.success('Successfully halted processing.', 'Halt');
                  self._reload();
                } else {
                  log.error(data['error']);
                  toastr.error(data['error'], 'Halt');
                }
              }
            );
          };

          self._load();
        };

        var Device = function() {
          var self = this;

          self._update = function(data) { angular.extend(self, data); };
          self._load = function() {
//            RTLRest.device.status(function(data){
//              self._update(data);
//            })
            // TODO: Backend implementation of device REST call
            log.warn('Using hardcoded data for device.');
            self._update({type: "rtl", status: "ready"});
          };
          self._reload = function(){ self._load(); };

          self._load();
        };

        var rtl = {};
        rtl.survey = new Survey();
        rtl.device = new Device();
        return rtl;
      }
    ])
;