module.exports = function (baseGTFS) {
	// init components
  this.base = baseGTFS,
  this.cleaned = null,

  this.getCleaned = function () {
  	return this.cleaned;
  }

	// © Chris Veness, MIT-licensed, http://www.movable-type.co.uk/scripts/latlong.html#equirectangular
	this.distance = function (lambda1,phi1,lambda2,phi2) {
	  var R = 6371000; // meters
	  difLambda = (lambda2 - lambda1) * Math.PI / 180;
	  phi1 = phi1 * Math.PI / 180;
	  phi2 = phi2 * Math.PI / 180;
	  var x = difLambda * Math.cos((phi1+phi2)/2);
	  var y = (phi2-phi1);
	  var d = Math.sqrt(x*x + y*y);
	  return R * d;
	};

	// produce shapefile
  this.create = function (results) {
  	if (this.base == null) {
  		return false;
  	} else {
      
      var distance = this.distance;
      var pointlist = {}; 


      this.base.forEach(function (point) {
        var id = point.shape_id;
        if (!pointlist.hasOwnProperty(id)) {
          pointlist[id] = {};
        }
        if (!pointlist[id].hasOwnProperty(point.direction_id)) {
          pointlist[id][point.direction_id] = [point];
        } else {
          var ti = pointlist[id][point.direction_id][0].trip_index;
          var cr = point.trip_index;
          if (ti == cr && (point.direction_id == 0 || point.direction_id == 1)) {
            pointlist[id][point.direction_id].push(point);
          }
        }
      });

      // currently I roll everything into one trip in each direction
      var sel = {0: [], 1:[]};
      for (id in pointlist) {
      	var rt = pointlist[id];
      	if (Array.isArray(rt[0]) && rt[0].length > 0) { sel[0] = sel[0].concat(rt[0]); }
      	if (Array.isArray(rt[1]) && rt[1].length > 0) { sel[1] = sel[1].concat(rt[1]); }
      }

      // then I clean the results of the merge(s)
      for (n in [0, 1]) {
				for (var i = 0; i < sel[n].length;  i++) {
					if (sel[n][i] == null || sel[n][i] == undefined || typeof sel[n][i] !== 'object') {
						sel[n].splice(i, 1);
					}
				}
			}

			// use distance measure to determine if sae trip for breadcrumbs
			var broken = {0: [], 1:[]};
      for (n in [0, 1]) {
      	var trip = [];

      	var oneway = sel[n],
		      	ow_lat = [],
		      	ow_lng = [];

      	for (var i = 0; i < oneway.length;  i++) {
      		var current = oneway[i];
      		ow_lat.push(current.shape_pt_lat);
      		ow_lng.push(current.shape_pt_lon);
      	}

      	function getAvg (elem) {
      		if (elem.length > 2) {
		      	var sum = elem.reduce(function(a, b) { return a + b; });
						return sum / elem.length;
      		} else {
      			return null;
      		}
      	}

      	var avg = {
      		lat: getAvg(ow_lat),
      		lng: getAvg(ow_lng),
      		farthest: null,
      	};

      	// break if something is wrong with avgs
      	if (avg.lat == null || avg.lng == null) {
      		return this;
      	}

      	// get the farthestmost point and mark that as the starter
      	for (var i = 0; i < oneway.length;  i++) {
      		var current = oneway[i];
      		var dist = distance(current.shape_pt_lat, current.shape_pt_lon, avg.lat, avg.lng);
      		if (avg.farthest == null || dist > avg.farthest.dist) {
      			avg.farthest = {
      				dist: dist,
      				obj: current
      			};
      		}
      	}

      	if (avg.farthest.obj == null) {
      		console.log('No farthest object found.');
      		return this;
      	}

      	var far = avg.farthest.obj;

      	oneway = oneway.map(function (current) {
      		if (current.shape_pt_lat !== null && current.shape_pt_lon !== null) {
	      		var dist = distance(current.shape_pt_lat, current.shape_pt_lon, far.shape_pt_lat, far.shape_pt_lon);
	      		current.distFromFarthest = dist;
      		} else {
      			current.distFromFarthest = null;
      		}
	      	return current;
      	});

      	oneway.sort(function (a, b) {
      		return a.distFromFarthest - b.distFromFarthest;
      	});

      	// remove any null vals
      	oneway = oneway.filter(function (val, i, ar) {
      		if (val.distFromFarthest == null || val.distFromFarthest == undefined || val.distFromFarthest > 450) {
      			return false;
      		} else {
      			return true;
      		}
      	});

      	var first = oneway[0];

      	// function checkNotSorted (sorted, current) {
      	// 	var cu = current.shape_pt_sequence;
    			// for (var i = 0; i < sorted.length;  i++) {
    			// 	var so = sorted[i].shape_pt_sequence
    			// 	if (cu == so) {
    			// 		return false;
    			// 	}
    			// }
    			// return true;
      	// }

      	// var sorted = [];

      	// sorted.push(avg.farthest.obj);

      	// for (var j = 0; j < oneway.length;  j++) {
      	// 	var nearest = {
      	// 		obj: null,
      	// 		dist: 999999999999
      	// 	}
	      // 	for (var i = 0; i < oneway.length;  i++) {
	      // 		var current = oneway[i],
      	// 				last = sorted[sorted.length - 1];
      	// 		if (last && last.shape_pt_lat !== undefined && last.shape_pt_lon !== undefined) {
		     //  		var dist = this.distance(current.shape_pt_lat, current.shape_pt_lon, last.shape_pt_lat, last.shape_pt_lon);
		     //  		if (current.shape_pt_sequence !== avg.farthest.obj.shape_pt_sequence) {
		     //  			if (dist < nearest.dist && checkNotSorted(sorted, current)) {
		     //  				nearest.obj = current;
		     //  				nearest.dist = dist;
		     //  			}
		     //  		}
      	// 		}
	      // 	}
	      // 	if (nearest.obj !== null && nearest.dist < 750) {
	      // 		sorted.push(nearest.obj);
	      // 	}
      	// }

      	broken[n] = oneway;
			}

			this.cleaned = broken;
			return this;
  	}
  }
}

