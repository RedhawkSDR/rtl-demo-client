/**
 * Created by Rob Cannon on 9/22/14.
 */
angular.module('rtl-plots', ['SubscriptionSocketService'])
    .service('plotDataConverter', function(){
      /*
       Create a map to convert the standard REDHAWK BulkIO Formats
       into Javascript equivalents.
       ----
       byte      = 8-bit signed
       char      = 8-bit unsigned
       octet     = 8-bit The signed-ness is undefined
       short     = 16-bit signed integer
       ushort    = 16-bit unsigned integer
       long      = 32-bit signed integer
       ulong     = 32-bit unsigned integer
       longlong  = 64-bit signed integer
       ulonglong = 64-bit unsigned integer
       float     = 32-bit floating point
       double    = 64-bit floating point
       ----
       */
      var conversionMap = {
        byte: Int8Array,
        char: Uint8Array,
        octet: Uint8Array,
        ushort: Uint16Array,
        short: Int16Array,
        long: Int32Array,
        ulong: Uint32Array,
        longlong: undefined, //This should be 64-bit
        ulonglong: undefined, //This should be 64-bit
        float: Float32Array,
        double: Float64Array
      };
      var defaultConversion = Float32Array;

      return function(type) {
        var fn = conversionMap[type];

        if(type == 'octet')
          console.log("Plot::DataConverter::WARNING - Data type is 'octet' assuming unsigned.");

        if(!fn) {
          console.log("Plot::DataConverter::WARNING - Data type is '"+type+"' using default.");
          fn = defaultConversion;
        }

        return function(data) { return new fn(data); };
      };
    })
    .directive('rtlPlot', ['SubscriptionSocket', 'plotDataConverter',
      function(SubscriptionSocket, plotDataConverter){
        return {
          restrict: 'E',
          scope: {
            width: '@',
            height: '@',
            url: '@',
            type: '@'
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
            scope.plotSettings = angular.extend(scope.plotSettings, scope.settings);

            var createPlot = function(format, settings) {
              plot = new sigplot.Plot(element[0].firstChild, {
                autohide_panbars: true,
                autox: 3,
                colors: {bg: "#f5f5f5", fg: "#000"},
                gridBackground: ["rgba(255,255,255,1", "rgba(238,238,238,1"],
                fillStyle: ["rgba(224, 255, 194, 0.0)", "rgba(0, 153, 51, 0.7)", "rgba(0, 0, 0, 1.0)"]
              });
              layer = plot.overlay_array(null, angular.extend(defaultSettings, {'format': format}));
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
                var mode = undefined;
                switch (data.mode) {
                  case 0:
                    mode = "S";
                    break;
                  case 1:
                    mode = "C";
                    break;
                  default:
                }

                if (mode) {
                  switch (scope.type) {
                    case "float":
                      createPlot(mode + "F", scope.plotSettings);
                      console.log("Create plots with format " + mode + "F");
                      break;
                    case "double":
                      createPlot(mode + "D", scope.plotSettings);
                      console.log("Create plots with format " + mode + "D");
                      break;
                    default:
                  }
                  isDirty = true;
                }
              }

              if(isDirty) {
                setPlots(scope.plotSettings);
              }
            };

            var on_sri = function(sri) {
              updatePlotSettings(sri);
            };

            var dataConverter = plotDataConverter(scope.type);
            var lastDataSize = 1000;
            var on_data = function(data) {
              var array = dataConverter(data);

              lastDataSize = array.length;

              if(plot)
                plot.reload(layer, array);
            };

            if(on_data)
              socket.addBinaryListener(on_data);
            if(on_sri)
              socket.addJSONListener(on_sri);

            socket.connect(scope.url, function(){
              console.log("Connected to Plot");
            });

            scope.$on("$destroy", function(){
              socket.close();
            })

          }
        };
      }
    ])
;