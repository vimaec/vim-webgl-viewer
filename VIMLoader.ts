/**
 @author VIM / https://vimaec.com
*/

import * as THREE from 'three'

export class VIMLoader {
  material: THREE.Material

  constructor (material: THREE.Material) {
    this.material = material
  }

  // Loads the VIM from a URL
  load (
    url: string,
    onLoad?: (response: any) => void,
    onProgress?: (request: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void
  ) {
    const scope = this
    const loader = new THREE.FileLoader()
    loader.setResponseType('arraybuffer')
    loader.setRequestHeader({
      'Content-Encoding': 'gzip'
      // 'Accept-Encoding': 'gzip, deflate'
    })

    loader.load(
      url,
      (data: string | ArrayBuffer) => {
        try {
          onLoad(scope.parse(data))
        } catch (exception) {
          console.log(
            'Error occured when loading VIM from ' +
              url +
              ', message = ' +
              exception
          )
          if (onError) onError(exception)
        }
      },
      onProgress,
      onError
    )
  }

  parseBFastFromArray (bytes) {
    return this.parseBFast(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }

  getMaterialColorLookup (vim) {
    const materialData = vim.entities['Rvt.Material']
    if (materialData == null) throw new Error('Material data undefined')
    const xs = new Float64Array(materialData['Color.X'])
    const ys = new Float64Array(materialData['Color.Y'])
    const zs = new Float64Array(materialData['Color.Z'])
    const ws = new Float64Array(materialData.Transparency)
    const ids = new Float64Array(materialData.Id)
    const r = {}
    for (let i = 0; i < ids.length; ++i) {
      r[ids[i]] = {
        color: new THREE.Color(xs[i], ys[i], zs[i]),
        opacity: 1.0 - ws[i]
      }
    }
    return r
  }

  getElements (vim) {
    const elementData = vim.entities['Rvt.Element']
    const names = new Int32Array(elementData.Name)
    const xs = new Float64Array(elementData['Location.X'])
    const ys = new Float64Array(elementData['Location.Y'])
    const zs = new Float64Array(elementData['Location.Z'])
    const r = new Array(names.length)
    for (let i = 0; i < names.length; ++i) {
      const name = names[i] >= 0 ? vim.strings[names[i]] : ''
      r[i] = { name: name, x: xs[i], y: ys[i], z: zs[i] }
    }
    return r
  }

  getRooms (vim) {
    if (!vim.elements) return []
    const roomData = vim.entities['Rvt.Room']
    if (!roomData) return []
    const ids = new Int32Array(roomData.Element)
    if (!ids) return []
    const r = new Array(ids.length)
    for (let i = 0; i < ids.length; ++i) {
      const id = ids[i]
      if (id > 0) r[i] = vim.elements[id]
    }
    return r
  }

  // BFAST is the container format for an array of binary arrays
  parseBFast (arrayBuffer, byteOffset, byteLength) {
    console.log('Parsing BFAST')

    // Cast the input data to 32-bit integers
    // Note that according to the spec they are 64 bit numbers. In JavaScript you can't have 64 bit integers,
    // and it would bust the amount of memory we can work with in most browsers and low-power devices
    const data = new Int32Array(arrayBuffer, byteOffset, byteLength / 4)

    // Parse the header
    const header = {
      Magic: data[0], // Either Constants.SameEndian or Constants.SwappedEndian depending on endianess of writer compared to reader.
      DataStart: data[2], // <= file size and >= ArrparayRangesEnd and >= FileHeader.ByteCount
      DataEnd: data[4], // >= DataStart and <= file size
      NumArrays: data[6] // number of arrays
    }

    console.log('BFAST header')
    console.log(JSON.stringify(header))

    // Check validity of data
    // TODO: check endianness
    if (header.Magic !== 0xbfa5) { throw new Error('Not a BFAST file, or endianness is swapped') }
    if (data[1] !== 0) throw new Error('Expected 0 in byte position 0')
    if (data[3] !== 0) throw new Error('Expected 0 in byte position 8')
    if (data[5] !== 0) throw new Error('Expected 0 in position 16')
    if (data[7] !== 0) throw new Error('Expected 0 in position 24')
    if (header.DataStart <= 32 || header.DataStart > byteLength) { throw new Error('Data start is out of valid range') }
    if (header.DataEnd < header.DataStart || header.DataEnd > byteLength) { throw new Error('Data end is out of vaid range') }
    if (header.NumArrays < 0 || header.NumArrays > header.DataEnd) { throw new Error('Number of arrays is invalid') }

    // Compute each buffer
    const buffers = []
    let pos = 8
    for (let i = 0; i < header.NumArrays; ++i) {
      const begin = data[pos + 0]
      const end = data[pos + 2]

      // Check validity of data
      if (data[pos + 1] !== 0) { throw new Error('Expected 0 in position ' + (pos + 1) * 4) }
      if (data[pos + 3] !== 0) { throw new Error('Expected 0 in position ' + (pos + 3) * 4) }
      if (begin < header.DataStart || begin > header.DataEnd) { throw new Error('Buffer start is out of range') }
      if (end < begin || end > header.DataEnd) { throw new Error('Buffer end is out of range') }

      pos += 4
      const buffer = new Uint8Array(arrayBuffer, begin + byteOffset, end - begin)
      buffers.push(buffer)
    }

    if (buffers.length < 0) { throw new Error('Expected at least one buffer containing the names') }

    // break the first one up into names
    const joinedNames = new TextDecoder('utf-8').decode(buffers[0])

    // Removing the trailing '\0' before spliting the names
    let names = joinedNames.slice(0, -1).split('\0')
    if (joinedNames.length === 0) names = []

    // Validate the number of names
    if (names.length !== buffers.length - 1) {
      throw new Error(
        'Expected number of names to be equal to the number of buffers - 1'
      )
    }

    // For debug purposes output the name of each buffer
    // for (let i=0; i < names.length; ++i)
    //    console.log("Buffer " + i + " (" + names[i] + ") has size " + buffers[i+1].byteLength);

    // Return the bfast structure
    return {
      header: header,
      names: names,
      buffers: buffers.slice(1)
    }
  }

  constructEntityTable (bfast) {
    const r = { properties: undefined }
    for (let i = 0; i < bfast.buffers.length; ++i) {
      const tmp = bfast.names[i].split(':')
      const columnType = tmp[0]
      const columnName = tmp[1]
      const buffer = bfast.buffers[i]
      let columnData
      if (columnType === 'numeric') {
        columnData = new Float64Array(
          buffer.buffer,
          buffer.byteOffset,
          buffer.byteLength / 8
        )
        r[columnName] = columnData
      } else if (columnType === 'string' || columnType === 'index') {
        columnData = new Int32Array(
          buffer.buffer,
          buffer.byteOffset,
          buffer.byteLength / 4
        )
        r[columnName] = columnData
      } else if (columnType === 'properties') {
        columnData = new Int32Array(
          buffer.buffer,
          buffer.byteOffset,
          buffer.byteLength / 4
        )
        // TODO Fix this JS
        r.properties = buffer
      } else {
        throw new Error('Unrecognized column type ' + columnType)
      }
    }
    return r
  }

  constructEntityTables (bfast) {
    const r = {}
    for (let i = 0; i < bfast.buffers.length; ++i) {
      let tableName = bfast.names[i]
      tableName = tableName.substring(tableName.indexOf(':') + 1)
      r[tableName] = this.constructEntityTable(
        this.parseBFastFromArray(bfast.buffers[i])
      )
    }
    return r
  }

  // Given a BFAST container (header/names/buffers) constructs a VIM data structure
  constructVIM (bfast) {
    console.log('Creating VIM')

    if (bfast.buffers.length < 5) { throw new Error('VIM requires at least five BFast buffers') }

    const lookup = new Map<string, any>()
    for (let i = 0; i < bfast.buffers.length; ++i) { lookup.set(bfast.names[i], bfast.buffers[i]) }

    // Parse BFAST
    return {
      header: new TextDecoder('utf-8').decode(lookup.get('header')),
      assets: this.parseBFastFromArray(lookup.get('assets')),
      g3d: this.constructG3D(this.parseBFastFromArray(lookup.get('geometry'))),
      entities: this.constructEntityTables(
        this.parseBFastFromArray(lookup.get('entities'))
      ),
      strings: new TextDecoder('utf-8').decode(lookup.get('strings')).split('\0')
    }
  }

  // Given a BFAST container (header/names/buffers) constructs a G3D data structure
  constructG3D (bfast) {
    console.log('Constructing G3D')

    if (bfast.buffers.length < 2) { throw new Error('G3D requires at least two BFast buffers') }

    // This will just contain some JSON
    const metaBuffer = bfast.buffers[0]
    if (bfast.names[0] !== 'meta') {
      throw new Error(
        "First G3D buffer must be named 'meta', but was named: " +
          bfast.names[0]
      )
    }

    // Extract each descriptor
    const attributes = []
    const nDescriptors = bfast.buffers.length - 1
    for (let i = 0; i < nDescriptors; ++i) {
      const desc = bfast.names[i + 1].split(':')
      if (desc[0].toLowerCase() !== 'g3d' || desc.length !== 6) {
        throw new Error(
          "Not a valid attribute descriptor, must have 6 components delimited by ':' and starting with 'g3d' " +
            desc
        )
      }
      const attribute = {
        name: desc,
        association: desc[1], // Indicates the part of the geometry that this attribute is associated with
        semantic: desc[2], // the role of the attribute
        attributeTypeIndex: desc[3], // each attribute type should have it's own index ( you can have uv0, uv1, etc. )
        dataType: desc[4], // the type of individual values (e.g. int32, float64)
        dataArity: desc[5], // how many values associated with each element (e.g. UVs might be 2, geometry might be 3, quaternions 4, matrices 9 or 16)
        rawData: bfast.buffers[i + 1], // the raw data (a UInt8Array)
        data: undefined
      }
      attribute.data = this.attributeToTypedArray(attribute)
      console.log('Attribute ' + i + ' = ' + desc)
      attributes.push(attribute)
    }

    return {
      attributes: attributes,
      meta: new TextDecoder('utf-8').decode(metaBuffer)
    }
  }

  // Finds the first attribute that has the matching fields passing null matches a field to all
  findAttribute (VIM, assoc, semantic, index, dataType, arity) {
    const r = []
    for (let i = 0; i < VIM.attributes.length; ++i) {
      const attr = VIM.attributes[i]
      if (
        (attr.association === assoc || assoc == null) &&
        (attr.semantic === semantic || semantic == null) &&
        (attr.attributeTypeIndex === index || index == null) &&
        (attr.dataArity === arity || arity == null) &&
        (attr.dataType === dataType || dataType == null)
      ) {
        r.push(attr)
      }
    }
    return r.length > 0 ? r[0] : null
  }

  // Converts a VIM attribute into a typed array from its raw data
  attributeToTypedArray (attr) {
    if (!attr) return null

    // This is a UInt8 array
    const data = attr.rawData

    switch (attr.dataType) {
      case 'float32':
        return new Float32Array(
          data.buffer,
          data.byteOffset,
          data.byteLength / 4
        )
      case 'float64':
        throw new Float64Array(
          data.buffer,
          data.byteOffset,
          data.byteLength / 8
        )
      case 'int8':
        return data
      case 'int16':
        return new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2)
      case 'int32':
        return new Int32Array(data.buffer, data.byteOffset, data.byteLength / 4)
      // case "int64": return new Int64Array(data.buffer, data.byteOffset, data.byteLength / 8);
      default:
        throw new Error('Unrecognized attribute data type ' + attr.dataType)
    }
  }

  // Adds an attribute to a BufferGeometry, if not null
  addAttributeToGeometry (geometry, name, attr) {
    if (attr) {
      geometry.setAttribute(
        name,
        new THREE.BufferAttribute(attr.data, attr.dataArity)
      )
    }
  }

  createBufferGeometry (positionTypedArray, indicesTypedArray, vertexColors) {
    if (!positionTypedArray) { throw new Error('Cannot create geometry without a valid vertex attribute') }
    if (!indicesTypedArray) { throw new Error('Cannot create geometry without a valid index attribute') }

    // Construtor the buffer geometry that is returned from the function
    const geometry = new THREE.BufferGeometry()

    // A vertex position data buffer
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positionTypedArray, 3)
    )

    // The Three JS shader model only supports 3 RGB colors
    geometry.setAttribute('color', new THREE.BufferAttribute(vertexColors, 3))

    // Add the index buffer (which has to be cast to a Uint32BufferAttribute)
    const indexBuffer = new THREE.Uint32BufferAttribute(indicesTypedArray, 1)
    geometry.setIndex(indexBuffer)
    return geometry
  }

  buildMeshes (g3d) {
    if (!g3d) throw new Error('Missing g3d argument')

    // Unpack
    const positions = this.findAttribute(
      g3d,
      null,
      'position',
      '0',
      'float32',
      '3'
    )?.data
    const indices = this.findAttribute(
      g3d,
      null,
      'index',
      '0',
      'int32',
      '1'
    )?.data
    const meshSubmeshes = this.findAttribute(
      g3d,
      'mesh',
      'submeshoffset',
      '0',
      'int32',
      '1'
    )?.data
    const submeshIndexOffset = this.findAttribute(
      g3d,
      'submesh',
      'indexoffset',
      '0',
      'int32',
      '1'
    )?.data
    const submeshMaterial = this.findAttribute(
      g3d,
      'submesh',
      'material',
      '0',
      'int32',
      '1'
    )?.data
    const materialColors = this.findAttribute(
      g3d,
      'material',
      'color',
      '0',
      'float32',
      '4'
    )?.data

    if (!positions) throw new Error('Missing position attribute')
    if (!indices) throw new Error('Missing index attribute')
    if (!meshSubmeshes) throw new Error('Missing mesh submesh attribute')
    if (!submeshIndexOffset) { throw new Error('Missing submesh index offset  attribute') }
    if (!submeshMaterial) throw new Error('Missing submesh material attribute')
    if (!materialColors) throw new Error('Missing material color attribute')

    const colorArity = 4
    const positionArity = 3

    // Validate
    if (indices.length % 3 !== 0) { throw new Error('Invalid Index Count, must be divisible by 3') }

    for (let i = 0; i < indices.length; i++) {
      if (indices[i] < 0 || indices[i] >= positions.length) { throw new Error('Vertex index out of bound') }
    }

    if (positions.length % positionArity !== 0) {
      throw new Error(
        'Invalid position buffer, must be divisible by ' + positionArity
      )
    }

    for (let i = 0; i < meshSubmeshes.length; i++) {
      if (meshSubmeshes[i] < 0 || meshSubmeshes[i] >= submeshIndexOffset.length) { throw new Error('MeshSubmeshOffset out of bound at') }
    }

    for (let i = 0; i < meshSubmeshes.length - 1; i++) {
      if (meshSubmeshes[i] >= meshSubmeshes[i + 1]) { throw new Error('MeshSubmesh out of sequence.') }
    }

    if (submeshIndexOffset.length !== submeshMaterial.length) { throw new Error('Mismatched submesh buffers') }

    for (let i = 0; i < submeshIndexOffset.length; i++) {
      if (submeshIndexOffset[i] < 0 || submeshIndexOffset[i] >= indices.length) { throw new Error('SubmeshIndexOffset out of bound') }
    }

    for (let i = 0; i < submeshIndexOffset.length; i++) {
      if (submeshIndexOffset[i] % 3 !== 0) { throw new Error('Invalid SubmeshIndexOffset, must be divisible by 3') }
    }

    for (let i = 0; i < submeshIndexOffset.length - 1; i++) {
      if (submeshIndexOffset[i] >= submeshIndexOffset[i + 1]) { throw new Error('SubmeshIndexOffset out of sequence.') }
    }

    for (let i = 0; i < submeshMaterial.length; i++) {
      if (submeshMaterial[i] >= materialColors.length) { throw new Error('submeshMaterial out of bound') }
    }

    if (materialColors.length % colorArity !== 0) {
      throw new Error(
        'Invalid material color buffer, must be divisible by ' + colorArity
      )
    }

    // Do the work
    const meshCount = meshSubmeshes.length
    const submeshCount = submeshIndexOffset.length
    const indexCount = indices.length

    const resultMeshes = []
    for (let mesh = 0; mesh < meshCount; mesh++) {
      const meshIndices = []
      const meshVertexPositions = []
      const meshVertexColors = []

      const meshStart = meshSubmeshes[mesh]
      const meshEnd =
        mesh < meshCount - 1 ? meshSubmeshes[mesh + 1] : submeshCount

      for (let submesh = meshStart; submesh < meshEnd; submesh++) {
        let r, g, b, a
        const material = submeshMaterial[submesh]
        if (material < 0) {
          r = 0.5
          g = 0.5
          b = 0.5
          a = 1
        } else {
          r = materialColors[material * colorArity]
          g = materialColors[material * colorArity + 1]
          b = materialColors[material * colorArity + 2]
          a = materialColors[material * colorArity + 3]
        }

        if (a < 0.9) continue

        const submeshStart = submeshIndexOffset[submesh]
        const submeshEnd =
          submesh < submeshCount - 1
            ? submeshIndexOffset[submesh + 1]
            : indexCount

        // TODO try not unpacking all vertices
        for (let index = submeshStart; index < submeshEnd; index++) {
          meshIndices.push(meshIndices.length)

          const vertex = indices[index]
          const x = positions[vertex * positionArity]
          const y = positions[vertex * positionArity + 1]
          const z = positions[vertex * positionArity + 2]

          meshVertexPositions.push(x)
          meshVertexPositions.push(y)
          meshVertexPositions.push(z)

          meshVertexColors.push(r)
          meshVertexColors.push(g)
          meshVertexColors.push(b)
        }
      }

      const resultMesh = this.createBufferGeometry(
        new Float32Array(meshVertexPositions),
        new Int32Array(meshIndices),
        new Float32Array(meshVertexColors)
      )
      resultMesh.computeBoundingBox()
      resultMeshes.push(resultMesh)
    }

    return resultMeshes
  }

  floatsToMatrix (m) {
    const r = new THREE.Matrix4()
    r.elements = m
    return r
  }

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
  parse (data: any) {
    console.time('parsingVim')

    console.log('Parsing data buffer into VIM')
    console.log('data size ' + data.byteLength)

    // A VIM follows the BFAST data arrangement, which is a collection of named byte arrays
    console.log('Parsing BFAST structure')
    const bfast = this.parseBFast(data, 0, data.byteLength)

    console.log('found: ' + bfast.buffers.length + ' buffers')
    for (let i = 0; i < bfast.names.length; ++i) console.log(bfast.names[i])

    console.log('Constructing VIM')
    const buffers = this.constructVIM(bfast)

    console.log('Building meshes')
    const geometry = this.buildMeshes(buffers.g3d)
    console.log('Found # meshes ' + geometry.length)

    const matrixArity = 16
    const instanceMeshes = this.findAttribute(
      buffers.g3d,
      'instance',
      'mesh',
      '0',
      'int32',
      '1'
    )?.data
    const instanceTransforms = this.findAttribute(
      buffers.g3d,
      'instance',
      'transform',
      '0',
      'float32',
      '16'
    )?.data

    // Validate
    if (!instanceMeshes) throw new Error('Missing Instance Mesh Attribute.')
    if (!instanceTransforms) { throw new Error('Missing Instance Tranform Attribute.') }
    if (instanceMeshes.length !== instanceTransforms.length / matrixArity) { throw new Error('Instance buffers mismatched') }
    if (instanceTransforms.length % matrixArity !== 0) {
      throw new Error(
        'Invalid InstanceTransform buffer, must respect arity ' + matrixArity
      )
    }

    for (let i = 0; i < instanceMeshes.length; i++) {
      if (instanceMeshes[i] >= geometry.length) { throw new Error('Instance Mesh Out of range.') }
    }

    console.log('Allocating Instanced Meshes')
    const rawMeshes = this.allocateMeshes(geometry, instanceMeshes)

    console.log('Applying Matrices')
    let { meshes, centers } = this.applyMatrices(
      rawMeshes,
      instanceMeshes,
      instanceTransforms
    )

    console.log('Computing center.')
    const sphere = new THREE.Sphere().setFromPoints(centers)

    // console.log("Merging lone meshes.");
    // vim.meshes = this.mergeSingleInstances(meshes, material);
    meshes = meshes.filter((m) => m !== undefined)

    console.log('Extracting BIM Elements.')
    const elements = this.getElements(buffers)

    console.log('Extracting BIM Rooms.')
    const rooms = this.getRooms(buffers)

    console.timeEnd('parsingVim')

    return {
      header: buffers.header,
      entities: buffers.entities,
      strings: buffers.strings,
      g3d: buffers.g3d,
      assets: buffers.assets,

      meshes,
      elements,
      rooms,
      sphere
    }
  }

  // geometries: array of THREE.GeometryBuffer
  // instanceMeshes: array of mesh indices
  // material: THREE.MeshPhongMaterial to use
  // returns array of THREE.InstancedMesh
  allocateMeshes (geometries, instanceMeshes) {
    const meshCount = geometries.length
    console.log('Counting references')
    const meshReferenceCounts = new Int32Array(meshCount)
    for (let i = 0; i < instanceMeshes.length; ++i) {
      const mesh = instanceMeshes[i]
      if (mesh < 0) continue
      meshReferenceCounts[mesh]++
    }

    console.log('Allocating instances.')
    const meshes = []
    for (let i = 0; i < meshCount; ++i) {
      const count = meshReferenceCounts[i]
      if (count === 0) {
        meshes.push(undefined)
      } else {
        const g = geometries[i]
        const mesh = new THREE.InstancedMesh(g, this.material, count)
        meshes.push(mesh)
      }
    }
    return meshes
  }

  // meshes: array of THREE.InstancedMesh
  // instanceMeshes: array of mesh indices
  // instanceTransform: flat array of matrix4x4
  // Returns array of InstancedMesh and array of instance centers with matrices applied to both.
  applyMatrices (meshes, instanceMeshes, instanceTransforms) {
    const matrixArity = 16
    const instanceCounters = new Int32Array(meshes.length)
    const centers = []
    for (let i = 0; i < instanceMeshes.length; ++i) {
      const meshIndex = instanceMeshes[i]
      if (meshIndex < 0) continue

      const mesh = meshes[meshIndex]
      if (!mesh) continue

      const matrixAsArray = instanceTransforms.subarray(
        i * matrixArity,
        (i + 1) * matrixArity
      )
      const matrix = this.floatsToMatrix(matrixAsArray)

      const count = instanceCounters[meshIndex]++
      mesh.setMatrixAt(count, matrix)

      if (!mesh.userData.instanceIndices) mesh.userData.instanceIndices = []
      mesh.userData.instanceIndices.push(i)

      const center = mesh.geometry.boundingBox.getCenter(new THREE.Vector3())
      center.applyMatrix4(matrix)
      centers.push(center)
    }
    return {
      meshes: meshes,
      centers: centers
    }
  }
}
