/**
 *
 * Services to interact with the RTL DEMO Application.
 *
 * Created by rxc on 8/29/14.
 **/
angular.module('rtl-rest', ['ngResource', 'toastr', 'ngAnimate', 'SubscriptionSocketService'])
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
    .factory('rtl', ['RTLRest', 'toastr', 'SubscriptionSocket',
      function(RTLRest, toastr, SubscriptionSocket) {

        var log = {
          info:  function(txt) { console.log('INFO:  '+txt); },
          warn:  function(txt) { console.log('WARN:  '+txt); },
          error: function(txt) { console.log('ERROR: '+txt); }
        };

        var rtl = {};
        rtl.processors = [];

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
            RTLRest.survey.status(
              function(data){
              if(data.hasOwnProperty('availableProcessing'))
                angular.copy(data['availableProcessing'], rtl.processors);
              self._update(data['status']);
              },
              function(resp){
                rtl.connected = false;
                log.error("Failed to get survey status "+resp.status+": "+resp.statusText)
              }
            );
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

          self._update = function(data) {
            if('status' in data && data['status'] != self.status) {
              var name = data['type'].toUpperCase();
              if(data['status'] == 'ready')
                toastr.success(name + " is ready.", 'Device');
              else if(data['status'] == 'unavailable')
                toastr.error(name + " is unavailable.", 'Device');
              else
                log.warn("Unknown device status of '"+data['status']+" for "+name);
            }

            angular.extend(self, data);
          };
          self._load = function() {
            RTLRest.device.status(
              function(data){
                self._update(data);
              },
              function(resp){
                rtl.connected = false;
                log.error("Failed to get device status "+resp.status+": "+resp.statusText)
              }
            );
          };
          self._reload = function(){ self._load(); };

          self._load();
        };

        rtl.connected = true;
        rtl.survey = new Survey();
        rtl.device = new Device();

        var statusSocket = SubscriptionSocket.createNew();

        statusSocket.addJSONListener(function(data){
          if('type' in data && 'body' in data) {
            if(data['type'] == 'device') {
              rtl.device._update(data['body']);
            } else if(data['type'] == 'survey') {
              rtl.survey._update(data['body']);
            } else {
              log.error("Unhandled Status Notification of type '" + data['type'] + "'"
                        + JSON.stringify(data['body']))
            }
          } else {
            log.error("Status Notification missing 'type' and/or 'body'"+JSON.stringify(data))
          }
        });

        statusSocket.connect('/rtl/status', function(){
          console.log("Connected to Status");
        });

        return rtl;
      }
    ])
;