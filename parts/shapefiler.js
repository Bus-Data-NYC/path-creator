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

  shapefiler: function (pointCluster) {
  
    // check to see if mandatory vars supplied
    if (pointCluster == undefined)
      throw Error('Lat/Lng data not supplied; shapefiler build failed.')

    
    // init components
    this.base = pointCluster;
    this.cleaned = null;
    this.ref = {
      angleSensitivity: 0.175,
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
    
    
    this.getBase = function () {
      return this.base;
    };
    
    this.getCleaned = function () {
      if (this.cleaned == null) {
        this.reorder();
      }
      return this.cleaned;
    };

    this.getAvg = function () {
      return this.ref.avg;
    };


    this.createAvg = function () {
      if (this.base == null)
        throw Error('Base lat/lng data missing.')

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

      return this;
    };


    this.createFar = function () {
      var tempFarthest = null,
          avg = this.ref.avg,
          base = this.base;

      // check avg and build it if not built
      if (avg.lat == null || avg.lng == null)
        this.createAvg();
        if (avg.lat == null || avg.lng == null)
          throw Error('Averages failed to be calculated.')

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
          base = this.base;

      // function(s) used from class utils
      var calcDist = this.calcDist;

      base.forEach(function (each) {
        var ok = true;
        for (var i = 0; i < order.length; i++) {
          var pt = order[i],
              dist = calcDist(each.lat, each.lng, pt.lat, pt.lng);
          if (dist < 10) {
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


    this.reorder = function () {
      // check far and build it if not built
      if (this.ref.pruned == null)
        this.pruneNearby();

      var order = [],
          far = this.ref.far,
          sensitivity = {
            low: 180 - this.ref.angleSensitivity * 180,
            high: 180 + this.ref.angleSensitivity * 180
          },
          pruned = this.ref.pruned;

      // function(s) used from class utils
      var calcDist = this.calcDist,
          calcAngle = this.calcAngle;

      order.push(far.obj);

      pruned.forEach(function (each, eachIndex) {
        var tempOrder = order,
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

                    // base variant
                    distAB = calcDist(ptA.lat, ptA.lng, ptB.lat, ptB.lng),

                    // in middle
                    distAE = calcDist(ptA.lat, ptA.lng, each.lat, each.lng),
                    distEB = calcDist(each.lat, each.lng, ptB.lat, ptB.lng),

                    // prior
                    distEA = calcDist(each.lat, each.lng, ptA.lat, ptA.lng),

                    // after
                    distBE = calcDist(ptB.lat, ptB.lng, each.lat, each.lng),

                    dist_bef = distEA + distAB,
                    dist_mid = distAE + distEB,
                    dist_aft = distAB + distBE;

                if (dist_bef < dist_mid && dist_bef < dist_aft) {
                  placeAfter.index = i - 1;
                } else if (dist_mid < dist_bef && dist_mid < dist_aft) {
                  placeAfter.index = i;
                } else {
                  placeAfter.index = i + 1;
                }
                placeAfter.dist = dist;console.log('h', placeAfter)
              } else if (i == 0) {
                if (tempOrder.length == 1) {
                  placeAfter.index = 1;
                  placeAfter.dist = dist;
                } else {
                  if (eachIndex < 4)
                    console.log(each.shape_pt_sequence, dist)

                  var ptA = tempOrder[i],
                      ptB = tempOrder[i + 1],

                      // base variant
                      distAB = calcDist(ptA.lat, ptA.lng, ptB.lat, ptB.lng),

                      // in middle
                      distAE = calcDist(ptA.lat, ptA.lng, each.lat, each.lng),
                      distEB = calcDist(each.lat, each.lng, ptB.lat, ptB.lng),

                      // prior
                      distEA = calcDist(each.lat, each.lng, ptA.lat, ptA.lng),

                      // after
                      distBE = calcDist(ptB.lat, ptB.lng, each.lat, each.lng),

                      dist_bef = distEA + distAB,
                      dist_mid = distAE + distEB,
                      dist_aft = distAB + distBE;

                  if (eachIndex < 4) {
                    console.log('ptB: ' + ptB.shape_pt_sequence, tempOrder[i].shape_pt_sequence);
                    console.log('ff', dist_bef, dist_mid, dist_aft);
                  }

                      if (dist_bef < dist_mid && dist_bef < dist_aft) {
                        placeAfter.index = 0;
                      } else if (dist_mid < dist_bef && dist_mid < dist_aft) {
                        placeAfter.index = 1;
                      } else {
                        placeAfter.index = 2;
                      }
                      placeAfter.dist = dist;
                }
              } else {
                var ptBef = tempOrder[i - 1],
                    ptMid = tempOrder[i],
                    ptAft = tempOrder[i + 1],

                    // prior segment
                    dist_BM = calcDist(ptBef.lat, ptBef.lng, ptMid.lat, ptMid.lng),
                    dist_BE = calcDist(ptBef.lat, ptBef.lng, each.lat, each.lng),
                    dist_EM = calcDist(each.lat, each.lng, ptMid.lat, ptMid.lng),

                    // subsequent segment
                    dist_MA = calcDist(ptMid.lat, ptMid.lng, ptAft.lat, ptAft.lng),
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

          if (eachIndex == 2) {
            console.log('placeAfter', placeAfter);
            order.forEach(function (each) { console.log(each); });
          }
        }
      });

      order.forEach(function (ea, i) {
        if (i > 273) {
          var latlng = new L.latLng(ea.lat, ea.lng);
          L.circle(latlng, 4).bindPopup('Num ' + i + ' and seq: ' + ea.shape_pt_sequence).addTo(map); 
        } else {
          var latlng = new L.latLng(ea.lat, ea.lng);
          L.circle(latlng, 8, {color: 'green'}).bindPopup('Num ' + i + ' and seq: ' + ea.shape_pt_sequence).addTo(map); 
        }
      });

      this.cleaned = order;
      return this;
    };


    // Internal tooling, modified from Chris Veness
    this.calcDist = function (lambda1,phi1,lambda2,phi2) {
      var R = 6371000; // meters
      difLambda = (lambda2 - lambda1) * Math.PI / 180;
      phi1 = phi1 * Math.PI / 180;
      phi2 = phi2 * Math.PI / 180;
      var x = difLambda * Math.cos((phi1+phi2)/2);
      var y = (phi2-phi1);
      var d = Math.sqrt(x*x + y*y);
      return R * d;
    };

    this.calcAngle = function (A,B,C) {
      if (A == 0 || B == 0 || C == 0) {
        return false;
      }
      var angleABC = Math.acos(((B * B) + (C * C) - (A * A)) / (2 * B * C)),
          angleACB = Math.acos(((A * A) + (C * C) - (B * B)) / (2 * A * C));
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

