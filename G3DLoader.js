/**
 * @author cdiggins / http://ara3d.com
 *
 * Description: A THREE loader for the G3D file format by Christopher Diggins at Ara 3D. 
 *
 * Usage:
 *  var loader = new THREE.G3DLoader();
 *  loader.load( './models/g3d/test.g3d', function ( geometry ) {
 *    scene.add( new THREE.Mesh( geometry ) );
 *  });
 *
 * For G3D geometry might contain colors for vertices. To use it:
 *  // use the same code to load STL as above
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
    // Data type constants
    dt_int8:0,
    dt_int16:1,
    dt_int32:2,
    dt_int64:3,
    dt_float32:4,
    dt_float64:5,

    // Attribute type associations 
    assoc_vertex:0,
    assoc_face:1,
    assoc_corner:2,
    assoc_edge:3,
    assoc_object:4,
    assoc_instance:5,
    assoc_group:6,
    assoc_none:7,

    // Attribute types
    attr_unknown:0,
    attr_vertex:1,
    attr_index:2,
    attr_faceindex:3,
    attr_facesize:4,
    attr_normal:5,
    attr_binormal:6,
    attr_tangent:7,
    attr_materialid:8,
    attr_polygroup:9,
    attr_uv:10,
    attr_color:11,
    attr_smoothing:12,
    attr_visibility:13,
    attr_selection:14,
    attr_pervertex:15,
    attr_mapchannel_data:16,
    attr_mapchannel_index:17,
    attr_instance_transform:18,
    attr_instance_group:19,
    attr_group_index:20, 
    attr_group_size:21,
    attr_custom:22,

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
        if (header.Magic != 0xBFA5) throw new Error("Not a BFAST file");
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

        // Return the bfast structure 
        return {
            header: header,
            buffers: buffers,
        }
    },

    // Given a BFAST container (header/buffers) constructs a G3D data structure
    constructG3d: function ( bfast )
    {
        if (bfast.buffers.length < 2)
            throw new Error("G3D requires at least two BFast buffers");

        // This will just contain some JSON (to-do convert )
        var metaBuffer = bfast.buffers[0];

        // Contains the array of descriptors 
        var descriptorsBuffer = bfast.buffers[1];
        
        // Check the size and convert into an array of Int32
        if (descriptorsBuffer.byteLength % 32 != 0) throw new Error("Expected the descriptors buffer to divde equally by 32");
        var nDescriptors = descriptorsBuffer.byteLength / 32; 
        if (nDescriptors != bfast.buffers.length - 2) throw new Error("Expected there to be n-2 descriptors, where n = # BFast buffers");
        var data = new Int32Array(descriptorsBuffer.buffer, descriptorsBuffer.byteOffset, descriptorsBuffer.byteLength / 4);        
        
        // Extract each descriptor 
        var attributes = [];
        for (var i=0; i < nDescriptors; ++i) {
            // We are indexing into an array of arrays of 32-but sizes
            var offset = i * 8; 
            var attribute = {
                Association:        data[offset+0], // Indicates the part of the geometry that this attribute is associated with 
                AttributeType:      data[offset+1], // n integer values 
                AttributeTypeIndex: data[offset+2], // each attribute type should have it's own index ( you can have uv0, uv1, etc. )
                DataArity:          data[offset+3], // how many values associated with each element (e.g. UVs might be 2, geometry might be 3, quaternions 4, matrices 9 or 16)
                DataType:           data[offset+4], // the type of individual values (e.g. int32, float64)
                Data:               bfast.buffers[i+2], // the data (a UInt8Array)                
            }
            attributes.push(attribute);
        }      
        return attributes;  
    },    

    findAttribute: function( g3d, assoc, attrType, index, arity, dataType ) {
        var r = [];
        for (var i=0; i < g3d.length; ++i)
        {
            var attr = g3d[i];
            if ((attr.Association == assoc || assoc < 0)
                && (attr.AttributeType == attrType || attrType < 0)
                && (attr.AttributeTypeIndex == index || index < 0)
                && (attr.DataArity == arity || arity < 0)
                && (attr.DataType == dataType || dataType < 0))
            {
                r.push(attr)
            }
        }
        return r.length > 0 ? r[0] : null;
    },    

    attributeToTypedArray : function( attr ) {
        if (!attr) 
            return null;
        
        // This is a UInt8 array
        var data = attr.Data;

        switch (attr.DataType)
        {
            case this.dt_float32: return new Float32Array(data.buffer, data.byteOffset, data.byteLength / 4);
            case this.dt_float64: throw new Float64Array(data.buffer, data.byteOffset, data.byteLength / 8);
            case this.dt_int8: return data;
            case this.dt_int16: return new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
            case this.dt_int32: return new Int32Array(data.buffer, data.byteOffset, data.byteLength / 4);
            case this.dt_int64: return new Int64Array(data.buffer, data.byteOffset, data.byteLength / 8);
            default: throw new Error("Unrecognized attribute data type " + attr.DataType);
        }
    },

    attributeToThreeJS : function ( attr ) {
        if (!attr) return null;
        var typedArray = this.attributeToTypedArray( attr );
        var arity = attr.DataArity;
        return new THREE.BufferAttribute( typedArray, arity );        
    },

    addAttributeToGeometry : function ( geometry, name, attr ) {
        if (attr)
            geometry.addAttribute( name, this.attributeToThreeJS( attr ) );
    },

    // Constructs the geometry from an ArrayBuffer 
    parse: function ( data ) 
    {	      
        var bfast = this.parseBFast( data );
        var g3d = this.constructG3d( bfast );
        
        // TODO: we can pre-process all of 
        var faceSizes = this.findAttribute( g3d, this.assoc_face, this.attr_facesize, 0, 1, this.dt_int32 );
        var position = this.findAttribute( g3d, this.assoc_vertex, this.attr_vertex, 0, 3, this.dt_float32 );
        var indices = this.findAttribute( g3d, this.assoc_corner, this.attr_index, 0, 1, this.dt_int32 );
        var normal = this.findAttribute( g3d, this.assoc_vertex, this.attr_normal, 0, 3, this.dt_float32 );
        var uv = this.findAttribute( g3d, this.assoc_vertex, this.attr_uv, 0, 2, this.dt_float32 );
        var uv2 = this.findAttribute( g3d, this.assoc_vertex, this.attr_uv, 1, 2, this.dt_float32 );
        var color = this.findAttribute( g3d, this.assoc_vertex, this.attr_color, 0, 3, this.dt_float32 );

        if (!position) throw new Error("Cannot create geometry without a vertex attribute");

        var geometry = new THREE.BufferGeometry();

        if ( indices )
            geometry.indices = this.attributeToThreeJS( indices );
        
        this.addAttributeToGeometry( geometry, 'position', position );
        /*        
        this.addAttributeToGeometry( geometry, 'normal', normal );
        this.addAttributeToGeometry( geometry, 'uv', uv );
        this.addAttributeToGeometry( geometry, 'uv2', uv2 );

        if ( color ) {
            this.addAttributeToGeometry( geometry, 'color', color );
            geometry.addAttribute( 'color', new THREE.BufferAttribute( new Float32Array( colors ), 3 ) );
            geometry.hasColors = true;
            geometry.alpha = alpha;
        }
        */

        return geometry;
	}
};
