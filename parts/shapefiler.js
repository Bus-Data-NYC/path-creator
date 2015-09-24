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
          pruned = this.ref.pruned;

      // function(s) used from class utils
      var calcDist = this.calcDist;

      order.push(far.obj);

      pruned.forEach(function (each) {
        var tempOrder = order,
            placeAfter = {
              index: null,
              dist: null
            };

        for (var i = 0; i < tempOrder.length; i++) {
          var pt = tempOrder[i],
              dist = calcDist(each.lat, each.lng, pt.lat, pt.lng);
          if (placeAfter.index == null || dist < placeAfter.dist) {
            placeAfter.index = i;
            placeAfter.dist = dist;
          }
        }

        var end = tempOrder.splice(placeAfter.index);
        order = tempOrder.concat(each).concat(end);
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

