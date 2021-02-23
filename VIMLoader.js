/**
 @author VIM / https://vimaec.com

  Description: A THREE.JS loader for the VIM file format. 
 
  Usage:

    const loader = new THREE.VIMLoader();
        loader.load(fileName, (obj) => {
            objects.push(obj.scene);
            scene.add(obj);
    });

 https://threejs.org/docs/#api/en/objects/InstancedMesh
 
 */

THREE.VIMLoader = function ( manager ) {
	this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;
};

THREE.VIMLoader.prototype = 
{    
    // The VIM loader constructor 
    constructor: THREE.VIMLoader,
    
    // Loads the VIM from a URL 
    load: function ( url, onLoad, onProgress, onError ) 
    {        
        const material = new THREE.MeshPhongMaterial( { 
            color: 0x999999, 
            vertexColors: THREE.VertexColors, 
            flatShading: true, 
            side: THREE.DoubleSide,  
            shininess: 70   
        });            
		let scope = this;
		let loader = new THREE.FileLoader( scope.manager );
        loader.setResponseType( 'arraybuffer' );
        loader.setRequestHeader("Content-Encoding", "gzip");
        loader.setRequestHeader("Accept-Encoding", "gzip, deflate");
        loader.load( url, function ( data ) 
        {
            try 
            {
				onLoad( scope.parse( data, material ) );
            } 
            catch ( exception ) 
            {
                console.log("Error occured when loading VIM from " + url + ", message = " + exception);
				if ( onError ) onError( exception );				
			}

		}, onProgress, onError );
	},

    parseBFastFromArray: function ( bytes )
    {
        return this.parseBFast( bytes.buffer, bytes.byteOffset, bytes.byteLength );
    },

    getMaterialColorLookup : function ( vim )
    {
        let materialData = vim.entities["Rvt.Material"];
        if (materialData == null)
            throw new Error("Material data undefined");
        let xs = new Float64Array(materialData["Color.X"], );
        let ys = new Float64Array(materialData["Color.Y"]);
        let zs = new Float64Array(materialData["Color.Z"]);
        let ws = new Float64Array(materialData["Transparency"]);
        let ids = new Float64Array(materialData["Id"]);
        let r = {};
        for (let i=0; i < ids.length; ++i)
        {
            r[ids[i]] = 
            {
                color: new THREE.Color(xs[i],ys[i],zs[i]),
                opacity: 1.0 - ws[i],
            };     
        }
        return r;
    },

    getElements : function ( vim )
    {
        let elementData = vim.entities["Rvt.Element"];
        let names = new Int32Array(elementData["Name"]);
        let xs = new Float64Array(elementData["Location.X"]);
        let ys = new Float64Array(elementData["Location.Y"]);
        let zs = new Float64Array(elementData["Location.Z"]);
        let r = new Array(names.length);
        for (let i=0; i < names.length; ++i)
        {
            let name = names[i] >= 0 ? vim.strings[names[i]] : "";
            r[i] = { name: name, x: xs[i], y: ys[i], z: zs[i] };
        }
        return r;
    },    
    
    getRooms : function ( vim )
    {
        if (!vim.elements)
            return undefined;
        let roomData = vim.entities["Rvt.Room"];
        let ids = new Int32Array(roomData["Element"]);
        let r = new Array(ids.length);
        for (let i=0; i < ids.length; ++i)
        {
            let id = ids[i];
            if (id > 0)
                r[i] = vim.elements[id];
        }
        return r;
    },
    
    // BFAST is the container format for an array of binary arrays 
    parseBFast: function ( arrayBuffer, byteOffset, byteLength )
    {
        console.log("Parsing BFAST");

        // Cast the input data to 32-bit integers 
        // Note that according to the spec they are 64 bit numbers. In JavaScript you can't have 64 bit integers, 
        // and it would bust the amount of memory we can work with in most browsers and low-power devices  
        let data = new Int32Array( arrayBuffer, byteOffset, byteLength / 4 );

        // Parse the header
        let header = {
            Magic:      data[0], // Either Constants.SameEndian or Constants.SwappedEndian depending on endianess of writer compared to reader. 
            DataStart:  data[2], // <= file size and >= ArrparayRangesEnd and >= FileHeader.ByteCount
            DataEnd:    data[4], // >= DataStart and <= file size
            NumArrays:  data[6], // number of arrays 
        }

        console.log("BFAST header");
        console.log(JSON.stringify(header));

        // Check validity of data 
        // TODO: check endianness
        if (header.Magic != 0xBFA5) throw new Error("Not a BFAST file, or endianness is swapped");
        if (data[1] != 0) throw new Error("Expected 0 in byte position 0");
        if (data[3] != 0) throw new Error("Expected 0 in byte position 8");
        if (data[5] != 0) throw new Error("Expected 0 in position 16");
        if (data[7] != 0) throw new Error("Expected 0 in position 24");
        if (header.DataStart <= 32 || header.DataStart > byteLength) throw new Error("Data start is out of valid range");
        if (header.DataEnd < header.DataStart || header.DataEnd > byteLength) throw new Error("Data end is out of vaid range");
        if (header.NumArrays < 0 || header.NumArrays > header.DataEnd) throw new Error("Number of arrays is invalid");
                
        // Compute each buffer
        let buffers = [];
        let pos = 8; 
        for (let i=0; i < header.NumArrays; ++i) {
            let begin = data[pos+0];
            let end = data[pos+2];            

            // Check validity of data 
            if (data[pos+1] != 0) throw new Error("Expected 0 in position " + (pos + 1) * 4);
            if (data[pos+3] != 0) throw new Error("Expected 0 in position " + (pos + 3) * 4);
            if (begin < header.DataStart || begin > header.DataEnd) throw new Error("Buffer start is out of range");
            if (end < begin || end > header.DataEnd ) throw new Error("Buffer end is out of range");            

            pos += 4;      
            let buffer = new Uint8Array(arrayBuffer, begin + byteOffset, end - begin);
            buffers.push(buffer);
        }        

        if (buffers.length < 0)
            throw new Error("Expected at least one buffer containing the names");

        // break the first one up into names          
        let joinedNames = new TextDecoder("utf-8").decode(buffers[0]);

        // Removing the trailing '\0' before spliting the names 
        names = joinedNames.slice(0,-1).split('\0');

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
        }
    },

    constructEntityTable: function (bfast) 
    {
        let r = {};
        for (let i=0; i < bfast.buffers.length; ++i)
        {
            let tmp = bfast.names[i].split(':');
            let columnType = tmp[0];
            let columnName = tmp[1];
            let buffer = bfast.buffers[i];
            let columnData;
            if (columnType == "numeric")
            {
                columnData = new Float64Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 8);
                r[columnName] = columnData;
            }
            else if (columnType == "string" || columnType == "index")
            {
                columnData = new Int32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
                r[columnName] = columnData;
            }
            else if (columnType == "properties")
            {
                columnData = new Int32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
                r["properties"] = buffer;
            }
            else 
            {
                throw new Error("Unrecognized column type " + columnType);
            }
        }
        return r;
    },

    constructEntityTables: function (bfast) 
    {
        let r = {};
        for (let i=0; i < bfast.buffers.length; ++i)
        {
            let tableName = bfast.names[i];
            tableName = tableName.substring(tableName.indexOf(":") + 1);
            r[tableName] = this.constructEntityTable(this.parseBFastFromArray(bfast.buffers[i]));
        }
        return r;
    },

    // Given a BFAST container (header/names/buffers) constructs a VIM data structure
    constructVIM: function ( bfast )
    {
        console.log("Creating VIM");

        if (bfast.buffers.length < 6)
            throw new Error("VIM requires at least six BFast buffers");

        let lookup = {};
        for (let i=0; i < bfast.buffers.length; ++i)
            lookup[bfast.names[i]] = bfast.buffers[i];

        // Some files generate the wrong name for the "nodes"
        if (!lookup.nodes)
            lookup.nodes = lookup.node;

        // Parse geometry
        return { 
            header: new TextDecoder("utf-8").decode(lookup.header),
            assets: this.parseBFastFromArray(lookup.assets),
            g3d: this.constructG3D(this.parseBFastFromArray(lookup.geometry)),
            nodes: this.parseNodes(lookup.nodes),
            entities: this.constructEntityTables(this.parseBFastFromArray(lookup.entities)),
            strings: new TextDecoder("utf-8").decode(lookup.strings).split('\0'),
        }
    },  

    // Given a BFAST container (header/names/buffers) constructs a G3D data structure
    constructG3D: function ( bfast )
    {
        console.log("Constructing G3D");

        if (bfast.buffers.length < 2)
            throw new Error("G3D requires at least two BFast buffers");

        // This will just contain some JSON
        let metaBuffer = bfast.buffers[0];
        if (bfast.names[0] != 'meta')
            throw new Error("First G3D buffer must be named 'meta', but was named: " + bfast.names[0]);
        
        // Extract each descriptor 
        let attributes = [];
        let nDescriptors = bfast.buffers.length - 1;
        for (let i=0; i < nDescriptors; ++i) {
            let desc = bfast.names[i+1].split(':');
            if (desc[0].toLowerCase() != 'g3d' || desc.length != 6)
                throw new Error("Not a valid attribute descriptor, must have 6 components delimited by ':' and starting with 'g3d' " + desc);
            let attribute = {
                name:               desc,
                association:        desc[1], // Indicates the part of the geometry that this attribute is associated with 
                semantic:           desc[2], // the role of the attribute 
                attributeTypeIndex: desc[3], // each attribute type should have it's own index ( you can have uv0, uv1, etc. )
                dataType:           desc[4], // the type of individual values (e.g. int32, float64)
                dataArity:          desc[5], // how many values associated with each element (e.g. UVs might be 2, geometry might be 3, quaternions 4, matrices 9 or 16)
                rawData:            bfast.buffers[i+1], // the raw data (a UInt8Array)                
            }
            attribute.data = this.attributeToTypedArray(attribute);
            console.log("Attribute " + i + " = " + desc);
            attributes.push(attribute);
        }     
        
        return {
            attributes: attributes,
            meta:  new TextDecoder("utf-8").decode(metaBuffer)            
        }
    },    

    // Finds the first attribute that has the matching fields passing null matches a field to all
    findAttribute: function( VIM, assoc, semantic, index, dataType, arity ) {
        let r = [];
        for (let i=0; i < VIM.attributes.length; ++i)
        {
            let attr = VIM.attributes[i];
            if ((attr.association == assoc || assoc == null)
                && (attr.semantic == semantic || semantic == null)
                && (attr.attributeTypeIndex == index || index == null)
                && (attr.dataArity == arity || arity == null)
                && (attr.dataType == dataType || dataType == null))
            {
                r.push(attr)
            }
        }
        return r.length > 0 ? r[0] : null;
    },    

    // Converts a VIM attribute into a typed array from its raw data      
    attributeToTypedArray : function( attr ) {
        if (!attr) 
            return null;
        
        // This is a UInt8 array
        let data = attr.rawData;

        switch (attr.dataType)
        {
            case "float32": return new Float32Array(data.buffer, data.byteOffset, data.byteLength / 4);
            case "float64": throw new Float64Array(data.buffer, data.byteOffset, data.byteLength / 8);
            case "int8": return data;
            case "int16": return new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
            case "int32": return new Int32Array(data.buffer, data.byteOffset, data.byteLength / 4);
            case "int64": return new Int64Array(data.buffer, data.byteOffset, data.byteLength / 8);
            default: throw new Error("Unrecognized attribute data type " + attr.dataType);
        }
    },

    // Adds an attribute to a BufferGeometry, if not null
    addAttributeToGeometry : function ( geometry, name, attr ) {
        if (attr)
            geometry.setAttribute( name, new THREE.BufferAttribute( attr.data, attr.dataArity ) );
    },

    createBufferGeometry : function ( positionTypedArray, indicesTypedArray, uvsTypedArray, vertexColors, opacities )
    {
        if (!positionTypedArray) throw new Error("Cannot create geometry without a valid vertex attribute");
        if (!indicesTypedArray) throw new Error("Cannot create geometry without a valid index attribute");

        // Construtor the buffer geometry that is returned from the function 
        let geometry = new THREE.BufferGeometry();

        // A vertex position data buffer 
        geometry.setAttribute( 'position', new THREE.BufferAttribute( positionTypedArray, 3 ) );

        if (uvsTypedArray)
            geometry.setAttribute( 'uv', new THREE.BufferAttribute( uvsTypedArray, 2 ) );

        // The Three JS shader model only supports 3 RGB colors (we could do more if we want.)
        geometry.setAttribute( 'color', new THREE.BufferAttribute(vertexColors, 3));

        // Opacity would require updating the shader. This is proposed in some discussions on the Three.JS forum
        //geometry.setAttribute( 'aOpacity', new THREE.BufferAttribute(opacities, 1));

        // Add the index buffer (which has to be cast to a Uint32BufferAttribute)        
        indexBuffer = new THREE.Uint32BufferAttribute(indicesTypedArray, 1 );
        geometry.setIndex( indexBuffer ); 
        return geometry;   
    },

    parseNodes: function ( data )
    {
        console.log("Parsing nodes");

        let nodeSize = (3 * 4) + (16 * 4); 
        if (data.byteLength % nodeSize != 0) throw new Error("Expected node databuffer size " + data.byteLength + " to be divisble by " + nodeSize);
        let numNodes = data.byteLength / nodeSize;
        let ints = new Int32Array(data.buffer, data.byteOffset, data.byteLength / 4);
        let floats = new Float32Array(data.buffer, data.byteOffset, data.byteLength / 4);

        let r = [];
        for (let i=0; i < numNodes; ++i)
        {
            let offset = i * 19;
            let node = {
                parentIndex: ints[offset], // DEPRECATED 
                geometryIndex: ints[offset + 1],
                instanceIndex: ints[offset + 2], // DEPRECATED
                worldTransform: floats.slice(offset + 3, offset + 19),
            };
            // We do not generate nodes with geometry 
            if (node.geometryIndex >= 0)
                r.push(node);
        }
        return r;
    },    

    getMaterialIdsPerGeometry: function ( g3d )
    {
        let materials = this.findAttribute( g3d, null, "materialid", "0", "int32", "1" );
        if (!materials)
            throw new Error("Could not find material ids attribute");
        let indexOffsets = this.findAttribute( g3d, null, "indexoffset", "0", "int32", "1");
        if (!indexOffsets)
            throw new Error("Could not find index offsets attribute");
        
        // let indices = this.findAttribute( g3d, null, "index", "0", "int32", "1" );
        let r = [];
        for (let i=0; i < indexOffsets.data.length; ++i)
        {
            let offset = indexOffsets.data[i];
            let faceIndex = offset / 3;co
            if (faceIndex < 0 || faceIndex >= materials.data.length)
                throw new Error("Material index " + faceIndex + " is out of range");            
            r.push(materials.data[faceIndex]);
        }
        return r;
    },
    
    checkRange: function( val, name, begin, end )
    {
        if (val < begin || val >= end)
            throw new Error("Value " + name + " has value " + val + " and is out of valid range from " + begin + " to " + end);
        return val;
    },

    splitGeometries: function ( g3d, matIdLookup )
    {
        if (!g3d) throw new Error("Missing g3d argument");
        if (!matIdLookup) throw new Error("Missing material lookup");

        // Find the vertex position data attribute
        let positions = this.findAttribute( g3d, null, "position", "0", "float32", "3" );
        let indices = this.findAttribute( g3d, null, "index", "0", "int32", "1" );
        //let colors = this.findAttribute( g3d, null, "color", "0", "float32", "4" );
        let uvs = this.findAttribute( g3d, null, "uv", "0", "float32", "2" );
        let materials = this.findAttribute( g3d, null, "materialid", "0", "int32", "1" );

        if (!positions) throw new Error("Missing position attribute");
        if (!indices) throw new Error("Missing index attribute");
        if (!uvs) throw new Error("Missing UV attribute");
        if (!materials) throw new Error("Missing materialid attribute");

        let indexOffsets = this.findAttribute( g3d, null, "indexoffset", "0", "int32", "1");
        let vertexOffsets = this.findAttribute( g3d, null, "vertexoffset", "0", "int32", "1");

        if (!indexOffsets) throw new Error("Missing index offsets");
        if (!vertexOffsets) throw new Error("Missing vertex offsets");
        if (indexOffsets.data.length != vertexOffsets.data.length) throw new Error("# index offsets " + indexOffsets.data.length + " is not the same as # vertex offsets " + vertexOffsets.data.length);

        let numTotalIndices = indices.data.length;
        let numTotalVertices = positions.data.length;
        let geometries = [];
        let numTotalFaces = numTotalIndices / 3;
        if (numTotalFaces != materials.data.length)
            throw new Error("Number of faces is not the same as the number of materials");

        for (let i=0; i < indexOffsets.data.length; ++i)
        {
            let indexBegin = this.checkRange(indexOffsets.data[i], "index begin", 0, numTotalIndices);
            let vertexBegin = this.checkRange(vertexOffsets.data[i], "vertex begin", 0, numTotalVertices);
            let indexEnd = this.checkRange(i >= indexOffsets.data.length - 1 ? numTotalIndices : indexOffsets.data[i+1], "index end", indexBegin, numTotalIndices + 1);
            let vertexEnd =  this.checkRange(i >= vertexOffsets.data.length - 1 ? numTotalVertices : vertexOffsets.data[i+1], "vertex end", vertexBegin, numTotalVertices + 1);

            let localPositions = positions.data.subarray(vertexBegin * 3, vertexEnd * 3);
            let localIndices = indices.data.subarray(indexBegin, indexEnd);
            //let localColors = colors != null && colors.data != null ? colors.data.subarray(vertexBegin * 4, vertexEnd * 4) : null;
            //let localUvs = uvs.data.subarray(vertexBegin * 2, vertexEnd * 2);

            let faceBegin = this.checkRange(indexBegin / 3, "face begin", 0, numTotalFaces);
            let faceEnd = this.checkRange(indexEnd / 3, "face end", faceBegin, numTotalFaces + 1);
            let matIds = materials.data.subarray(faceBegin, faceEnd);
            let opacities = new Float32Array(localPositions.length); 
            for (let j=0; j < opacities.length; ++j)
                opacities[j] = 1.0;
            
            if (localPositions.length % 3 != 0)
                throw new Error("Number of vertex floats is not divisible by 3 " + localPositions.length)
            
            let nVertices = localPositions.length / 3;
            let colorArity = 3;
            let vertexColors = new Float32Array(nVertices * colorArity);
            for (let j=0; j < vertexColors.length; ++j)
                vertexColors[j] = 0.5;

            let newIndices = [];
            let numFaces = faceEnd - faceBegin;
            for (let j=0; j < numFaces; ++j)
            {
                // TODO: this requirement should be removed in VIM v1.0 it slows down load times 
                localIndices[j * 3 + 0] -= vertexBegin;
                localIndices[j * 3 + 1] -= vertexBegin;
                localIndices[j * 3 + 2] -= vertexBegin;

                // Get the material ID for the current face, and find the associated color. 
                let matId = matIds[j];
                let mat = matIdLookup[matId];
                    
                for (let k=0; k < 3; ++k)
                {
                    let idx = this.checkRange(localIndices[j * 3 + k], "index", 0, nVertices);
                    if (mat)
                    {
                        vertexColors[idx * colorArity + 0] = mat.color.r;
                        vertexColors[idx * colorArity + 1] = mat.color.g;
                        vertexColors[idx * colorArity + 2] = mat.color.b;
                        opacities[idx] = mat.opacity;
                    }
    
                    // Don't put transparent triangles in 
                    if (!mat || mat.opacity > 0.9)
                        newIndices.push(idx);
                }
            }

            localIndices = new Int32Array(newIndices);
            
            if (localIndices.length == 0)
            {
                geometries.push(undefined);
            }
            else 
            {
                let geometry = this.createBufferGeometry(localPositions, localIndices, undefined, vertexColors, opacities);
                // This has to be enabled if you set flatShading: true on the material. However, experience shows that the 
                //geometry.computeVertexNormals();
                geometries.push(geometry);
            }
        }        

        return geometries;        
    },    

    floatsToMatrix: function (m)
    {
        let r = new THREE.Matrix4();
        r.elements = m;
        return r;
    },

    // Merges all meshes with only a single instance 
    mergeSingleInstances: function ( instancedMeshList, material )
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
        let meshesToMerge = [];
        for (let i=0; i < singleInstancedMeshes.length; ++i)
        {            
            let g = singleInstancedMeshes[i].geometry;
            // Remove the normal attribute? Maybe something else? 
            singleInstancedMeshes[i].getMatrixAt(0, matrix);
            g.applyMatrix4(matrix);
            meshesToMerge.push(g);
        }
        let mergedGeometry = THREE.BufferGeometryUtils.mergeBufferGeometries( meshesToMerge );
        let mergedMesh = new THREE.InstancedMesh( mergedGeometry, material, 1 );
        mergedMesh.setMatrixAt(0, new THREE.Matrix4());
        r.push(mergedMesh);
        return r;
    },

    // Constructs a BufferGeometry from an ArrayBuffer arranged as a VIM
    parse: function ( data, material ) 
    {	   
        console.time("parsingVim");

        console.log("Parsing data buffer into VIM");
        console.log("data size " + data.byteLength);

        // A VIM follows the BFAST data arrangement, which is a collection of named byte arrays  
        console.log("Parsing BFAST structure");
        let bfast = this.parseBFast( data, 0, data.byteLength );

        console.log("found: " + bfast.buffers.length + " buffers");
        for (let i=0; i < bfast.names.length; ++i)
            console.log(bfast.names[i]);
        
        console.log("Constructing VIM");
        let vim = this.constructVIM( bfast );
        
        console.log("Computing material color lookup");
        vim.materialLookup = this.getMaterialColorLookup( vim );

        console.log("Splitting geometries");
        vim.geometries = this.splitGeometries(vim.g3d, vim.materialLookup );
        console.log("Found # geometries " + vim.geometries.length);

        console.log("Counting # instance of each geometry");
        let instanceCounts = [];
        for (let i=0; i < vim.geometries.length; ++i)
            instanceCounts.push(0);
        for (let i=0; i < vim.nodes.length; ++i)
        {
            let geometryIndex = vim.nodes[i].geometryIndex;
            if (geometryIndex >= 0)
                instanceCounts[geometryIndex] += 1;
        }            
        
        console.log("creating instanced meshes");
        vim.meshes = new Array(vim.geometries.length);
        for (let i=0; i < vim.geometries.length; ++i)
        {
            let count = instanceCounts[i];               
            let g = vim.geometries[i];
            if (g)
                vim.meshes[i] = new THREE.InstancedMesh( g, material, count );
        }

        // We are going to reuse the geometryCounts as the current index
        let instanceIndexes = new Array(instanceCounts.length);
        for (let i=0; i < instanceCounts.length; ++i)
            instanceIndexes[i] = 0;
        
        for (let i=0; i < vim.nodes.length; ++i)
        {
            // TODO: set the matrix for one of the instanced meshes. 
            // NOTE: we will have to keep track of the current index of the geometry for each node
            let node = vim.nodes[i];
            if (node.geometryIndex < 0)
                continue;
            
            if (node.geometryIndex > vim.meshes.length)
                throw new Error("Geometry index " + node.geometryIndex + " out of range 0 .. " +vim.meshes.length);            
            let mesh = vim.meshes[node.geometryIndex];
            if (!mesh)
                continue;
            let matrix = this.floatsToMatrix(node.worldTransform);
            let instanceIndex = instanceIndexes[node.geometryIndex];
            if (instanceIndex < 0 || instanceIndex >= mesh.count)
                throw new Error("Instance index " + instanceIndex + " is out of range " + mesh.count);
            mesh.setMatrixAt(instanceIndex, matrix);
            instanceIndexes[node.geometryIndex] += 1;
        }
        
        vim.meshes = this.mergeSingleInstances(vim.meshes, material);        
        vim.elements = this.getElements(vim);
        vim.rooms = this.getRooms(vim);
        
        console.timeEnd("parsingVim");
        return vim;
	},
};
