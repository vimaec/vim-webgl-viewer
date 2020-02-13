/**
 * @author VIM / https://vimaec.com
 *
 * Description: A THREE.JS loader for the G3D file format. 
 *
 * Usage:
 *  var loader = new THREE.G3DLoader();
 *  loader.load( './models/g3d/test.g3d', function ( geometry ) {
 *    scene.add( new THREE.Mesh( geometry ) );
 *  });
 *
 * Note:
 * 
 *  // A G3D geometry might contain colors for vertices. To set vertex colors in the material:
 *  if (geometry.hasColors) {
 *    material = new THREE.MeshPhongMaterial({ opacity: geometry.alpha, vertexColors: THREE.VertexColors });
 *  } else { .... }
 *  var mesh = new THREE.Mesh( geometry, material );
 */

THREE.G3DLoader = function ( manager ) {
	this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;
};

THREE.G3DLoader.prototype = 
{    
    // The G3D loader constructor 
    constructor: THREE.G3DLoader,
    
    // Loads the G3D from a URL 
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
                console.log("Error occured when loading G3D from " + url + ", message = " + exception);
				if ( onError ) onError( exception );				
			}

		}, onProgress, onError );
	},

    // BFAST is the container format for an array of binary arrays 
    parseBFast: function ( arrayBuffer )
    {
        // Cast the input data to 32-bit integers 
        // Note that according to the spec they are 64 bit numbers. In JavaScript you can't have 64 bit integers, 
        // and it would bust the amount of memory we can work with in most browsers and low-power devices  
        var data = new Int32Array( arrayBuffer );

        // Parse the header
        var header = {
            Magic:      data[0], // Either Constants.SameEndian or Constants.SwappedEndian depending on endianess of writer compared to reader. 
            DataStart:  data[2], // <= file size and >= ArrayRangesEnd and >= FileHeader.ByteCount
            DataEnd:    data[4], // >= DataStart and <= file size
            NumArrays:  data[6], // number of arrays 
        }

        // Check validity of data 
        // TODO: check endianness
        if (header.Magic != 0xBFA5) throw new Error("Not a BFAST file, or endianness is swapped");
        if (data[1] != 0) throw new Error("Expected 0 in byte position 0");
        if (data[3] != 0) throw new Error("Expected 0 in byte position 8");
        if (data[5] != 0) throw new Error("Expected 0 in position 16");
        if (data[7] != 0) throw new Error("Expected 0 in position 24");
        if (header.DataStart <= 32 || header.DataStart >= arrayBuffer.length) throw new Error("Data start is out of valid range");
        if (header.DataEnd < header.DataStart || header.DataEnd >= arrayBuffer.length) throw new Error("Data end is out of vaid range");
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
            var buffer = new Uint8Array(arrayBuffer, begin, end - begin);
            buffers.push(buffer);
        }        

        if (buffers.length < 0)
            throw new Error("Expected at least one buffer containing the names");

        // break the first one up into names          
        var joinedNames = new TextDecoder("utf-8").decode(buffers[0]);
        names = joinedNames.split('\0');

        if (names.length != buffers.length - 1)
            throw new Error("Expected number of names to be equal to the number of buffers - 1"); 

        // Return the bfast structure 
        return {
            header: header, 
            names: names,
            buffers: buffers.slice(1),
        }
    },

    // Given a BFAST container (header/names/buffers) constructs a G3D data structure
    constructG3d: function ( bfast )
    {
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
            if (desc[0] != 'g3d' || desc.length != '6')
                throw new Error("Not a valid attribute descriptor, must have 6 components delimited by ':' and starting with 'g3d': " + desc);
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
    findAttribute: function( g3d, assoc, semantic, index, dataType, arity ) {
        var r = [];
        for (var i=0; i < g3d.attributes.length; ++i)
        {
            var attr = g3d.attributes[i];
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

    // Converts a G3D attribute into a typed array from its raw data      
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

    // Constructs a BufferGeometry from an ArrayBuffer arranged as a G3D
    parse: function ( data ) 
    {	      
        // A G3D follows the BFAST data arrangement, which is a collection of named byte arrays  
        var bfast = this.parseBFast( data );

        // Construct the g3D, which is effectively a collection of attributes
        var g3d = this.constructG3d( bfast );
        
        // Find the vertex position data attribute
        var position = this.findAttribute( g3d, null, "position", "0", "float32", "3" );

        // Find the index buffer data attribute 
        var indices = this.findAttribute( g3d, null, "index", "0", "int32", "1" );

        if (!position) throw new Error("Cannot create geometry without a valid vertex attribute");
        if (!indices) throw new Error("Cannot create geometry without a valid index attribute");

        // Construtor the buffer geometry that is returned from the function 
        var geometry = new THREE.BufferGeometry();

        // A vertex position data buffer 
        this.addAttributeToGeometry( geometry, 'position', position );
        
        // Add the index buffer (which has to be cast to a Uint32BufferAttribute)
        var typedArray = this.attributeToTypedArray( indices );
        var indexBuffer = new THREE.Uint32BufferAttribute(typedArray, 1 );
        geometry.setIndex( indexBuffer );
        
        return geometry;
	}
};
