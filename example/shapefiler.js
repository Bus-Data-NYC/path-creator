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
        dumbReorder: false,
        sensitivity: {
          proximity: 5, // meters
          angle: 50     // degrees
        }
      };
    } else {
      this.options = {};

      if (options.shuffle == true || options.shuffle == false) {
        this.options.shuffle = options.shuffle;
      } else {
        this.options.shuffle = false;
      }

      if (options.dumbReorder == true || options.dumbReorder == false) {
        this.options.dumbReorder = options.dumbReorder;
      } else {
        this.options.dumbReorder = false;
      }

      if (typeof options.sensitivity == 'object') {
        this.options.sensitivity = {};

        if (isNaN(options.sensitivity.proximity)) {
          this.options.sensitivity.proximity = options.sensitivity.proximity;
        } else {
          this.options.sensitivity.proximity = 5;
        }

        if (isNaN(options.sensitivity.angle)) {
          this.options.sensitivity.angle = options.sensitivity.angle;
        } else {
          this.options.sensitivity.angle = 50;
        }

      } else {
        this.options.sensitivity = {
          proximity: 5,
          angle: 50
        };
      }
    }
    
    
    this.getBase = function () {
      return this.base;
    };
    
    this.getCleaned = function () {
      if (this.cleaned == null) {
        if (this.options.dumbReorder) {
          this.dumbReorder();
        } else {
          this.reorder();
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
      var tempFarthest = null,
          avg = this.ref.avg,
          base = this.base;

      // check avg and build it if not built
      if (avg.lat == null || avg.lng == null)
        this.createAvg();

      // function(s) used from class utils
      var calcDist = this.calcDist;

      base.forEach(function (each) {
        each.distFromAvg = calcDist(each.lat, each.lng, avg.lat, avg.lng);
        if (tempFarthest == null || each.distFromAvg > tempFarthest.distFromAvg)
          tempFarthest = each;
      });

      this.ref.far.lat = tempFarthest.lat;
      this.ref.far.lng = tempFarthest.lng;
      this.ref.far.obj = tempFarthest;

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


    this.dumbReorder = function () {
      // check far and build it if not built
      if (this.ref.pruned == null)
        this.pruneNearby();

      var order = [],
          far = this.ref.far,
          pruned = this.ref.pruned;

      // function(s) used from class utils
      var calcDist = this.calcDist,
          calcAngle = this.calcAngle;

      var proximity = this.options.sensitivity.proximity;

      order.push(far.obj);

      pruned.forEach(function () {
        var tempOrder = order,
            placeAfter = {
              obj: null,
              dist: null,
              before: false
            },
            last = tempOrder[tempOrder.length - 1];

        pruned.forEach(function (each, eachIndex) {
          var dist = calcDist(each.lat, each.lng, last.lat, last.lng);
          if ((placeAfter.dist == null || dist < placeAfter.dist) && dist > 5) {
            var match = false;
            tempOrder.forEach(function (ea) {
              var d2 = calcDist(each.lat, each.lng, ea.lat, ea.lng);
              if (d2 < proximity) {
                match = true;
              }
            });

            if (match == false) {
              placeAfter.obj = each;
              placeAfter.dist = dist;

              var prior = order[order.length - 2];
              if (prior !== undefined) {

                // B = before, E = each, L = last
                var distBE = calcDist(each.lat, each.lng, prior.lat, prior.lng),
                    distEL = calcDist(each.lat, each.lng, last.lat, last.lng),
                    distBL = calcDist(prior.lat, prior.lng, last.lat, last.lng),

                    dist_bef = distBE + distEL,
                    dist_aft = distBL + distEL;
                if (dist_bef < dist_aft) {
                  placeAfter.before = true;
                } else {
                  placeAfter.before = false;
                }
              } else {
                placeAfter.before = false;
              }
            }
          }
        });

        if (placeAfter.obj !== null) {
          if (placeAfter.before) {
            var ordLast = order.pop();
            order.push(placeAfter.obj);
            order.push(ordLast);
          } else {
            order.push(placeAfter.obj);
          }
        }
      });

      this.cleaned = order;
      return this;
    };

    this.reorder = function () {
      // check far and build it if not built
      if (this.ref.pruned == null)
        this.pruneNearby();

      var order = [],
          far = this.ref.far,
          angleThreshold = this.options.sensitivity.angle,
          pruned = this.ref.pruned;

      // function(s) used from class utils
      var calcDist = this.calcDist,
          calcAngle = this.calcAngle;

      order.push(far.obj);

      pruned.forEach(function (each, eachIndex) {
        var tempOrder = order.slice(),
            placeAfter = {
              index: null,
              dist: null
            };
        

        for (var i = 0; i < tempOrder.length; i++) {
          var dist = calcDist(each.lat, each.lng, tempOrder[i].lat, tempOrder[i].lng);

          if ((placeAfter.dist == null || dist < placeAfter.dist) && dist > 5) {

            if (tempOrder.length == 0) {
              placeAfter.index = i;
              placeAfter.dist = dist;
            } else {
              if (i == (tempOrder.length - 1) && tempOrder.length > 1) {
                var ptA = tempOrder[i - 1],
                    ptB = tempOrder[i];

                    // in middle
                    distAE = calcDist(ptA.lat, ptA.lng, each.lat, each.lng),
                    distEB = calcDist(each.lat, each.lng, ptB.lat, ptB.lng),

                    // after
                    distAB = calcDist(ptA.lat, ptA.lng, ptB.lat, ptB.lng),
                    distBE = calcDist(ptB.lat, ptB.lng, each.lat, each.lng),

                    dist_mid = distAE + distEB,
                    dist_aft = distAB + distBE;

                if (dist_mid < dist_aft) {
                  placeAfter.index = i;
                } else {
                  placeAfter.index = i + 1;
                }
                placeAfter.dist = dist;

              } else if (i == 0) {
                if (tempOrder.length == 1) {
                  placeAfter.index = 0;
                  placeAfter.dist = dist;
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
                    placeAfter.index = 0;
                  } else {
                    placeAfter.index = 1;
                  }
                  placeAfter.dist = dist;
                }
              } else {
                var ptBef = tempOrder[i - 1],
                    ptMid = tempOrder[i],
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
                  placeAfter.index = i;
                } else {
                  placeAfter.index = i + 1;
                }
                placeAfter.dist = dist;
              }
            }
          }
        }

        if (placeAfter.index !== null && placeAfter.dist !== null) {
          var end = tempOrder.splice(placeAfter.index);
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

