/**
 @author VIM / https://vimaec.com
*/

import * as THREE from 'three'
import * as BufferGeometryUtils from '../node_modules/three/examples/jsm/utils/BufferGeometryUtils.js'
import { G3d, VimG3d, Attribute } from './g3d'
import { BFast, BFastHeader } from './bfast'
import { Vim, VimScene, VimSceneGeometry } from './vim'

type Mesh = THREE.InstancedMesh<THREE.BufferGeometry, THREE.Material>

export class VIMLoader {
  material: THREE.Material

  constructor (material: THREE.Material) {
    this.material = material
  }

  // Loads the VIM from a URL
  load (
    url: string,
    onLoad?: (response: VimScene) => void,
    onProgress?: (request: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void
  ) {
    const loader = new THREE.FileLoader()
    loader.setResponseType('arraybuffer')
    loader.setRequestHeader({
      'Content-Encoding': 'gzip'
      // 'Accept-Encoding': 'gzip, deflate'
    })

    loader.load(
      url,
      (data: string | ArrayBuffer) => {
        if (typeof data === 'string') {
          onError?.(new ErrorEvent('Unsupported string loader response'))
          return
        }
        let vim: any
        try {
          vim = this.parse(data)
        } catch (exception) {
          const error = exception as Error
          console.log(
            `Error occured when loading VIM from ${url}, message = ${error} at = ${error.stack}`
          )
          onError?.(new ErrorEvent('Loading Error', { error: exception }))
          return
        }
        // Don't catch exceptions in code provided by caller.
        onLoad?.(vim)
      },
      onProgress,
      onError
    )
  }

  parseBFastFromArray (bytes: Uint8Array) {
    return this.parseBFast(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }

  // BFAST is the container format for an array of binary arrays
  parseBFast (
    arrayBuffer: ArrayBuffer,
    byteOffset: number = 0,
    byteLength: number = arrayBuffer.byteLength - byteOffset
  ): BFast {
    // Cast the input data to 32-bit integers
    // Note that according to the spec they are 64 bit numbers. In JavaScript you can't have 64 bit integers,
    // and it would bust the amount of memory we can work with in most browsers and low-power devices
    const data = new Int32Array(arrayBuffer, byteOffset, byteLength / 4)

    // Parse the header
    const header = BFastHeader.fromArray(data, byteLength)
    console.log('BFAST header')
    console.log(JSON.stringify(header))

    // Compute each buffer
    const buffers: Uint8Array[] = []
    let pos = 8
    for (let i = 0; i < header.numArrays; ++i) {
      const begin = data[pos + 0]
      const end = data[pos + 2]

      // Check validity of data
      if (data[pos + 1] !== 0) {
        throw new Error('Expected 0 in position ' + (pos + 1) * 4)
      }
      if (data[pos + 3] !== 0) {
        throw new Error('Expected 0 in position ' + (pos + 3) * 4)
      }
      if (begin < header.dataStart || begin > header.dataEnd) {
        throw new Error('Buffer start is out of range')
      }
      if (end < begin || end > header.dataEnd) {
        throw new Error('Buffer end is out of range')
      }

      pos += 4
      const buffer = new Uint8Array(
        arrayBuffer,
        begin + byteOffset,
        end - begin
      )
      buffers.push(buffer)
    }

    if (buffers.length < 0) {
      throw new Error('Expected at least one buffer containing the names')
    }

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

    return new BFast(header, names, buffers.slice(1))
  }

  constructEntityTable (bfast: BFast) {
    const result = new Map<string, any>()
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
        result.set(columnName, columnData)
      } else if (columnType === 'string' || columnType === 'index') {
        columnData = new Int32Array(
          buffer.buffer,
          buffer.byteOffset,
          buffer.byteLength / 4
        )
        result.set(columnName, columnData)
      } else if (columnType === 'properties') {
        columnData = new Int32Array(
          buffer.buffer,
          buffer.byteOffset,
          buffer.byteLength / 4
        )
        // TODO Fix this JS
        result.set('properties', buffer)
      } else {
        throw new Error('Unrecognized column type ' + columnType)
      }
    }
    return result
  }

  constructEntityTables (bfast: BFast): any {
    const result = new Map<string, any>()
    for (let i = 0; i < bfast.buffers.length; ++i) {
      const current = bfast.names[i]
      const tableName = current.substring(current.indexOf(':') + 1)
      const next = this.constructEntityTable(
        this.parseBFastFromArray(bfast.buffers[i])
      )
      result.set(tableName, next)
    }
    return result
  }

  // Given a BFAST container (header/names/buffers) constructs a VIM data structure
  constructVIM (bfast: any): Vim {
    if (bfast.buffers.length < 5) {
      throw new Error('VIM requires at least five BFast buffers')
    }

    const lookup = new Map<string, any>()
    for (let i = 0; i < bfast.buffers.length; ++i) {
      lookup.set(bfast.names[i], bfast.buffers[i])
    }

    const g3d = new VimG3d(
      this.constructG3D(this.parseBFastFromArray(lookup.get('geometry')))
    )
    g3d.validate()

    // Parse BFAST
    return new Vim(
      new TextDecoder('utf-8').decode(lookup.get('header')),
      this.parseBFastFromArray(lookup.get('assets')),
      g3d,
      this.constructEntityTables(
        this.parseBFastFromArray(lookup.get('entities'))
      ),
      new TextDecoder('utf-8').decode(lookup.get('strings')).split('\0')
    )
  }

  // Given a BFAST container (header/names/buffers) constructs a G3D data structure
  constructG3D (bfast: BFast): G3d {
    console.log('Constructing G3D')

    if (bfast.buffers.length < 2) {
      throw new Error('G3D requires at least two BFast buffers')
    }

    // Parse first buffer as Meta
    const metaBuffer = bfast.buffers[0]
    if (bfast.names[0] !== 'meta') {
      throw new Error(
        "First G3D buffer must be named 'meta', but was named: " +
          bfast.names[0]
      )
    }
    const meta = new TextDecoder('utf-8').decode(metaBuffer)

    // Parse remaining buffers as Attributes
    const attributes: Attribute[] = []
    const nDescriptors = bfast.buffers.length - 1
    for (let i = 0; i < nDescriptors; ++i) {
      const attribute = Attribute.fromString(
        bfast.names[i + 1],
        bfast.buffers[i + 1]
      )
      attributes.push(attribute)
      console.log(`Attribute ${i} = ${attribute.descriptor.description}`)
    }

    return new G3d(meta, attributes)
  }

  createBufferGeometry (
    vertices: Float32Array,
    indices: Int32Array,
    vertexColors: Float32Array | undefined = undefined
  ): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry()

    // Vertices
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))

    // Indices
    geometry.setIndex(new THREE.Uint32BufferAttribute(indices, 1))

    // Colors
    if (vertexColors) {
      geometry.setAttribute('color', new THREE.BufferAttribute(vertexColors, 3))
    }

    return geometry
  }

  allocateGeometry (g3d: VimG3d): THREE.BufferGeometry[] {
    const meshCount = g3d.meshSubmeshes.length
    const submeshCount = g3d.submeshIndexOffset.length
    const indexCount = g3d.indices.length

    const colorBuffer = new Float32Array(g3d.positions.length)
    const resultMeshes: THREE.BufferGeometry[] = []
    for (let mesh = 0; mesh < meshCount; mesh++) {
      const indexSlice: number[] = []

      const meshStart = g3d.meshSubmeshes[mesh]
      const meshEnd =
        mesh < meshCount - 1 ? g3d.meshSubmeshes[mesh + 1] : submeshCount

      let min: number = Number.MAX_SAFE_INTEGER
      let max: number = 0
      for (let submesh = meshStart; submesh < meshEnd; submesh++) {
        let r: number
        let g: number
        let b: number
        const material = g3d.submeshMaterial[submesh]
        if (material < 0) {
          r = 0.5
          g = 0.5
          b = 0.5
        } else {
          const alpha = g3d.materialColors[material * g3d.colorArity + 3]
          if (alpha < 0.9) {
            continue
          }

          r = g3d.materialColors[material * g3d.colorArity]
          g = g3d.materialColors[material * g3d.colorArity + 1]
          b = g3d.materialColors[material * g3d.colorArity + 2]
        }

        const submeshStart = g3d.submeshIndexOffset[submesh]
        const submeshEnd =
          submesh < submeshCount - 1
            ? g3d.submeshIndexOffset[submesh + 1]
            : indexCount

        // TODO try not unpacking all vertices
        for (let index = submeshStart; index < submeshEnd; index++) {
          const vertex = g3d.indices[index]
          indexSlice.push(vertex)
          min = Math.min(min, vertex)
          max = Math.max(max, vertex)
          colorBuffer[vertex * 3] = r
          colorBuffer[vertex * 3 + 1] = g
          colorBuffer[vertex * 3 + 2] = b
        }
      }

      // If mesh is empty we push null to keep results aligned
      if (indexSlice.length === 0) {
        resultMeshes.push(null)
        continue
      }

      const sliceStart = min * 3
      const sliceEnd = (max + 1) * 3
      const vertexSlice = g3d.positions.subarray(sliceStart, sliceEnd)
      const colorSlice = colorBuffer.subarray(sliceStart, sliceEnd)

      for (let i = 0; i < indexSlice.length; i++) {
        indexSlice[i] -= min
      }

      const resultMesh = this.createBufferGeometry(
        vertexSlice,
        new Int32Array(indexSlice),
        colorSlice
      )

      resultMesh.computeBoundingSphere()
      resultMeshes.push(resultMesh)
    }

    return resultMeshes
  }

  // Main
  parse (data: ArrayBuffer): VimScene {
    console.time('parsingVim')
    console.log(`Parsing Vim. Byte count: ${data.byteLength}`)

    console.log('Parsing BFAST')
    const bfast = this.parseBFast(data)

    console.log(`found: ${bfast.buffers.length} buffers`)
    for (let i = 0; i < bfast.names.length; ++i) console.log(bfast.names[i])

    console.log('Creating VIM')
    const vim = this.constructVIM(bfast)

    console.log('Building meshes')
    const geometry = this.allocateGeometry(vim.g3d)
    console.log('Found # meshes ' + geometry.length)

    console.log('Counting references')
    const meshRefCounts = this.countMeshReferences(
      vim.g3d.instanceMeshes,
      geometry.length
    )

    console.log('Merging geometry')

    console.log('Allocating Instanced Meshes')
    const rawMeshes = this.allocateMeshes(geometry, meshRefCounts)

    console.log('Applying Matrices')
    const sceneGeometry = this.applyMatrices(
      rawMeshes,
      vim.g3d.instanceMeshes,
      vim.g3d.instanceTransforms
    )

    const singles: THREE.BufferGeometry[] = []
    for (let i = 0; i < vim.g3d.instanceMeshes.length; i++) {
      const meshIndex = vim.g3d.instanceMeshes[i]
      if (meshIndex < 0) continue

      const mesh = geometry[meshIndex]
      if (!mesh) continue

      if (meshRefCounts[meshIndex] === 1) {
        const matrixAsArray = vim.g3d.instanceTransforms.subarray(
          i * vim.g3d.matrixArity,
          (i + 1) * vim.g3d.matrixArity
        )
        const matrix = new THREE.Matrix4()
        matrix.elements = Array.from(matrixAsArray)
        mesh.applyMatrix4(matrix)
        singles.push(mesh)
      }
    }

    const big: THREE.BufferGeometry =
      BufferGeometryUtils.mergeBufferGeometries(singles)
    const bigMesh = new THREE.InstancedMesh(big, this.material, 1)
    bigMesh.setMatrixAt(0, new THREE.Matrix4())
    big.computeBoundingSphere()
    sceneGeometry.meshes.push(bigMesh)
    sceneGeometry.boundingSphere = big.boundingSphere

    console.log('Loading Completed')
    return new VimScene(vim, sceneGeometry)
  }

  countMeshReferences (
    instanceMeshes: Int32Array,
    meshCount: number
  ): Int32Array {
    const meshRefCounts = new Int32Array(meshCount)
    for (let i = 0; i < instanceMeshes.length; ++i) {
      const mesh = instanceMeshes[i]
      if (mesh < 0) continue
      meshRefCounts[mesh]++
    }
    return meshRefCounts
  }

  allocateMeshes (
    geometries: THREE.BufferGeometry[],
    meshRefCounts: Int32Array
  ): (Mesh | null)[] {
    const meshCount = geometries.length
    const meshes: (Mesh | null)[] = []

    for (let i = 0; i < meshCount; ++i) {
      const count = meshRefCounts[i]
      if (count <= 1) {
        meshes.push(null)
        continue
      }

      const geometry = geometries[i]
      if (geometry === null) {
        meshes.push(null)
        continue
      }

      const mesh = new THREE.InstancedMesh(geometry, this.material, count)
      meshes.push(mesh)
    }

    return meshes
  }

  // meshes: array of THREE.InstancedMesh
  // instanceMeshes: array of mesh indices
  // instanceTransform: flat array of matrix4x4
  // Returns array of InstancedMesh and array of instance centers with matrices applied to both.
  applyMatrices (
    meshes: (Mesh | null)[],
    instanceMeshes: Int32Array,
    instanceTransforms: Float32Array
  ): VimSceneGeometry {
    const matrixArity = 16
    const instanceCounters = new Int32Array(meshes.length)
    let boundingSphere: THREE.Sphere | null = null
    const nodeIndexToMeshInstance = new Map<number, [Mesh, number]>()
    const meshIdToNodeIndex = new Map<number, [number]>()
    const resultMeshes: Mesh[] = []

    for (let i = 0; i < instanceMeshes.length; ++i) {
      const meshIndex = instanceMeshes[i]
      if (meshIndex < 0) continue

      const mesh = meshes[meshIndex]
      if (!mesh) continue

      const count = instanceCounters[meshIndex]++

      // Compute Matrix
      const matrixAsArray = instanceTransforms.subarray(
        i * matrixArity,
        (i + 1) * matrixArity
      )
      const matrix = new THREE.Matrix4()
      matrix.elements = Array.from(matrixAsArray)
      mesh.setMatrixAt(count, matrix)

      // Set Node ID for picking
      nodeIndexToMeshInstance.set(i, [mesh, count])

      const nodes = meshIdToNodeIndex.get(mesh.id)
      if (nodes) {
        nodes.push(i)
      } else {
        meshIdToNodeIndex.set(mesh.id, [i])
      }

      // Sphere was computed when geometry was created
      const sphere = mesh.geometry.boundingSphere!.clone()
      sphere.applyMatrix4(matrix)
      boundingSphere = boundingSphere ? boundingSphere.union(sphere) : sphere

      resultMeshes.push(mesh)
    }
    return new VimSceneGeometry(
      resultMeshes,
      boundingSphere ?? new THREE.Sphere(),
      nodeIndexToMeshInstance,
      meshIdToNodeIndex
    )
  }
}
