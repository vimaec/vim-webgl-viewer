/**
 @author VIM / https://vimaec.com
*/
import * as THREE from "./node_modules/three/src/Three";
var VIMLoader = /** @class */ (function () {
    function VIMLoader() {
    }
    // Loads the VIM from a URL 
    VIMLoader.prototype.load = function (url, onLoad, onProgress, onError) {
        var material = new THREE.MeshPhongMaterial({
            color: 0x999999,
            flatShading: true,
            side: THREE.DoubleSide,
            shininess: 70
        });
        var scope = this;
        var loader = new THREE.FileLoader();
        loader.setResponseType('arraybuffer');
        //loader.setRequestHeader("Content-Encoding", "gzip");
        //loader.setRequestHeader("Accept-Encoding", "gzip, deflate");
        loader.load(url, function (data) {
            try {
                onLoad(scope.parse(data, material));
            }
            catch (exception) {
                console.log("Error occured when loading VIM from " + url + ", message = " + exception);
                if (onError)
                    onError(exception);
            }
        }, onProgress, onError);
    };
    VIMLoader.prototype.parseBFastFromArray = function (bytes) {
        return this.parseBFast(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    };
    VIMLoader.prototype.getMaterialColorLookup = function (vim) {
        var materialData = vim.entities["Rvt.Material"];
        if (materialData == null)
            throw new Error("Material data undefined");
        var xs = new Float64Array(materialData["Color.X"]);
        var ys = new Float64Array(materialData["Color.Y"]);
        var zs = new Float64Array(materialData["Color.Z"]);
        var ws = new Float64Array(materialData["Transparency"]);
        var ids = new Float64Array(materialData["Id"]);
        var r = {};
        for (var i = 0; i < ids.length; ++i) {
            r[ids[i]] =
                {
                    color: new THREE.Color(xs[i], ys[i], zs[i]),
                    opacity: 1.0 - ws[i],
                };
        }
        return r;
    };
    VIMLoader.prototype.getElements = function (vim) {
        var elementData = vim.entities["Rvt.Element"];
        var names = new Int32Array(elementData["Name"]);
        var xs = new Float64Array(elementData["Location.X"]);
        var ys = new Float64Array(elementData["Location.Y"]);
        var zs = new Float64Array(elementData["Location.Z"]);
        var r = new Array(names.length);
        for (var i = 0; i < names.length; ++i) {
            var name_1 = names[i] >= 0 ? vim.strings[names[i]] : "";
            r[i] = { name: name_1, x: xs[i], y: ys[i], z: zs[i] };
        }
        return r;
    };
    VIMLoader.prototype.getRooms = function (vim) {
        if (!vim.elements)
            return [];
        var roomData = vim.entities["Rvt.Room"];
        if (!roomData)
            return [];
        var ids = new Int32Array(roomData["Element"]);
        if (!ids)
            return [];
        var r = new Array(ids.length);
        for (var i = 0; i < ids.length; ++i) {
            var id = ids[i];
            if (id > 0)
                r[i] = vim.elements[id];
        }
        return r;
    };
    // BFAST is the container format for an array of binary arrays 
    VIMLoader.prototype.parseBFast = function (arrayBuffer, byteOffset, byteLength) {
        console.log("Parsing BFAST");
        // Cast the input data to 32-bit integers 
        // Note that according to the spec they are 64 bit numbers. In JavaScript you can't have 64 bit integers, 
        // and it would bust the amount of memory we can work with in most browsers and low-power devices  
        var data = new Int32Array(arrayBuffer, byteOffset, byteLength / 4);
        // Parse the header
        var header = {
            Magic: data[0],
            DataStart: data[2],
            DataEnd: data[4],
            NumArrays: data[6],
        };
        console.log("BFAST header");
        console.log(JSON.stringify(header));
        // Check validity of data 
        // TODO: check endianness
        if (header.Magic != 0xBFA5)
            throw new Error("Not a BFAST file, or endianness is swapped");
        if (data[1] != 0)
            throw new Error("Expected 0 in byte position 0");
        if (data[3] != 0)
            throw new Error("Expected 0 in byte position 8");
        if (data[5] != 0)
            throw new Error("Expected 0 in position 16");
        if (data[7] != 0)
            throw new Error("Expected 0 in position 24");
        if (header.DataStart <= 32 || header.DataStart > byteLength)
            throw new Error("Data start is out of valid range");
        if (header.DataEnd < header.DataStart || header.DataEnd > byteLength)
            throw new Error("Data end is out of vaid range");
        if (header.NumArrays < 0 || header.NumArrays > header.DataEnd)
            throw new Error("Number of arrays is invalid");
        // Compute each buffer
        var buffers = [];
        var pos = 8;
        for (var i = 0; i < header.NumArrays; ++i) {
            var begin = data[pos + 0];
            var end = data[pos + 2];
            // Check validity of data 
            if (data[pos + 1] != 0)
                throw new Error("Expected 0 in position " + (pos + 1) * 4);
            if (data[pos + 3] != 0)
                throw new Error("Expected 0 in position " + (pos + 3) * 4);
            if (begin < header.DataStart || begin > header.DataEnd)
                throw new Error("Buffer start is out of range");
            if (end < begin || end > header.DataEnd)
                throw new Error("Buffer end is out of range");
            pos += 4;
            var buffer = new Uint8Array(arrayBuffer, begin + byteOffset, end - begin);
            buffers.push(buffer);
        }
        if (buffers.length < 0)
            throw new Error("Expected at least one buffer containing the names");
        // break the first one up into names          
        var joinedNames = new TextDecoder("utf-8").decode(buffers[0]);
        // Removing the trailing '\0' before spliting the names 
        var names = joinedNames.slice(0, -1).split('\0');
        if (joinedNames.length == 0)
            names = [];
        // Validate the number of names 
        if (names.length != buffers.length - 1)
            throw new Error("Expected number of names to be equal to the number of buffers - 1");
        // For debug purposes output the name of each buffer 
        //for (let i=0; i < names.length; ++i)
        //    console.log("Buffer " + i + " (" + names[i] + ") has size " + buffers[i+1].byteLength);        
        // Return the bfast structure 
        return {
            header: header,
            names: names,
            buffers: buffers.slice(1),
        };
    };
    VIMLoader.prototype.constructEntityTable = function (bfast) {
        var r = {};
        for (var i = 0; i < bfast.buffers.length; ++i) {
            var tmp = bfast.names[i].split(':');
            var columnType = tmp[0];
            var columnName = tmp[1];
            var buffer = bfast.buffers[i];
            var columnData = void 0;
            if (columnType == "numeric") {
                columnData = new Float64Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 8);
                r[columnName] = columnData;
            }
            else if (columnType == "string" || columnType == "index") {
                columnData = new Int32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
                r[columnName] = columnData;
            }
            else if (columnType == "properties") {
                columnData = new Int32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
                r["properties"] = buffer;
            }
            else {
                throw new Error("Unrecognized column type " + columnType);
            }
        }
        return r;
    };
    VIMLoader.prototype.constructEntityTables = function (bfast) {
        var r = {};
        for (var i = 0; i < bfast.buffers.length; ++i) {
            var tableName = bfast.names[i];
            tableName = tableName.substring(tableName.indexOf(":") + 1);
            r[tableName] = this.constructEntityTable(this.parseBFastFromArray(bfast.buffers[i]));
        }
        return r;
    };
    // Given a BFAST container (header/names/buffers) constructs a VIM data structure
    VIMLoader.prototype.constructVIM = function (bfast) {
        console.log("Creating VIM");
        if (bfast.buffers.length < 5)
            throw new Error("VIM requires at least five BFast buffers");
        var lookup = {};
        for (var i = 0; i < bfast.buffers.length; ++i)
            lookup[bfast.names[i]] = bfast.buffers[i];
        // Parse BFAST
        return {
            header: new TextDecoder("utf-8").decode(lookup["header"]),
            assets: this.parseBFastFromArray(lookup["assets"]),
            g3d: this.constructG3D(this.parseBFastFromArray(lookup["geometry"])),
            entities: this.constructEntityTables(this.parseBFastFromArray(lookup["entities"])),
            strings: new TextDecoder("utf-8").decode(lookup["strings"]).split('\0'),
        };
    };
    // Given a BFAST container (header/names/buffers) constructs a G3D data structure
    VIMLoader.prototype.constructG3D = function (bfast) {
        console.log("Constructing G3D");
        if (bfast.buffers.length < 2)
            throw new Error("G3D requires at least two BFast buffers");
        // This will just contain some JSON
        var metaBuffer = bfast.buffers[0];
        if (bfast.names[0] != 'meta')
            throw new Error("First G3D buffer must be named 'meta', but was named: " + bfast.names[0]);
        // Extract each descriptor 
        var attributes = [];
        var nDescriptors = bfast.buffers.length - 1;
        for (var i = 0; i < nDescriptors; ++i) {
            var desc = bfast.names[i + 1].split(':');
            if (desc[0].toLowerCase() != 'g3d' || desc.length != 6)
                throw new Error("Not a valid attribute descriptor, must have 6 components delimited by ':' and starting with 'g3d' " + desc);
            var attribute = {
                name: desc,
                association: desc[1],
                semantic: desc[2],
                attributeTypeIndex: desc[3],
                dataType: desc[4],
                dataArity: desc[5],
                rawData: bfast.buffers[i + 1],
                data: undefined
            };
            attribute.data = this.attributeToTypedArray(attribute);
            console.log("Attribute " + i + " = " + desc);
            attributes.push(attribute);
        }
        return {
            attributes: attributes,
            meta: new TextDecoder("utf-8").decode(metaBuffer)
        };
    };
    // Finds the first attribute that has the matching fields passing null matches a field to all
    VIMLoader.prototype.findAttribute = function (VIM, assoc, semantic, index, dataType, arity) {
        var r = [];
        for (var i = 0; i < VIM.attributes.length; ++i) {
            var attr = VIM.attributes[i];
            if ((attr.association == assoc || assoc == null)
                && (attr.semantic == semantic || semantic == null)
                && (attr.attributeTypeIndex == index || index == null)
                && (attr.dataArity == arity || arity == null)
                && (attr.dataType == dataType || dataType == null)) {
                r.push(attr);
            }
        }
        return r.length > 0 ? r[0] : null;
    };
    // Converts a VIM attribute into a typed array from its raw data      
    VIMLoader.prototype.attributeToTypedArray = function (attr) {
        if (!attr)
            return null;
        // This is a UInt8 array
        var data = attr.rawData;
        switch (attr.dataType) {
            case "float32": return new Float32Array(data.buffer, data.byteOffset, data.byteLength / 4);
            case "float64": throw new Float64Array(data.buffer, data.byteOffset, data.byteLength / 8);
            case "int8": return data;
            case "int16": return new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
            case "int32": return new Int32Array(data.buffer, data.byteOffset, data.byteLength / 4);
            //case "int64": return new Int64Array(data.buffer, data.byteOffset, data.byteLength / 8);
            default: throw new Error("Unrecognized attribute data type " + attr.dataType);
        }
    };
    // Adds an attribute to a BufferGeometry, if not null
    VIMLoader.prototype.addAttributeToGeometry = function (geometry, name, attr) {
        if (attr)
            geometry.setAttribute(name, new THREE.BufferAttribute(attr.data, attr.dataArity));
    };
    VIMLoader.prototype.createBufferGeometry = function (positionTypedArray, indicesTypedArray, vertexColors) {
        if (!positionTypedArray)
            throw new Error("Cannot create geometry without a valid vertex attribute");
        if (!indicesTypedArray)
            throw new Error("Cannot create geometry without a valid index attribute");
        // Construtor the buffer geometry that is returned from the function 
        var geometry = new THREE.BufferGeometry();
        // A vertex position data buffer 
        geometry.setAttribute('position', new THREE.BufferAttribute(positionTypedArray, 3));
        // The Three JS shader model only supports 3 RGB colors 
        geometry.setAttribute('color', new THREE.BufferAttribute(vertexColors, 3));
        // Add the index buffer (which has to be cast to a Uint32BufferAttribute)        
        var indexBuffer = new THREE.Uint32BufferAttribute(indicesTypedArray, 1);
        geometry.setIndex(indexBuffer);
        return geometry;
    };
    VIMLoader.prototype.buildMeshes = function (g3d) {
        var _a, _b, _c, _d, _e, _f;
        if (!g3d)
            throw new Error("Missing g3d argument");
        // Unpack
        var positions = (_a = this.findAttribute(g3d, null, "position", "0", "float32", "3")) === null || _a === void 0 ? void 0 : _a.data;
        var indices = (_b = this.findAttribute(g3d, null, "index", "0", "int32", "1")) === null || _b === void 0 ? void 0 : _b.data;
        var meshSubmeshes = (_c = this.findAttribute(g3d, "mesh", "submeshoffset", "0", "int32", "1")) === null || _c === void 0 ? void 0 : _c.data;
        var submeshIndexOffset = (_d = this.findAttribute(g3d, "submesh", "indexoffset", "0", "int32", "1")) === null || _d === void 0 ? void 0 : _d.data;
        var submeshMaterial = (_e = this.findAttribute(g3d, "submesh", "material", "0", "int32", "1")) === null || _e === void 0 ? void 0 : _e.data;
        var materialColors = (_f = this.findAttribute(g3d, "material", "color", "0", "float32", "4")) === null || _f === void 0 ? void 0 : _f.data;
        if (!positions)
            throw new Error("Missing position attribute");
        if (!indices)
            throw new Error("Missing index attribute");
        if (!meshSubmeshes)
            throw new Error("Missing mesh submesh attribute");
        if (!submeshIndexOffset)
            throw new Error("Missing submesh index offset  attribute");
        if (!submeshMaterial)
            throw new Error("Missing submesh material attribute");
        if (!materialColors)
            throw new Error("Missing material color attribute");
        var colorArity = 4;
        var positionArity = 3;
        // Validate
        if (indices.length % 3 != 0)
            throw new Error("Invalid Index Count, must be divisible by 3");
        for (var i = 0; i < indices.length; i++)
            if (indices[i] < 0 || indices[i] >= positions.length)
                throw new Error("Vertex index out of bound");
        if (positions.length % positionArity != 0)
            throw new Error("Invalid position buffer, must be divisible by " + positionArity);
        for (var i = 0; i < meshSubmeshes.length; i++)
            if (meshSubmeshes[i] < 0 || meshSubmeshes[i] >= submeshIndexOffset.length)
                throw new Error("MeshSubmeshOffset out of bound at");
        for (var i = 0; i < meshSubmeshes.length - 1; i++)
            if (meshSubmeshes[i] >= meshSubmeshes[i + 1])
                throw new Error("MeshSubmesh out of sequence.");
        if (submeshIndexOffset.length != submeshMaterial.length)
            throw new Error("Mismatched submesh buffers");
        for (var i = 0; i < submeshIndexOffset.length; i++)
            if (submeshIndexOffset[i] < 0 || submeshIndexOffset[i] >= indices.length)
                throw new Error("SubmeshIndexOffset out of bound");
        for (var i = 0; i < submeshIndexOffset.length; i++)
            if (submeshIndexOffset[i] % 3 != 0)
                throw new Error("Invalid SubmeshIndexOffset, must be divisible by 3");
        for (var i = 0; i < submeshIndexOffset.length - 1; i++)
            if (submeshIndexOffset[i] >= submeshIndexOffset[i + 1])
                throw new Error("SubmeshIndexOffset out of sequence.");
        for (var i = 0; i < submeshMaterial.length; i++)
            if (submeshMaterial[i] >= materialColors.length)
                throw new Error("submeshMaterial out of bound");
        if (materialColors.length % colorArity != 0)
            throw new Error("Invalid material color buffer, must be divisible by " + colorArity);
        // Do the work
        var meshCount = meshSubmeshes.length;
        var submeshCount = submeshIndexOffset.length;
        var indexCount = indices.length;
        var resultMeshes = [];
        for (var mesh = 0; mesh < meshCount; mesh++) {
            var meshIndices = [];
            var meshVertexPositions = [];
            var meshVertexColors = [];
            var meshStart = meshSubmeshes[mesh];
            var meshEnd = mesh < meshCount - 1
                ? meshSubmeshes[mesh + 1]
                : submeshCount;
            for (var submesh = meshStart; submesh < meshEnd; submesh++) {
                var r = void 0, g = void 0, b = void 0, a = void 0;
                var material = submeshMaterial[submesh];
                if (material < 0) {
                    r = 0.5;
                    g = 0.5;
                    b = 0.5;
                    a = 1;
                }
                else {
                    r = materialColors[material * colorArity];
                    g = materialColors[material * colorArity + 1];
                    b = materialColors[material * colorArity + 2];
                    a = materialColors[material * colorArity + 3];
                }
                if (a < 0.9)
                    continue;
                var submeshStart = submeshIndexOffset[submesh];
                var submeshEnd = submesh < submeshCount - 1
                    ? submeshIndexOffset[submesh + 1]
                    : indexCount;
                for (var index = submeshStart; index < submeshEnd; index++) {
                    meshIndices.push(meshIndices.length);
                    var vertex = indices[index];
                    var x = positions[vertex * positionArity];
                    var y = positions[vertex * positionArity + 1];
                    var z = positions[vertex * positionArity + 2];
                    meshVertexPositions.push(x);
                    meshVertexPositions.push(y);
                    meshVertexPositions.push(z);
                    meshVertexColors.push(r);
                    meshVertexColors.push(g);
                    meshVertexColors.push(b);
                }
            }
            var resultMesh = this.createBufferGeometry(new Float32Array(meshVertexPositions), new Int32Array(meshIndices), new Float32Array(meshVertexColors));
            resultMesh.computeBoundingBox();
            resultMeshes.push(resultMesh);
        }
        return resultMeshes;
    };
    VIMLoader.prototype.floatsToMatrix = function (m) {
        var r = new THREE.Matrix4();
        r.elements = m;
        return r;
    };
    /*
    // Merges all meshes with only a single instance
    mergeSingleInstances ( instancedMeshList, material )
    {
        let r = [];

        let singleInstancedMeshes = [];
        for (let i=0; i < instancedMeshList.length; ++i)
        {
            let mesh = instancedMeshList[i];
            if (!mesh)
                continue;
            if (mesh.count == 1)
            {
                singleInstancedMeshes.push(mesh);
            }
            else
            {
                r.push(mesh);
            }
        }

        let matrix = new THREE.Matrix4();
        let meshesToMerge : THREE.BufferGeometry[] = [];
        for (let i=0; i < singleInstancedMeshes.length; ++i)
        {
            let g = singleInstancedMeshes[i].geometry;
            // Remove the normal attribute? Maybe something else?
            singleInstancedMeshes[i].getMatrixAt(0, matrix);
            g.applyMatrix4(matrix);
            meshesToMerge.push(g);
        }
        let mergedGeometry = THREE.BufferGeometryUtils.mergeBufferGeometries( meshesToMerge, false );
        let mergedMesh = new THREE.InstancedMesh( mergedGeometry, material, 1 );
        mergedMesh.setMatrixAt(0, new THREE.Matrix4());
        r.push(mergedMesh);

        return r;
    }
    */
    // Constructs a BufferGeometry from an ArrayBuffer arranged as a VIM
    // Main
    VIMLoader.prototype.parse = function (data, material) {
        var _a, _b;
        console.time("parsingVim");
        console.log("Parsing data buffer into VIM");
        console.log("data size " + data.byteLength);
        // A VIM follows the BFAST data arrangement, which is a collection of named byte arrays  
        console.log("Parsing BFAST structure");
        var bfast = this.parseBFast(data, 0, data.byteLength);
        console.log("found: " + bfast.buffers.length + " buffers");
        for (var i = 0; i < bfast.names.length; ++i)
            console.log(bfast.names[i]);
        console.log("Constructing VIM");
        var buffers = this.constructVIM(bfast);
        console.log("Building meshes");
        var geometry = this.buildMeshes(buffers.g3d);
        console.log("Found # meshes " + geometry.length);
        var matrixArity = 16;
        var instanceMeshes = (_a = this.findAttribute(buffers.g3d, "instance", "mesh", "0", "int32", "1")) === null || _a === void 0 ? void 0 : _a.data;
        var instanceTransforms = (_b = this.findAttribute(buffers.g3d, "instance", "transform", "0", "float32", "16")) === null || _b === void 0 ? void 0 : _b.data;
        // Validate
        if (!instanceMeshes)
            throw new Error("Missing Instance Mesh Attribute.");
        if (!instanceTransforms)
            throw new Error("Missing Instance Tranform Attribute.");
        if (instanceMeshes.length != instanceTransforms.length / matrixArity)
            throw new Error("Instance buffers mismatched");
        if (instanceTransforms.length % matrixArity != 0)
            throw new Error("Invalid InstanceTransform buffer, must respect arity " + matrixArity);
        for (var i = 0; i < instanceMeshes.length; i++)
            if (instanceMeshes[i] >= geometry.length)
                throw new Error("Instance Mesh Out of range.");
        console.log("Allocating Instanced Meshes");
        var rawMeshes = this.allocateMeshes(geometry, instanceMeshes, material);
        console.log("Applying Matrices");
        var _c = this.applyMatrices(rawMeshes, instanceMeshes, instanceTransforms), meshes = _c.meshes, centers = _c.centers;
        console.log("Computing center.");
        var sphere = new THREE.Sphere().setFromPoints(centers);
        //console.log("Merging lone meshes.");
        //vim.meshes = this.mergeSingleInstances(meshes, material);  
        meshes = meshes.filter(function (m) { return m !== undefined; });
        console.log("Extracting BIM Elements.");
        var elements = this.getElements(buffers);
        console.log("Extracting BIM Rooms.");
        var rooms = this.getRooms(buffers);
        console.timeEnd("parsingVim");
        return {
            header: buffers.header,
            entities: buffers.entities,
            strings: buffers.strings,
            g3d: buffers.g3d,
            assets: buffers.assets,
            meshes: meshes,
            elements: elements,
            rooms: rooms,
            sphere: sphere
        };
    };
    // geometries: array of THREE.GeometryBuffer
    // instanceMeshes: array of mesh indices
    // material: THREE.MeshPhongMaterial to use
    // returns array of THREE.InstancedMesh
    VIMLoader.prototype.allocateMeshes = function (geometries, instanceMeshes, material) {
        var meshCount = geometries.length;
        console.log("Counting references");
        var meshReferenceCounts = new Int32Array(meshCount);
        for (var i = 0; i < instanceMeshes.length; ++i) {
            var mesh = instanceMeshes[i];
            if (mesh < 0)
                continue;
            meshReferenceCounts[mesh]++;
        }
        console.log("Allocating instances.");
        var meshes = [];
        for (var i = 0; i < meshCount; ++i) {
            var count = meshReferenceCounts[i];
            if (count == 0) {
                meshes.push(undefined);
            }
            else {
                var g = geometries[i];
                var mesh = new THREE.InstancedMesh(g, material, count);
                meshes.push(mesh);
            }
        }
        return meshes;
    };
    // meshes: array of THREE.InstancedMesh
    // instanceMeshes: array of mesh indices
    // instanceTransform: flat array of matrix4x4 
    // Returns array of InstancedMesh and array of instance centers with matrices applied to both.
    VIMLoader.prototype.applyMatrices = function (meshes, instanceMeshes, instanceTransforms) {
        var matrixArity = 16;
        var instanceCounters = new Int32Array(meshes.length);
        var centers = [];
        for (var i = 0; i < instanceMeshes.length; ++i) {
            var meshIndex = instanceMeshes[i];
            if (meshIndex < 0)
                continue;
            var mesh = meshes[meshIndex];
            if (!mesh)
                continue;
            var matrixAsArray = instanceTransforms.subarray(i * matrixArity, (i + 1) * matrixArity);
            var matrix = this.floatsToMatrix(matrixAsArray);
            var count = instanceCounters[meshIndex]++;
            mesh.setMatrixAt(count, matrix);
            if (!mesh.userData.instanceIndices)
                mesh.userData.instanceIndices = [];
            mesh.userData.instanceIndices.push(i);
            var center = mesh.geometry.boundingBox.getCenter(new THREE.Vector3());
            center.applyMatrix4(matrix);
            centers.push(center);
        }
        return {
            meshes: meshes,
            centers: centers
        };
    };
    return VIMLoader;
}());
export { VIMLoader };
;
//# sourceMappingURL=VIMLoader.js.map