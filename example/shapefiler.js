var sfToolkit = {
  splitDirections: function (raw_data, direction_id) {
    var order = {
      0: [],
      1: []
    };
    raw_data.forEach(function (each) {
      if (each[direction_id] == 0) {
        order[0].push(each);
      } else {
        order[1].push(each)
      }
    });
    return order;
  },

  shapefiler: function (pointCluster, options) {
  
    // check to see if mandatory vars supplied
    if (pointCluster == undefined) {
      throw Error('Lat/Lng data not supplied; shapefiler build failed.')
    }

    // init components
    this.base = pointCluster;
    this.cleaned = null;
    this.ref = {
      avg: {
        lat: null,
        lng: null,
      },
      far: {
        lat: null,
        lng: null,
        obj: null,
      },
      pruned: null,
    };

    if (options == undefined) {
      this.options = {
        shuffle: false,
        basicReorder: true,
        sensitivity: {
          proximity: 5, // meters
          angle: 50     // degrees
        },
        farthestPoint: {
          lat: null,
          lng: null,
        }
      };
    } else {
      this.options = {};

      // shuffle
      if (options.shuffle == true || options.shuffle == false) {
        this.options.shuffle = options.shuffle;
      } else {
        this.options.shuffle = false;
      }

      // use basic or experimental reorder
      if (options.basicReorder == true || options.basicReorder == false) {
        this.options.basicReorder = options.basicReorder;
      } else {
        this.options.basicReorder = true;
      }

      // set sensitivity
      if (typeof options.sensitivity == 'object') {
        this.options.sensitivity = {};

        if (isNaN(options.sensitivity.proximity)) {
          this.options.sensitivity.proximity = 5;
        } else {
          this.options.sensitivity.proximity = options.sensitivity.proximity;
        }

        if (isNaN(options.sensitivity.angle)) {
          this.options.sensitivity.angle = 50;
        } else {
          this.options.sensitivity.angle = options.sensitivity.angle;
        }
      } else {
        this.options.sensitivity = {
          proximity: 5,
          angle: 50
        };
      }

      // set farthest point
      if (typeof options.farthestPoint == 'object') {
        this.options.sensitivity = {};
        
        if (isNaN(options.farthestPoint.lat)) {
          this.ref.far.lat;
        } else {
          this.ref.far.lat = options.farthestPoint.lat;
        }
        
        if (isNaN(options.far.lng)) {
          this.ref.far.lng;
        } else {
          this.ref.far.lng = options.farthestPoint.lng;
        }
      } else {
        this.ref.far = {
          lat: null,
          lng: null
        };
      }
    }
    
    
    this.getBase = function () {
      return this.base;
    };
    
    this.getCleaned = function () {
      if (this.cleaned == null) {
        if (this.options.basicReorder) {
          this.basicReorder();
        } else {
          this.experimentalReorder();
        }
      }
      return this.cleaned;
    };

    this.getAvg = function () {
      return this.ref.avg;
    };

    this.shuffle = function () {
      var b = this.base.slice(),
          length = b.length;

      for (var i = 0; i < length; i++) {
        var lastVar = b.pop(),
            randIndex = Math.floor(Math.random() * length),
            end = b.splice(randIndex);
        b = b.concat(lastVar).concat(end);
      }
    };

    this.createAvg = function () {
      if (this.base == null)
        throw Error('Base lat/lng data missing.')

      if (this.options.shuffle)
        this.shuffle();

      var latList = [],
          lngList = [],
          base = this.base;

      // function(s) used from class utils
      var calcAvg = this.calcAvg;

      base.forEach(function (each) {
        if (each.lat !== undefined || each.lat !== null || isNaN(Number(each.lat)))
          latList.push(each.lat);

        if (each.lng !== undefined || each.lng !== null || isNaN(Number(each.lng)))
          lngList.push(each.lng);
      });

      this.ref.avg.lat = calcAvg(latList);
      this.ref.avg.lng = calcAvg(lngList);

      if (isNaN(this.ref.avg.lat) || isNaN(this.ref.avg.lng))
        throw Error('Averages failed to be calculated.')

      return this;
    };


    this.createFar = function () {
      // check avg and build it if not built
      if (this.ref.avg.lat == null || this.ref.avg.lng == null)
        this.createAvg();

      var tempSelect = {
            obj: null,
            distFromAvg: null
          },
          base = this.base;

      // function(s) used from class utils
      var calcDist = this.calcDist;

      // find point farthest from average or closest to stated far
      if (this.ref.far.lat == null || this.ref.far.lng == null) {
        var avg = this.ref.avg;
        base.forEach(function (each) {
          var distFromAvg = calcDist(each.lat, each.lng, avg.lat, avg.lng);
          if (tempSelect.obj == null || distFromAvg > tempSelect.distFromAvg){
            tempSelect.obj = each;
            tempSelect.distFromAvg = distFromAvg; 
          }
        });
      } else {
        var far = this.ref.far;
        base.forEach(function (each) {
          var distFromAvg = calcDist(each.lat, each.lng, far.lat, far.lng);
          if (tempSelect.obj == null || distFromAvg < tempSelect.distFromAvg) {
            tempSelect.obj = each;
            tempSelect.distFromAvg = distFromAvg; 
          }
        });
      }

      this.ref.far.lat = tempSelect.obj.lat;
      this.ref.far.lng = tempSelect.obj.lng;
      this.ref.far.obj = tempSelect.obj;

      return this;
    };


    this.pruneNearby = function () {
      // check far and build it if not built
      if (this.ref.far.lat == null || this.ref.far.lng == null)
        this.createFar();
        if (this.ref.far.lat == null || this.ref.far.lng == null)
          throw Error('Farthest point failed to be calculated.')

      var order = [],
          far = this.ref.far,
          proximity = this.options.sensitivity.proximity,
          base = this.base;

      // function(s) used from class utils
      var calcDist = this.calcDist;

      base.forEach(function (each) {
        var ok = true;
        for (var i = 0; i < order.length; i++) {
          var pt = order[i],
              dist = calcDist(each.lat, each.lng, pt.lat, pt.lng);
          if (dist < proximity) {
            ok = false;
          }
        }
        if (ok) {
          order.push(each);
        }
      });
      this.ref.pruned = order;

      return this;
    };


    this.basicReorder = function () {
      // check far and build it if not built
      if (this.ref.pruned == null)
        this.pruneNearby();

      var far = this.ref.far,
          pruned = this.ref.pruned;

      // function(s) used from class utils
      var calcDist = this.calcDist,
          calcAngle = this.calcAngle;

      var proximity = this.options.sensitivity.proximity;

      var order = [far.obj];

      pruned.forEach(function () {
        var tempOrder = order,
            placeBef = {
              obj: null,
              dist: null,
              before: false
            },
            last = tempOrder[tempOrder.length - 1];

        pruned.forEach(function (each, eachIndex) {
          var dist = calcDist(each.lat, each.lng, last.lat, last.lng);
          if ((placeBef.dist == null || dist < placeBef.dist) && dist > proximity) {
            var match = false;
            tempOrder.forEach(function (ea) {
              var d2 = calcDist(each.lat, each.lng, ea.lat, ea.lng);
              if (d2 < proximity) {
                match = true;
              }
            });

            if (match == false) {
              placeBef.obj = each;
              placeBef.dist = dist;

              var prior = order[order.length - 2];
              if (prior !== undefined) {

                // B = before, E = each, L = last
                var distBE = calcDist(each.lat, each.lng, prior.lat, prior.lng),
                    distEL = calcDist(each.lat, each.lng, last.lat, last.lng),
                    distBL = calcDist(prior.lat, prior.lng, last.lat, last.lng),

                    dist_bef = distBE + distEL,
                    dist_aft = distBL + distEL;
                if (dist_bef < dist_aft) {
                  placeBef.before = true;
                } else {
                  placeBef.before = false;
                }
              } else {
                placeBef.before = false;
              }
            }
          }
        });

        if (placeBef.obj !== null) {
          if (placeBef.before) {
            var ordLast = order.pop();
            order.push(placeBef.obj);
            order.push(ordLast);
          } else {
            order.push(placeBef.obj);
          }
        }
      });

      this.cleaned = this.jagCleaner(order);
      return this;
    };

    this.experimentalReorder = function () {
      // check far and build it if not built
      if (this.ref.pruned == null)
        this.pruneNearby();

      var far = this.ref.far,
          proximity = this.options.sensitivity.proximity,
          angleThreshold = this.options.sensitivity.angle,
          pruned = this.ref.pruned;

      // function(s) used from class utils
      var calcDist = this.calcDist,
          calcAngle = this.calcAngle;

      var order = [far.obj];

      pruned.forEach(function (each, eachIndex) {
        var tempOrder = order.slice(),
            placeBef = {
              index: null,
              dist: null
            };
        
        tempOrder.forEach(function (target, i) {
          var dist = calcDist(each.lat, each.lng, target.lat, target.lng);
          if ((placeBef.dist == null || dist < placeBef.dist) && dist > proximity) {

            if (tempOrder.length == 0) {
              placeBef.index = i;
              placeBef.dist = dist;
            } else {

              // if is last item
              if (i == (tempOrder.length - 1) && tempOrder.length > 1) {
                var ptA = tempOrder[i - 1],
                    ptB = target;

                    // in middle
                    distAE = calcDist(ptA.lat, ptA.lng, each.lat, each.lng),
                    distEB = calcDist(each.lat, each.lng, ptB.lat, ptB.lng),

                    // after
                    distAB = calcDist(ptA.lat, ptA.lng, ptB.lat, ptB.lng),
                    distBE = calcDist(ptB.lat, ptB.lng, each.lat, each.lng),

                    dist_mid = distAE + distEB,
                    dist_aft = distAB + distBE;

                if (dist_mid < dist_aft) {
                  placeBef.index = i;
                } else {
                  placeBef.index = i + 1;
                }
                placeBef.dist = dist;

              // if is first item
              } else if (i == 0) {
                if (tempOrder.length == 1) {
                  placeBef.index = 0;
                  placeBef.dist = dist;
                } else {
                  var ptA = tempOrder[0],
                      ptB = tempOrder[1],

                      // prior
                      distEA = calcDist(each.lat, each.lng, ptA.lat, ptA.lng),
                      distAB = calcDist(ptA.lat, ptA.lng, ptB.lat, ptB.lng),

                      // in middle
                      distAE = calcDist(ptA.lat, ptA.lng, each.lat, each.lng),
                      distEB = calcDist(each.lat, each.lng, ptB.lat, ptB.lng),

                      dist_bef = distEA + distAB,
                      dist_mid = distAE + distEB;

                  if (dist_bef < dist_mid) {
                    placeBef.index = 0;
                  } else {
                    placeBef.index = 1;
                  }
                  placeBef.dist = dist;
                }

              // otherwise in middle of array
              } else {
                var ptBef = tempOrder[i - 1],
                    ptMid = target,
                    ptAft = tempOrder[i + 1],

                    // prior segment
                    dist_BE = calcDist(ptBef.lat, ptBef.lng, each.lat, each.lng),
                    dist_EM = calcDist(each.lat, each.lng, ptMid.lat, ptMid.lng),
                    dist_MA = calcDist(ptMid.lat, ptMid.lng, ptAft.lat, ptAft.lng),

                    // subsequent segment
                    dist_BM = calcDist(ptBef.lat, ptBef.lng, ptMid.lat, ptMid.lng),
                    dist_ME = calcDist(ptMid.lat, ptMid.lng, each.lat, each.lng),
                    dist_EA = calcDist(each.lat, each.lng, ptAft.lat, ptAft.lng),

                    plc_bef = dist_BE + dist_EM + dist_MA,
                    plc_aft = dist_BM + dist_ME + dist_EA;

                if (plc_bef < plc_aft) {
                  placeBef.index = i;
                } else {
                  placeBef.index = i + 1;
                }
                placeBef.dist = dist;
              }
            }
          }
        });

        if (placeBef.index !== null && placeBef.dist !== null) {
          var end = tempOrder.splice(placeBef.index);
          order = tempOrder.concat(each).concat(end);
        }
      });

      // order = this.jagCleaner(order);

      this.cleaned = order;
      return this;
    };


    this.jagCleaner = function (base) {
      var angleLimit = this.options.sensitivity.angle;

      base.forEach(function (each, eachIndex) {
        var prior = base[eachIndex - 1],
            after = base[eachIndex + 1]
        if (prior !== undefined && after !== undefined) {
          //
        }
      });

      return base;
    };


    this.calcDist = function (lat1, lng1, lat2, lng2) {
      var R = 6371000,
          rad = (Math.PI / 180),

          x = (lng2 - lng1) * rad,
          y = (lat2 - lat1) * rad;

      return R * Math.sqrt((x * x) + (y * y));
    };

    this.calcAngle = function (A,B,C) {
      if (A == 0 || B == 0 || C == 0) { return false; }

      // conversion from radians to degrees = * (180 / Math.PI)
      var angleABC = Math.acos(((B * B) + (C * C) - (A * A)) / (2 * B * C)) * (180 / Math.PI),
          angleACB = Math.acos(((A * A) + (C * C) - (B * B)) / (2 * A * C)) * (180 / Math.PI);

      return 180 - angleABC - angleACB;
    };

    this.calcAvg = function (elem) {
      if (elem.length > 2) {
        var sum = elem.reduce(function(a, b) { return a + b; });
        return sum / elem.length;
      } else {
        throw Error('Not enough points in lat/lng lists provided to perform calculation.');
      }
    };
  },

};

