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
            type: '@',
            doTune: '&'
          },
          template: '<div style="width: {{width}}; height: {{height}};" id="plot" ></div>',
          link: function (scope, element, attrs) {
            var socket = SubscriptionSocket.createNew();

            var plot, layer;

            var bw = 100000;

            var defaultSettings = {
              xdelta:10.25390625,
              xstart: 100E6,
              xunits: 3,
              ydelta : 0.09752380952380953,
              ystart: 0,
              yunits: 3,
              subsize: 32768,
              size: 32768,
              format: 'SF' };
              scope.plotSettings = angular.copy(defaultSettings);
            //scope.plotSettings = angular.extend(scope.plotSettings, scope.settings);

            var createPlot = function(format, settings) {
              plot = new sigplot.Plot(element[0].firstChild, {
                  autohide_panbars: true,
                  autox: 3,
                  //autol: 50,
                  autoy: 3,
                  gridBackground: ["rgba(255,255,255,1", "rgba(200,200,200,1"],
                  all: true,
                  xi: true,
                  cmode: "D2", //20Log
                  fillStyle: ["rgba(224, 255, 194, 0.0)", "rgba(0, 153, 51, 0.7)", "rgba(0, 0, 0, 1.0)"]
              });

              plot.addListener('mdown', plotMDownListener);
              plot.addListener('mup', plotMupListener);
              layer = plot.overlay_array(null, angular.extend(defaultSettings, {'format': format}));
            };

              var lastMouseDown = {
                  x: undefined,
                  y: undefined
              }

              var plotMDownListener = function(event) {
                  lastMouseDown.x = event.x;
                  lastMouseDown.y = event.y;
              }

              var clickTolerance = 100;
              var plotMupListener = function(event) {
                  if (Math.abs(event.x - lastMouseDown.x) <= clickTolerance) {
                      console.log("Tuned to " + event.x / 1000  + " KHz");
                      scope.doTune({cf:event.x});
                  } else if (event.which == 3) {
                      dragTune(event);
                  }
              }

              var dragTune = function(event) {
                  if (lastMouseDown.x && lastMouseDown.y) {
                      var rect = {
                          x1: lastMouseDown.x,
                          x2: event.x,
                          y1: lastMouseDown.y,
                          y2: event.y
                      };
                      lastMouseDown = {x:undefined, y: undefined};
                      scope.doTune({cf:(rect.x1 + rect.x2) / 2});
                      console.log("Tuned to sub-band from " + rect.x1 / 1000  + " KHz to " + rect.x2 / 1000 + " KHz");
                  }
              };

              var showHighlight = function (cf) {
                  var factor = 1;
                  if (scope.url.indexOf('narrowband') >= 0) {
                      cf = 0; //complex data
                      bw = 18e3; //TFD_2 BW
                      factor = 3;//Unit is KHz
                  }
                  if (plot && cf !== undefined) {
                      plot.get_layer(layer).remove_highlight('subBand');
                      plot.get_layer(layer).add_highlight(
                          {
                              xstart: cf - bw / 2 * factor,
                              xend: cf + bw / 2 * factor,
                              color: 'rgba(255,50,50,1)',
                              id: 'subBand'
                          }
                      );
                  }

              };

            var reloadSri;
            var lastCf;
            var lastXDelta = 0;

            //var ignoreNewXStart;

            var updatePlotSettings = function(data) {
              var isDirty = false;
                var cf = data.keywords.CHAN_RF;
                var xdelt = data.xdelta;
                if (Math.abs(lastXDelta - xdelt) >= 0) {
                    lastXDelta = xdelt;
                    showHighlight(cf);
                    isDirty = true;
                }
              angular.forEach(data, function(item, key){
                if (angular.isDefined(scope.plotSettings[key]) && !angular.equals(scope.plotSettings[key], item) && item != 0) {
                  isDirty = true;
                  console.log("Plot settings change "+key+": "+scope.plotSettings[key]+" -> "+item);
                  scope.plotSettings[key] = item;
                }
              });

              scope.plotSettings['size'] = lastDataSize * scope.plotSettings['xdelta'];

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
                    showHighlight();
                  isDirty = true;
                }
              }

              if(isDirty) {
                  reloadSri = true;
              }
            };

            var on_sri = function(sri) {
              updatePlotSettings(sri);
            };

            var dataConverter = plotDataConverter(scope.type);
            var lastDataSize = 1000;

            var on_data = function(data) {
              switch (data.byteLength) {
                  case 1048576:
                      data = data.slice(0, data.byteLength / 8);
                      break;
                  case 917504:
                      data = data.slice(0, data.byteLength / 7);
                      break;
              };
              var array = dataConverter(data);

              lastDataSize = array.length;

              if (plot) {
                  if (reloadSri) {
                      plot.reload(layer, array, scope.plotSettings);
                      plot.refresh();
                      plot._Gx.ylab = 27; //this is a hack, but the only way I can get sigplot to take the value
                      reloadSri = false;
                  } else {
                      plot.reload(layer, array);
                      plot._Gx.ylab = 27; //this is a hack, but the only way I can get sigplot to take the value
                  } }
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