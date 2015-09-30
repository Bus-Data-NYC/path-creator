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

                    // in middle
                    distAE = calcDist(ptA.lat, ptA.lng, each.lat, each.lng),
                    distEB = calcDist(each.lat, each.lng, ptB.lat, ptB.lng),

                    // after
                    distAB = calcDist(ptA.lat, ptA.lng, ptB.lat, ptB.lng),
                    distBE = calcDist(ptB.lat, ptB.lng, each.lat, each.lng),

                    dist_mid = distAE + distEB,
                    dist_aft = distAB + distBE;

                if (dist_mid < dist_aft) {
                  placeAfter.index = i - 1;
                } else {
                  placeAfter.index = i;
                }
                placeAfter.dist = dist;

              } else if (i == 0) {
                if (tempOrder.length == 1) {
                  placeAfter.index = 0;
                  placeAfter.dist = dist;
                } else {
                  var ptA = tempOrder[i],
                      ptB = tempOrder[i + 1],

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

          if (placeAfter.index == 152 && order[placeAfter.index + 1] !== undefined) {
            console.log('T Len: ' + tempOrder.length);
            var end = tempOrder.splice(placeAfter.index);
            console.log('End: ', end);
            console.log('Ea: ', each);
            order = tempOrder.concat(each).concat(end);
            console.log('order: ', order);
            console.log(i - 1 + ': ', order[placeAfter.index - 1]);
            console.log(i + ': ', order[placeAfter.index]);
            console.log(i + 1 + ': ', order[placeAfter.index + 1]);
            var ptEac = new L.latLng(each.lat, each.lng),
                ptBef = new L.latLng(order[placeAfter.index - 2].lat, order[placeAfter.index - 2].lng),
                ptMid = new L.latLng(order[placeAfter.index - 1].lat, order[placeAfter.index - 1].lng),
                ptAft = new L.latLng(order[placeAfter.index + 1].lat, order[placeAfter.index + 1].lng);

                // prior segment
                dist_BM = new L.Polyline([ptBef, ptMid], { color: 'red', weight: 1 } ),
                dist_BE = new L.Polyline([ptBef, ptEac], { color: 'green', weight: 1 } ),
                dist_EM = new L.Polyline([ptEac, ptMid], { color: 'purple', weight: 1 } ),

              // subsequent segment
              dist_MA = new L.Polyline([ptMid, ptAft], { color: 'orange', weight: 1 } ),
              dist_ME = new L.Polyline([ptMid, ptEac], { color: 'blue', weight: 2 } ),
              dist_EA = new L.Polyline([ptEac, ptAft], { color: 'blue', weight: 2 } );

            dist_BM.addTo(map);
            dist_BE.addTo(map);
            dist_EM.addTo(map);
            dist_MA.addTo(map);
            dist_ME.addTo(map);
            dist_EA.addTo(map);

            var cc_bef = L.circle(L.latLng(ptBef.lat, ptBef.lng), 4, {color: 'blue'}).addTo(map),
                cc_mid = L.circle(L.latLng(ptMid.lat, ptMid.lng), 8, {color: 'red'}).addTo(map),
                cc_aft = L.circle(L.latLng(ptAft.lat, ptAft.lng), 2, {color: 'purple'}).addTo(map),
                cc_ea = L.circle(L.latLng(each.lat, each.lng), 8, {color: 'yellow'}).addTo(map);

            // debugger;

            map.removeLayer(dist_BM);
            map.removeLayer(dist_BE);
            map.removeLayer(dist_EM);
            map.removeLayer(dist_MA);
            map.removeLayer(dist_ME);

            map.removeLayer(cc_bef);
            map.removeLayer(cc_mid);
            map.removeLayer(cc_aft);

            map.removeLayer(dist_EA);
            map.removeLayer(cc_ea);
          } else {

          var end = tempOrder.splice(placeAfter.index);
          order = tempOrder.concat(each).concat(end);            
          }


          if (fooLayer !== undefined) {
            fooLayer.forEach(function (each) {
              map.removeLayer(each);
            });
          } else {
            fooLayer = [];
          }

          if (placeAfter.index > 15000) {
            order.forEach(function (each) {
              var latlng = new L.latLng(each.lat, each.lng);
              var circ = L.circle(latlng, 1, {color: 'black', opacity: 0});
              circ.addTo(map);
              fooLayer.push(circ);
            });
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

