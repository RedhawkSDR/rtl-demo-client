/**
 * Created by Rob Cannon on 9/22/14.
 */
angular.module('rtl-plots', ['SubscriptionSocketService'])
    .directive('rtlPlot', ['SubscriptionSocket',
      function(SubscriptionSocket){
        return {
          restrict: 'E',
          scope: {
            width: '@',
            height: '@',
            url: '@'
          },
          template: '<div style="width: {{width}}; height: {{height}};" id="plot" ></div>',
          link: function (scope, element, attrs) {
            var socket = SubscriptionSocket.createNew();

            var plot, layer;

            var defaultSettings = {
              xdelta:10.25390625,
              xstart: 0,
              xunits: 1,
              ydelta : 0.09752380952380953,
              ystart: 0,
              yunits: 3,
              subsize: 16385,
              size: 1,
              format: 'SF'
            };
            scope.plotSettings = angular.copy(defaultSettings);

            var createPlot = function(format, settings) {
              console.log(element);

              plot = new sigplot.Plot(element[0].firstChild, {
                autohide_panbars: true,
                autox: 3,
                colors: {bg: "#f5f5f5", fg: "#000"},
                gridBackground: ["rgba(255,255,255,1", "rgba(238,238,238,1"],
                fillStyle: ["rgba(224, 255, 194, 0.0)", "rgba(0, 153, 51, 0.7)", "rgba(0, 0, 0, 1.0)"]
              });
              layer = plot.overlay_array(null, angular.extend(settings, {'format': format}));
            };

            var setLayer = function(layer, settings) {
              var newSettings = angular.copy(settings);

              layer.xstart = newSettings['xstart'];
              layer.xdelta = newSettings['xdelta'];
              layer.ystart = newSettings['ystart'];
              layer.ydelta = newSettings['ydelta'];
              layer.xlab   = newSettings['xunits'];
              layer.ylab   = newSettings['yunits'];
              layer.subsize = newSettings['subsize'];
              layer.size   = newSettings['size'];
              layer.mode   = newSettings['mode'];
            };

            var setPlots = function(settings) {
              if(settings['yunits'] == 0)
                settings['yunits'] = 11;

              var plotLayer = plot.get_layer(layer);
              plotLayer.hcb.size = settings['size'];
              setLayer( plotLayer, settings );
            };

            var updatePlotSettings = function(data) {
              var isDirty = false;
              angular.forEach(data, function(item, key){
                if (angular.isDefined(scope.plotSettings[key]) && !angular.equals(scope.plotSettings[key], item) && item != 0) {
                  isDirty = true;
                  console.log("Plot settings change "+key+": "+scope.plotSettings[key]+" -> "+item);
                  scope.plotSettings[key] = item;
                }
              });

              scope.plotSettings['size'] = lastDataSize * scope.plotSettings['xdelta'];
              if(data['subsize'] == 0) {
                scope.plotSettings['subsize'] = lastDataSize;
              }

              if (!plot) {
                createPlot("SD", scope.plotSettings);
              }

              if(isDirty) {
                setPlots(scope.plotSettings);
              }
            };

            var on_sri = function(sri) {
              updatePlotSettings(sri);
            };

            var lastDataSize = 1000;
            var on_data = function(data) {
              var array = new Float64Array(data);

              lastDataSize = array.length;

              if(plot)
                plot.reload(layer, array);
            };

            if(on_data)
              socket.addBinaryListener(on_data);
            if(on_sri)
              socket.addJSONListener(on_sri);

            socket.connect(scope.url, function(){
              console.log("Connected to Survey Wideband");
            });

            scope.$on("$destroy", function(){
              socket.close();
            })

          }
        };
      }
    ])
;