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

      order.push(far.obj);

      pruned.forEach(function () {
        var tempOrder = order,
            placeAfter = {
              obj: null,
              dist: null
            },
            last = tempOrder[tempOrder.length - 1];

        pruned.forEach(function (each, eachIndex) {
          var dist = calcDist(each.lat, each.lng, last.lat, last.lng);
          if ((placeAfter.dist == null || dist < placeAfter.dist) && dist > 5) {
            var match = false;
            tempOrder.forEach(function (ea) {
              var d2 = calcDist(each.lat, each.lng, ea.lat, ea.lng);
              if (d2 < 5) {
                match = true;
              }
            });

            if (match == false) {
              placeAfter.obj = each;
              placeAfter.dist = dist;
            }
          }
        });

        if (placeAfter.obj !== null) {
          order.push(placeAfter.obj);
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


      // order.forEach(function (ea, i) {
      //   if (i == order.length - 1) {
      //     var latlng = new L.latLng(ea.lat, ea.lng);
      //     L.circle(latlng, 4).bindPopup('Num ' + i + ' and seq: ' + ea.shape_pt_sequence).addTo(map);
      //   } else {
      //     var latlng = new L.latLng(ea.lat, ea.lng);
      //     L.circle(latlng, 8, {color: 'green'}).bindPopup('Num ' + i + ' and seq: ' + ea.shape_pt_sequence).addTo(map);
      //   }
      // });

      tempOrder = order.slice();

      tempOrder.forEach(function (each, eachIndex) {
        
        // check if not end point
        var prior = tempOrder[eachIndex - 1],
            after = tempOrder[eachIndex + 1];

        if (prior !== undefined && after !== undefined) {
          var dist_bef = calcDist(prior.lat, prior.lng, each.lat, each.lng),
              dist_aft = calcDist(each.lat, each.lng, after.lat, after.lng),
              dist_mid = calcDist(prior.lat, prior.lng, after.lat, after.lng);

          if (Math.abs((dist_bef + dist_aft) - dist_mid) > 0.5) {
            console.log('Dist Bef: ', dist_bef);
            console.log('Dist Mid: ', dist_mid);
            console.log('Dist Aft: ', dist_aft);
            console.log('Angle: ', calcAngle(dist_bef, dist_aft, dist_mid));
            console.log('');

            var a = [L.latLng(prior.lat, prior.lng), L.latLng(each.lat, each.lng)];
            var b = [L.latLng(after.lat, after.lng), L.latLng(each.lat, each.lng)];
            var c = [L.latLng(prior.lat, prior.lng), L.latLng(after.lat, after.lng)];

            var la = L.polyline(a, {color: 'red', weight: 1});
                // la.addTo(map);
            var lb = L.polyline(b, {color: 'green', weight: 1});
                // lb.addTo(map);
            var lc = L.polyline(c, {color: 'blue', weight: 1});
                lc.addTo(map);
            
            var latlng = new L.latLng(prior.lat, prior.lng);
            var gc1 = new L.circle(latlng, 8, {color: 'red'}).addTo(map);

            var latlng = new L.latLng(each.lat, each.lng);
            var gc2 = new L.circle(latlng, 8, {color: 'green'}).addTo(map);

            var latlng = new L.latLng(after.lat, after.lng);
            var gc3 = new L.circle(latlng, 8, {color: 'orange'}).addTo(map);

            debugger;

            map.removeLayer(la);
            map.removeLayer(lb);
            map.removeLayer(lc);

            map.removeLayer(gc1);
            map.removeLayer(gc2);
            map.removeLayer(gc3);
          }
        }
      });

      order.forEach(function (ea, i) {
        if (i == order.length - 1) {
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
      var R = 6371000; 

      var phi1 = lambda1 * (Math.PI / 180);
      var phi2 = lambda2 * (Math.PI / 180);
      var deltaphi = (lambda2-lambda1) * (Math.PI / 180);
      var deltalambda = (phi2-phi1) * (Math.PI / 180);

      var a = Math.sin(deltaphi/2) * Math.sin(deltaphi/2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltalambda/2) * Math.sin(deltalambda/2);
      var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      var d = R * c;

      return d;
    };

    this.calcAngle = function (A,B,C) {
      if (A == 0 || B == 0 || C == 0) { return false; }

      // conversion from radians to degrees = * (180 / Math.PI)
      var angleABC = Math.acos(((B * B) + (C * C) - (A * A)) / (2 * B * C)) * (180 / Math.PI),
          angleACB = Math.acos(((A * A) + (C * C) - (B * B)) / (2 * A * C)) * (180 / Math.PI);
      console.log(angleABC, angleACB);
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

