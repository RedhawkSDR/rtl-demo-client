/*
 * This file is protected by Copyright. Please refer to the COPYRIGHT file
 * distributed with this source distribution.
 *
 * This file is part of REDHAWK rtl-demo-client.
 *
 * REDHAWK rtl-demo-client is free software: you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or (at your
 * option) any later version.
 *
 * REDHAWK rtl-demo-client is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser General Public License
 * for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see http://www.gnu.org/licenses/.
 */
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
    //Line plot
    .directive('rtlPlot', ['SubscriptionSocket', 'plotDataConverter',
      function(SubscriptionSocket, plotDataConverter){
        return {
          restrict: 'E',
          scope: {
            width: '@',
            height: '@',
            url: '@',
            type: '@',
            doTune: '&',
            useGradient: '=?',
            cmode: '@?'
          },
          template: '<div style="width: {{width}}; height: {{height}};" id="plot" ></div>',
          link: function (scope, element, attrs) {

            var socket = SubscriptionSocket.createNew();

            var RUBBERBOX_ACTION = 'select';

            var RUBBERBOX_MODE = 'horizontal';

            if(!angular.isDefined(scope.useGradient))
              scope.useGradient = true;

            /**
             * plot rendering mode
             *   "IN" = Index, "AB" = Abscissa,
             *   "MA" = Magnitude, "PH" = Phase,
             *   "RE" = Real,
             *   "IM" = Imaginary,
             *   "LO" or "D1" = 10log,
             *   "L2" or "D2" = 20log,
             *   "RI" or "IR" = Real vs. Imaginary
             * @type {string[]}
             */
            var validCMode = ['IN', 'AB', 'MA', 'PH', 'RE', 'LO', 'D1', 'L2', 'D2'];
            var cmode = 'D2';
            console.log(scope.cmode);
            if(angular.isDefined(scope.cmode) && scope.cmode != "") {
              if(validCMode.indexOf(scope.cmode) == -1) {
                console.log("WARN::Invalid cmode '"+scope.cmode+"' setting to '"+cmode+"'.");
              } else {
                cmode = scope.cmode;
              }
            }

            //sigplot objects
            var plot, //line plot
                layer, //layer number
                accordion; //sigplot plug-in, used here to display vertical line at tuned frequency

            //narrowband bandwidth
            var bw = 100000;

            //wideband bandwidth
            var spectrumBw = 2e6;

            var tunedFreq; //TODO see if this is still needed

            //settings used when plot is created. Will be overridden from received SRI
            var defaultSettings = {
              xdelta:10.25390625,
              xstart: -1,//ensure change is detected with first SRI
              xunits: 3,
              ydelta : 0.09752380952380953,
              ystart: 0,
              yunits: 3,
              subsize: 4097,
              size: 32768,
              format: 'SF'
            };

            //apply new values from SRI to this object
            scope.plotSettings = angular.copy(defaultSettings);

            var plotOptions = {
              autohide_panbars: true,
              autox: 3, //auto-scale min and max x values
              autoy: 3, //auto-scale min and max y values
              legend: false, //don't show legend of traces being plotted
              all: true, //show all plot data, rather than partial range with pan bars
              cmode: cmode, //Output mode 20Log
              rubberbox_action: RUBBERBOX_ACTION,
              rubberbox_mode: RUBBERBOX_MODE,
              colors: {bg: "#222", fg: "#888"}
            };

            //Show readout (values under plot, updated as cursor moves) only for wideband plot
            if (scope.url.indexOf('psd/fm') >= 0 || scope.url.indexOf('psd/narrowband') >= 0) {
              plotOptions.noreadout = true;
            }

            var createPlot = function(format, settings) {
              plot = new sigplot.Plot(element[0].firstChild, plotOptions);
              if (scope.url.indexOf('psd/wideband') >= 0) {
                //mouse listeners used to provide click-tuning and drag-tuning
                plot.addListener('mdown', plotMDownListener);
                plot.addListener('mup', plotMupListener);
              }

              if(scope.useGradient) {
                plot.change_settings({
                  fillStyle: [
                    "rgba(255, 255, 100, 0.7)",
                    "rgba(255, 0, 0, 0.7)",
                    "rgba(0, 255, 0, 0.7)",
                    "rgba(0, 0, 255, 0.7)"
                  ]
                });
              }

              layer = plot.overlay_array(null, angular.extend(defaultSettings, {'format': format}));
              //sigplot plug-in used to draw vertical line at tuned freq
              accordion = new sigplot.AccordionPlugin({
                draw_center_line: true,
                shade_area: false,
                draw_edge_lines: false,
                direction: "vertical",
                edge_line_style: {strokeStyle: "#FF0000"}
              });

              plot.add_plugin(accordion, layer + 1);//plug-ins are drawn in separate layers
            };

            var lastMouseDown = {
              x: undefined,
              y: undefined
            };

            //mark initial drag point
            var plotMDownListener = function(event) {
              lastMouseDown.x = event.x;
              lastMouseDown.y = event.y;
            };

            //Since freq is on MHz scale, we need some tolerance when comparing click-point to some value
            var clickTolerance = 200; //TODO set value automatically as a multiple of xdelta, to work with any data scale

            //Compare with initial drag-point to get user-specified rectangle
            var plotMupListener = function(event) {
              console.log("ctrl: " + event.ctrlKey);
              //event.which==> 1=left-click, 2=middle-click, 3=right-click
              //left-click zooming is built into sigplot. Here we implement right-click drag-tuning
              if (Math.abs(event.x - lastMouseDown.x) <= clickTolerance && event.which === 1) {
                if (inPlotBounds(event.x, event.y) && !scope.ctrlKeyPressed) {
                  console.log("Tuned to " + event.x / 1000 + " KHz");
                  scope.doTune({cf: event.x});
                }
              } else if (Math.abs(event.x - lastMouseDown.x) >= clickTolerance && dragSelect(event.which)) {
                dragTune(event);
              }
            };

            /**
             * Determine whether a select or  zoom action is being performed with the current drag operation,
             * in accordance with the current rubberbox_action plot option setting.
             *
             * @param {Number} button the mouse button that is being pressed. 1: left; 2: middle; 3: right
             * @returns {boolean} true if a select action is being performed, false if a zoom action is being performed.
             */
            var dragSelect = function(button) {
              switch (RUBBERBOX_ACTION) {
                case 'select' :
                  //true for left-click drag
                  return button === 1 && plot._Mx.warpbox.style !== plot._Mx.warpbox.alt_style;
                case 'zoom' :
                  //true for ctrl-left-click drag
                  return button === 1 && plot._Mx.warpbox.style === plot._Mx.warpbox.alt_style;
                default:
                  return false;
              }
            };

            /* Tune to freq value at center of rectangle. In applications where bandwidth is selectable
             * it can be set from width of rectangle. Here bandwidth is not selectable because we're dealing with
             * fixed-bandwidth FM broadcast signals.
             */
            var dragTune = function(event) {
              if (lastMouseDown.x && lastMouseDown.y) {
                var rect = {
                  x1: lastMouseDown.x,
                  x2: event.x,
                  y1: lastMouseDown.y,
                  y2: event.y
                };
                lastMouseDown = {x:undefined, y: undefined}; //reset initial drag-point
                scope.doTune({cf:(rect.x1 + rect.x2) / 2});
                console.log("Tuned to sub-band from " + rect.x1 / 1000  + " KHz to " + rect.x2 / 1000 + " KHz");
              }
            };

            /* Plot min/max values go beyond the plot boundary, to include the area where labels, etc are displayed.
             * Here we detect whether clicking on actual plot or surrounding area.
             */
            var inPlotBounds = function(x, y) {
              //zoom stack remembers min/max values at each zoom level, with current zoom values at end of stack
              var zoomStack = plot._Mx.stk[plot._Mx.stk.length - 1];
              var xmin = zoomStack.xmin;
              var xmax = zoomStack.xmax;
              var ymin = zoomStack.ymin;
              var ymax = zoomStack.ymax;
              // when clicking on any x position > xmax, x will be set to xmax. Same for y values
              if (x >= xmax || x <= xmin || y >= ymax || y <= ymin) {
                return false;
              }
              return true;
            };

            /*
             * Show subband tuning by adding a feature to the plot which draws a different color trace
             * for data in a specified x-value range
             */
            var showHighlight = function (cf) {
              if (scope.url.indexOf('psd/narrowband') >= 0) {
                cf = 0;//show baseband freq for narrowband plot, not RF
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
                  accordion.set_width(bw);//width currently irrelevant since we're not drawing edge-lines
                }
              }

            };

            /* When SRI has changed, plot settings will be updated with next push of data */
            var reloadSri;

            /* Detect changes to xstart and draw new highlight */
            var lastXStart = -1;

            /* String value used as part of format string: S = scalar data, C = complex data  */
            var mode = undefined;

            /*
             * Detect changed values from SRI and apply to plot
             */
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
                  console.log('New SRI: ' + key + ' changed from ' +  scope.plotSettings[key] + ' to ' + item);
                  scope.plotSettings[key] = item;
                }
              });

              //TODO see if this is still needed
              scope.plotSettings['size'] = lastDataSize * scope.plotSettings['xdelta'];

              /*
               * We create the plot the first time SRI is received
               */
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
                  angular.extend(defaultSettings,
                      {
                        'xdelta': data.xdelta,
                        'xunits': data.xunits,
                        'subsize': data.subsize,
                        'ydelta': data.ydelta
                      }
                  );

                  // format string = (C|S)(F|D) for scalar/complex data containing Float or Double values
                  switch (scope.type) {
                    case "float":
                      /* unexplained behavior in firefox: If we invoke with scope.plotSettings instead of
                         defaultSettings, plot layer is not created and errors are thrown on every push of data */
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

            //SRI = Signal Related Information: signal metadata, pushed from server initially and when values change
            var on_sri = function(sri) {
              updatePlotSettings(sri);
            };

            var dataConverter = plotDataConverter(scope.type);
            var lastDataSize;

            /* Server pushes data one frame at a time */
            var on_data = function(data) {

              /*bpa and ape not currently used. Useful if we need to identify frame boundaries in data.

                Number of raw bytes = subsize (from SRI) * bytes per element (BPE).
                BPE = number of bytes per atom (BPA) * atoms per element (APE)
                BPA = bytes needed to represent a value, i.e 2 for float, 4 for double
                APE = 1 for scalar data, 2 for complex

                Complex data can be plotted in various complex output modes, i.e. magnitude
                of complex number (sqrt(real** + imag**)), sum of real and imaginary components,
                separate trace for real and imaginary values, etc.
               */

              var bpa;
              switch (scope.type) {
                case 'double':
                  bpa = 2;
                  break;
                case 'float':
                  bpa = 4;
                  break;
                default:
                  return;
              }

              var ape;
              switch (mode) {
                case 'S':
                  ape = 1;
                  break;
                case 'C':
                  ape = 2;
                  break;
                default:
                  return;
              }

              //bytes per element. There will be bpe * subsize raw bytes per frame.
              var bpe = bpa * ape;

              //assume single frame per handler invocation
              var array = dataConverter(data);
              lastDataSize = array.length;
              if (plot) {
                reloadPlot(array);
              }
            };

            var reloadPlot = function(data) {
                if (reloadSri) {
                    plot.reload(layer, data, scope.plotSettings);
                    plot.refresh();
                    plot._Gx.ylab = 27; //this is a hack, but sigplot seems to ignore the value in plotSettings
                    reloadSri = false;
                } else {
                    plot.reload(layer, data);
                    plot._Gx.ylab = 27; //this is a hack, but sigplot seems to ignore the value in plotSettings
                }
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
    //TODO factor out common code from line and raster plot directives
  //Raster plot
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
        template: '<div style="width: {{width}}; height: {{height}};" id="raster" ></div>',
        link: function (scope, element, attrs) {
          var socket = SubscriptionSocket.createNew();

          var plot, layer, accordion;

          var bw = 100000;

          var RUBBERBOX_ACTION = 'select';

          var RUBBERBOX_MODE = 'horizontal';

          var defaultSettings = {
            xdelta:10.25390625,
            xstart: -1,//ensure change is detected with first SRI
            xunits: 3,
            ydelta : 0.09752380952380953,
            ystart: 0,
            yunits: 3,
            subsize: 4097,
            size: 4097,
            format: 'SF' };
          scope.plotSettings = angular.copy(defaultSettings);

          var createPlot = function(format, settings) {
            plot = new sigplot.Plot(element[0].firstChild, {
              all: true,
              expand: true,
              autol: 100,
              autox: 3,
              autohide_panbars: true,
              xcnt: 0,
              cmode: "D2", //20Log
              colors: {bg: "#222", fg: "#888"},
              nogrid: true,
              rubberbox_action: RUBBERBOX_ACTION,
              rubberbox_mode: RUBBERBOX_MODE,
            });
            if (scope.url.indexOf('psd/wideband') >= 0) {
              plot.addListener('mdown', plotMDownListener);
              plot.addListener('mup', plotMupListener);
            }

            plot.change_settings({
              fillStyle: [
                "rgba(255, 255, 100, 0.7)",
                "rgba(255, 0, 0, 0.7)",
                "rgba(0, 255, 0, 0.7)",
                "rgba(0, 0, 255, 0.7)"
              ]
            });

            layer = plot.overlay_pipe(angular.extend(settings, {type: 2000, 'format': format, pipe: true, pipesize: 1024 * 1024 * 5, yunits: 28}));
            accordion = new sigplot.AccordionPlugin({
              draw_center_line: false,
              shade_area: true,
              draw_edge_lines: true,
              direction: "vertical",
              edge_line_style: {strokeStyle: "#FF0000"}
            });

            plot.add_plugin(accordion, layer + 1);
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
            } else if (Math.abs(event.x - lastMouseDown.x) >= clickTolerance && mouseSelect(event.which)) {
              dragTune(event);
            }
          };

          var mouseSelect = function(button) {
            switch (RUBBERBOX_ACTION) {
              case 'select' :
                return button === 1 && plot._Mx.warpbox.style !== plot._Mx.warpbox.alt_style;
              case 'zoom' :
                return button === 1 && plot._Mx.warpbox.style === plot._Mx.warpbox.alt_style;
              default:
                return false;
            }
          };ot

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
          };

          var showHighlight = function (cf) {
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
                angular.extend(defaultSettings,
                  {
                    'xdelta': data.xdelta,
                    'xunits': data.xunits,
                    'ydelta': data.ydelta,
                    'subsize': data.subsize
                  }
                );
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
                bps = 8;
                break;
              case 'float':
                bps = 4;
                break;
              default:
                return;
            }

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

            //assume single frame sent
            var array = dataConverter(data);
            if (plot) {
                  reloadPlot(array);
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
