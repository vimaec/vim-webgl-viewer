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
		var scope = this;
		var loader = new THREE.FileLoader( scope.manager );
		loader.setResponseType( 'arraybuffer' );
        loader.load( url, function ( data ) 
        {
            try 
            {
				onLoad( scope.parse( data ) );
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

    // BFAST is the container format for an array of binary arrays 
    parseBFast: function ( arrayBuffer, byteOffset, byteLength )
    {
        console.log("Parsing BFAST");

        // Cast the input data to 32-bit integers 
        // Note that according to the spec they are 64 bit numbers. In JavaScript you can't have 64 bit integers, 
        // and it would bust the amount of memory we can work with in most browsers and low-power devices  
        var data = new Int32Array( arrayBuffer, byteOffset, byteLength / 4 );

        // Parse the header
        var header = {
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
        var buffers = [];
        var pos = 8; 
        for (var i=0; i < header.NumArrays; ++i) {
            var begin = data[pos+0];
            var end = data[pos+2];            

            // Check validity of data 
            if (data[pos+1] != 0) throw new Error("Expected 0 in position " + (pos + 1) * 4);
            if (data[pos+3] != 0) throw new Error("Expected 0 in position " + (pos + 3) * 4);
            if (begin < header.DataStart || begin > header.DataEnd) throw new Error("Buffer start is out of range");
            if (end < begin || end > header.DataEnd ) throw new Error("Buffer end is out of range");            

            pos += 4;      
            var buffer = new Uint8Array(arrayBuffer, begin + byteOffset, end - begin);
            buffers.push(buffer);
        }        

        if (buffers.length < 0)
            throw new Error("Expected at least one buffer containing the names");

        // break the first one up into names          
        var joinedNames = new TextDecoder("utf-8").decode(buffers[0]);

        // Removing the trailing '\0' before spliting the names 
        names = joinedNames.slice(0,-1).split('\0');

        // Validate the number of names 
        if (names.length != buffers.length - 1)
            throw new Error("Expected number of names to be equal to the number of buffers - 1"); 

        // For debug purposes output the name of each buffer 
        for (var i=0; i < names.length; ++i)
            console.log("Buffer " + i + " (" + names[i] + ") has size " + buffers[i+1].byteLength);        

        // Return the bfast structure 
        return {
            header: header, 
            names: names,
            buffers: buffers.slice(1),
        }
    },

    // Given a BFAST container (header/names/buffers) constructs a VIM data structure
    constructVIM: function ( bfast )
    {
        console.log("Creating VIM");

        if (bfast.buffers.length < 6)
            throw new Error("VIM requires at least six BFast buffers");

        var lookup = {};
        for (var i=0; i < bfast.buffers.length; ++i)
            lookup[bfast.names[i]] = bfast.buffers[i];

        // Parse geometry
        return { 
            header: new TextDecoder("utf-8").decode(lookup.header),
            assets: this.parseBFastFromArray(lookup.assets),
            g3d: this.constructG3D(this.parseBFastFromArray(lookup.geometry)),
            entities: this.parseBFastFromArray(lookup.entities),
            strings: new TextDecoder("utf-8").decode(lookup.strings),
        }
    },  

    // Given a BFAST container (header/names/buffers) constructs a G3D data structure
    constructG3D: function ( bfast )
    {
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
        for (var i=0; i < nDescriptors; ++i) {
            var desc = bfast.names[i+1].split(':');
            if (desc[0].toLowerCase() != 'g3d' || desc.length != 6)
                throw new Error("Not a valid attribute descriptor, must have 6 components delimited by ':' and starting with 'g3d' " + desc);
            var attribute = {
                name:               desc,
                association:        desc[1], // Indicates the part of the geometry that this attribute is associated with 
                semantic:           desc[2], // the role of the attribute 
                attributeTypeIndex: desc[3], // each attribute type should have it's own index ( you can have uv0, uv1, etc. )
                dataType:           desc[4], // the type of individual values (e.g. int32, float64)
                dataArity:          desc[5], // how many values associated with each element (e.g. UVs might be 2, geometry might be 3, quaternions 4, matrices 9 or 16)
                rawData:            bfast.buffers[i+1], // the raw data (a UInt8Array)                
            }
            attribute.data = this.attributeToTypedArray(attribute);
            attributes.push(attribute);
        }     
        
        return {
            attributes: attributes,
            meta:  new TextDecoder("utf-8").decode(metaBuffer)            
        }
    },    

    // Finds the first attribute that has the matching fields passing null matches a field to all
    findAttribute: function( VIM, assoc, semantic, index, dataType, arity ) {
        var r = [];
        for (var i=0; i < VIM.attributes.length; ++i)
        {
            var attr = VIM.attributes[i];
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
        var data = attr.rawData;

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
            geometry.addAttribute( name, new THREE.BufferAttribute( attr.data, attr.dataArity ) );
    },

    g3dToThreeJs : function ( g3d )
    {
        // Find the vertex position data attribute
        var position = this.findAttribute( g3d, null, "position", "0", "float32", "3" );
        console.log(position ? "Found position data" : "No position data found");

        // Find the index buffer data attribute 
        var indices = this.findAttribute( g3d, null, "index", "0", "int32", "1" );
        console.log(position ? "Found index data" : "No index data found");

        // Find the color attribute
        var colors = this.findAttribute( g3d, null, "color", "0", "float32", "4" );
        console.log(position ? "Found color data" : "No color data found");

        if (!position) throw new Error("Cannot create geometry without a valid vertex attribute");
        if (!indices) throw new Error("Cannot create geometry without a valid index attribute");

        // TODO: create intanced mesh for each node.
        // TODO: start with one 
        // https://threejs.org/docs/#api/en/objects/InstancedMesh

        // Construtor the buffer geometry that is returned from the function 
        var geometry = new THREE.BufferGeometry();

        // A vertex position data buffer 
        this.addAttributeToGeometry( geometry, 'position', position );

        // Optionally add a vertex color data buffer if present
        if (colors)
            this.addAttributeToGeometry( geometry, 'color', colors );
        
        // Add the index buffer (which has to be cast to a Uint32BufferAttribute)
        var typedArray = this.attributeToTypedArray( indices );
        var indexBuffer = new THREE.Uint32BufferAttribute(typedArray, 1 );
        geometry.setIndex( indexBuffer );
                
        return geometry;
    },

    splitGeometries: function ( g3d )
    {

    },

    // Constructs a BufferGeometry from an ArrayBuffer arranged as a VIM
    parse: function ( data ) 
    {	      
        console.log("Parsing data buffer into VIM");
        console.log("data size " + data.byteLength);

        console.log("Parsing BFAST structure");

        // A VIM follows the BFAST data arrangement, which is a collection of named byte arrays  
        var bfast = this.parseBFast( data, 0, data.byteLength );

        console.log("found: " + bfast.buffers.length + " buffers");
        for (var i=0; i < bfast.names.length; ++i)
            console.log(bfast.names[i]);
        
        console.log("Constructing VIM");
        var VIM = this.constructVIM( bfast );
        
        var threeJsGeometry = this.g3dToThreeJs(VIM.g3d);
        return threeJsGeometry;
	},
};
