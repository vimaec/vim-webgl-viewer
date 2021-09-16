/**
 @author VIM / https://vimaec.com

  Description: A THREE.JS loader for the VIM file format. 
 
  Usage:

      function loadVim(fileName) {
            console.log("Loading VIM");
            console.time("loadingVim");

            const loader = new THREE.VIMLoader();
            loader.load(fileName, (vim) => {                       
                console.log("Finished loading VIM: found " + vim.meshes.length + " objects");
                materialsLoaded = true;
                for (let i=0; i < vim.meshes.length; ++i)                        
                    loadObject(vim.meshes[i]);
                addViews(vim.rooms);
                console.log("Finished loading VIM geometries into scene");
                console.timeEnd("loadingVim");
            });
        } 
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
            return [];
        let roomData = vim.entities["Rvt.Room"];
        if (!roomData) 
            return [];
        let ids = new Int32Array(roomData["Element"]);
        if (!ids)
            return [];
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

        if (bfast.buffers.length < 5)
            throw new Error("VIM requires at least five BFast buffers");

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

    createBufferGeometry : function (positionTypedArray, indicesTypedArray, vertexColors)
    {
        if (!positionTypedArray) throw new Error("Cannot create geometry without a valid vertex attribute");
        if (!indicesTypedArray) throw new Error("Cannot create geometry without a valid index attribute");

        // Construtor the buffer geometry that is returned from the function 
        let geometry = new THREE.BufferGeometry();

        // A vertex position data buffer 
        geometry.setAttribute( 'position', new THREE.BufferAttribute( positionTypedArray, 3 ) );

        // The Three JS shader model only supports 3 RGB colors 
        geometry.setAttribute( 'color', new THREE.BufferAttribute(vertexColors, 3));

        // Add the index buffer (which has to be cast to a Uint32BufferAttribute)        
        indexBuffer = new THREE.Uint32BufferAttribute(indicesTypedArray, 1 );
        geometry.setIndex( indexBuffer ); 
        return geometry;   
    },

    buildMeshes: function ( g3d)
    {
        if (!g3d) throw new Error("Missing g3d argument");

        // Find the vertex position data attribute
        let positions = this.findAttribute( g3d, null, "position", "0", "float32", "3" );
        let indices = this.findAttribute(g3d, null, "index", "0", "int32", "1");
        let meshSubmeshes = this.findAttribute(g3d, "mesh", "submeshoffset", "0", "int32", "1");
        let submeshIndexOffset = this.findAttribute(g3d, "submesh", "indexoffset", "0", "int32", "1");
        let submeshMaterial = this.findAttribute(g3d, "submesh", "material", "0", "int32", "1");
        let materialColors = this.findAttribute(g3d, "material", "color", "0", "float32", "4" );

        if (!positions) throw new Error("Missing position attribute");
        if (!indices) throw new Error("Missing index attribute");
        if (!meshSubmeshes) throw new Error("Missing mesh submesh attribute");
        if (!submeshIndexOffset) throw new Error("Missing submesh index offset  attribute");
        if (!submeshMaterial) throw new Error("Missing submesh material attribute");
        if (!materialColors) throw new Error("Missing material color attribute");

        let meshCount = meshSubmeshes.data.length;
        let submeshCount = submeshIndexOffset.data.length;
        let indexCount = indices.data.length;
        let materialCount = materialColors.data.length;
        const colorArity = 4;
        const positionArity = 3;

        let resultMeshes = [];
        for (let mesh = 0; mesh < meshCount; mesh++)
        {
            let meshIndices = []
            let meshVertexPositions = [];
            let meshVertexColors = [];

            let meshStart = meshSubmeshes.data[mesh];
            let meshEnd = mesh < meshCount - 1
                ? meshSubmeshes.data[mesh + 1]
                : submeshCount;

            for (let submesh = meshStart; submesh < meshEnd; submesh++)
            {
                let r, g, b, a;
                let material = submeshMaterial.data[submesh];
                if (material >= materialCount)
                    throw new Error("Material count invalid");
                if (material < 0) {
                    r = 0.5;
                    g = 0.5;
                    b = 0.5;
                    a = 1;
                }
                else
                {
                    r = materialColors.data[material * colorArity];
                    g = materialColors.data[material * colorArity + 1];
                    b = materialColors.data[material * colorArity + 2];
                    a = materialColors.data[material * colorArity + 3];
                }

                if (a < 0.9)
                    continue;

                let submeshStart = submeshIndexOffset.data[submesh];
                let submeshEnd = submesh < submeshCount - 1
                    ? submeshIndexOffset.data[submesh + 1]
                    : indexCount;

                for (let index = submeshStart; index < submeshEnd; index++)
                {
                    meshIndices.push(meshIndices.length);
                    let vertex = indices.data[index];
                    let x = positions.data[vertex * positionArity];
                    let y = positions.data[vertex * positionArity + 1];
                    let z = positions.data[vertex * positionArity + 2]

                    meshVertexPositions.push(x); 
                    meshVertexPositions.push(y);
                    meshVertexPositions.push(z);

                    meshVertexColors.push(r);
                    meshVertexColors.push(g);
                    meshVertexColors.push(b);
                }
            }

            let resultMesh = this.createBufferGeometry(
                new Float32Array(meshVertexPositions),
                new Int32Array(meshIndices),
                new Float32Array(meshVertexColors),
            );
            resultMesh.computeBoundingBox();
            resultMeshes.push(resultMesh);
        }

        console.log("Meshes created succesfully");
        return resultMeshes;
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
        console.log("Parsing BFAST structure KEEWLLL~!!");
        let bfast = this.parseBFast( data, 0, data.byteLength );

        console.log("found: " + bfast.buffers.length + " buffers");
        for (let i=0; i < bfast.names.length; ++i)
            console.log(bfast.names[i]);
        
        console.log("Constructing VIM");
        let vim = this.constructVIM( bfast );
        
        console.log("Building meshes");
        vim.geometries = this.buildMeshes(vim.g3d);
        let meshCount = vim.geometries.length;
        console.log("Found # meshes " + meshCount);

        const matrixArity = 16;
        let instanceMeshes = this.findAttribute(vim.g3d, "instance", "mesh", "0", "int32", "1");
        let instanceTransforms = this.findAttribute(vim.g3d, "instance", "transform", "0", "float32", "16");
        if (!instanceMeshes) throw new Error("Missing Instance Mesh Attribute.");
        if (!instanceTransforms) throw new Error("Missing Instance Tranform Attribute.");
        if (instanceMeshes.data.length != instanceTransforms.data.length / matrixArity)
            throw new Error("Mismatched instance attributes length.");
        let instanceCount = instanceMeshes.data.length;
        

        console.log("Counting mesh references");
        let meshReferenceCounts = new Int32Array(meshCount);
        for (let i = 0; i < instanceCount; ++i)
        {
            let mesh = instanceMeshes.data[i];
            if (mesh < 0) continue;
            meshReferenceCounts[mesh]++;
        }            

        console.log("Creating instanced meshes");
        const meshes = [];
        for (let i=0; i < meshCount; ++i)
        {
            const count = meshReferenceCounts[i];               
            const g = vim.geometries[i];
            const mesh = new THREE.InstancedMesh(g, material, count);
            meshes.push(mesh);
        }

        console.log("Applying Matrices");
        const instanceCounters = new Int32Array(meshCount);
        const instanceCenters = [];
        for (let i=0; i < instanceCount; ++i)
        {
            const meshIndex = instanceMeshes.data[i];
            if (meshIndex < 0)
                continue;
                   
            const mesh = meshes[meshIndex];
            if (!mesh)
                continue;

            const matrixAsArray = instanceTransforms.data.subarray(i * matrixArity, (i + 1) * matrixArity);
            const matrix = this.floatsToMatrix(matrixAsArray);

            const count = instanceCounters[meshIndex]++;
            mesh.setMatrixAt(count, matrix);

            let center = mesh.geometry.boundingBox.getCenter(new THREE.Vector3());
            center.applyMatrix4(matrix);
            instanceCenters.push(center);
        }

        console.log("Computing center.");
        vim.box = new THREE.Box3().setFromPoints(instanceCenters);

        console.log("Merging lone meshes.");
        vim.meshes = this.mergeSingleInstances(meshes, material);        

        console.log("Extracting BIM Elements.");
        vim.elements = this.getElements(vim);

        console.log("Extracting BIM Rooms.");
        vim.rooms = this.getRooms(vim);
        
        console.timeEnd("parsingVim");
        return vim;
	},
};
