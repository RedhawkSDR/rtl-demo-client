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

            var plot, layer, accordion;

            var bw = 100000;

            var spectrumBw = 2e6;

            var tunedFreq;

            var defaultSettings = {
              xdelta:10.25390625,
              xstart: -1,//ensure change is detected with first SRI
              xunits: 3,
              ydelta : 0.09752380952380953,
              ystart: 0,
              yunits: 3,
              subsize: 32768,
              size: 32768,
              format: 'SF' };
              scope.plotSettings = angular.copy(defaultSettings);

              var plotOptions = {
                  autohide_panbars: true,
                  autox: 3,
                  //autol: 50,
                  autoy: 3,
                  legend: false,
                  xcnt: false,
//                  colors: {bg: "#f5f5f5", fg: "#000"},
                  xi: true,
                  gridBackground: ["rgba(255,255,255,1", "rgba(200,200,200,1"],
                  all: true,
                  cmode: "D2", //20Log
                  fillStyle: ["rgba(224, 255, 194, 0.0)", "rgba(0, 153, 51, 0.7)", "rgba(0, 0, 0, 1.0)"]
              };

              if (scope.url.indexOf('psd/fm') >= 0 || scope.url.indexOf('psd/narrowband') >= 0) {
                  plotOptions.noreadout = true;
              }

            var createPlot = function(format, settings) {
              plot = new sigplot.Plot(element[0].firstChild, plotOptions);
              if (scope.url.indexOf('psd/wideband') >= 0) {
                plot.addListener('mdown', plotMDownListener);
                plot.addListener('mup', plotMupListener);
              }

              layer = plot.overlay_array(null, angular.extend(defaultSettings, {'format': format}));
              accordion = new sigplot.AccordionPlugin({
                draw_center_line: true,
                shade_area: false,
                draw_edge_lines: false,
                direction: "vertical",
                edge_line_style: {strokeStyle: "#FF0000"}
              });

              plot.add_plugin(accordion, layer + 1);
              //modifyWarpboxBehavior(plot);
            };

              var lastMouseDown = {
                  x: undefined,
                  y: undefined
              };

              var plotMDownListener = function(event) {
                  lastMouseDown.x = event.x;
                  lastMouseDown.y = event.y;
              };

              var clickTolerance = 200;
              var plotMupListener = function(event) {
                if (Math.abs(event.x - lastMouseDown.x) <= clickTolerance && event.which === 1) {
                  if (inPlotBounds(event.x, event.y)) {
                    console.log("Tuned to " + event.x / 1000 + " KHz");
                    scope.doTune({cf: event.x});
                  }
                } else if (Math.abs(event.x - lastMouseDown.x) >= clickTolerance && event.which == 3) {
                  //disable drag tuning until warpbox can be drawn
                  //dragTune(event);
                }
              };

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

            var inPlotBounds = function(x, y) {
              var zoomStack = plot._Mx.stk[plot._Mx.stk.length - 1];
              var xmin = zoomStack.xmin;
              var xmax = zoomStack.xmax;
              var ymin = zoomStack.ymin;
              var ymax = zoomStack.ymax;
              //if clicking on x position > xmax, x will be set to xmax. Same for y values
              if (x >= xmax || x <= xmin || y >= ymax || y <= ymin) {
                return false;
              }
              return true;
            }

              var showHighlight = function (cf) {
                tunedFreq = cf;//used in wideband plot to determine min/max x values in mouse listeners
                if (scope.url.indexOf('psd/narrowband') >= 0) {
                  cf = 0;
                  bw = 100e3//TODO get value from TuneFilterDecimate component
                }
                if (plot && cf !== undefined) {
                  if (scope.url.indexOf('psd/wideband') >= 0 || scope.url.indexOf('psd/narrowband') >= 0) {
                    plot.get_layer(layer).remove_highlight('subBand');
                    plot.get_layer(layer).add_highlight(
                      {
                        xstart: cf - bw / 2,
                        xend: cf + bw / 2,
                        color: 'rgba(255,50,50,1)',
                        id: 'subBand'
                      }
                    );
                    accordion.set_center(cf);
                    accordion.set_width(bw);
                  }
                }

              };

            var reloadSri;
            var lastXStart = -1;


            var mode = undefined;

            var updatePlotSettings = function(data) {
              var isDirty = false;
              var cf = data.keywords.CHAN_RF;
              var xstart = data.xstart;
              if (Math.abs(lastXStart - xstart) >= 0) {
                lastXStart = xstart;
                showHighlight(cf);
                isDirty = true;
              }
              angular.forEach(data, function(item, key){
                if (angular.isDefined(scope.plotSettings[key]) && !angular.equals(scope.plotSettings[key], item)) {
                  isDirty = true;
                  scope.plotSettings[key] = item;
                }
              });

              scope.plotSettings['size'] = lastDataSize * scope.plotSettings['xdelta'];

              if (!plot) {
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
                      createPlot(mode + "F", defaultSettings);
                      console.log("Create plots with format " + mode + "F");
                      break;
                    case "double":
                      createPlot(mode + "D", defaultSettings);
                      console.log("Create plots with format " + mode + "D");
                      break;
                    default:
                  }
                  showHighlight(cf);
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
            var lastDataSize;

            var on_data = function(data) {
              var bps;
              switch (scope.type) {
                case 'double':
                  bps = 2;
                  break;
                case 'float':
                  bps = 4;
                  break;
                default:
                  return;
              };

              var bpe;
              switch (mode) {
                case 'S':
                  bpe = bps;
                  break;
                case 'C':
                  bpe = bps * 2;
                  break;
                default:
                  return;
              }

              var frameSize = scope.plotSettings.subsize * bpe;
              var numFrames = Math.floor(data.byteLength / frameSize );
              //workaround: take ony first frame, as loading frames seriatum seems to not work
              //back-end will be modified to send only one frame
              for (var i = 0; i < frameSize /** (numFrames - 1)*/; i+= frameSize) {
                data = data.slice(i, i + frameSize);
                var array = dataConverter(data);
                lastDataSize = array.length;
                if (plot) {
                  reloadPlot(array);
                }
              }
            };

            var reloadPlot = function(data) {
                if (reloadSri) {
                    plot.reload(layer, data, scope.plotSettings);
                    plot.refresh();
                    plot._Gx.ylab = 27; //this is a hack, but the only way I can get sigplot to take the value
                    reloadSri = false;
                } else {
                    plot.reload(layer, data);
                    plot._Gx.ylab = 27; //this is a hack, but the only way I can get sigplot to take the value
                }
            };

            var modifyWarpboxBehavior = function(plot) {
              plot._Mx.onmouseup = (function(Mx) {
                alert('yay warpbox');
                return function(event) {
                  if (Mx.warpbox) {
                    mx.onWidgetLayer(Mx, function() {
                      mx.erase_window(Mx);
                    });

                    var old_warpbox = Mx.warpbox;
                    Mx.warpbox = undefined;

                    if (event.which === 1 || event.which === 3) {
                      if (old_warpbox.func) {
                        var xo = old_warpbox.xo;
                        var yo = old_warpbox.yo;
                        var xl = old_warpbox.xl;
                        var yl = old_warpbox.yl;

                        if (old_warpbox.mode === "vertical") {
                          xo = Mx.l;
                          xl = Mx.r;
                        } else if (old_warpbox.mode === "horizontal") {
                          yo = Mx.t;
                          yl = Mx.b;
                        } // else "box"
                        old_warpbox.func(event, xo, yo, xl, yl, old_warpbox.style.return_value);
                      }
                    }

                  }
                  mx.widget_callback(Mx, event);
                };
              })(Mx);
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
  .directive('rtlRaster', ['SubscriptionSocket', 'plotDataConverter',
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

          var plot, layer, accordion;

          var bw = 100000;

          var tunedFreq;

          var defaultSettings = {
            xdelta:10.25390625,
            xstart: -1,//ensure change is detected with first SRI
            xunits: 3,
            ydelta : 0.09752380952380953,
            ystart: 0,
            yunits: 3,
            subsize: 32768,
            size: 32768,
            format: 'SF' };
          scope.plotSettings = angular.copy(defaultSettings);

          var createPlot = function(format, settings) {
            plot = new sigplot.Plot(element[0].firstChild, {
              all: true,
              expand: true,
              autol: 100,
              autox: 3,
              autohide_panbars: true,
              xcnt: false,
              cmode: "D2", //20Log
              gridBackground: ["rgba(255,255,255,1", "rgba(200,200,200,1"],
              xi: true
//              colors: {bg: "rgba(255,255,255,1)", fg: "rgba(0,0,0,1)"}
            });
            if (scope.url.indexOf('psd/wideband') >= 0) {
              plot.addListener('mdown', plotMDownListener);
              plot.addListener('mup', plotMupListener);
            }

            layer = plot.overlay_pipe(angular.extend(settings, {type: 2000, 'format': format, pipe: true, pipesize: 1024 * 1024 * 5, yunits: 28}));
            accordion = new sigplot.AccordionPlugin({
              draw_center_line: false,
              shade_area: true,
              draw_edge_lines: true,
              direction: "vertical",
              edge_line_style: {strokeStyle: "#FF0000"}
            });

            plot.add_plugin(accordion, layer + 1);
            //modifyWarpboxBehavior(plot);
          };

          var lastMouseDown = {
            x: undefined,
            y: undefined
          };

          var plotMDownListener = function(event) {
            lastMouseDown.x = event.x;
            lastMouseDown.y = event.y;
          };

          var clickTolerance = 200;
          var plotMupListener = function(event) {
            if (Math.abs(event.x - lastMouseDown.x) <= clickTolerance && event.which === 1) {
              if (inPlotBounds(event.x, event.y)) {
                console.log("Tuned to " + event.x / 1000 + " KHz");
                scope.doTune({cf: event.x});
              }
            } else if (Math.abs(event.x - lastMouseDown.x) >= clickTolerance && event.which == 3) {
              //disable drag tuning until warpbox can be drawn
              //dragTune(event);
            }
          };

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

          var inPlotBounds = function(x, y) {
            var zoomStack = plot._Mx.stk[plot._Mx.stk.length - 1];
            var xmin = zoomStack.xmin;
            var xmax = zoomStack.xmax;
            var ymin = zoomStack.ymin;
            var ymax = zoomStack.ymax;
            //if clicking on x position > xmax, x will be set to xmax. Same for y values
            if (x >= xmax || x <= xmin || y >= ymax || y <= ymin) {
              return false;
            }
            return true;
          }

          var showHighlight = function (cf) {
            tunedFreq = cf;//used in wideband plot to determine min/max x values in mouse listeners
            if (plot && cf !== undefined) {
              if (scope.url.indexOf('psd/wideband') >= 0) {
                accordion.set_center(cf);
                accordion.set_width(bw);
              }
            }

          };

          var reloadSri;
          var lastXStart = -1;

          var mode = undefined;

          var updatePlotSettings = function(data) {
            var isDirty = false;
            var cf = data.keywords.CHAN_RF;
            var xstart = data.xstart;
            if (Math.abs(lastXStart - xstart) >= 0) {
              console.log(scope.url + ' xstart: ' + xstart);
              lastXStart = xstart;
              showHighlight(cf);
              isDirty = true;
            }
            angular.forEach(data, function(item, key){
              if (angular.isDefined(scope.plotSettings[key]) && !angular.equals(scope.plotSettings[key], item)) {
                isDirty = true;
                console.log(scope.url + ": Plot settings change "+key+": "+scope.plotSettings[key]+" -> "+item);
                scope.plotSettings[key] = item;
              }
            });

            scope.plotSettings['size'] = lastDataSize * scope.plotSettings['xdelta'];

            if (!plot) {
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
                    createPlot(mode + "F", defaultSettings);
                    console.log("Create plots with format " + mode + "F");
                    break;
                  case "double":
                    createPlot(mode + "D", defaultSettings);
                    console.log("Create plots with format " + mode + "D");
                    break;
                  default:
                }
                showHighlight(cf);
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
          var lastDataSize;

          var on_data = function(data) {
              var snd = new Audio("data:audio/wav," + data);
              snd.play();
            var bps;
            switch (scope.type) {
              case 'double':
                bps = 2;
                break;
              case 'float':
                bps = 4;
                break;
              default:
                return;
            };

            var bpe;
            switch (mode) {
              case 'S':
                bpe = bps;
                break;
              case 'C':
                bpe = bps * 2;
                break;
              default:
                return;
            }

            var frameSize = scope.plotSettings.subsize * bpe;
            var numFrames = Math.floor(data.byteLength / frameSize );
            //workaround: take ony first frame, as loading frames seriatum seems to not work
            //back-end will be modified to send only one frame
            for (var i = 0; i < frameSize /** (numFrames - 1)*/; i+= frameSize) {
              data = data.slice(i, i + frameSize);
              var array = dataConverter(data);
              lastDataSize = array.length;
              if (plot) {
                reloadPlot(array);
              }
            }
          };

          var reloadPlot = function(data) {
            if (reloadSri) {
              plot.push(layer, data, scope.plotSettings);
              plot.refresh();
              plot._Gx.ylab = 27; //this is a hack, but the only way I can get sigplot to take the value
              reloadSri = false;
            } else {
              plot.push(layer, data);
              plot._Gx.ylab = 27; //this is a hack, but the only way I can get sigplot to take the value
            }
          };

          var modifyWarpboxBehavior = function(plot) {
            plot._Mx.onmouseup = (function(Mx) {
              alert('yay warpbox');
              return function(event) {
                if (Mx.warpbox) {
                  mx.onWidgetLayer(Mx, function() {
                    mx.erase_window(Mx);
                  });

                  var old_warpbox = Mx.warpbox;
                  Mx.warpbox = undefined;

                  if (event.which === 1 || event.which === 3) {
                    if (old_warpbox.func) {
                      var xo = old_warpbox.xo;
                      var yo = old_warpbox.yo;
                      var xl = old_warpbox.xl;
                      var yl = old_warpbox.yl;

                      if (old_warpbox.mode === "vertical") {
                        xo = Mx.l;
                        xl = Mx.r;
                      } else if (old_warpbox.mode === "horizontal") {
                        yo = Mx.t;
                        yl = Mx.b;
                      } // else "box"
                      old_warpbox.func(event, xo, yo, xl, yl, old_warpbox.style.return_value);
                    }
                  }

                }
                mx.widget_callback(Mx, event);
              };
            })(Mx);
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