var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
// Split strategy constants
var CENTER = 0;
var AVERAGE = 1;
var SAH = 2;
var MeshBVHNode = /** @class */ (function () {
    function MeshBVHNode() {
        // internal nodes have boundingData, left, right, and splitAxis
        // leaf nodes have offset and count (referring to primitives in the mesh geometry)
    }
    return MeshBVHNode;
}());
// Returns a Float32Array representing the bounds data for box.
function boxToArray(bx) {
    var arr = new Float32Array(6);
    arr[0] = bx.min.x;
    arr[1] = bx.min.y;
    arr[2] = bx.min.z;
    arr[3] = bx.max.x;
    arr[4] = bx.max.y;
    arr[5] = bx.max.z;
    return arr;
}
function arrayToBox(arr, target) {
    target.min.x = arr[0];
    target.min.y = arr[1];
    target.min.z = arr[2];
    target.max.x = arr[3];
    target.max.y = arr[4];
    target.max.z = arr[5];
    return target;
}
function getLongestEdgeIndex(bounds) {
    var splitDimIdx = -1;
    var splitDist = -Infinity;
    for (var i = 0; i < 3; i++) {
        var dist = bounds[i + 3] - bounds[i];
        if (dist > splitDist) {
            splitDist = dist;
            splitDimIdx = i;
        }
    }
    return splitDimIdx;
}
var xyzFields = ['x', 'y', 'z'];
var boxTemp = new THREE.Box3();
function ensureIndex(geo) {
    if (!geo.index) {
        var vertexCount = geo.attributes.position.count;
        var index = new (vertexCount > 65535 ? Uint32Array : Uint16Array)(vertexCount);
        geo.setIndex(new THREE.BufferAttribute(index, 1));
        for (var i = 0; i < vertexCount; i++) {
            index[i] = i;
        }
    }
}
// Computes the set of { offset, count } ranges which need independent BVH roots. Each
// region in the geometry index that belongs to a different set of material groups requires
// a separate BVH root, so that triangles indices belonging to one group never get swapped
// with triangle indices belongs to another group. For example, if the groups were like this:
//
// [-------------------------------------------------------------]
// |__________________|
//   g0 = [0, 20]  |______________________||_____________________|
//                      g1 = [16, 40]           g2 = [41, 60]
//
// we would need four BVH roots: [0, 15], [16, 20], [21, 40], [41, 60].
function getRootIndexRanges(geo) {
    if (!geo.groups || !geo.groups.length) {
        return [{ offset: 0, count: geo.index.count / 3 }];
    }
    var ranges = [];
    var rangeBoundaries = new Set();
    for (var _i = 0, _a = geo.groups; _i < _a.length; _i++) {
        var group = _a[_i];
        rangeBoundaries.add(group.start);
        rangeBoundaries.add(group.start + group.count);
    }
    // note that if you don't pass in a comparator, it sorts them lexicographically as strings :-(
    var sortedBoundaries = Array.from(rangeBoundaries.values()).sort(function (a, b) { return a - b; });
    for (var i = 0; i < sortedBoundaries.length - 1; i++) {
        var start = sortedBoundaries[i], end = sortedBoundaries[i + 1];
        ranges.push({ offset: (start / 3), count: (end - start) / 3 });
    }
    return ranges;
}
// computes the union of the bounds of all of the given triangles and puts the resulting box in target. If
// centroidTarget is provided then a bounding box is computed for the centroids of the triangles, as well.
// These are computed together to avoid redundant accesses to bounds array.
function getBounds(triangleBounds, offset, count, target, centroidTarget) {
    if (centroidTarget === void 0) { centroidTarget = null; }
    var minx = Infinity;
    var miny = Infinity;
    var minz = Infinity;
    var maxx = -Infinity;
    var maxy = -Infinity;
    var maxz = -Infinity;
    var cminx = Infinity;
    var cminy = Infinity;
    var cminz = Infinity;
    var cmaxx = -Infinity;
    var cmaxy = -Infinity;
    var cmaxz = -Infinity;
    var includeCentroid = centroidTarget !== null;
    for (var i = offset * 6, end = (offset + count) * 6; i < end; i += 6) {
        var cx = triangleBounds[i + 0];
        var hx = triangleBounds[i + 1];
        var lx = cx - hx;
        var rx = cx + hx;
        if (lx < minx)
            minx = lx;
        if (rx > maxx)
            maxx = rx;
        if (includeCentroid && cx < cminx)
            cminx = cx;
        if (includeCentroid && cx > cmaxx)
            cmaxx = cx;
        var cy = triangleBounds[i + 2];
        var hy = triangleBounds[i + 3];
        var ly = cy - hy;
        var ry = cy + hy;
        if (ly < miny)
            miny = ly;
        if (ry > maxy)
            maxy = ry;
        if (includeCentroid && cy < cminy)
            cminy = cy;
        if (includeCentroid && cy > cmaxy)
            cmaxy = cy;
        var cz = triangleBounds[i + 4];
        var hz = triangleBounds[i + 5];
        var lz = cz - hz;
        var rz = cz + hz;
        if (lz < minz)
            minz = lz;
        if (rz > maxz)
            maxz = rz;
        if (includeCentroid && cz < cminz)
            cminz = cz;
        if (includeCentroid && cz > cmaxz)
            cmaxz = cz;
    }
    target[0] = minx;
    target[1] = miny;
    target[2] = minz;
    target[3] = maxx;
    target[4] = maxy;
    target[5] = maxz;
    if (includeCentroid) {
        centroidTarget[0] = cminx;
        centroidTarget[1] = cminy;
        centroidTarget[2] = cminz;
        centroidTarget[3] = cmaxx;
        centroidTarget[4] = cmaxy;
        centroidTarget[5] = cmaxz;
    }
}
// A stand alone function for retrieving the centroid bounds.
function getCentroidBounds(triangleBounds, offset, count, centroidTarget) {
    var cminx = Infinity;
    var cminy = Infinity;
    var cminz = Infinity;
    var cmaxx = -Infinity;
    var cmaxy = -Infinity;
    var cmaxz = -Infinity;
    for (var i = offset * 6, end = (offset + count) * 6; i < end; i += 6) {
        var cx = triangleBounds[i + 0];
        if (cx < cminx)
            cminx = cx;
        if (cx > cmaxx)
            cmaxx = cx;
        var cy = triangleBounds[i + 2];
        if (cy < cminy)
            cminy = cy;
        if (cy > cmaxy)
            cmaxy = cy;
        var cz = triangleBounds[i + 4];
        if (cz < cminz)
            cminz = cz;
        if (cz > cmaxz)
            cmaxz = cz;
    }
    centroidTarget[0] = cminx;
    centroidTarget[1] = cminy;
    centroidTarget[2] = cminz;
    centroidTarget[3] = cmaxx;
    centroidTarget[4] = cmaxy;
    centroidTarget[5] = cmaxz;
}
// reorders `tris` such that for `count` elements after `offset`, elements on the left side of the split
// will be on the left and elements on the right side of the split will be on the right. returns the index
// of the first element on the right side, or offset + count if there are no elements on the right side.
function partition(index, triangleBounds, sahPlanes, offset, count, split) {
    var left = offset;
    var right = offset + count - 1;
    var pos = split.pos;
    var axisOffset = split.axis * 2;
    // hoare partitioning, see e.g. https://en.wikipedia.org/wiki/Quicksort#Hoare_partition_scheme
    while (true) {
        while (left <= right && triangleBounds[left * 6 + axisOffset] < pos) {
            left++;
        }
        while (left <= right && triangleBounds[right * 6 + axisOffset] >= pos) {
            right--;
        }
        if (left < right) {
            // we need to swap all of the information associated with the triangles at index
            // left and right; that's the verts in the geometry index, the bounds,
            // and perhaps the SAH planes
            for (var i = 0; i < 3; i++) {
                var t0 = index[left * 3 + i];
                index[left * 3 + i] = index[right * 3 + i];
                index[right * 3 + i] = t0;
                var t1 = triangleBounds[left * 6 + i * 2 + 0];
                triangleBounds[left * 6 + i * 2 + 0] = triangleBounds[right * 6 + i * 2 + 0];
                triangleBounds[right * 6 + i * 2 + 0] = t1;
                var t2 = triangleBounds[left * 6 + i * 2 + 1];
                triangleBounds[left * 6 + i * 2 + 1] = triangleBounds[right * 6 + i * 2 + 1];
                triangleBounds[right * 6 + i * 2 + 1] = t2;
            }
            if (sahPlanes) {
                for (var i = 0; i < 3; i++) {
                    var t = sahPlanes[i][left];
                    sahPlanes[i][left] = sahPlanes[i][right];
                    sahPlanes[i][right] = t;
                }
            }
            left++;
            right--;
        }
        else {
            return left;
        }
    }
}
function getOptimalSplit(nodeBoundingData, centroidBoundingData, triangleBounds, sahPlanes, offset, count, strategy) {
    var axis = -1;
    var pos = 0;
    // Center
    if (strategy === CENTER) {
        axis = getLongestEdgeIndex(centroidBoundingData);
        if (axis !== -1) {
            pos = (centroidBoundingData[axis] + centroidBoundingData[axis + 3]) / 2;
        }
    }
    else if (strategy === AVERAGE) {
        axis = getLongestEdgeIndex(nodeBoundingData);
        if (axis !== -1) {
            pos = getAverage(triangleBounds, offset, count, axis);
        }
    }
    else if (strategy === SAH) {
        // Surface Area Heuristic
        // In order to make this code more terse, the x, y, and z
        // variables of various structures have been stuffed into
        // 0, 1, and 2 array indices so they can be easily computed
        // and accessed within array iteration
        // Cost values defineed for operations. We're using bounds for traversal, so
        // the cost of traversing one more layer is more than intersecting a triangle.
        var TRAVERSAL_COST_1 = 3;
        var INTERSECTION_COST_1 = 1;
        var bb = arrayToBox(nodeBoundingData, boxTemp);
        // Define the width, height, and depth of the bounds as a box
        var dim = [
            bb.max.x - bb.min.x,
            bb.max.y - bb.min.y,
            bb.max.z - bb.min.z
        ];
        var sa = 2 * (dim[0] * dim[1] + dim[0] * dim[2] + dim[1] * dim[2]);
        // Get the precalculated planes based for the triangles we're
        // testing here
        var filteredLists = [[], [], []];
        for (var i = offset, end = offset + count; i < end; i++) {
            for (var v = 0; v < 3; v++) {
                filteredLists[v].push(sahPlanes[v][i]);
            }
        }
        filteredLists.forEach(function (planes) { return planes.sort(function (a, b) { return a.p - b.p; }); });
        // this bounds surface area, left bound SA, left triangles, right bound SA, right triangles
        var getCost = function (sa, sal, nl, sar, nr) {
            return TRAVERSAL_COST_1 + INTERSECTION_COST_1 * ((sal / sa) * nl + (sar / sa) * nr);
        };
        // the cost of _not_ splitting into smaller bounds
        var noSplitCost = INTERSECTION_COST_1 * count;
        axis = -1;
        var bestCost = noSplitCost;
        for (var i = 0; i < 3; i++) {
            // o1 and o2 represent the _other_ two axes in the
            // the space. So if we're checking the x (0) dimension,
            // then o1 and o2 would be y and z (1 and 2)
            var o1 = (i + 1) % 3;
            var o2 = (i + 2) % 3;
            var bmin = bb.min[xyzFields[i]];
            var bmax = bb.max[xyzFields[i]];
            var planes = filteredLists[i];
            // The number of left and right triangles on either side
            // given the current split
            var nl = 0;
            var nr = count;
            for (var p = 0; p < planes.length; p++) {
                var pinfo = planes[p];
                // As the plane moves, we have to increment or decrement the
                // number of triangles on either side of the plane
                nl++;
                nr--;
                // the distance from the plane to the edge of the broader bounds
                var ldim = pinfo.p - bmin;
                var rdim = bmax - pinfo.p;
                // same for the other two dimensions
                var ldimo1 = dim[o1], rdimo1 = dim[o1];
                var ldimo2 = dim[o2], rdimo2 = dim[o2];
                /*
                // compute the other bounding planes for the box
                // if only the current triangles are considered to
                // be in the box
                // This is really slow and probably not really worth it
                const o1planes = sahPlanes[o1];
                const o2planes = sahPlanes[o2];
                let lmin = Infinity, lmax = -Infinity;
                let rmin = Infinity, rmax = -Infinity;
                planes.forEach((p, i) => {
                const tri2 = p.tri * 2;
                const inf1 = o1planes[tri2 + 0];
                const inf2 = o1planes[tri2 + 1];
                if (i <= nl) {
                lmin = Math.min(inf1.p, inf2.p, lmin);
                lmax = Math.max(inf1.p, inf2.p, lmax);
                }
                if (i >= nr) {
                rmin = Math.min(inf1.p, inf2.p, rmin);
                rmax = Math.max(inf1.p, inf2.p, rmax);
                }
                })
                ldimo1 = Math.min(lmax - lmin, ldimo1);
                rdimo1 = Math.min(rmax - rmin, rdimo1);

                planes.forEach((p, i) => {
                const tri2 = p.tri * 2;
                const inf1 = o2planes[tri2 + 0];
                const inf2 = o2planes[tri2 + 1];
                if (i <= nl) {
                lmin = Math.min(inf1.p, inf2.p, lmin);
                lmax = Math.max(inf1.p, inf2.p, lmax);
                }
                if (i >= nr) {
                rmin = Math.min(inf1.p, inf2.p, rmin);
                rmax = Math.max(inf1.p, inf2.p, rmax);
                }
                })
                ldimo2 = Math.min(lmax - lmin, ldimo2);
                rdimo2 = Math.min(rmax - rmin, rdimo2);
                */
                // surface areas and cost
                var sal = 2 * (ldimo1 * ldimo2 + ldimo1 * ldim + ldimo2 * ldim);
                var sar = 2 * (rdimo1 * rdimo2 + rdimo1 * rdim + rdimo2 * rdim);
                var cost = getCost(sa, sal, nl, sar, nr);
                if (cost < bestCost) {
                    axis = i;
                    pos = pinfo.p;
                    bestCost = cost;
                }
            }
        }
    }
    return { axis: axis, pos: pos };
}
// returns the average coordinate on the specified axis of the all the provided triangles
function getAverage(triangleBounds, offset, count, axis) {
    var avg = 0;
    for (var i = offset, end = offset + count; i < end; i++) {
        avg += triangleBounds[i * 6 + axis * 2];
    }
    return avg / count;
}
function computeSAHPlanes(triangleBounds) {
    var triCount = triangleBounds.length / 6;
    var sahPlanes = [new Array(triCount), new Array(triCount), new Array(triCount)];
    for (var tri = 0; tri < triCount; tri++) {
        for (var el = 0; el < 3; el++) {
            sahPlanes[el][tri] = { p: triangleBounds[tri * 6 + el * 2], tri: tri };
        }
    }
    return sahPlanes;
}
// precomputes the bounding box for each triangle; required for quickly calculating tree splits.
// result is an array of size tris.length * 6 where triangle i maps to a
// [x_center, x_delta, y_center, y_delta, z_center, z_delta] tuple starting at index i * 6,
// representing the center and half-extent in each dimension of triangle i
function computeTriangleBounds(geo) {
    var verts = geo.attributes.position.array;
    var index = geo.index.array;
    var triCount = index.length / 3;
    var triangleBounds = new Float32Array(triCount * 6);
    for (var tri = 0; tri < triCount; tri++) {
        var tri3 = tri * 3;
        var tri6 = tri * 6;
        var ai = index[tri3 + 0] * 3;
        var bi = index[tri3 + 1] * 3;
        var ci = index[tri3 + 2] * 3;
        for (var el = 0; el < 3; el++) {
            var a = verts[ai + el];
            var b = verts[bi + el];
            var c = verts[ci + el];
            var min = a;
            if (b < min)
                min = b;
            if (c < min)
                min = c;
            var max = a;
            if (b > max)
                max = b;
            if (c > max)
                max = c;
            var halfExtents = (max - min) / 2;
            var el2 = el * 2;
            triangleBounds[tri6 + el2 + 0] = min + halfExtents;
            triangleBounds[tri6 + el2 + 1] = halfExtents;
        }
    }
    return triangleBounds;
}
function buildTree(geo, options) {
    // either recursively splits the given node, creating left and right subtrees for it, or makes it a leaf node,
    // recording the offset and count of its triangles and writing them into the reordered geometry index.
    function splitNode(node, offset, count, centroidBoundingData, depth) {
        if (centroidBoundingData === void 0) { centroidBoundingData = null; }
        if (depth === void 0) { depth = 0; }
        if (!reachedMaxDepth && depth >= maxDepth) {
            reachedMaxDepth = true;
            if (verbose) {
                console.warn("MeshBVH: Max depth of " + maxDepth + " reached when generating BVH. Consider increasing maxDepth.");
                console.warn(this, geo);
            }
        }
        // early out if we've met our capacity
        if (count <= maxLeafTris || depth >= maxDepth) {
            node.offset = offset;
            node.count = count;
            return node;
        }
        // Find where to split the volume
        var split = getOptimalSplit(node.boundingData, centroidBoundingData, triangleBounds, sahPlanes, offset, count, strategy);
        if (split.axis === -1) {
            node.offset = offset;
            node.count = count;
            return node;
        }
        var splitOffset = partition(indexArray, triangleBounds, sahPlanes, offset, count, split);
        // create the two new child nodes
        if (splitOffset === offset || splitOffset === offset + count) {
            node.offset = offset;
            node.count = count;
        }
        else {
            node.splitAxis = split.axis;
            // create the left child and compute its bounding box
            var left_1 = new MeshBVHNode();
            var lstart_1 = offset;
            var lcount_1 = splitOffset - offset;
            node.left = left_1;
            left_1.boundingData = new Float32Array(6);
            if (lazyGeneration) {
                getBounds(triangleBounds, lstart_1, lcount_1, left_1.boundingData);
                left_1.continueGeneration = function () {
                    delete this.continueGeneration;
                    getCentroidBounds(triangleBounds, lstart_1, lcount_1, cacheCentroidBoundingData);
                    splitNode(left_1, lstart_1, lcount_1, cacheCentroidBoundingData, depth + 1);
                };
            }
            else {
                getBounds(triangleBounds, lstart_1, lcount_1, left_1.boundingData, cacheCentroidBoundingData);
                splitNode(left_1, lstart_1, lcount_1, cacheCentroidBoundingData, depth + 1);
            }
            // repeat for right
            var right_1 = new MeshBVHNode();
            var rstart_1 = splitOffset;
            var rcount_1 = count - lcount_1;
            node.right = right_1;
            right_1.boundingData = new Float32Array(6);
            if (lazyGeneration) {
                getBounds(triangleBounds, rstart_1, rcount_1, right_1.boundingData);
                right_1.continueGeneration = function () {
                    delete this.continueGeneration;
                    getCentroidBounds(triangleBounds, rstart_1, rcount_1, cacheCentroidBoundingData);
                    splitNode(right_1, rstart_1, rcount_1, cacheCentroidBoundingData, depth + 1);
                };
            }
            else {
                getBounds(triangleBounds, rstart_1, rcount_1, right_1.boundingData, cacheCentroidBoundingData);
                splitNode(right_1, rstart_1, rcount_1, cacheCentroidBoundingData, depth + 1);
            }
        }
        return node;
    }
    ensureIndex(geo);
    var cacheCentroidBoundingData = new Float32Array(6);
    var triangleBounds = computeTriangleBounds(geo);
    var sahPlanes = options.strategy === SAH ? computeSAHPlanes(triangleBounds) : null;
    var indexArray = geo.index.array;
    var maxDepth = options.maxDepth;
    var verbose = options.verbose;
    var maxLeafTris = options.maxLeafTris;
    var strategy = options.strategy;
    var lazyGeneration = options.lazyGeneration;
    var reachedMaxDepth = false;
    var roots = [];
    var ranges = getRootIndexRanges(geo);
    if (ranges.length === 1) {
        var root = new MeshBVHNode();
        var range = ranges[0];
        if (geo.boundingBox != null) {
            root.boundingData = boxToArray(geo.boundingBox);
            getCentroidBounds(triangleBounds, range.offset, range.count, cacheCentroidBoundingData);
        }
        else {
            root.boundingData = new Float32Array(6);
            getBounds(triangleBounds, range.offset, range.count, root.boundingData, cacheCentroidBoundingData);
        }
        splitNode(root, range.offset, range.count, cacheCentroidBoundingData);
        roots.push(root);
    }
    else {
        for (var _i = 0, ranges_1 = ranges; _i < ranges_1.length; _i++) {
            var range = ranges_1[_i];
            var root = new MeshBVHNode();
            root.boundingData = new Float32Array(6);
            getBounds(triangleBounds, range.offset, range.count, root.boundingData, cacheCentroidBoundingData);
            splitNode(root, range.offset, range.count, cacheCentroidBoundingData);
            roots.push(root);
        }
    }
    // if the geometry doesn't have a bounding box, then let's politely populate it using
    // the work we did to determine the BVH root bounds
    if (geo.boundingBox == null) {
        var rootBox = new THREE.Box3();
        geo.boundingBox = new THREE.Box3();
        for (var _a = 0, roots_1 = roots; _a < roots_1.length; _a++) {
            var root = roots_1[_a];
            geo.boundingBox.union(arrayToBox(root.boundingData, rootBox));
        }
    }
    return roots;
}
var SeparatingAxisBounds = /** @class */ (function () {
    function SeparatingAxisBounds() {
        this.min = Infinity;
        this.max = -Infinity;
    }
    SeparatingAxisBounds.prototype.setFromPointsField = function (points, field) {
        var min = Infinity;
        var max = -Infinity;
        for (var i = 0, l = points.length; i < l; i++) {
            var p = points[i];
            var val = p[field];
            min = Math.min(val, min);
            max = Math.max(val, max);
        }
        this.min = min;
        this.max = max;
    };
    SeparatingAxisBounds.prototype.setFromPoints = function (axis, points) {
        var min = Infinity;
        var max = -Infinity;
        for (var i = 0, l = points.length; i < l; i++) {
            var p = points[i];
            var val = axis.dot(p);
            min = Math.min(val, min);
            max = Math.max(val, max);
        }
        this.min = min;
        this.max = max;
    };
    SeparatingAxisBounds.prototype.isSeparated = function (other) {
        return this.min > other.max || other.min > this.max;
    };
    return SeparatingAxisBounds;
}());
SeparatingAxisBounds.prototype.setFromBox = (function () {
    var p = new THREE.Vector3();
    return function setFromBox(axis, box) {
        var boxMin = box.min;
        var boxMax = box.max;
        var min = Infinity;
        var max = -Infinity;
        for (var x = 0; x <= 1; x++) {
            for (var y = 0; y <= 1; y++) {
                for (var z = 0; z <= 1; z++) {
                    p.x = boxMin.x * x + boxMax.x * (1 - x);
                    p.y = boxMin.y * y + boxMax.y * (1 - y);
                    p.z = boxMin.z * z + boxMax.z * (1 - z);
                    var val = axis.dot(p);
                    min = Math.min(val, min);
                    max = Math.max(val, max);
                }
            }
        }
        this.min = min;
        this.max = max;
    };
})();
var areIntersecting = (function () {
    var cacheSatBounds = new SeparatingAxisBounds();
    return function areIntersecting(shape1, shape2) {
        var points1 = shape1.points;
        var satAxes1 = shape1.satAxes;
        var satBounds1 = shape1.satBounds;
        var points2 = shape2.points;
        var satAxes2 = shape2.satAxes;
        var satBounds2 = shape2.satBounds;
        // check axes of the first shape
        for (var i = 0; i < 3; i++) {
            var sb = satBounds1[i];
            var sa = satAxes1[i];
            cacheSatBounds.setFromPoints(sa, points2);
            if (sb.isSeparated(cacheSatBounds))
                return false;
        }
        // check axes of the second shape
        for (var i = 0; i < 3; i++) {
            var sb = satBounds2[i];
            var sa = satAxes2[i];
            cacheSatBounds.setFromPoints(sa, points1);
            if (sb.isSeparated(cacheSatBounds))
                return false;
        }
    };
})();
var closestPointLineToLine = (function () {
    // https://github.com/juj/MathGeoLib/blob/master/src/Geometry/Line.cpp#L56
    var dir1 = new THREE.Vector3();
    var dir2 = new THREE.Vector3();
    var v02 = new THREE.Vector3();
    return function closestPointLineToLine(l1, l2, result) {
        var v0 = l1.start;
        var v10 = dir1;
        var v2 = l2.start;
        var v32 = dir2;
        v02.subVectors(v0, v2);
        dir1.subVectors(l1.end, l2.start);
        dir2.subVectors(l2.end, l2.start);
        // float d0232 = v02.Dot(v32);
        var d0232 = v02.dot(v32);
        // float d3210 = v32.Dot(v10);
        var d3210 = v32.dot(v10);
        // float d3232 = v32.Dot(v32);
        var d3232 = v32.dot(v32);
        // float d0210 = v02.Dot(v10);
        var d0210 = v02.dot(v10);
        // float d1010 = v10.Dot(v10);
        var d1010 = v10.dot(v10);
        // float denom = d1010*d3232 - d3210*d3210;
        var denom = d1010 * d3232 - d3210 * d3210;
        var d, d2;
        if (denom !== 0) {
            d = (d0232 * d3210 - d0210 * d3232) / denom;
        }
        else {
            d = 0;
        }
        d2 = (d0232 + d * d3210) / d3232;
        result.x = d;
        result.y = d2;
    };
})();
var closestPointsSegmentToSegment = (function () {
    // https://github.com/juj/MathGeoLib/blob/master/src/Geometry/LineSegment.cpp#L187
    var paramResult = new THREE.Vector2();
    var temp1 = new THREE.Vector3();
    var temp2 = new THREE.Vector3();
    return function closestPointsSegmentToSegment(l1, l2, target1, target2) {
        closestPointLineToLine(l1, l2, paramResult);
        var d = paramResult.x;
        var d2 = paramResult.y;
        if (d >= 0 && d <= 1 && d2 >= 0 && d2 <= 1) {
            l1.at(d, target1);
            l2.at(d2, target2);
            return;
        }
        else if (d >= 0 && d <= 1) {
            // Only d2 is out of bounds.
            if (d2 < 0) {
                l2.at(0, target2);
            }
            else {
                l2.at(1, target2);
            }
            l1.closestPointToPoint(target2, true, target1);
            return;
        }
        else if (d2 >= 0 && d2 <= 1) {
            // Only d is out of bounds.
            if (d < 0) {
                l1.at(0, target1);
            }
            else {
                l1.at(1, target1);
            }
            l2.closestPointToPoint(target1, true, target2);
            return;
        }
        else {
            // Both u and u2 are out of bounds.
            var p = void 0;
            if (d < 0) {
                p = l1.start;
            }
            else {
                p = l1.end;
            }
            var p2 = void 0;
            if (d2 < 0) {
                p2 = l2.start;
            }
            else {
                p2 = l2.end;
            }
            var closestPoint = temp1;
            var closestPoint2 = temp2;
            l1.closestPointToPoint(p2, true, temp1);
            l2.closestPointToPoint(p, true, temp2);
            if (closestPoint.distanceToSquared(p2) <= closestPoint2.distanceToSquared(p)) {
                target1.copy(closestPoint);
                target2.copy(p2);
                return;
            }
            else {
                target1.copy(p);
                target2.copy(closestPoint2);
                return;
            }
        }
    };
})();
var sphereIntersectTriangle = (function () {
    // https://stackoverflow.com/questions/34043955/detect-collision-between-sphere-and-triangle-in-three-js
    var closestPointTemp = new THREE.Vector3();
    var projectedPointTemp = new THREE.Vector3();
    var planeTemp = new THREE.Plane();
    var lineTemp = new THREE.Line3();
    return function sphereIntersectTriangle(sphere, triangle) {
        var radius = sphere.radius, center = sphere.center;
        var a = triangle.a, b = triangle.b, c = triangle.c;
        // phase 1
        lineTemp.start = a;
        lineTemp.end = b;
        var closestPoint1 = lineTemp.closestPointToPoint(center, true, closestPointTemp);
        if (closestPoint1.distanceTo(center) <= radius)
            return true;
        lineTemp.start = a;
        lineTemp.end = c;
        var closestPoint2 = lineTemp.closestPointToPoint(center, true, closestPointTemp);
        if (closestPoint2.distanceTo(center) <= radius)
            return true;
        lineTemp.start = b;
        lineTemp.end = c;
        var closestPoint3 = lineTemp.closestPointToPoint(center, true, closestPointTemp);
        if (closestPoint3.distanceTo(center) <= radius)
            return true;
        // phase 2
        var plane = triangle.getPlane(planeTemp);
        var dp = Math.abs(plane.distanceToPoint(center));
        if (dp <= radius) {
            var pp = plane.projectPoint(center, projectedPointTemp);
            var cp = triangle.containsPoint(pp);
            if (cp)
                return true;
        }
        return false;
    };
})();
var SeparatingAxisTriangle = /** @class */ (function (_super) {
    __extends(SeparatingAxisTriangle, _super);
    function SeparatingAxisTriangle() {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var _this = _super.apply(this, args) || this;
        _this.isSeparatingAxisTriangle = true;
        _this.satAxes = new Array(4).fill().map(function () { return new THREE.Vector3(); });
        _this.satBounds = new Array(4).fill().map(function () { return new SeparatingAxisBounds(); });
        _this.points = [_this.a, _this.b, _this.c];
        _this.sphere = new THREE.Sphere();
        return _this;
    }
    return SeparatingAxisTriangle;
}(THREE.Triangle));
SeparatingAxisTriangle.prototype.update = (function () {
    var arr = new Array(3);
    return function update() {
        var a = this.a;
        var b = this.b;
        var c = this.c;
        arr[0] = this.a;
        arr[1] = this.b;
        arr[2] = this.c;
        var satAxes = this.satAxes;
        var satBounds = this.satBounds;
        var axis0 = satAxes[0];
        var sab0 = satBounds[0];
        this.getNormal(axis0);
        sab0.setFromPoints(axis0, arr);
        var axis1 = satAxes[1];
        var sab1 = satBounds[1];
        axis1.subVectors(a, b);
        sab1.setFromPoints(axis1, arr);
        var axis2 = satAxes[2];
        var sab2 = satBounds[2];
        axis2.subVectors(b, c);
        sab2.setFromPoints(axis2, arr);
        var axis3 = satAxes[3];
        var sab3 = satBounds[3];
        axis3.subVectors(c, a);
        sab3.setFromPoints(axis3, arr);
        this.sphere.setFromPoints(this.points);
    };
})();
SeparatingAxisTriangle.prototype.intersectsTriangle = (function () {
    var saTri2 = new SeparatingAxisTriangle();
    var arr1 = new Array(3);
    var arr2 = new Array(3);
    var cachedSatBounds = new SeparatingAxisBounds();
    var cachedSatBounds2 = new SeparatingAxisBounds();
    var cachedAxis = new THREE.Vector3();
    return function intersectsTriangle(other) {
        if (!other.isSeparatingAxisTriangle) {
            saTri2.copy(other);
            saTri2.update();
            other = saTri2;
        }
        var satBounds1 = this.satBounds;
        var satAxes1 = this.satAxes;
        arr2[0] = other.a;
        arr2[1] = other.b;
        arr2[2] = other.c;
        for (var i = 0; i < 4; i++) {
            var sb = satBounds1[i];
            var sa = satAxes1[i];
            cachedSatBounds.setFromPoints(sa, arr2);
            if (sb.isSeparated(cachedSatBounds))
                return false;
        }
        var satBounds2 = other.satBounds;
        var satAxes2 = other.satAxes;
        arr1[0] = this.a;
        arr1[1] = this.b;
        arr1[2] = this.c;
        for (var i = 0; i < 4; i++) {
            var sb = satBounds2[i];
            var sa = satAxes2[i];
            cachedSatBounds.setFromPoints(sa, arr1);
            if (sb.isSeparated(cachedSatBounds))
                return false;
        }
        // check crossed axes
        for (var i = 0; i < 4; i++) {
            var sa1 = satAxes1[i];
            for (var i2 = 0; i2 < 4; i2++) {
                var sa2 = satAxes2[i2];
                cachedAxis.crossVectors(sa1, sa2);
                cachedSatBounds.setFromPoints(cachedAxis, arr1);
                cachedSatBounds2.setFromPoints(cachedAxis, arr2);
                if (cachedSatBounds.isSeparated(cachedSatBounds2))
                    return false;
            }
        }
        return true;
    };
})();
SeparatingAxisTriangle.prototype.distanceToPoint = (function () {
    var target = new THREE.Vector3();
    return function distanceToPoint(point) {
        this.closestPointToPoint(point, target);
        return point.distanceTo(target);
    };
})();
SeparatingAxisTriangle.prototype.distanceToTriangle = (function () {
    var point = new THREE.Vector3();
    var point2 = new THREE.Vector3();
    var cornerFields = ['a', 'b', 'c'];
    var line1 = new THREE.Line3();
    var line2 = new THREE.Line3();
    return function distanceToTriangle(other, target1, target2) {
        if (target1 === void 0) { target1 = null; }
        if (target2 === void 0) { target2 = null; }
        if (this.intersectsTriangle(other)) {
            // TODO: This will not result in a point that lies on
            // the intersection line of the triangles
            if (target1 || target2) {
                this.getMidpoint(point);
                other.closestPointToPoint(point, point2);
                this.closestPointToPoint(point2, point);
                if (target1)
                    target1.copy(point);
                if (target2)
                    target2.copy(point2);
            }
            return 0;
        }
        var closestDistanceSq = Infinity;
        // check all point distances
        for (var i = 0; i < 3; i++) {
            var dist = void 0;
            var field = cornerFields[i];
            var otherVec = other[field];
            this.closestPointToPoint(otherVec, point);
            dist = otherVec.distanceToSquared(point);
            if (dist < closestDistanceSq) {
                closestDistanceSq = dist;
                if (target1)
                    target1.copy(point);
                if (target2)
                    target2.copy(otherVec);
            }
            var thisVec = this[field];
            other.closestPointToPoint(thisVec, point);
            dist = thisVec.distanceToSquared(point);
            if (dist < closestDistanceSq) {
                closestDistanceSq = dist;
                if (target1)
                    target1.copy(thisVec);
                if (target2)
                    target2.copy(point);
            }
        }
        for (var i = 0; i < 3; i++) {
            var f11 = cornerFields[i];
            var f12 = cornerFields[(i + 1) % 3];
            line1.set(this[f11], this[f12]);
            for (var i2 = 0; i2 < 3; i2++) {
                var f21 = cornerFields[i2];
                var f22 = cornerFields[(i2 + 1) % 3];
                line2.set(other[f21], other[f22]);
                closestPointsSegmentToSegment(line1, line2, point, point2);
                var dist = point.distanceToSquared(point2);
                if (dist < closestDistanceSq) {
                    closestDistanceSq = dist;
                    if (target1)
                        target1.copy(point);
                    if (target2)
                        target2.copy(point2);
                }
            }
        }
        return Math.sqrt(closestDistanceSq);
    };
})();
var OrientedBox = /** @class */ (function (_super) {
    __extends(OrientedBox, _super);
    function OrientedBox() {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var _this = _super.apply(this, args) || this;
        _this.isOrientedBox = true;
        _this.matrix = new THREE.Matrix4();
        _this.invMatrix = new THREE.Matrix4();
        _this.points = new Array(8).fill().map(function () { return new THREE.Vector3(); });
        _this.satAxes = new Array(3).fill().map(function () { return new THREE.Vector3(); });
        _this.satBounds = new Array(3).fill().map(function () { return new SeparatingAxisBounds(); });
        _this.alignedSatBounds = new Array(3).fill().map(function () { return new SeparatingAxisBounds(); });
        _this.sphere = new THREE.Sphere();
        return _this;
    }
    OrientedBox.prototype.set = function (min, max, matrix) {
        _super.prototype.set.call(this, min, max);
        this.matrix = matrix;
    };
    OrientedBox.prototype.copy = function (other) {
        _super.prototype.copy.call(this, other);
        this.matrix.copy(other.matrix);
    };
    return OrientedBox;
}(THREE.Box3));
OrientedBox.prototype.update = (function () {
    return function update() {
        var matrix = this.matrix;
        var min = this.min;
        var max = this.max;
        var points = this.points;
        for (var x = 0; x <= 1; x++) {
            for (var y = 0; y <= 1; y++) {
                for (var z = 0; z <= 1; z++) {
                    var i = ((1 << 0) * x) | ((1 << 1) * y) | ((1 << 2) * z);
                    var v = points[i];
                    v.x = x ? max.x : min.x;
                    v.y = y ? max.y : min.y;
                    v.z = z ? max.z : min.z;
                    v.applyMatrix4(matrix);
                }
            }
        }
        this.sphere.setFromPoints(this.points);
        var satBounds = this.satBounds;
        var satAxes = this.satAxes;
        var minVec = points[0];
        for (var i = 0; i < 3; i++) {
            var axis = satAxes[i];
            var sb = satBounds[i];
            var index = 1 << i;
            var pi = points[index];
            axis.subVectors(minVec, pi);
            sb.setFromPoints(axis, points);
        }
        var alignedSatBounds = this.alignedSatBounds;
        alignedSatBounds[0].setFromPointsField(points, 'x');
        alignedSatBounds[1].setFromPointsField(points, 'y');
        alignedSatBounds[2].setFromPointsField(points, 'z');
        this.invMatrix.getInverse(this.matrix);
    };
})();
OrientedBox.prototype.intersectsBox = (function () {
    var aabbBounds = new SeparatingAxisBounds();
    return function intersectsBox(box) {
        if (!box.intersectsSphere(this.sphere))
            return false;
        var min = box.min;
        var max = box.max;
        var satBounds = this.satBounds;
        var satAxes = this.satAxes;
        var alignedSatBounds = this.alignedSatBounds;
        aabbBounds.min = min.x;
        aabbBounds.max = max.x;
        if (alignedSatBounds[0].isSeparated(aabbBounds))
            return false;
        aabbBounds.min = min.y;
        aabbBounds.max = max.y;
        if (alignedSatBounds[1].isSeparated(aabbBounds))
            return false;
        aabbBounds.min = min.z;
        aabbBounds.max = max.z;
        if (alignedSatBounds[2].isSeparated(aabbBounds))
            return false;
        for (var i = 0; i < 3; i++) {
            var axis = satAxes[i];
            var sb = satBounds[i];
            aabbBounds.setFromBox(axis, box);
            if (sb.isSeparated(aabbBounds))
                return false;
        }
        return true;
    };
})();
OrientedBox.prototype.intersectsTriangle = (function () {
    var saTri = new SeparatingAxisTriangle();
    var pointsArr = new Array(3);
    var cachedSatBounds = new SeparatingAxisBounds();
    var cachedSatBounds2 = new SeparatingAxisBounds();
    var cachedAxis = new THREE.Vector3();
    return function intersectsTriangle(triangle) {
        if (!triangle.isSeparatingAxisTriangle) {
            saTri.copy(triangle);
            saTri.update();
            triangle = saTri;
        }
        var satBounds = this.satBounds;
        var satAxes = this.satAxes;
        pointsArr[0] = triangle.a;
        pointsArr[1] = triangle.b;
        pointsArr[2] = triangle.c;
        for (var i = 0; i < 3; i++) {
            var sb = satBounds[i];
            var sa = satAxes[i];
            cachedSatBounds.setFromPoints(sa, pointsArr);
            if (sb.isSeparated(cachedSatBounds))
                return false;
        }
        var triSatBounds = triangle.satBounds;
        var triSatAxes = triangle.satAxes;
        var points = this.points;
        for (var i = 0; i < 3; i++) {
            var sb = triSatBounds[i];
            var sa = triSatAxes[i];
            cachedSatBounds.setFromPoints(sa, points);
            if (sb.isSeparated(cachedSatBounds))
                return false;
        }
        // check crossed axes
        for (var i = 0; i < 3; i++) {
            var sa1 = satAxes[i];
            for (var i2 = 0; i2 < 4; i2++) {
                var sa2 = triSatAxes[i2];
                cachedAxis.crossVectors(sa1, sa2);
                cachedSatBounds.setFromPoints(cachedAxis, pointsArr);
                cachedSatBounds2.setFromPoints(cachedAxis, points);
                if (cachedSatBounds.isSeparated(cachedSatBounds2))
                    return false;
            }
        }
        return true;
    };
})();
OrientedBox.prototype.closestPointToPoint = (function () {
    return function closestPointToPoint(point, target1) {
        target1
            .copy(point)
            .applyMatrix4(this.invMatrix)
            .clamp(this.min, this.max)
            .applyMatrix4(this.matrix);
        return target1;
    };
})();
OrientedBox.prototype.distanceToPoint = (function () {
    var target = new THREE.Vector3();
    return function distanceToPoint(point) {
        this.closestPointToPoint(point, target);
        return point.distanceTo(target);
    };
})();
OrientedBox.prototype.distanceToBox = (function () {
    var xyzFields = ['x', 'y', 'z'];
    var segments1 = new Array(12).fill().map(function () { return new THREE.Line3(); });
    var segments2 = new Array(12).fill().map(function () { return new THREE.Line3(); });
    var point1 = new THREE.Vector3();
    var point2 = new THREE.Vector3();
    return function distanceToBox(box, threshold, target1, target2) {
        if (threshold === void 0) { threshold = 0; }
        if (target1 === void 0) { target1 = null; }
        if (target2 === void 0) { target2 = null; }
        if (this.intersectsBox(box)) {
            if (target1 || target2) {
                box.getCenter(point2);
                this.closestPointToPoint(point2, point1);
                box.closestPointToPoint(point1, point2);
                if (target1)
                    target1.copy(point1);
                if (target2)
                    target2.copy(point2);
            }
            return 0;
        }
        var threshold2 = threshold * threshold;
        var min = box.min;
        var max = box.max;
        var points = this.points;
        // iterate over every edge and compare distances
        var closestDistanceSq = Infinity;
        // check over all these points
        for (var i = 0; i < 8; i++) {
            var p = points[i];
            point2.copy(p).clamp(min, max);
            var dist = p.distanceToSquared(point2);
            if (dist < closestDistanceSq) {
                closestDistanceSq = dist;
                if (target1)
                    target1.copy(p);
                if (target2)
                    target2.copy(point2);
                if (dist < threshold2)
                    return Math.sqrt(dist);
            }
        }
        // generate and check all line segment distances
        var count = 0;
        for (var i = 0; i < 3; i++) {
            for (var i1 = 0; i1 <= 1; i1++) {
                for (var i2 = 0; i2 <= 1; i2++) {
                    var nextIndex = (i + 1) % 3;
                    var nextIndex2 = (i + 2) % 3;
                    // get obb line segments
                    var index = i1 << nextIndex | i2 << nextIndex2;
                    var index2 = 1 << i | i1 << nextIndex | i2 << nextIndex2;
                    var p1 = points[index];
                    var p2 = points[index2];
                    var line1 = segments1[count];
                    line1.set(p1, p2);
                    // get aabb line segments
                    var f1 = xyzFields[i];
                    var f2 = xyzFields[nextIndex];
                    var f3 = xyzFields[nextIndex2];
                    var line2 = segments2[count];
                    var start = line2.start;
                    var end = line2.end;
                    start[f1] = min[f1];
                    start[f2] = i1 ? min[f2] : max[f2];
                    start[f3] = i2 ? min[f3] : max[f2];
                    end[f1] = max[f1];
                    end[f2] = i1 ? min[f2] : max[f2];
                    end[f3] = i2 ? min[f3] : max[f2];
                    count++;
                }
            }
        }
        // check all the other boxes point
        for (var x = 0; x <= 1; x++) {
            for (var y = 0; y <= 1; y++) {
                for (var z = 0; z <= 1; z++) {
                    point2.x = x ? max.x : min.x;
                    point2.y = y ? max.y : min.y;
                    point2.z = z ? max.z : min.z;
                    this.closestPointToPoint(point2, point1);
                    var dist = point2.distanceToSquared(point1);
                    if (dist < closestDistanceSq) {
                        closestDistanceSq = dist;
                        if (target1)
                            target1.copy(point1);
                        if (target2)
                            target2.copy(point2);
                        if (dist < threshold2)
                            return Math.sqrt(dist);
                    }
                }
            }
        }
        for (var i = 0; i < 12; i++) {
            var l1 = segments1[i];
            for (var i2 = 0; i2 < 12; i2++) {
                var l2 = segments2[i2];
                closestPointsSegmentToSegment(l1, l2, point1, point2);
                var dist = point1.distanceToSquared(point2);
                if (dist < closestDistanceSq) {
                    closestDistanceSq = dist;
                    if (target1)
                        target1.copy(point1);
                    if (target2)
                        target2.copy(point2);
                    if (dist < threshold2)
                        return Math.sqrt(dist);
                }
            }
        }
        return Math.sqrt(closestDistanceSq);
    };
})();
// sets the vertices of triangle `tri` with the 3 vertices after i
function setTriangle(tri, i, index, pos) {
    var ta = tri.a;
    var tb = tri.b;
    var tc = tri.c;
    var i3 = index.getX(i);
    ta.x = pos.getX(i3);
    ta.y = pos.getY(i3);
    ta.z = pos.getZ(i3);
    i3 = index.getX(i + 1);
    tb.x = pos.getX(i3);
    tb.y = pos.getY(i3);
    tb.z = pos.getZ(i3);
    i3 = index.getX(i + 2);
    tc.x = pos.getX(i3);
    tc.y = pos.getY(i3);
    tc.z = pos.getZ(i3);
}
// Ripped and modified From THREE.js Mesh raycast
// https://github.com/mrdoob/three.js/blob/0aa87c999fe61e216c1133fba7a95772b503eddf/src/objects/Mesh.js#L115
var vA = new THREE.Vector3();
var vB = new THREE.Vector3();
var vC = new THREE.Vector3();
var uvA = new THREE.Vector2();
var uvB = new THREE.Vector2();
var uvC = new THREE.Vector2();
var intersectionPoint = new THREE.Vector3();
var intersectionPointWorld = new THREE.Vector3();
function checkIntersection(object, material, raycaster, ray, pA, pB, pC, point) {
    var intersect;
    if (material.side === THREE.BackSide) {
        intersect = ray.intersectTriangle(pC, pB, pA, true, point);
    }
    else {
        intersect = ray.intersectTriangle(pA, pB, pC, material.side !== THREE.DoubleSide, point);
    }
    if (intersect === null)
        return null;
    intersectionPointWorld.copy(point);
    intersectionPointWorld.applyMatrix4(object.matrixWorld);
    var distance = raycaster.ray.origin.distanceTo(intersectionPointWorld);
    if (distance < raycaster.near || distance > raycaster.far)
        return null;
    return {
        distance: distance,
        point: intersectionPointWorld.clone(),
        object: object
    };
}
function checkBufferGeometryIntersection(object, raycaster, ray, position, uv, a, b, c) {
    vA.fromBufferAttribute(position, a);
    vB.fromBufferAttribute(position, b);
    vC.fromBufferAttribute(position, c);
    var intersection = checkIntersection(object, object.material, raycaster, ray, vA, vB, vC, intersectionPoint);
    if (intersection) {
        if (uv) {
            uvA.fromBufferAttribute(uv, a);
            uvB.fromBufferAttribute(uv, b);
            uvC.fromBufferAttribute(uv, c);
            intersection.uv = THREE.Triangle.getUV(intersectionPoint, vA, vB, vC, uvA, uvB, uvC, new THREE.Vector2());
        }
        var normal = new THREE.Vector3();
        intersection.face = new THREE.Face3(a, b, c, THREE.Triangle.getNormal(vA, vB, vC, normal));
    }
    return intersection;
}
// https://github.com/mrdoob/three.js/blob/0aa87c999fe61e216c1133fba7a95772b503eddf/src/objects/Mesh.js#L258
function intersectTri(mesh, geo, raycaster, ray, tri, intersections) {
    var triOffset = tri * 3;
    var a = geo.index.getX(triOffset);
    var b = geo.index.getX(triOffset + 1);
    var c = geo.index.getX(triOffset + 2);
    var intersection = checkBufferGeometryIntersection(mesh, raycaster, ray, geo.attributes.position, geo.attributes.uv, a, b, c);
    if (!intersection)
        return null;
    var f1 = geo.vtxToFace[a];
    var f2 = geo.vtxToFace[b];
    var f3 = geo.vtxToFace[c];
    var f = (f1 == f2 || f1 == f3 || f2 != f3) ? f1 : f2;
    intersection.faceIndex = f;
    if (intersections)
        intersections.push(intersection);
    return intersection;
}
function intersectTris(mesh, geo, raycaster, ray, offset, count, intersections) {
    for (var i = offset, end = offset + count; i < end; i++) {
        intersectTri(mesh, geo, raycaster, ray, i, intersections);
    }
}
function intersectClosestTri(mesh, geo, raycaster, ray, offset, count) {
    var dist = Infinity;
    var res = null;
    for (var i = offset, end = offset + count; i < end; i++) {
        var intersection = intersectTri(mesh, geo, raycaster, ray, i);
        if (intersection && intersection.distance < dist) {
            res = intersection;
            dist = intersection.distance;
        }
    }
    return res;
}
var boundingBox = new THREE.Box3();
var boxIntersection = new THREE.Vector3();
var xyzFields$1 = ['x', 'y', 'z'];
function intersectRay(node, ray, target) {
    if (!node)
        console.log("no bounding data");
    arrayToBox(node.boundingData, boundingBox);
    return ray.intersectBox(boundingBox, target);
}
function raycast(node, mesh, raycaster, ray, intersects) {
    if (node.continueGeneration) {
        node.continueGeneration();
    }
    var isLeaf = !!node.count;
    if (isLeaf) {
        intersectTris(mesh, mesh.geometry, raycaster, ray, node.offset, node.count, intersects);
    }
    else {
        if (intersectRay(node.left, ray, boxIntersection)) {
            raycast(node.left, mesh, raycaster, ray, intersects);
        }
        if (intersectRay(node.right, ray, boxIntersection)) {
            raycast(node.right, mesh, raycaster, ray, intersects);
        }
    }
}
function raycastFirst(node, mesh, raycaster, ray) {
    if (node.continueGeneration) {
        node.continueGeneration();
    }
    var isLeaf = !!node.count;
    if (isLeaf) {
        return intersectClosestTri(mesh, mesh.geometry, raycaster, ray, node.offset, node.count);
    }
    else {
        // consider the position of the split plane with respect to the oncoming ray; whichever direction
        // the ray is coming from, look for an intersection among that side of the tree first
        var splitAxis = node.splitAxis;
        var xyzAxis = xyzFields$1[splitAxis];
        var rayDir = ray.direction[xyzAxis];
        var leftToRight = rayDir >= 0;
        // c1 is the child to check first
        var c1 = void 0, c2 = void 0;
        if (leftToRight) {
            c1 = node.left;
            c2 = node.right;
        }
        else {
            c1 = node.right;
            c2 = node.left;
        }
        var c1Intersection = intersectRay(c1, ray, boxIntersection);
        var c1Result = c1Intersection ? raycastFirst(c1, mesh, raycaster, ray) : null;
        // if we got an intersection in the first node and it's closer than the second node's bounding
        // box, we don't need to consider the second node because it couldn't possibly be a better result
        if (c1Result) {
            // check only along the split axis
            var rayOrig = ray.origin[xyzAxis];
            var toPoint = rayOrig - c1Result.point[xyzAxis];
            var toChild1 = rayOrig - c2.boundingData[splitAxis];
            var toChild2 = rayOrig - c2.boundingData[splitAxis + 3];
            var toPointSq = toPoint * toPoint;
            if (toPointSq <= toChild1 * toChild1 && toPointSq <= toChild2 * toChild2) {
                return c1Result;
            }
        }
        // either there was no intersection in the first node, or there could still be a closer
        // intersection in the second, so check the second node and then take the better of the two
        var c2Intersection = intersectRay(c2, ray, boxIntersection);
        var c2Result = c2Intersection ? raycastFirst(c2, mesh, raycaster, ray) : null;
        if (c1Result && c2Result) {
            return c1Result.distance <= c2Result.distance ? c1Result : c2Result;
        }
        else {
            return c1Result || c2Result || null;
        }
    }
}
var shapecast = (function () {
    var triangle = new SeparatingAxisTriangle();
    var cachedBox1 = new THREE.Box3();
    var cachedBox2 = new THREE.Box3();
    return function shapecast(node, mesh, intersectsBoundsFunc, intersectsTriangleFunc, nodeScoreFunc) {
        if (intersectsTriangleFunc === void 0) { intersectsTriangleFunc = null; }
        if (nodeScoreFunc === void 0) { nodeScoreFunc = null; }
        if (node.continueGeneration) {
            node.continueGeneration();
        }
        var isLeaf = !!node.count;
        if (isLeaf && intersectsTriangleFunc) {
            var geometry = mesh.geometry;
            var index = geometry.index;
            var pos = geometry.attributes.position;
            var offset = node.offset;
            var count = node.count;
            for (var i = offset * 3, l = (count + offset) * 3; i < l; i += 3) {
                setTriangle(triangle, i, index, pos);
                triangle.update();
                if (intersectsTriangleFunc(triangle, i, i + 1, i + 2)) {
                    return true;
                }
            }
            return false;
        }
        else {
            var left = node.left;
            var right = node.right;
            var c1 = left;
            var c2 = right;
            var score1 = void 0, score2 = void 0;
            var box1 = void 0, box2 = void 0;
            if (nodeScoreFunc) {
                box1 = cachedBox1;
                box2 = cachedBox2;
                arrayToBox(c1.boundingData, box1);
                arrayToBox(c2.boundingData, box2);
                score1 = nodeScoreFunc(box1);
                score2 = nodeScoreFunc(box2);
                if (score2 < score1) {
                    c1 = right;
                    c2 = left;
                    var temp_1 = score1;
                    score1 = score2;
                    score2 = temp_1;
                    var tempBox = box1;
                    box1 = box2;
                    box2 = tempBox;
                }
            }
            if (!box1) {
                box1 = cachedBox1;
                arrayToBox(c1.boundingData, box1);
            }
            var isC1Leaf = !!c1.count;
            var c1Intersection = intersectsBoundsFunc(box1, isC1Leaf, score1) &&
                shapecast(c1, mesh, intersectsBoundsFunc, intersectsTriangleFunc, nodeScoreFunc);
            if (c1Intersection)
                return true;
            if (!box2) {
                box2 = cachedBox2;
                arrayToBox(c2.boundingData, box2);
            }
            var isC2Leaf = !!c2.count;
            var c2Intersection = intersectsBoundsFunc(box2, isC2Leaf, score2) &&
                shapecast(c2, mesh, intersectsBoundsFunc, intersectsTriangleFunc, nodeScoreFunc);
            if (c2Intersection)
                return true;
            return false;
        }
    };
})();
var intersectsGeometry = (function () {
    var triangle = new SeparatingAxisTriangle();
    var triangle2 = new SeparatingAxisTriangle();
    var cachedMesh = new THREE.Mesh();
    var invertedMat = new THREE.Matrix4();
    var obb = new OrientedBox();
    var obb2 = new OrientedBox();
    return function intersectsGeometry(node, mesh, geometry, geometryToBvh, cachedObb) {
        if (cachedObb === void 0) { cachedObb = null; }
        if (node.continueGeneration) {
            node.continueGeneration();
        }
        if (cachedObb === null) {
            if (!geometry.boundingBox) {
                geometry.computeBoundingBox();
            }
            obb.set(geometry.boundingBox.min, geometry.boundingBox.max, geometryToBvh);
            obb.update();
            cachedObb = obb;
        }
        var isLeaf = !!node.count;
        if (isLeaf) {
            var thisGeometry = mesh.geometry;
            var thisIndex_1 = thisGeometry.index;
            var thisPos_1 = thisGeometry.attributes.position;
            var index = geometry.index;
            var pos = geometry.attributes.position;
            var offset_1 = node.offset;
            var count_1 = node.count;
            // get the inverse of the geometry matrix so we can transform our triangles into the
            // geometry space we're trying to test. We assume there are fewer triangles being checked
            // here.
            invertedMat.getInverse(geometryToBvh);
            if (geometry.boundsTree) {
                arrayToBox(node.boundingData, obb2);
                obb2.matrix.copy(invertedMat);
                obb2.update();
                cachedMesh.geometry = geometry;
                var res = geometry.boundsTree.shapecast(cachedMesh, function (box) { return obb2.intersectsBox(box); }, function (tri) {
                    tri.a.applyMatrix4(geometryToBvh);
                    tri.b.applyMatrix4(geometryToBvh);
                    tri.c.applyMatrix4(geometryToBvh);
                    tri.update();
                    for (var i = offset_1 * 3, l = (count_1 + offset_1) * 3; i < l; i += 3) {
                        // this triangle needs to be transformed into the current BVH coordinate frame
                        setTriangle(triangle2, i, thisIndex_1, thisPos_1);
                        triangle2.update();
                        if (tri.intersectsTriangle(triangle2)) {
                            return true;
                        }
                    }
                    return false;
                });
                cachedMesh.geometry = null;
                return res;
            }
            else {
                for (var i = offset_1 * 3, l = (count_1 + offset_1 * 3); i < l; i += 3) {
                    // this triangle needs to be transformed into the current BVH coordinate frame
                    setTriangle(triangle, i, thisIndex_1, thisPos_1);
                    triangle.a.applyMatrix4(invertedMat);
                    triangle.b.applyMatrix4(invertedMat);
                    triangle.c.applyMatrix4(invertedMat);
                    triangle.update();
                    for (var i2 = 0, l2 = index.count; i2 < l2; i2 += 3) {
                        setTriangle(triangle2, i2, index, pos);
                        triangle2.update();
                        if (triangle.intersectsTriangle(triangle2)) {
                            return true;
                        }
                    }
                }
            }
        }
        else {
            var left = node.left;
            var right = node.right;
            arrayToBox(left.boundingData, boundingBox);
            var leftIntersection = cachedObb.intersectsBox(boundingBox) &&
                intersectsGeometry(left, mesh, geometry, geometryToBvh, cachedObb);
            if (leftIntersection)
                return true;
            arrayToBox(right.boundingData, boundingBox);
            var rightIntersection = cachedObb.intersectsBox(boundingBox) &&
                intersectsGeometry(right, mesh, geometry, geometryToBvh, cachedObb);
            if (rightIntersection)
                return true;
            return false;
        }
    };
})();
var boundingBox$1 = new THREE.Box3();
var boxIntersection$1 = new THREE.Vector3();
var xyzFields$2 = ['x', 'y', 'z'];
function raycastBuffer(stride4Offset, mesh, raycaster, ray, intersects) {
    var stride2Offset = stride4Offset * 2, float32Array = _float32Array, uint16Array = _uint16Array, uint32Array = _uint32Array;
    var isLeaf = /* node count */ uint16Array[stride2Offset + 15] === 0xffff;
    if (isLeaf) {
        intersectTris(mesh, mesh.geometry, raycaster, ray, /* node offset */ uint32Array[stride4Offset + 6], /* node count */ uint16Array[stride2Offset + 14], intersects);
    }
    else {
        if (intersectRayBuffer(/* node left */ stride4Offset + 8, float32Array, ray, boxIntersection$1)) {
            raycastBuffer(/* node left */ stride4Offset + 8, mesh, raycaster, ray, intersects);
        }
        if (intersectRayBuffer(/* node right */ uint32Array[stride4Offset + 6], float32Array, ray, boxIntersection$1)) {
            raycastBuffer(/* node right */ uint32Array[stride4Offset + 6], mesh, raycaster, ray, intersects);
        }
    }
}
function raycastFirstBuffer(stride4Offset, mesh, raycaster, ray) {
    var stride2Offset = stride4Offset * 2, float32Array = _float32Array, uint16Array = _uint16Array, uint32Array = _uint32Array;
    var isLeaf = /* node count */ uint16Array[stride2Offset + 15] === 0xffff;
    if (isLeaf) {
        return intersectClosestTri(mesh, mesh.geometry, raycaster, ray, /* node offset */ uint32Array[stride4Offset + 6], /* node count */ uint16Array[stride2Offset + 14]);
    }
    else {
        // consider the position of the split plane with respect to the oncoming ray; whichever direction
        // the ray is coming from, look for an intersection among that side of the tree first
        var splitAxis = /* node splitAxis */ uint32Array[stride4Offset + 7];
        var xyzAxis = xyzFields$2[splitAxis];
        var rayDir = ray.direction[xyzAxis];
        var leftToRight = rayDir >= 0;
        // c1 is the child to check first
        var c1 = void 0, c2 = void 0;
        if (leftToRight) {
            c1 = /* node left */ stride4Offset + 8;
            c2 = /* node right */ uint32Array[stride4Offset + 6];
        }
        else {
            c1 = /* node right */ uint32Array[stride4Offset + 6];
            c2 = /* node left */ stride4Offset + 8;
        }
        var c1Intersection = intersectRayBuffer(c1, float32Array, ray, boxIntersection$1);
        var c1Result = c1Intersection ? raycastFirstBuffer(c1, mesh, raycaster, ray) : null;
        // if we got an intersection in the first node and it's closer than the second node's bounding
        // box, we don't need to consider the second node because it couldn't possibly be a better result
        if (c1Result) {
            // check only along the split axis
            var rayOrig = ray.origin[xyzAxis];
            var toPoint = rayOrig - c1Result.point[xyzAxis];
            var toChild1 = rayOrig - /* c2 boundingData */ float32Array[c2 + splitAxis];
            var toChild2 = rayOrig - /* c2 boundingData */ float32Array[c2 + splitAxis + 3];
            var toPointSq = toPoint * toPoint;
            if (toPointSq <= toChild1 * toChild1 && toPointSq <= toChild2 * toChild2) {
                return c1Result;
            }
        }
        // either there was no intersection in the first node, or there could still be a closer
        // intersection in the second, so check the second node and then take the better of the two
        var c2Intersection = intersectRayBuffer(c2, float32Array, ray, boxIntersection$1);
        var c2Result = c2Intersection ? raycastFirstBuffer(c2, mesh, raycaster, ray) : null;
        if (c1Result && c2Result) {
            return c1Result.distance <= c2Result.distance ? c1Result : c2Result;
        }
        else {
            return c1Result || c2Result || null;
        }
    }
}
var shapecastBuffer = (function () {
    var triangle = new SeparatingAxisTriangle();
    var cachedBox1 = new THREE.Box3();
    var cachedBox2 = new THREE.Box3();
    return function shapecastBuffer(stride4Offset, mesh, intersectsBoundsFunc, intersectsTriangleFunc, nodeScoreFunc) {
        if (intersectsTriangleFunc === void 0) { intersectsTriangleFunc = null; }
        if (nodeScoreFunc === void 0) { nodeScoreFunc = null; }
        var stride2Offset = stride4Offset * 2, float32Array = _float32Array, uint16Array = _uint16Array, uint32Array = _uint32Array;
        var isLeaf = /* node count */ uint16Array[stride2Offset + 15] === 0xffff;
        if (isLeaf && intersectsTriangleFunc) {
            var geometry = mesh.geometry;
            var index = geometry.index;
            var pos = geometry.attributes.position;
            var offset = /* node offset */ uint32Array[stride4Offset + 6];
            var count = /* node count */ uint16Array[stride2Offset + 14];
            for (var i = offset * 3, l = (count + offset) * 3; i < l; i += 3) {
                setTriangle(triangle, i, index, pos);
                triangle.update();
                if (intersectsTriangleFunc(triangle, i, i + 1, i + 2)) {
                    return true;
                }
            }
            return false;
        }
        else {
            var left = /* node left */ stride4Offset + 8;
            var right = /* node right */ uint32Array[stride4Offset + 6];
            var c1 = left;
            var c2 = right;
            var score1 = void 0, score2 = void 0;
            var box1 = void 0, box2 = void 0;
            if (nodeScoreFunc) {
                box1 = cachedBox1;
                box2 = cachedBox2;
                arrayToBoxBuffer(/* c1 boundingData */ c1, float32Array, box1);
                arrayToBoxBuffer(/* c2 boundingData */ c2, float32Array, box2);
                score1 = nodeScoreFunc(box1);
                score2 = nodeScoreFunc(box2);
                if (score2 < score1) {
                    c1 = right;
                    c2 = left;
                    var temp_2 = score1;
                    score1 = score2;
                    score2 = temp_2;
                    var tempBox = box1;
                    box1 = box2;
                    box2 = tempBox;
                }
            }
            if (!box1) {
                box1 = cachedBox1;
                arrayToBoxBuffer(/* c1 boundingData */ c1, float32Array, box1);
            }
            var isC1Leaf = /* c1 count */ uint16Array[c1 + 15] === 0xffff;
            var c1Intersection = intersectsBoundsFunc(box1, isC1Leaf, score1) &&
                shapecastBuffer(c1, mesh, intersectsBoundsFunc, intersectsTriangleFunc, nodeScoreFunc);
            if (c1Intersection)
                return true;
            if (!box2) {
                box2 = cachedBox2;
                arrayToBoxBuffer(/* c2 boundingData */ c2, float32Array, box2);
            }
            var isC2Leaf = /* c2 count */ uint16Array[c2 + 15] === 0xffff;
            var c2Intersection = intersectsBoundsFunc(box2, isC2Leaf, score2) &&
                shapecastBuffer(c2, mesh, intersectsBoundsFunc, intersectsTriangleFunc, nodeScoreFunc);
            if (c2Intersection)
                return true;
            return false;
        }
    };
})();
var intersectsGeometryBuffer = (function () {
    var triangle = new SeparatingAxisTriangle();
    var triangle2 = new SeparatingAxisTriangle();
    var cachedMesh = new THREE.Mesh();
    var invertedMat = new THREE.Matrix4();
    var obb = new OrientedBox();
    var obb2 = new OrientedBox();
    return function intersectsGeometryBuffer(stride4Offset, mesh, geometry, geometryToBvh, cachedObb) {
        if (cachedObb === void 0) { cachedObb = null; }
        var stride2Offset = stride4Offset * 2, float32Array = _float32Array, uint16Array = _uint16Array, uint32Array = _uint32Array;
        if (cachedObb === null) {
            if (!geometry.boundingBox) {
                geometry.computeBoundingBox();
            }
            obb.set(geometry.boundingBox.min, geometry.boundingBox.max, geometryToBvh);
            obb.update();
            cachedObb = obb;
        }
        var isLeaf = /* node count */ uint16Array[stride2Offset + 15] === 0xffff;
        if (isLeaf) {
            var thisGeometry = mesh.geometry;
            var thisIndex_2 = thisGeometry.index;
            var thisPos_2 = thisGeometry.attributes.position;
            var index = geometry.index;
            var pos = geometry.attributes.position;
            var offset_2 = /* node offset */ uint32Array[stride4Offset + 6];
            var count_2 = /* node count */ uint16Array[stride2Offset + 14];
            // get the inverse of the geometry matrix so we can transform our triangles into the
            // geometry space we're trying to test. We assume there are fewer triangles being checked
            // here.
            invertedMat.getInverse(geometryToBvh);
            if (geometry.boundsTree) {
                arrayToBoxBuffer(/* node boundingData */ stride4Offset, float32Array, obb2);
                obb2.matrix.copy(invertedMat);
                obb2.update();
                cachedMesh.geometry = geometry;
                var res = geometry.boundsTree.shapecast(cachedMesh, function (box) { return obb2.intersectsBox(box); }, function (tri) {
                    tri.a.applyMatrix4(geometryToBvh);
                    tri.b.applyMatrix4(geometryToBvh);
                    tri.c.applyMatrix4(geometryToBvh);
                    tri.update();
                    for (var i = offset_2 * 3, l = (count_2 + offset_2) * 3; i < l; i += 3) {
                        // this triangle needs to be transformed into the current BVH coordinate frame
                        setTriangle(triangle2, i, thisIndex_2, thisPos_2);
                        triangle2.update();
                        if (tri.intersectsTriangle(triangle2)) {
                            return true;
                        }
                    }
                    return false;
                });
                cachedMesh.geometry = null;
                return res;
            }
            else {
                for (var i = offset_2 * 3, l = (count_2 + offset_2 * 3); i < l; i += 3) {
                    // this triangle needs to be transformed into the current BVH coordinate frame
                    setTriangle(triangle, i, thisIndex_2, thisPos_2);
                    triangle.a.applyMatrix4(invertedMat);
                    triangle.b.applyMatrix4(invertedMat);
                    triangle.c.applyMatrix4(invertedMat);
                    triangle.update();
                    for (var i2 = 0, l2 = index.count; i2 < l2; i2 += 3) {
                        setTriangle(triangle2, i2, index, pos);
                        triangle2.update();
                        if (triangle.intersectsTriangle(triangle2)) {
                            return true;
                        }
                    }
                }
            }
        }
        else {
            var left = /* node left */ stride4Offset + 8;
            var right = /* node right */ uint32Array[stride4Offset + 6];
            arrayToBoxBuffer(/* left boundingData */ left, float32Array, boundingBox$1);
            var leftIntersection = cachedObb.intersectsBox(boundingBox$1) &&
                intersectsGeometryBuffer(left, mesh, geometry, geometryToBvh, cachedObb);
            if (leftIntersection)
                return true;
            arrayToBoxBuffer(/* right boundingData */ right, float32Array, boundingBox$1);
            var rightIntersection = cachedObb.intersectsBox(boundingBox$1) &&
                intersectsGeometryBuffer(right, mesh, geometry, geometryToBvh, cachedObb);
            if (rightIntersection)
                return true;
            return false;
        }
    };
})();
function intersectRayBuffer(stride4Offset, array, ray, target) {
    arrayToBoxBuffer(stride4Offset, array, boundingBox$1);
    return ray.intersectBox(boundingBox$1, target);
}
var bufferStack = [];
var _prevBuffer;
var _float32Array;
var _uint16Array;
var _uint32Array;
function setBuffer(buffer) {
    if (_prevBuffer) {
        bufferStack.push(_prevBuffer);
    }
    _prevBuffer = buffer;
    _float32Array = new Float32Array(buffer);
    _uint16Array = new Uint16Array(buffer);
    _uint32Array = new Uint32Array(buffer);
}
function clearBuffer() {
    _prevBuffer = null;
    _float32Array = null;
    _uint16Array = null;
    _uint32Array = null;
    if (bufferStack.length) {
        setBuffer(bufferStack.pop());
    }
}
function arrayToBoxBuffer(stride4Offset, array, target) {
    target.min.x = array[stride4Offset];
    target.min.y = array[stride4Offset + 1];
    target.min.z = array[stride4Offset + 2];
    target.max.x = array[stride4Offset + 3];
    target.max.y = array[stride4Offset + 4];
    target.max.z = array[stride4Offset + 5];
}
// boundingData  				: 6 float32
// right / offset 				: 1 uint32
// splitAxis / isLeaf + count 	: 1 uint32 / 2 uint16
var BYTES_PER_NODE = 6 * 4 + 4 + 4;
var IS_LEAFNODE_FLAG = 0xFFFF;
var SKIP_GENERATION = Symbol('skip tree generation');
var obb = new OrientedBox();
var temp = new THREE.Vector3();
var tri2 = new SeparatingAxisTriangle();
var temp1 = new THREE.Vector3();
var temp2 = new THREE.Vector3();
var MeshBVH = /** @class */ (function () {
    function MeshBVH(geo, options) {
        var _a;
        if (options === void 0) { options = {}; }
        if (!geo.isBufferGeometry) {
            throw new Error('MeshBVH: Only BufferGeometries are supported.');
        }
        else if (geo.attributes.position.isInterleavedBufferAttribute) {
            throw new Error('MeshBVH: InterleavedBufferAttribute is not supported for the position attribute.');
        }
        else if (geo.index && geo.index.isInterleavedBufferAttribute) {
            throw new Error('MeshBVH: InterleavedBufferAttribute is not supported for the index attribute.');
        }
        // default options
        options = Object.assign((_a = {
                strategy: CENTER,
                maxDepth: 40,
                maxLeafTris: 10,
                verbose: true,
                lazyGeneration: true,
                // undocumented options
                // whether to the pack the data as a buffer or not. The data
                // will not be packed if lazyGeneration is true.
                packData: true
            },
            // Whether to skip generating the tree. Used for deserialization.
            _a[SKIP_GENERATION] = false,
            _a), options);
        options.strategy = Math.max(0, Math.min(2, options.strategy));
        this._isPacked = false;
        this._roots = null;
        if (!options[SKIP_GENERATION]) {
            this._roots = buildTree(geo, options);
            if (!options.lazyGeneration && options.packData) {
                this._roots = MeshBVH.serialize(this, geo, false).roots;
                this._isPacked = true;
            }
        }
    }
    MeshBVH.serialize = function (bvh, geometry, copyIndexBuffer) {
        if (copyIndexBuffer === void 0) { copyIndexBuffer = true; }
        function finishTree(node) {
            if (node.continueGeneration) {
                node.continueGeneration();
            }
            if (!node.count) {
                finishTree(node.left);
                finishTree(node.right);
            }
        }
        function countNodes(node) {
            if (node.count) {
                return 1;
            }
            else {
                return 1 + countNodes(node.left) + countNodes(node.right);
            }
        }
        function populateBuffer(byteOffset, node) {
            var stride4Offset = byteOffset / 4;
            var stride2Offset = byteOffset / 2;
            var isLeaf = !!node.count;
            var boundingData = node.boundingData;
            for (var i = 0; i < 6; i++) {
                float32Array[stride4Offset + i] = boundingData[i];
            }
            if (isLeaf) {
                var offset = node.offset;
                var count = node.count;
                uint32Array[stride4Offset + 6] = offset;
                uint16Array[stride2Offset + 14] = count;
                uint16Array[stride2Offset + 15] = IS_LEAFNODE_FLAG;
                return byteOffset + BYTES_PER_NODE;
            }
            else {
                var left = node.left;
                var right = node.right;
                var splitAxis = node.splitAxis;
                var nextUnusedPointer = void 0;
                nextUnusedPointer = populateBuffer(byteOffset + BYTES_PER_NODE, left);
                uint32Array[stride4Offset + 6] = nextUnusedPointer / 4;
                nextUnusedPointer = populateBuffer(nextUnusedPointer, right);
                uint32Array[stride4Offset + 7] = splitAxis;
                return nextUnusedPointer;
            }
        }
        var float32Array;
        var uint32Array;
        var uint16Array;
        var roots = bvh._roots;
        var rootData;
        if (bvh._isPacked) {
            rootData = roots;
        }
        else {
            rootData = [];
            for (var i = 0; i < roots.length; i++) {
                var root = roots[i];
                finishTree(root);
                var nodeCount = countNodes(root);
                var buffer = new ArrayBuffer(BYTES_PER_NODE * nodeCount);
                float32Array = new Float32Array(buffer);
                uint32Array = new Uint32Array(buffer);
                uint16Array = new Uint16Array(buffer);
                populateBuffer(0, root);
                rootData.push(buffer);
            }
        }
        var indexAttribute = geometry.getIndex();
        var result = {
            roots: rootData,
            index: copyIndexBuffer ? indexAttribute.array.slice() : indexAttribute.array,
        };
        return result;
    };
    MeshBVH.deserialize = function (data, geometry, setIndex) {
        // function setData( byteOffset, node ) {
        var _a;
        if (setIndex === void 0) { setIndex = true; }
        // 	const stride4Offset = byteOffset / 4;
        // 	const stride2Offset = byteOffset / 2;
        // 	const boundingData = new Float32Array( 6 );
        // 	for ( let i = 0; i < 6; i ++ ) {
        // 		boundingData[ i ] = float32Array[ stride4Offset + i ];
        // 	}
        // 	node.boundingData = boundingData;
        // 	const isLeaf = uint16Array[ stride2Offset + 15 ] === IS_LEAFNODE_FLAG;
        // 	if ( isLeaf ) {
        // 		node.offset = uint32Array[ stride4Offset + 6 ];
        // 		node.count = uint16Array[ stride2Offset + 14 ];
        // 	} else {
        // 		const left = new MeshBVHNode();
        // 		const right = new MeshBVHNode();
        // 		const leftOffset = stride4Offset + BYTES_PER_NODE / 4;
        // 		const rightOffset = uint32Array[ stride4Offset + 6 ];
        // 		setData( leftOffset * 4, left );
        // 		setData( rightOffset * 4, right );
        // 		node.left = left;
        // 		node.right = right;
        // 		node.splitAxis = uint32Array[ stride4Offset + 7 ];
        // 	}
        // }
        // let float32Array;
        // let uint32Array;
        // let uint16Array;
        // const { index, roots } = data;
        // const bvh = new MeshBVH( geometry, { [ SKIP_GENERATION ]: true } );
        // bvh._roots = [];
        // for ( let i = 0; i < roots.length; i ++ ) {
        // 	const buffer = roots[ i ];
        // 	float32Array = new Float32Array( buffer );
        // 	uint32Array = new Uint32Array( buffer );
        // 	uint16Array = new Uint16Array( buffer );
        // 	const root = new MeshBVHNode();
        // 	setData( 0, root );
        // 	bvh._roots.push( root );
        // }
        var index = data.index, roots = data.roots;
        var bvh = new MeshBVH(geometry, (_a = {}, _a[SKIP_GENERATION] = true, _a));
        bvh._roots = roots;
        bvh._isPacked = true;
        if (setIndex) {
            var indexAttribute = geometry.getIndex();
            if (indexAttribute === null) {
                var newIndex = new THREE.BufferAttribute(data.index, 1, false);
                geometry.setIndex(newIndex);
            }
            else if (indexAttribute.array !== index) {
                indexAttribute.array.set(index);
                indexAttribute.needsUpdate = true;
            }
        }
        return bvh;
    };
    MeshBVH.prototype.traverse = function (callback, rootIndex) {
        if (rootIndex === void 0) { rootIndex = 0; }
        if (this._isPacked) {
            var buffer_1 = this._roots[rootIndex];
            var uint32Array_1 = new Uint32Array(buffer_1);
            var uint16Array_1 = new Uint16Array(buffer_1);
            _traverseBuffer(0);
            function _traverseBuffer(stride4Offset, depth) {
                if (depth === void 0) { depth = 0; }
                var stride2Offset = stride4Offset * 2;
                var isLeaf = uint16Array_1[stride2Offset + 15];
                if (isLeaf) {
                    var offset = uint32Array_1[stride4Offset + 6];
                    var count = uint16Array_1[stride2Offset + 14];
                    callback(depth, isLeaf, new Float32Array(buffer_1, stride4Offset * 4, 6), offset, count);
                }
                else {
                    var left = stride4Offset + BYTES_PER_NODE / 4;
                    var right = uint32Array_1[stride4Offset + 6];
                    var splitAxis = uint32Array_1[stride4Offset + 7];
                    callback(depth, isLeaf, new Float32Array(buffer_1, stride4Offset * 4, 6), splitAxis, false);
                    _traverseBuffer(left, depth + 1);
                    _traverseBuffer(right, depth + 1);
                }
            }
        }
        else {
            _traverseNode(this._roots[rootIndex]);
            function _traverseNode(node, depth) {
                if (depth === void 0) { depth = 0; }
                var isLeaf = !!node.count;
                if (isLeaf) {
                    callback(depth, isLeaf, node.boundingData, node.offset, node.count);
                }
                else {
                    callback(depth, isLeaf, node.boundingData, node.splitAxis, !!node.continueGeneration);
                    if (node.left)
                        _traverseNode(node.left, depth + 1);
                    if (node.right)
                        _traverseNode(node.right, depth + 1);
                }
            }
        }
    };
    /* Core Cast Functions */
    MeshBVH.prototype.raycast = function (mesh, raycaster, ray, intersects) {
        var isPacked = this._isPacked;
        for (var _i = 0, _a = this._roots; _i < _a.length; _i++) {
            var root = _a[_i];
            if (isPacked) {
                setBuffer(root);
                raycastBuffer(0, mesh, raycaster, ray, intersects);
            }
            else {
                raycast(root, mesh, raycaster, ray, intersects);
            }
        }
        isPacked && clearBuffer();
    };
    MeshBVH.prototype.raycastFirst = function (mesh, raycaster, ray) {
        var isPacked = this._isPacked;
        var closestResult = null;
        for (var _i = 0, _a = this._roots; _i < _a.length; _i++) {
            var root = _a[_i];
            var result = void 0;
            if (isPacked) {
                setBuffer(root);
                result = raycastFirstBuffer(0, mesh, raycaster, ray);
            }
            else {
                result = raycastFirst(root, mesh, raycaster, ray);
            }
            if (result != null && (closestResult == null || result.distance < closestResult.distance)) {
                closestResult = result;
            }
        }
        isPacked && clearBuffer();
        return closestResult;
    };
    MeshBVH.prototype.intersectsGeometry = function (mesh, geometry, geomToMesh) {
        var isPacked = this._isPacked;
        var result = false;
        for (var _i = 0, _a = this._roots; _i < _a.length; _i++) {
            var root = _a[_i];
            if (isPacked) {
                setBuffer(root);
                result = intersectsGeometryBuffer(0, mesh, geometry, geomToMesh);
            }
            else {
                result = intersectsGeometry(root, mesh, geometry, geomToMesh);
            }
            if (result) {
                break;
            }
        }
        isPacked && clearBuffer();
        return result;
    };
    MeshBVH.prototype.shapecast = function (mesh, intersectsBoundsFunc, intersectsTriangleFunc, orderNodesFunc) {
        if (intersectsTriangleFunc === void 0) { intersectsTriangleFunc = null; }
        if (orderNodesFunc === void 0) { orderNodesFunc = null; }
        var isPacked = this._isPacked;
        var result = false;
        for (var _i = 0, _a = this._roots; _i < _a.length; _i++) {
            var root = _a[_i];
            if (isPacked) {
                setBuffer(root);
                result = shapecastBuffer(0, mesh, intersectsBoundsFunc, intersectsTriangleFunc, orderNodesFunc);
            }
            else {
                result = shapecast(root, mesh, intersectsBoundsFunc, intersectsTriangleFunc, orderNodesFunc);
            }
            if (result) {
                break;
            }
        }
        isPacked && clearBuffer();
        return result;
    };
    /* Derived Cast Functions */
    MeshBVH.prototype.intersectsBox = function (mesh, box, boxToMesh) {
        obb.set(box.min, box.max, boxToMesh);
        obb.update();
        return this.shapecast(mesh, function (box) { return obb.intersectsBox(box); }, function (tri) { return obb.intersectsTriangle(tri); });
    };
    MeshBVH.prototype.intersectsSphere = function (mesh, sphere) {
        return this.shapecast(mesh, function (box) { return sphere.intersectsBox(box); }, function (tri) { return sphereIntersectTriangle(sphere, tri); });
    };
    MeshBVH.prototype.closestPointToGeometry = function (mesh, geom, geometryToBvh, target1, target2, minThreshold, maxThreshold) {
        if (target1 === void 0) { target1 = null; }
        if (target2 === void 0) { target2 = null; }
        if (minThreshold === void 0) { minThreshold = 0; }
        if (maxThreshold === void 0) { maxThreshold = Infinity; }
        if (!geom.boundingBox) {
            geom.computeBoundingBox();
        }
        obb.set(geom.boundingBox.min, geom.boundingBox.max, geometryToBvh);
        obb.update();
        var pos = geom.attributes.position;
        var index = geom.index;
        var tempTarget1 = null;
        var tempTarget2 = null;
        if (target1) {
            tempTarget1 = temp1;
        }
        if (target2) {
            tempTarget2 = temp2;
        }
        var closestDistance = Infinity;
        this.shapecast(mesh, function (box, isLeaf, score) { return score < closestDistance && score < maxThreshold; }, function (tri) {
            var sphere1 = tri.sphere;
            for (var i2 = 0, l2 = index.count; i2 < l2; i2 += 3) {
                setTriangle(tri2, i2, index, pos);
                tri2.a.applyMatrix4(geometryToBvh);
                tri2.b.applyMatrix4(geometryToBvh);
                tri2.c.applyMatrix4(geometryToBvh);
                tri2.sphere.setFromPoints(tri2.points);
                var sphere2 = tri2.sphere;
                var sphereDist = sphere2.center.distanceTo(sphere1.center) - sphere2.radius - sphere1.radius;
                if (sphereDist > closestDistance) {
                    continue;
                }
                tri2.update();
                var dist = tri.distanceToTriangle(tri2, tempTarget1, tempTarget2);
                if (dist < closestDistance) {
                    if (target1) {
                        target1.copy(tempTarget1);
                    }
                    if (target2) {
                        target2.copy(tempTarget2);
                    }
                    closestDistance = dist;
                }
                if (dist < minThreshold)
                    return true;
            }
            return false;
        }, function (box) { return obb.distanceToBox(box, Math.min(closestDistance, maxThreshold)); });
        return closestDistance;
    };
    MeshBVH.prototype.distanceToGeometry = function (mesh, geom, matrix, minThreshold, maxThreshold) {
        return this.closestPointToGeometry(mesh, geom, matrix, null, null, minThreshold, maxThreshold);
    };
    MeshBVH.prototype.closestPointToPoint = function (mesh, point, target, minThreshold, maxThreshold) {
        if (minThreshold === void 0) { minThreshold = 0; }
        if (maxThreshold === void 0) { maxThreshold = Infinity; }
        // early out if under minThreshold
        // skip checking if over maxThreshold
        // set minThreshold = maxThreshold to quickly check if a point is within a threshold
        // returns Infinity if no value found
        var closestDistance = Infinity;
        this.shapecast(mesh, function (box, isLeaf, score) { return score < closestDistance && score < maxThreshold; }, function (tri) {
            tri.closestPointToPoint(point, temp);
            var dist = point.distanceTo(temp);
            if (dist < closestDistance) {
                if (target) {
                    target.copy(temp);
                }
                closestDistance = dist;
            }
            if (dist < minThreshold) {
                return true;
            }
            else {
                return false;
            }
        }, function (box) { return box.distanceToPoint(point); });
        return closestDistance;
    };
    MeshBVH.prototype.distanceToPoint = function (mesh, point, minThreshold, maxThreshold) {
        return this.closestPointToPoint(mesh, point, null, minThreshold, maxThreshold);
    };
    return MeshBVH;
}());
var wiremat = new THREE.LineBasicMaterial({ color: 0x00FF88, transparent: true, opacity: 0.3 });
var boxGeom = new THREE.Box3Helper().geometry;
var boundingBox$2 = new THREE.Box3();
var MeshBVHRootVisualizer = /** @class */ (function (_super) {
    __extends(MeshBVHRootVisualizer, _super);
    function MeshBVHRootVisualizer(mesh, depth, group) {
        if (depth === void 0) { depth = 10; }
        if (group === void 0) { group = 0; }
        var _this = _super.call(this, 'MeshBVHRootVisualizer') || this;
        _this.depth = depth;
        _this._oldDepth = -1;
        _this._mesh = mesh;
        _this._boundsTree = null;
        _this._group = group;
        _this.update();
        return _this;
    }
    MeshBVHRootVisualizer.prototype.update = function () {
        var _this = this;
        this._oldDepth = this.depth;
        this._boundsTree = this._mesh.geometry.boundsTree;
        var requiredChildren = 0;
        if (this._boundsTree) {
            this._boundsTree.traverse(function (depth, isLeaf, boundingData, offsetOrSplit, countOrIsUnfinished) {
                var isTerminal = isLeaf || countOrIsUnfinished;
                if (depth >= _this.depth)
                    return;
                if (depth === _this.depth - 1 || isTerminal) {
                    var m = requiredChildren < _this.children.length ? _this.children[requiredChildren] : null;
                    if (!m) {
                        m = new THREE.LineSegments(boxGeom, wiremat);
                        m.raycast = function () { return []; };
                        _this.add(m);
                    }
                    requiredChildren++;
                    arrayToBox(boundingData, boundingBox$2);
                    boundingBox$2.getCenter(m.position);
                    m.scale.subVectors(boundingBox$2.max, boundingBox$2.min).multiplyScalar(0.5);
                    if (m.scale.x === 0)
                        m.scale.x = Number.EPSILON;
                    if (m.scale.y === 0)
                        m.scale.y = Number.EPSILON;
                    if (m.scale.z === 0)
                        m.scale.z = Number.EPSILON;
                }
            });
        }
        while (this.children.length > requiredChildren)
            this.remove(this.children.pop());
    };
    return MeshBVHRootVisualizer;
}(THREE.Group));
var MeshBVHVisualizer = /** @class */ (function (_super) {
    __extends(MeshBVHVisualizer, _super);
    function MeshBVHVisualizer(mesh, depth) {
        if (depth === void 0) { depth = 10; }
        var _this = _super.call(this, 'MeshBVHVisualizer') || this;
        _this.depth = depth;
        _this._mesh = mesh;
        _this._roots = [];
        _this.update();
        return _this;
    }
    MeshBVHVisualizer.prototype.update = function () {
        var bvh = this._mesh.geometry.boundsTree;
        var totalRoots = bvh ? bvh._roots.length : 0;
        while (this._roots.length > totalRoots) {
            this._roots.pop();
        }
        for (var i = 0; i < totalRoots; i++) {
            if (i >= this._roots.length) {
                var root = new MeshBVHRootVisualizer(this._mesh, this.depth, i);
                this.add(root);
                this._roots.push(root);
            }
            else {
                var root = this._roots[i];
                root.depth = this.depth;
                root.update();
            }
        }
        this.position.copy(this._mesh.position);
        this.rotation.copy(this._mesh.rotation);
        this.scale.copy(this._mesh.scale);
    };
    return MeshBVHVisualizer;
}(THREE.Group));
// https://stackoverflow.com/questions/1248302/how-to-get-the-size-of-a-javascript-object
function getPrimitiveSize(el) {
    switch (typeof el) {
        case 'number':
            return 8;
        case 'string':
            return el.length * 2;
        case 'boolean':
            return 4;
        default:
            return 0;
    }
}
function isTypedArray(arr) {
    var regex = /(Uint|Int|Float)(8|16|32)Array/;
    return regex.test(arr.constructor.name);
}
function getRootExtremes(bvh, group) {
    var result = {
        total: 0,
        depth: {
            min: Infinity, max: -Infinity
        },
        tris: {
            min: Infinity, max: -Infinity
        },
        splits: [0, 0, 0]
    };
    bvh.traverse(function (depth, isLeaf, boundingData, offsetOrSplit, countOrIsUnfinished) {
        result.total++;
        if (isLeaf) {
            result.depth.min = Math.min(depth, result.depth.min);
            result.depth.max = Math.max(depth, result.depth.max);
            result.tris.min = Math.min(countOrIsUnfinished, result.tris.min);
            result.tris.max = Math.max(countOrIsUnfinished, result.tris.max);
        }
        else {
            result.splits[offsetOrSplit]++;
        }
    }, group);
    // If there are no leaf nodes because the tree hasn't finished generating yet.
    if (result.tris.min === Infinity) {
        result.tris.min = 0;
        result.tris.max = 0;
    }
    if (result.depth.min === Infinity) {
        result.depth.min = 0;
        result.depth.max = 0;
    }
    return result;
}
function getBVHExtremes(bvh) {
    return bvh._roots.map(function (root, i) { return getRootExtremes(bvh, i); });
}
function estimateMemoryInBytes(obj) {
    var traversed = new Set();
    var stack = [obj];
    var bytes = 0;
    while (stack.length) {
        var curr = stack.pop();
        if (traversed.has(curr)) {
            continue;
        }
        traversed.add(curr);
        for (var key in curr) {
            if (!curr.hasOwnProperty(key)) {
                continue;
            }
            bytes += getPrimitiveSize(key);
            var value = curr[key];
            if (value && (typeof value === 'object' || typeof value === 'function')) {
                if (isTypedArray(value)) {
                    bytes += value.byteLength;
                }
                else if (value instanceof ArrayBuffer) {
                    bytes += value.byteLength;
                }
                else {
                    stack.push(value);
                }
            }
            else {
                bytes += getPrimitiveSize(value);
            }
        }
    }
    return bytes;
}
var ray = new THREE.Ray();
var tmpInverseMatrix = new THREE.Matrix4();
var origMeshRaycastFunc = THREE.Mesh.prototype.raycast;
function acceleratedRaycast(raycaster, intersects) {
    if (this.geometry.boundsTree) {
        if (this.material === undefined)
            return;
        tmpInverseMatrix.getInverse(this.matrixWorld);
        ray.copy(raycaster.ray).applyMatrix4(tmpInverseMatrix);
        if (raycaster.firstHitOnly === true) {
            var res = this.geometry.boundsTree.raycastFirst(this, raycaster, ray);
            if (res)
                intersects.push(res);
        }
        else {
            this.geometry.boundsTree.raycast(this, raycaster, ray, intersects);
        }
    }
    else {
        origMeshRaycastFunc.call(this, raycaster, intersects);
    }
}
function computeBoundsTree(options) {
    this.vtxToFace = {};
    var idx = 0;
    for (var _i = 0, _a = this.index.array; _i < _a.length; _i++) {
        var vtxIdx = _a[_i];
        this.vtxToFace[vtxIdx] = Math.floor(idx++ / 3);
    }
    this.boundsTree = new MeshBVH(this, options);
    return this.boundsTree;
}
function disposeBoundsTree() {
    this.boundsTree = null;
}
// The MIT License (MIT)
// Copyright (c) 2012 Nicholas Fisher
// https://github.com/KyleAMathews/deepmerge/blob/master/license.txt
var DeepMerge = /** @class */ (function () {
    function DeepMerge() {
    }
    DeepMerge.prototype.isMergeableObject = function (val) {
        return val && typeof val === 'object';
    };
    DeepMerge.prototype.emptyTarget = function (val) {
        return Array.isArray(val) ? [] : {};
    };
    DeepMerge.prototype.cloneIfNecessary = function (value, optionsArgument) {
        var clone = optionsArgument && optionsArgument.clone === true;
        return (clone && this.isMergeableObject(value)) ? this.deepMerge(this.emptyTarget(value), value, optionsArgument) : value;
    };
    DeepMerge.prototype.defaultArrayMerge = function (target, source, optionsArgument) {
        var destination = target.slice();
        for (var i = 0; i < destination.length; ++i) {
            var e = destination[i];
            if (typeof destination[i] === 'undefined')
                destination[i] = this.cloneIfNecessary(e, optionsArgument);
            else if (this.isMergeableObject(e))
                destination[i] = this.deepMerge(target[i], e, optionsArgument);
            else if (target.indexOf(e) === -1)
                destination.push(this.cloneIfNecessary(e, optionsArgument));
        }
        return destination;
    };
    DeepMerge.prototype.mergeObject = function (target, source, optionsArgument) {
        var destination = {};
        if (this.isMergeableObject(target))
            for (var key in target)
                destination[key] = this.cloneIfNecessary(target[key], optionsArgument);
        for (var key in source)
            if (!this.isMergeableObject(source[key]) || !target[key])
                destination[key] = this.cloneIfNecessary(source[key], optionsArgument);
            else
                destination[key] = this.deepMerge(target[key], source[key], optionsArgument);
        return destination;
    };
    DeepMerge.prototype.deepMerge = function (target, source, optionsArgument) {
        var array = Array.isArray(source);
        var options = optionsArgument || { arrayMerge: this.defaultArrayMerge };
        var arrayMerge = options.arrayMerge || this.defaultArrayMerge;
        if (array)
            return Array.isArray(target) ? arrayMerge(target, source, optionsArgument) : this.cloneIfNecessary(source, optionsArgument);
        else
            return this.mergeObject(target, source, optionsArgument);
    };
    return DeepMerge;
}());
var direction = {
    forward: new THREE.Vector3(0, 0, -1),
    back: new THREE.Vector3(0, 0, 1),
    left: new THREE.Vector3(-1, 0, 0),
    right: new THREE.Vector3(1, 0, 0),
    up: new THREE.Vector3(0, 1, 0),
    down: new THREE.Vector3(0, -1, 0),
};
var ViewerCamera = /** @class */ (function () {
    function ViewerCamera(camera, settings) {
        this.camera = camera;
        this.applySettings(settings);
        // Save initial position
        this.initialPosition = new THREE.Vector3();
        this.initialRotation = new THREE.Quaternion();
        this.initialPosition.copy(this.camera.position);
        this.initialRotation.copy(this.camera.quaternion);
    }
    ViewerCamera.prototype.lookAt = function (position) { this.camera.lookAt(position); };
    ViewerCamera.prototype.applySettings = function (newSettings) {
        // TODO: camera updates aren't working
        this.camera.fov = newSettings.camera.fov;
        this.camera.zoom = newSettings.camera.zoom;
        this.camera.near = newSettings.camera.near;
        this.camera.far = newSettings.camera.far;
        this.camera.position.copy(toVec(newSettings.camera.position));
        this.cameraTarget = toVec(newSettings.camera.target);
        this.camera.lookAt(this.cameraTarget);
        this.settings = newSettings;
    };
    ViewerCamera.prototype.moveCameraBy = function (dir, speed, onlyHoriz) {
        if (dir === void 0) { dir = direction.forward; }
        if (speed === void 0) { speed = 1; }
        if (onlyHoriz === void 0) { onlyHoriz = false; }
        var vector = new THREE.Vector3();
        vector.copy(dir);
        if (speed)
            vector.multiplyScalar(speed);
        vector.applyQuaternion(this.camera.quaternion);
        var y = this.camera.position.y;
        this.camera.position.add(vector);
        if (onlyHoriz)
            this.camera.position.y = y;
    };
    ViewerCamera.prototype.panCameraBy = function (pt) {
        var speed = this.settings.camera.controls.panSpeed;
        this.moveCameraBy(new THREE.Vector3(-pt.x, pt.y, 0), speed);
    };
    ViewerCamera.prototype.rotateCameraBy = function (pt) {
        var euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler.setFromQuaternion(this.camera.quaternion);
        euler.y += -pt.x * this.settings.camera.controls.rotateSpeed;
        euler.x += -pt.y * this.settings.camera.controls.rotateSpeed;
        euler.z = 0;
        var PI_2 = Math.PI / 2;
        var minPolarAngle = -2 * Math.PI;
        var maxPolarAngle = 2 * Math.PI;
        euler.x = Math.max(PI_2 - maxPolarAngle, Math.min(PI_2 - minPolarAngle, euler.x));
        this.camera.quaternion.setFromEuler(euler);
    };
    ViewerCamera.prototype.resetCamera = function () {
        this.camera.position.copy(this.initialPosition);
        this.camera.quaternion.copy(this.initialRotation);
    };
    return ViewerCamera;
}());
var KEYS = {
    A: 65,
    D: 68,
    Q: 81,
    E: 69,
    S: 83,
    W: 87,
    LEFTARROW: 37,
    UPARROW: 38,
    RIGHTARROW: 39,
    DOWNARROW: 40,
    HOME: 36,
    END: 37,
    PAGEUP: 33,
    PAGEDOWN: 34,
};
var ViewerInput = /** @class */ (function () {
    function ViewerInput(canvas, settings, cameraController) {
        var _this = this;
        this.onKeyDown = function (event) {
            var speed = _this.settings.camera.controls.speed;
            if (event.shiftKey)
                speed *= _this.settings.camera.controls.shiftMultiplier;
            if (event.altKey)
                speed *= _this.settings.camera.controls.altMultiplier;
            switch (event.keyCode) {
                case KEYS.A:
                    _this.cameraController.moveCameraBy(direction.left, speed);
                    break;
                case KEYS.LEFTARROW:
                    _this.cameraController.moveCameraBy(direction.left, speed, true);
                    break;
                case KEYS.D:
                    _this.cameraController.moveCameraBy(direction.right, speed);
                    break;
                case KEYS.RIGHTARROW:
                    _this.cameraController.moveCameraBy(direction.right, speed, true);
                    break;
                case KEYS.W:
                    _this.cameraController.moveCameraBy(direction.forward, speed);
                    break;
                case KEYS.UPARROW:
                    _this.cameraController.moveCameraBy(direction.forward, speed, true);
                    break;
                case KEYS.S:
                    _this.cameraController.moveCameraBy(direction.back, speed);
                    break;
                case KEYS.DOWNARROW:
                    _this.cameraController.moveCameraBy(direction.back, speed, true);
                    break;
                case KEYS.E:
                case KEYS.PAGEUP:
                    _this.cameraController.moveCameraBy(direction.up, speed);
                    break;
                case KEYS.Q:
                case KEYS.PAGEDOWN:
                    _this.cameraController.moveCameraBy(direction.down, speed);
                    break;
                case KEYS.HOME:
                    _this.cameraController.resetCamera();
                    break;
                default:
                    return;
            }
            event.preventDefault();
        };
        this.onMouseMove = function (event) {
            if (!_this.isMouseDown)
                return;
            event.preventDefault();
            // https://github.com/mrdoob/three.js/blob/master/examples/jsm/controls/PointerLockControls.js
            var deltaX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
            var deltaY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
            var delta = new THREE.Vector2(deltaX, deltaY);
            if (event.buttons & 2)
                _this.cameraController.panCameraBy(delta);
            else
                _this.cameraController.rotateCameraBy(delta);
        };
        this.onMouseWheel = function (event) {
            event.preventDefault();
            event.stopPropagation();
            var speed = _this.settings.camera.controls.zoomSpeed;
            var dir = event.deltaY > 0 ? direction.back : direction.forward;
            _this.cameraController.moveCameraBy(dir, speed);
        };
        this.onMouseDown = function (event) {
            event.preventDefault();
            _this.isMouseDown = true;
            var hits = _this.mouseRaycast(event.x, event.y);
            if (hits.length > 0) {
                var mesh = hits[0].object;
                var index = hits[0].instanceId;
                var nodeIndex = _this.viewer.getNodeIndex(mesh, index);
                var name_1 = _this.viewer.getElementNameFromNodeIndex(nodeIndex);
                _this.viewer.focus(mesh, index);
                console.log("Raycast hit.");
                console.log("Position:" + hits[0].point.x + "," + hits[0].point.y + "," + hits[0].point.z);
                console.log("Element: " + name_1);
            }
            // Manually set the focus since calling preventDefault above
            // prevents the browser from setting it automatically.    
            _this.canvas.focus ? _this.canvas.focus() : window.focus();
        };
        this.onMouseUp = function (_) {
            _this.isMouseDown = false;
        };
        this.canvas = canvas;
        this.settings = settings;
        this.cameraController = cameraController;
        this.unregister = function () { };
        this.isMouseDown = false;
    }
    ViewerInput.prototype.register = function () {
        this.canvas.addEventListener('mousedown', this.onMouseDown);
        this.canvas.addEventListener('wheel', this.onMouseWheel);
        this.canvas.addEventListener('mousemove', this.onMouseMove);
        this.canvas.addEventListener('mouseup', this.onMouseUp);
        document.addEventListener('keydown', this.onKeyDown);
        this.unregister = function () {
            this.canvas.removeEventListener('mousedown', this.onMouseDown);
            this.canvas.removeEventListener('wheel', this.onMouseWheel);
            this.canvas.removeEventListener('mousemove', this.onMouseMove);
            this.canvas.removeEventListener('mouseup', this.onMouseUp);
            document.removeEventListener('keydown', this.onKeyDown);
            this.isMouseDown = false;
            this.unregister = function () { };
        };
    };
    ViewerInput.prototype.mouseRaycast = function (mouseX, mouseY) {
        var x = (mouseX / window.innerWidth) * 2 - 1;
        var y = -(mouseY / window.innerHeight) * 2 + 1;
        var mouse = new THREE.Vector2(x, y);
        var raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.cameraController.camera);
        raycaster.firstHitOnly = true;
        return raycaster.intersectObjects(this.viewer.meshes);
    };
    return ViewerInput;
}());
// Used to provide new IDs for each new property descriptor that is created.
var gid = 0;
/**
 * Describes a property so that it can be found
 */
var PropDesc = /** @class */ (function () {
    function PropDesc(type, def) {
        this.type = type;
        this.def = def;
        this.id = gid++;
        this.name = "";
        this.vis = true;
    }
    PropDesc.prototype.setStep = function (step) {
        this.step = step;
        return this;
    };
    PropDesc.prototype.setRange = function (min, max) {
        this.min = min;
        this.max = max;
        return this;
    };
    PropDesc.prototype.setName = function (name) {
        this.name = name;
        return this;
    };
    PropDesc.prototype.setChoices = function (xs) {
        this.choices = xs;
        return this;
    };
    PropDesc.prototype.setOptions = function (xs) {
        this.options = xs;
        return this;
    };
    return PropDesc;
}());
/**
 * Holds a value, and a reference to the descriptor.
 */
var PropValue = /** @class */ (function () {
    function PropValue(_desc) {
        this._desc = _desc;
        this._value = _desc.def;
    }
    Object.defineProperty(PropValue.prototype, "name", {
        get: function () { return this._desc.name; },
        enumerable: false,
        configurable: true
    });
    ;
    Object.defineProperty(PropValue.prototype, "value", {
        get: function () { return this._value; },
        set: function (value) { this._value = value; },
        enumerable: false,
        configurable: true
    });
    return PropValue;
}());
/**
 * A list of properties. The values can be get and set directly on this object.
 */
var PropList = /** @class */ (function () {
    function PropList(desc, name) {
        if (name === void 0) { name = ''; }
        this.desc = desc;
        this.name = name;
        this.items = [];
        for (var k in desc) {
            var v = desc[k];
            if (v instanceof PropDesc)
                this.items.push(new PropValue(v));
            else
                this.items.push(new PropList(v, k));
        }
    }
    PropList.prototype.fromJson = function (json) {
        for (var _i = 0, _a = this.items; _i < _a.length; _i++) {
            var pv = _a[_i];
            if (pv.name in json) {
                var v = json[pv.name];
                if (pv instanceof PropValue)
                    pv.value = v;
                else
                    pv.fromJson(v);
            }
        }
        return this;
    };
    Object.defineProperty(PropList.prototype, "toJson", {
        get: function () {
            var r = {};
            for (var _i = 0, _a = this.items; _i < _a.length; _i++) {
                var pv = _a[_i];
                if (pv instanceof PropValue) {
                    r[pv.name] = pv.value;
                }
                else {
                    r[pv.name] = pv.toJson;
                }
            }
            return r;
        },
        enumerable: false,
        configurable: true
    });
    PropList.prototype.find = function (name) {
        return this.items.find(function (v) { return v.name === name; });
    };
    return PropList;
}());
var ViewerGui = {
    gui: new dat.GUI(),
    bind: function (settings, callback) {
        // Create a property descriptor 
        var propDesc = objectToPropDesc(settings, {});
        // Create a property list from the descriptor 
        var props = new PropList(propDesc);
        // Iniitlaize the property list values             
        props.fromJson(settings);
        // Bind the properties to the DAT.gui controller, returning the scene when it updates
        bindControls(props, this.gui, function () { return callback(props.toJson); });
        function objectToPropDesc(obj, pdm) {
            // TODO: look for common patterns (colors, positions, angles) and process these specially.
            for (var k in obj) {
                var v = obj[k];
                switch (typeof (v)) {
                    case 'number':
                        pdm[k] = floatProp(v).setName(k);
                        break;
                    case 'string':
                        pdm[k] = stringProp(v).setName(k);
                        break;
                    case 'boolean':
                        pdm[k] = boolProp(v).setName(k);
                        break;
                    case 'object':
                        pdm[k] = objectToPropDesc(v, {});
                        break;
                }
            }
            return pdm;
        }
        // Fills out a dat.gui instance to a property list.
        function bindControls(list, gui, onChange) {
            for (var k in list.desc) {
                bindControl(list, k, gui, onChange);
            }
            return gui;
        }
        // Fills out a dat.gui control to a property in a property list.
        function bindControl(list, name, gui, onChange) {
            var pv = list.find(name);
            if (!pv)
                throw new Error("Could not find parameter " + name);
            // Do I really need to pass a PropDesc?? 
            if (pv instanceof PropValue) {
                var desc = pv._desc;
                if (desc.choices) {
                    return gui.add(pv, "value", desc.choices).name(pv.name).setValue(pv.value).onChange(function () { return onChange(pv); });
                }
                else if (desc.type === 'vec3') {
                    var folder = gui.addFolder(desc.name);
                    folder.open();
                    folder.add(pv.value, "x").step(0.1).onChange(function () { return onChange(pv); });
                    folder.add(pv.value, "y").step(0.1).onChange(function () { return onChange(pv); });
                    folder.add(pv.value, "z").step(0.1).onChange(function () { return onChange(pv); });
                    return folder;
                }
                else if (desc.type === 'hsv') {
                    var folder = gui.addFolder(desc.name);
                    folder.open();
                    folder.add(pv.value, "x").name("hue").step(0.1).onChange(function () { return onChange(pv); });
                    folder.add(pv.value, "y").name("saturation").step(0.1).onChange(function () { return onChange(pv); });
                    folder.add(pv.value, "z").name("value").step(0.1).onChange(function () { return onChange(pv); });
                    return folder;
                }
                else if (desc.type === 'rot') {
                    var folder = gui.addFolder(desc.name);
                    folder.open();
                    folder.add(pv.value, "yaw", -1, 1, 0.01).onChange(function () { return onChange(pv); });
                    folder.add(pv.value, "pitch", -1, 1, 0.01).onChange(function () { return onChange(pv); });
                    folder.add(pv.value, "roll", -1, 1, 0.01).onChange(function () { return onChange(pv); });
                    return folder;
                }
                else if (desc.type === 'color') {
                    var controller = gui.addColor(pv, "value").name(pv.name);
                    controller.onChange(function () { return onChange(pv); });
                    return controller;
                }
                else {
                    var controller = gui.add(pv, "value", desc.min, desc.max, desc.step).name(pv.name);
                    controller.onChange(function () { return onChange(pv); });
                    return controller;
                }
            }
            else {
                // It is a property list. We create a new folder, and add controls to the folder.
                var folder = gui.addFolder(name);
                //folder.open();
                bindControls(pv, folder, onChange);
                return folder;
            }
        }
        // Helper functions for defining properties 
        function prop(type, def) { return new PropDesc(type, def); }
        function boolProp(x) { return prop("boolean", x); }
        function stringProp(x) { return prop("string", x); }
        function floatProp(x) {
            if (x === void 0) { x = 0; }
            return prop("float", x);
        }
        function smallFloatProp(x) {
            if (x === void 0) { x = 0; }
            return prop("float", x).setStep(0.01);
        }
        function colorCompProp(x) {
            if (x === void 0) { x = 0; }
            return rangedIntProp(x, 0, 255);
        }
        function intProp(x) { return prop("int", x); }
        function rangedIntProp(x, min, max) { return intProp(x).setRange(min, max); }
        function rangedFloatProp(x, min, max) { return floatProp(x).setRange(min, max); }
        function zeroToOneProp(x) { return floatProp(x).setRange(0, 1).setStep(0.01); }
        function oneOrMoreIntProp(x) { return intProp(x).setRange(1); }
        function timeProp(x) { return prop("time", x); }
        function choiceProp(xs) { return prop("choices", xs[0]).setChoices(xs); }
        function vec3Prop(x, y, z) {
            if (x === void 0) { x = 0; }
            if (y === void 0) { y = 0; }
            if (z === void 0) { z = 0; }
            return prop('vec3', { x: x, y: y, z: z });
        }
        function scaleProp() { return prop('vec3', { x: 1, y: 1, z: 1 }); }
        function rotProp(yaw, pitch, roll) {
            if (yaw === void 0) { yaw = 0; }
            if (pitch === void 0) { pitch = 0; }
            if (roll === void 0) { roll = 0; }
            return prop('rot', { yaw: yaw, pitch: pitch, roll: roll });
        }
        function axisProp() { return choiceProp(['x', 'y', 'z']).setName("axis"); }
        function conditionalProp(val, options) { return prop('conditional', val).setOptions(options); }
        function colorProp(r, g, b) {
            if (r === void 0) { r = 0; }
            if (g === void 0) { g = 0; }
            if (b === void 0) { b = 0; }
            return prop('color', [r, g, b]);
        }
    }
};
var ViewerSettings = {
    default: {
        showGui: true,
        showStats: true,
        camera: {
            near: 0.1,
            far: 15000,
            fov: 50,
            zoom: 1,
            rotate: 1.0,
            position: { x: 0, y: 5, z: -5 },
            target: { x: 0, y: -1, z: 0, },
            controls: {
                speed: 0.1,
                altMultiplier: 3.0,
                shiftMultiplier: 5.0,
                zoomSpeed: 0.2,
                rotateSpeed: 0.01,
                panSpeed: 0.1,
            }
        },
        background: {
            color: { r: 0x72, g: 0x64, b: 0x5b, }
        },
        plane: {
            show: true,
            material: {
                color: { r: 0x99, g: 0x99, b: 0x99, },
                specular: { r: 0x10, g: 0x10, b: 0x10, }
            },
            position: {
                x: 0, y: 0, z: 0
            }
        },
        sunlight: {
            skyColor: { r: 0x44, g: 0x33, b: 0x33 },
            groundColor: { r: 0x11, g: 0x11, b: 0x22 },
            intensity: 1,
        },
        light1: {
            // TODO: the positions of the lights are all wrong. 
            position: { x: 1, y: 1, z: 1 },
            color: { r: 0xFF, g: 0xFF, b: 0xFF },
            intensity: 1.35,
        },
        light2: {
            position: { x: 0.5, y: 1, z: -1 },
            color: { r: 0xFF, g: 0xAA, b: 0x00 },
            intensity: 1,
        },
        object: {
            scale: 0.01,
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            material: {
                color: { r: 0x00, g: 0x55, b: 0xFF },
                emissive: { r: 0x00, g: 0x00, b: 0x00 },
                specular: { r: 0x11, g: 0x11, b: 0x11 },
                flatShading: true,
                shininess: 30,
                wireframe: false,
            }
        }
    }
};
var Viewer = /** @class */ (function () {
    function Viewer() {
        this.meshes = [];
        this.meshes = [];
    }
    Viewer.prototype.view = function (options) {
        var _this = this;
        this.settings = (new DeepMerge()).deepMerge(ViewerSettings.default, options, undefined);
        //Init Canvas
        {
            // If a canvas is given, we will draw in it.
            var canvas = document.getElementById(this.settings.canvasId);
            // If no canvas is given, we create a new one
            if (!canvas) {
                canvas = document.createElement('canvas');
                document.body.appendChild(canvas);
            }
            this.canvas = canvas;
        }
        //Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, canvas: this.canvas });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        // Create the camera and size everything appropriately 
        this.camera = new THREE.PerspectiveCamera();
        this.cameraController = new ViewerCamera(this.camera, this.settings);
        this.resizeCanvas(true);
        // Create scene object
        this.scene = new THREE.Scene();
        if (this.settings.showGui) {
            // Create a new DAT.gui controller 
            ViewerGui.bind(this.settings, function (settings) {
                _this.settings = settings;
                _this.updateScene();
            });
        }
        // Ground
        this.plane = new THREE.Mesh(new THREE.PlaneBufferGeometry(1000, 1000), new THREE.MeshPhongMaterial());
        this.plane.rotation.x = -Math.PI / 2;
        this.scene.add(this.plane);
        // Lights
        this.sunlight = new THREE.HemisphereLight();
        this.light1 = new THREE.DirectionalLight();
        this.light2 = new THREE.DirectionalLight();
        this.scene.add(this.sunlight);
        this.scene.add(this.light1);
        this.scene.add(this.light2);
        // Material 
        this.material = new THREE.MeshPhongMaterial();
        // Initial scene update: happens if controls change 
        this.updateScene();
        // Add Stats display 
        if (this.settings.showStats) {
            this.stats = new Stats();
            this.stats.dom.style.top = "84px";
            this.stats.dom.style.left = "16px";
            document.body.appendChild(this.stats.dom);
        }
        // Add Vim logo
        var logo = document.createElement("img");
        logo.src = "logo.png";
        logo.style.position = "fixed";
        logo.style.top = "16px";
        logo.style.left = "16px";
        logo.height = 48;
        logo.width = 128;
        document.body.prepend(logo);
        // Set Favicon
        var favicon = document.createElement('img');
        favicon.setAttribute('href', "favicon.ico");
        document.head.appendChild(favicon);
        // Add all of the appropriate mouse, touch-pad, and keyboard listeners
        //Load Vim
        this.loadFile(this.settings.url, function (vim) { return _this.onVimLoaded(vim); });
        // Start Loop
        this.animate();
    };
    Viewer.prototype.onVimLoaded = function (vim) {
        for (var i = 0; i < vim.meshes.length; ++i) {
            this.meshes.push(vim.meshes[i]);
            this.scene.add(vim.meshes[i]);
        }
        this.controls = new ViewerInput(this.canvas, this.settings, this.cameraController);
        this.controls.register();
        this.controls.viewer = this;
        this.vim = vim;
    };
    Viewer.prototype.loadFile = function (fileName, onSuccess) {
        function getExt(fileName) {
            var indexOfQueryParams = fileName.lastIndexOf("?");
            if (indexOfQueryParams >= 0)
                fileName = fileName.substring(0, indexOfQueryParams);
            var extPos = fileName.lastIndexOf(".");
            return fileName.slice(extPos + 1).toLowerCase();
        }
        console.log("Loading file: " + fileName);
        var ext = getExt(fileName);
        if (ext != "vim") {
            console.error("unhandled file format");
            return;
        }
        console.time("loadingVim");
        var loader = new THREE.VIMLoader();
        loader.load(fileName, function (vim) {
            console.log("Finished loading VIM: found " + vim.meshes.length + " objects");
            console.timeEnd("loadingVim");
            onSuccess(vim);
        });
    };
    // Calls render, and asks the framework to prepare the next frame 
    Viewer.prototype.animate = function () {
        var _this = this;
        requestAnimationFrame(function () { return _this.animate(); });
        this.resizeCanvas();
        this.updateObjects();
        //cameraControls.update();
        this.renderer.render(this.scene, this.camera);
        if (this.stats)
            this.stats.update();
    };
    Viewer.prototype.updateObjects = function () {
        for (var i = 0; i < this.meshes.length; i++) {
            this.applyViewMatrix(this.meshes[i]);
        }
    };
    Viewer.prototype.applyViewMatrix = function (mesh) {
        /*
        const scale = scalarToVec(this.settings.object.scale);
        mesh.scale.copy(scale);
        mesh.position.copy(this.settings.object.position);
        mesh.rotation.copy();
        */
        var matrix = this.getViewMatrix();
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(matrix);
    };
    Viewer.prototype.getViewMatrix = function () {
        var pos = this.settings.object.position;
        var rot = toQuaternion(this.settings.object.rotation);
        var scl = scalarToVec(0.1);
        var matrix = new THREE.Matrix4().compose(pos, rot, scl);
        return matrix;
    };
    Viewer.prototype.highlight = function (geometry) {
        var wireframe = new THREE.WireframeGeometry(geometry);
        var line = new THREE.LineSegments(wireframe);
        line.material.depthTest = false;
        line.material.opacity = 0.5;
        line.material.color = new THREE.Color(0x0000ff);
        line.material.transparent = true;
        this.scene.add(line);
    };
    Viewer.prototype.createWorldGeometry = function (mesh, index) {
        var geometry = mesh.geometry.clone();
        var matrix = new THREE.Matrix4();
        mesh.getMatrixAt(index, matrix);
        matrix = this.getViewMatrix().multiply(matrix);
        geometry.applyMatrix4(matrix);
        return geometry;
    };
    Viewer.prototype.lookAt = function (sphere) {
        var axis = this.camera.position.clone().sub(sphere.center).normalize();
        var fovRadian = this.camera.fov * Math.PI / 180;
        var dist = 1.33 * sphere.radius * (1 + 2 / Math.tan(fovRadian));
        var pos = axis.clone().multiplyScalar(dist).add(sphere.center);
        this.camera.lookAt(sphere.center);
        this.camera.position.copy(pos);
    };
    Viewer.prototype.getNodeIndex = function (mesh, instance) {
        return mesh.userData.instanceIndices[instance];
    };
    Viewer.prototype.focus = function (mesh, index) {
        var geometry = this.createWorldGeometry(mesh, index);
        this.highlight(geometry);
        geometry.computeBoundingSphere();
        var sphere = geometry.boundingSphere.clone();
        this.lookAt(sphere);
    };
    Viewer.prototype.addViews = function (views) {
        var _this = this;
        var getSettingsMatrix = function () {
            return toMatrix(_this.settings.object.position, _this.settings.object.rotation, _this.settings.object.scale);
        };
        if (!views || !views.length)
            return;
        var folder = ViewerGui.gui.addFolder('views');
        var obj = {};
        var matrix = getSettingsMatrix();
        var _loop_1 = function (i) {
            var view = views[i];
            var name_2 = view.name;
            if (view.x == 0 && view.y == 0 && view.z == 0)
                return "continue";
            obj[name_2] = function () {
                console.log("Navigating to " + name_2);
                var pos = new THREE.Vector3(view.x, view.y, view.z + 5.5);
                pos.applyMatrix4(matrix);
                this.camera.position.copy(pos);
            };
            folder.add(obj, name_2);
        };
        for (var i = 0; i < views.length; ++i) {
            _loop_1(i);
        }
    };
    Viewer.prototype.resizeCanvas = function (force) {
        if (force === void 0) { force = false; }
        if (!this.settings.autoResize && !force)
            return;
        var canvas = this.renderer.domElement;
        var parent = canvas.parentElement;
        var w = parent.clientWidth / window.devicePixelRatio;
        var h = parent.clientHeight / window.devicePixelRatio;
        this.renderer.setSize(w, h, false);
        // Set aspect ratio
        this.camera.aspect = canvas.width / canvas.height;
        this.camera.updateProjectionMatrix();
    };
    // Called every frame in case settings are updated 
    Viewer.prototype.updateScene = function () {
        this.scene.background = toColor(this.settings.background.color);
        this.plane.visible = this.settings.plane.show;
        this.updateMaterial(this.plane.material, this.settings.plane.material);
        this.plane.position.copy(toVec(this.settings.plane.position));
        this.light1.position.copy(toVec(this.settings.light1.position));
        this.light1.color = toColor(this.settings.light1.color);
        this.light1.intensity = this.settings.light1.intensity;
        this.light2.position.copy(toVec(this.settings.light2.position));
        this.light2.color = toColor(this.settings.light2.color);
        this.light2.intensity = this.settings.light2.intensity;
        this.sunlight.skyColor = toColor(this.settings.sunlight.skyColor);
        this.sunlight.groundColor = toColor(this.settings.sunlight.groundColor);
        this.sunlight.intensity = this.settings.sunlight.intensity;
        this.cameraController.applySettings(this.settings);
    };
    Viewer.prototype.updateMaterial = function (targetMaterial, settings) {
        if ('color' in settings)
            targetMaterial.color = toColor(settings.color);
        if ('flatShading' in settings)
            targetMaterial.flatShading = settings.flatShading;
        if ('emissive' in settings)
            targetMaterial.emissive = toColor(settings.emissive);
        if ('specular' in settings)
            targetMaterial.specular = toColor(settings.specular);
        if ('wireframe' in settings)
            targetMaterial.wireframe = settings.wireframe;
        if ('shininess' in settings)
            targetMaterial.shininess = settings.shininess;
    };
    //TODO: Add more granular ways to access the bim data.
    Viewer.prototype.getElementNameFromNodeIndex = function (nodeIndex) {
        var elementIndex = this.vim.entities["Vim.Node"]["Rvt.Element"][nodeIndex];
        var stringIndex = this.vim.entities["Rvt.Element"]["Name"][elementIndex];
        var name = this.vim.strings[stringIndex];
        return name;
    };
    return Viewer;
}());
// Helpers
function isColor(obj) {
    return typeof (obj) === 'object' && 'r' in obj && 'g' in obj && 'b' in obj;
}
function toColor(c) {
    if (!isColor(c))
        throw new Error("Not a color");
    return new THREE.Color(c.r / 255, c.g / 255, c.b / 255);
}
function toVec(obj) {
    return new THREE.Vector3(obj.x, obj.y, obj.z);
}
function scalarToVec(x) {
    return new THREE.Vector3(x, x, x);
}
function toEuler(rot) {
    return new THREE.Euler(rot.x * Math.PI / 180, rot.y * Math.PI / 180, rot.z * Math.PI / 180);
}
function toQuaternion(rot) {
    var q = new THREE.Quaternion();
    q.setFromEuler(toEuler(rot));
    return q;
}
function toMatrix(pos, rot, scl) {
    var m = new THREE.Matrix4();
    m.compose(toVec(pos), toQuaternion(rot), scalarToVec(scl));
    return m;
}
//# sourceMappingURL=index.js.map