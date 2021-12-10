/**
 @author VIM / https://vimaec.com
*/

import * as THREE from 'three'
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils'
import { G3d, VimG3d, Attribute } from './g3d'
import { BFast, BFastHeader } from './bfast'
import { Vim } from './vim'
import { VimSceneGeometry } from './vimSceneGeometry'
import { VimScene } from './vimScene'
import { createBufferGeometryFromArrays } from './threeHelpers'

type Mesh = THREE.InstancedMesh<THREE.BufferGeometry, THREE.Material>

export class VIMLoader {
  material: THREE.Material
  timerName: string

  constructor (material?: THREE.Material) {
    this.material = material ?? this.createDefaultMaterial()
    this.timerName = 'VIM Loader'
  }

  createDefaultMaterial = () =>
    new THREE.MeshPhongMaterial({
      color: 0x999999,
      vertexColors: true,
      flatShading: true,
      // TODO: experiment without being double-sided
      side: THREE.DoubleSide,
      shininess: 70
    })

  logStart () {
    console.time(this.timerName)
  }

  log (msg: string) {
    console.timeLog(this.timerName, msg)
  }

  logEnd () {
    console.timeEnd(this.timerName)
  }

  timeAction<T> (task: string, call: () => T): T {
    console.log('Started ' + task)
    const time = 'Ended ' + task
    console.time(time)
    const result = call()
    console.timeEnd(time)
    return result
  }

  // Loads the VIM from a URL
  load (
    url: string,
    onLoad?: (response: VimScene) => void,
    onProgress?: (progress: ProgressEvent | 'processing') => void,
    onError?: (event: ErrorEvent) => void
  ) {
    const loader = new THREE.FileLoader()
    loader.setResponseType('arraybuffer')
    loader.setRequestHeader({
      'Content-Encoding': 'gzip'
    })

    this.logStart()
    loader.load(
      url,
      (data: string | ArrayBuffer) => {
        if (typeof data === 'string') {
          onError?.(new ErrorEvent('Unsupported string loader response'))
          return
        }
        onProgress?.('processing')

        // Try parse vim file
        let vim: any
        try {
          vim = this.parse(data)
        } catch (exception) {
          onError?.(new ErrorEvent('Loading Error', exception as Error))
          return
        }
        this.logEnd()
        // Don't catch exceptions in callback.
        onLoad?.(vim)
      },
      onProgress,
      (error) => {
        this.logEnd()
        onError?.(error)
      }
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
      const columnName = bfast.names[i]
      // eslint-disable-next-line no-unused-vars
      const [columnType, ..._] = columnName.split(':')
      const buffer = bfast.buffers[i]

      let length
      let ctor
      switch (columnType) {
        case 'byte':
          length = buffer.byteLength
          ctor = Int8Array
          break
        case 'float':
          length = buffer.byteLength / 4
          ctor = Float32Array
          break
        case 'double':
        case 'numeric': // legacy (vim0.9)
          length = buffer.byteLength / 8
          ctor = Float64Array
          break
        case 'string': // i.e. indices into the string table
        case 'index':
        case 'int':
        case 'properties': // legacy (vim0.9)
          length = buffer.byteLength / 4
          ctor = Int32Array
          break
        default:
          throw new Error('Unrecognized column type ' + columnType)
      }

      // eslint-disable-next-line new-cap
      const columnData = new ctor(buffer.buffer, buffer.byteOffset, length)
      result.set(columnName, columnData)
    }
    return result
  }

  constructEntityTables (bfast: BFast): any {
    const result = new Map<string, any>()
    for (let i = 0; i < bfast.buffers.length; ++i) {
      const current = bfast.names[i]
      const tableName = current.substring(current.indexOf(':') + 1)
      const buffer = bfast.buffers[i]
      this.log(
        `Constructing entity table ${current} which is ${buffer.length} size`
      )
      const next = this.constructEntityTable(this.parseBFastFromArray(buffer))
      result.set(tableName, next)
    }
    return result
  }

  // Given a BFAST container (header/names/buffers) constructs a VIM data structure
  constructVIM = (bfast: any): Vim => {
    if (bfast.buffers.length < 5) {
      throw new Error('VIM requires at least five BFast buffers')
    }

    const lookup = new Map<string, any>()
    for (let i = 0; i < bfast.buffers.length; ++i) {
      lookup.set(bfast.names[i], bfast.buffers[i])
    }

    const assetData = lookup.get('assets')
    const g3dData = lookup.get('geometry')
    const headerData = lookup.get('header')
    const entityData = lookup.get('entities')
    const stringData = lookup.get('strings')

    this.log(`Parsing header: ${headerData.length} bytes`)
    const header = new TextDecoder('utf-8').decode(headerData)

    this.log(`Constructing G3D: ${g3dData.length} bytes`)
    const g3d = new VimG3d(this.constructG3D(this.parseBFastFromArray(g3dData)))
    this.log('Validating G3D')
    g3d.validate()

    this.log(`Retrieving assets: ${assetData.length} bytes`)
    const assets = this.parseBFastFromArray(assetData)
    this.log(`Found ${assets.buffers.length} assets`)

    this.log(`Constructing entity tables: ${entityData.length} bytes`)
    const entities = this.constructEntityTables(
      this.parseBFastFromArray(entityData)
    )
    this.log(`Found ${entities.length} entity tables`)

    this.log(`Decoding strings: ${stringData.length} bytes`)
    const strings = new TextDecoder('utf-8').decode(stringData).split('\0')
    this.log(`Found ${strings.length} strings`)

    return new Vim(header, assets, g3d, entities, strings)
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

  // Main
  parse (data: ArrayBuffer): VimScene {
    const bfast = this.timeAction('Parsing Vim', () => this.parseBFast(data))

    console.log(`found: ${bfast.buffers.length} buffers`)
    console.log(bfast.names.join(', '))

    const vim = this.timeAction('Creating VIM', () => this.constructVIM(bfast))

    const geometryBuilder = new BufferGeometryBuilder(vim.g3d)
    const geometry = this.timeAction('Allocating Geometry', () =>
      geometryBuilder.createAllGeometry()
    )
    console.log('Found # meshes ' + geometry.length)

    const nodesByMeshes = this.timeAction('Counting references', () =>
      vim.g3d.getNodesByMeshes()
    )

    const rawMeshes = this.timeAction('Allocating Meshes', () =>
      this.allocateMeshes(geometry, nodesByMeshes)
    )

    const sceneGeometry = this.timeAction('Instantiating Shared Geometry', () =>
      this.instantiateSharedGeometry(rawMeshes, vim.g3d)
    )

    const merge = this.timeAction('Merging Unique Geometry', () =>
      this.mergeUniqueGeometry(vim.g3d, geometry, nodesByMeshes)
    )
    if (merge !== null) {
      const [mesh, nodes] = merge
      sceneGeometry.addMesh(mesh, nodes)
    }

    console.log('Loading Completed')
    return new VimScene(vim, sceneGeometry, geometryBuilder)
  }

  mergeUniqueGeometry (
    g3d: VimG3d,
    geometry: (THREE.BufferGeometry | null)[],
    nodesByMesh: number[][]
  ): [THREE.Mesh, number[]] | null {
    const [uniques, nodes] = this.getTransformedUniqueGeometry(
      g3d,
      geometry,
      nodesByMesh
    )
    if (uniques.length === 0) return null

    const result = this.createMergedMesh(uniques)
    uniques.forEach((u) => u.dispose())
    return [result, nodes]
  }

  getTransformedUniqueGeometry (
    g3d: VimG3d,
    geometry: (THREE.BufferGeometry | null)[],
    nodesByMesh: number[][]
  ): [THREE.BufferGeometry[], number[]] {
    const result: THREE.BufferGeometry[] = []
    const nodes: number[] = []

    for (let i = 0; i < g3d.instanceMeshes.length; i++) {
      const meshIndex = g3d.instanceMeshes[i]
      if (meshIndex < 0) continue

      const bufferGeometry = geometry[meshIndex]
      if (!bufferGeometry) continue

      // only merge unique objects
      const meshNodes = nodesByMesh[meshIndex]
      if (meshNodes.length === 1) {
        // adding uvs for picking
        this.addUVs(bufferGeometry, i)
        const matrix = getMatrixFromNodeIndex(g3d, i)
        bufferGeometry.applyMatrix4(matrix)
        result.push(bufferGeometry)
        nodes.push(meshNodes[0])
      }
    }
    return [result, nodes]
  }

  // TODO Use and support a simple THREE.Mesh
  createMergedMesh (
    bufferGeometry: THREE.BufferGeometry[]
  ): THREE.InstancedMesh {
    const mergedbufferGeometry: THREE.BufferGeometry =
      BufferGeometryUtils.mergeBufferGeometries(bufferGeometry)

    const mergedMesh = new THREE.InstancedMesh(
      mergedbufferGeometry,
      this.material,
      1
    )
    mergedMesh.setMatrixAt(0, new THREE.Matrix4())
    mergedbufferGeometry.computeBoundingBox()
    // Used by picking to distinguish merged meshes
    mergedMesh.userData.merged = true
    return mergedMesh
  }

  addUVs (bufferGeometry: THREE.BufferGeometry, value: number) {
    const uvArity = 2
    const vertexCount = bufferGeometry.getAttribute('position').count
    const uvs = new Float32Array(vertexCount * uvArity)
    uvs.fill(value)
    bufferGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, uvArity))
  }

  allocateMeshes (
    geometries: (THREE.BufferGeometry | null)[],
    nodesByMesh: number[][]
  ): (Mesh | null)[] {
    const meshCount = geometries.length
    const meshes: (Mesh | null)[] = new Array(meshCount)

    for (let i = 0; i < meshCount; ++i) {
      const count = nodesByMesh[i]?.length ?? 0
      if (count <= 1) {
        continue
      }

      const geometry = geometries[i]
      if (geometry === null) {
        continue
      }

      meshes[i] = new THREE.InstancedMesh(geometry, this.material, count)
    }

    return meshes
  }

  instantiateSharedGeometry (
    meshes: (Mesh | null)[],
    g3d: VimG3d
  ): VimSceneGeometry {
    const instanceCounters = new Int32Array(meshes.length)
    let boundingBox: THREE.Box3 | null = null
    const nodeIndexToMeshInstance = new Map<number, [Mesh, number]>()
    const meshIdToNodeIndex = new Map<number, number[]>()
    const resultMeshes: Mesh[] = []

    for (let i = 0; i < g3d.getInstanceCount(); ++i) {
      const meshIndex = g3d.instanceMeshes[i]
      if (meshIndex < 0) continue

      const mesh = meshes[meshIndex]
      if (!mesh) continue

      const count = instanceCounters[meshIndex]++

      // Set Node-MeshMap
      const nodes = meshIdToNodeIndex.get(mesh.id)
      if (nodes) {
        nodes.push(i)
      } else {
        meshIdToNodeIndex.set(mesh.id, [i])
        resultMeshes.push(mesh) // push mesh first time it is seen
      }

      // Set Node ID for picking
      nodeIndexToMeshInstance.set(i, [mesh, count])

      // Set matrix
      const matrix = getMatrixFromNodeIndex(g3d, i)
      mesh.setMatrixAt(count, matrix)

      // Compute total bounding box
      const box = mesh.geometry.boundingBox!.clone()
      box.applyMatrix4(matrix)
      boundingBox = boundingBox ? boundingBox.union(box) : box
    }
    return new VimSceneGeometry(
      resultMeshes,
      boundingBox ?? new THREE.Box3(),
      nodeIndexToMeshInstance,
      meshIdToNodeIndex
    )
  }
}

export class BufferGeometryBuilder {
  defaultColor = new THREE.Color(0.5, 0.5, 0.5)
  indexBuffer: Int32Array
  vertexBuffer: Float32Array
  colorBuffer: Float32Array

  g3d: VimG3d

  constructor (g3d: VimG3d) {
    this.vertexBuffer = Float32Array.from(g3d.positions)
    this.colorBuffer = new Float32Array(g3d.positions.length)
    this.indexBuffer = new Int32Array(g3d.indices.length)
    this.g3d = g3d
  }

  createAllGeometry = (): (THREE.BufferGeometry | null)[] => {
    const meshCount = this.g3d.meshSubmeshes.length
    const resultMeshes: (THREE.BufferGeometry | null)[] = []

    for (let mesh = 0; mesh < meshCount; mesh++) {
      const result = this.createBufferGeometryFromMeshIndex(mesh)
      result?.computeBoundingBox()
      resultMeshes.push(result)
    }

    return resultMeshes
  }

  createBufferGeometryFromMeshIndex (
    meshIndex: number
  ): THREE.BufferGeometry | null {
    // min and max indices accumulated to slice into the vertex buffer
    let min: number = Number.MAX_SAFE_INTEGER
    let max: number = 0
    let indexCount = 0

    const [meshStart, meshEnd] = this.g3d.getMeshSubmeshRange(meshIndex)
    for (let submesh = meshStart; submesh < meshEnd; submesh++) {
      // transparent submeshes are skipped
      const submeshColor = this.getSubmeshColor(this.g3d, submesh)
      if (!submeshColor) continue

      const [submeshStart, submeshEnd] = this.g3d.getSubmeshIndexRange(submesh)
      for (let index = submeshStart; index < submeshEnd; index++) {
        const vertex = this.g3d.indices[index]
        this.indexBuffer[indexCount++] = vertex
        min = Math.min(min, vertex)
        max = Math.max(max, vertex)
        submeshColor.toArray(this.colorBuffer, vertex * 3)
      }
    }

    // If all submesh are transparent, we push null to keep results aligned
    if (indexCount === 0) return null

    // 3 is both the arity of the vertex buffer and of THREE.color
    const sliceStart = min * 3
    const sliceEnd = (max + 1) * 3

    // Rebase indices in mesh space
    for (let i = 0; i < indexCount; i++) {
      this.indexBuffer[i] -= min
    }

    return createBufferGeometryFromArrays(
      this.vertexBuffer.subarray(sliceStart, sliceEnd),
      this.indexBuffer.subarray(0, indexCount),
      this.colorBuffer.subarray(sliceStart, sliceEnd)
    )
  }

  createBufferGeometryFromInstanceIndex (
    instanceIndex: number
  ): THREE.BufferGeometry | null {
    if (instanceIndex < 0) throw new Error('Invalid negative index.')

    const meshIndex = this.g3d.instanceMeshes[instanceIndex]
    if (meshIndex < 0) return null
    const geometry = this.createBufferGeometryFromMeshIndex(meshIndex)
    if (!geometry) return null
    const matrix = getMatrixFromNodeIndex(this.g3d, instanceIndex)
    geometry.applyMatrix4(matrix)
    return geometry
  }

  getSubmeshColor (g3d: VimG3d, submesh: number) {
    const material = g3d.submeshMaterial[submesh]
    if (material < 0) {
      return this.defaultColor
    }

    const colorIndex = material * g3d.colorArity
    const alpha = g3d.materialColors[colorIndex + 3]
    if (alpha < 0.9) {
      return // to skip transparent materials
    }

    return new THREE.Color().fromArray(g3d.materialColors, colorIndex)
  }
}

function getMatrixFromNodeIndex (g3d: VimG3d, index: number): THREE.Matrix4 {
  const matrixAsArray = g3d.getTransformMatrixAsArray(index)
  const matrix = new THREE.Matrix4()
  matrix.elements = Array.from(matrixAsArray)
  return matrix
}
