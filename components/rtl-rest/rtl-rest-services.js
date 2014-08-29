/**
 *
 * Services to interact with the RTL DEMO Application.
 *
 * Created by rxc on 8/29/14.
 **/
angular.module('rtl-rest', ['ngResource'])
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
    .factory('rtl', ['RTLRest',
      function(RTLRest) {

        var log = {
          info:  function(txt) { console.log('INFO:  '+txt); },
          warn:  function(txt) { console.log('WARN:  '+txt); },
          error: function(txt) { console.log('ERROR: '+txt); }
        };

        var Survey = function() {
          var self = this;

          self._update = function(data) { angular.extend(self, data); };
          self._load = function() {
            RTLRest.survey.status(function(data){
              self._update(data);
            })
          };
          self._reload = function(){ self._load(); };

          self.task = function(frequency, processing) {
            return RTLRest.survey.task({},
                {
                  frequency: parseFloat(frequency),
                  processing: processing
                }, function(data) {
                  if(data['success']) {
                    self._update(data['status']);
                    log.info(data);
                  } else {
                    log.error(data['error']);
                  }
                }, function(resp) {
                  log.error(resp['data']['error']);
                }
            );
          };

          self.halt = function() {
            return RTLRest.survey.halt({}, {},
              function(data) {
                if(data['success']) {
                  log.info(data);
                  self._reload();
                } else {
                  log.error(data['error']);
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