/**
 * @module vim-loader
 */

import * as THREE from 'three'
import {
  G3d,
  G3dMesh,
  G3dMeshIndex,
  G3dMeshOffsets,
  MeshSection
} from 'vim-format'
import { VimMaterials } from '../vim'

export type MergeArgs = {
  section: MeshSection
  instances: number[]
  loadRooms: boolean
  transparent: boolean
}

export namespace Transparency {
  /**
   * Determines how to draw (or not) transparent and opaque objects
   */
  export type Mode = 'opaqueOnly' | 'transparentOnly' | 'allAsOpaque' | 'all'

  /**
   * Returns true if the transparency mode is one of the valid values
   */
  export function isValid (value: string | undefined | null): value is Mode {
    if (!value) return false
    return ['all', 'opaqueOnly', 'transparentOnly', 'allAsOpaque'].includes(
      value
    )
  }

  /**
   * Returns true if the transparency mode requires to use RGBA colors
   */
  export function requiresAlpha (mode: Mode) {
    return mode === 'all' || mode === 'transparentOnly'
  }
}

export namespace Geometry {
  /**
   * Creates a BufferGeometry with all given instances merged
   * @param instances indices of the instances from the g3d to merge
   * @returns a BufferGeometry
   */
  export function createGeometryFromInstances (g3d: G3d, args: MergeArgs) {
    return Geometry.mergeInstanceMeshes(g3d, args)?.geometry
  }

  /**
   * Creates a BufferGeometry from a given mesh index in the g3d
   * @param mesh g3d mesh index
   * @param transparent specify to use RGB or RGBA for colors
   */
  export function createGeometryFromMesh (
    g3d: G3d,
    mesh: number,
    section: MeshSection,
    transparent: boolean
  ): THREE.BufferGeometry {
    const colors = createVertexColors(g3d, mesh, transparent)
    const positions = g3d.positions.subarray(
      g3d.getMeshVertexStart(mesh) * 3,
      g3d.getMeshVertexEnd(mesh) * 3
    )

    const start = g3d.getMeshIndexStart(mesh, section)
    const end = g3d.getMeshIndexEnd(mesh, section)
    const indices = g3d.indices.subarray(start, end)
    return createGeometryFromArrays(
      positions,
      indices,
      colors,
      transparent ? 4 : 3
    )
  }
  /**
   * Expands submesh colors into vertex colors as RGB or RGBA
   */
  function createVertexColors (
    g3d: G3d,
    mesh: number,
    useAlpha: boolean
  ): Float32Array {
    const colorSize = useAlpha ? 4 : 3
    const result = new Float32Array(g3d.getMeshVertexCount(mesh) * colorSize)

    const subStart = g3d.getMeshSubmeshStart(mesh)
    const subEnd = g3d.getMeshSubmeshEnd(mesh)

    for (let submesh = subStart; submesh < subEnd; submesh++) {
      const color = g3d.getSubmeshColor(submesh)
      const start = g3d.getSubmeshIndexStart(submesh)
      const end = g3d.getSubmeshIndexEnd(submesh)

      for (let i = start; i < end; i++) {
        const v = g3d.indices[i] * colorSize
        result[v] = color[0]
        result[v + 1] = color[1]
        result[v + 2] = color[2]
        if (useAlpha) result[v + 3] = color[3]
      }
    }
    return result
  }

  /**
   * Returns a THREE.Matrix4 from the g3d for given instance
   * @param instance g3d instance index
   * @param target matrix where the data will be copied, a new matrix will be created if none provided.
   */
  export function getInstanceMatrix (
    g3d: G3d,
    instance: number,
    target: THREE.Matrix4 = new THREE.Matrix4()
  ): THREE.Matrix4 {
    const matrixAsArray = g3d.getInstanceMatrix(instance)
    target.fromArray(matrixAsArray)
    return target
  }

  /**
   * Creates a BufferGeometry from given geometry data arrays
   * @param vertices vertex data with 3 number per vertex (XYZ)
   * @param indices index data with 3 indices per face
   * @param vertexColors color data with 3 or 4 number per vertex. RBG or RGBA
   * @param colorSize specify whether to treat colors as RGB or RGBA
   * @returns a BufferGeometry
   */
  export function createGeometryFromArrays (
    vertices: Float32Array,
    indices: Uint32Array,
    vertexColors: Float32Array | undefined = undefined,
    colorSize: number = 3
  ): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry()

    // Vertices
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))

    // Indices
    geometry.setIndex(new THREE.Uint32BufferAttribute(indices, 1))

    // Colors with alpha if transparent
    if (vertexColors) {
      geometry.setAttribute(
        'color',
        new THREE.BufferAttribute(vertexColors, colorSize)
      )
    }

    return geometry
  }

  /**
   * Returns a merged mesh of all meshes related to given instances along with picking related metadata
   * Returns undefined if mesh would be empty
   * @param section mesh sections to include in the merged mesh.
   * @param transparent true to use a transparent material.
   * @param instances instances for which to merge meshes.
   */
  export function mergeInstanceMeshes (g3d: G3d, mergeArgs: MergeArgs) {
    const info = getInstanceMergeInfo(g3d, mergeArgs)
    if (info.instances.length === 0 || info.indexCount === 0) return
    return merge(g3d, info)
  }

  /**
   * Returns a merged mesh of all unique meshes along with picking related metadata
   * @param section mesh sections to include in the merged mesh.
   * @param transparent true to use a transparent material.
   * @param instances instances for which to merge meshes.
   */
  export function mergeUniqueMeshes (g3d: G3d, args: MergeArgs) {
    const info = getUniqueMeshMergeInfo(g3d, args)
    if (info.instances.length === 0 || info.indexCount === 0) return
    return merge(g3d, info)
  }

  export function mergeUniqueMeshesFromFiles (
    g3d: G3dMeshIndex,
    args: MergeArgs
  ) {
    const info = getUniqueMeshMergeInfoFromFiles(g3d, args)
    if (info.instances.length === 0 || info.indexCount === 0) return
    // return merge(g3d, info)
  }

  /**
   * Returns merged geometry and meta data for picking.
   */
  function merge (g3d: G3d, info: MergeInfo) {
    const buffer = info.createBuffer()
    fillBuffers(g3d, buffer, info)
    const geometry = buffer.toBufferGeometry()
    return new MergeResult(
      geometry,
      info.instances,
      buffer.groups,
      buffer.boxes
    )
  }

  /**
   * Precomputes array sizes required to merge all unique meshes
   */
  function getUniqueMeshMergeInfo (g3d: G3d, args: MergeArgs) {
    let vertexCount = 0
    let indexCount = 0
    const instances = []

    const meshCount = g3d.getMeshCount()
    for (let mesh = 0; mesh < meshCount; mesh++) {
      const meshInstances = g3d.meshInstances[mesh]
      if (!meshInstances || meshInstances.length !== 1) continue

      const instance = meshInstances[0]
      if (!args.loadRooms && g3d.getInstanceHasFlag(instance, 1)) continue

      const count = g3d.getMeshIndexCount(mesh, args.section)
      if (count <= 0) continue

      indexCount += count
      vertexCount += g3d.getMeshVertexCount(mesh)
      instances.push(instance)
    }

    return new MergeInfo(
      args.section,
      args.transparent,
      instances,
      indexCount,
      vertexCount
    )
  }

  /**
   * Precomputes array sizes required to merge all unique meshes
   */
  function getUniqueMeshMergeInfoFromFiles (
    index: G3dMeshIndex,
    args: MergeArgs
  ) {
    const uniqueMeshes = new Array<number>()
    const instances = new Array<number>()
    const seen = new Set<number>()
    index.instanceFiles.forEach((f) => {
      if (!seen.has(f)) {
        uniqueMeshes.push(f)
        seen.add(f)
        instances.push(f)
      }
    })
    const counts = index.getAttributeCounts(uniqueMeshes)

    return new MergeInfo(
      args.section,
      args.transparent,
      instances,
      counts.indexCount,
      counts.vertexCount
    )
  }

  /**
   * Precomputes array sizes required to merge all meshes of given instances.
   */
  function getInstanceMergeInfo (g3d: G3d, args: MergeArgs) {
    let vertexCount = 0
    let indexCount = 0
    const instancesFiltered = []

    for (let i = 0; i < args.instances.length; i++) {
      const instance = args.instances[i]
      if (!args.loadRooms && g3d.getInstanceHasFlag(instance, 1)) {
        continue
      }
      const mesh = g3d.instanceMeshes[instance]

      const start = g3d.getMeshIndexStart(mesh, args.section)
      const end = g3d.getMeshIndexEnd(mesh, args.section)
      const count = end - start
      if (count <= 0) continue
      indexCount += count
      vertexCount += g3d.getMeshVertexCount(mesh)
      instancesFiltered.push(instance)
    }

    return new MergeInfo(
      args.section,
      args.transparent,
      instancesFiltered,
      indexCount,
      vertexCount
    )
  }

  /**
   * Concatenates all required mesh data into the merge buffer.
   */
  function fillBuffers (g3d: G3d, buffer: MergeBuffer, info: MergeInfo) {
    let index = 0
    let vertex = 0
    let offset = 0

    // matrix and vector is reused to avoid needless allocations
    const matrix = new THREE.Matrix4()
    const vector = new THREE.Vector3()

    for (let i = 0; i < info.instances.length; i++) {
      const instance = info.instances[i]
      const mesh = g3d.getInstanceMesh(instance)
      buffer.groups[i] = index

      const subStart = g3d.getMeshSubmeshStart(mesh, info.section)
      const subEnd = g3d.getMeshSubmeshEnd(mesh, info.section)
      for (let sub = subStart; sub < subEnd; sub++) {
        const subColor = g3d.getSubmeshColor(sub)
        const start = g3d.getSubmeshIndexStart(sub)
        const end = g3d.getSubmeshIndexEnd(sub)

        for (let s = start; s < end; s++) {
          // Copy index
          const newIndex = g3d.indices[s] + offset
          buffer.indices[index++] = newIndex

          // Copy color
          const v = newIndex * buffer.colorSize
          buffer.colors[v] = subColor[0]
          buffer.colors[v + 1] = subColor[1]
          buffer.colors[v + 2] = subColor[2]
          if (buffer.colorSize > 3) {
            buffer.colors[v + 3] = subColor[3]
          }
        }
      }

      // Apply Matrices and copy vertices to merged array
      getInstanceMatrix(g3d, instance, matrix)
      const vertexStart = g3d.getMeshVertexStart(mesh)
      const vertexEnd = g3d.getMeshVertexEnd(mesh)

      if (vertexEnd > vertexStart) {
        // First point is computed before to initialize box
        vector.fromArray(g3d.positions, vertexStart * G3d.POSITION_SIZE)
        vector.applyMatrix4(matrix)
        vector.toArray(buffer.vertices, vertex)
        vertex += G3d.POSITION_SIZE
        buffer.boxes[i] = new THREE.Box3(vector.clone(), vector.clone())
      }

      for (let p = vertexStart + 1; p < vertexEnd; p++) {
        vector.fromArray(g3d.positions, p * G3d.POSITION_SIZE)
        vector.applyMatrix4(matrix)
        vector.toArray(buffer.vertices, vertex)
        vertex += G3d.POSITION_SIZE
        buffer.boxes[i].expandByPoint(vector)
      }

      // Keep offset for next mesh
      offset += vertexEnd - vertexStart
    }
  }

  /**
   * Holds the info that needs to be precomputed for a merge.
   */
  export class MergeInfo {
    section: MeshSection
    transparent: boolean
    instances: number[]
    indexCount: number
    vertexCount: number

    constructor (
      section: MeshSection,
      transparent: boolean,
      instance: number[],
      indexCount: number,
      vertexCount: number
    ) {
      this.section = section
      this.transparent = transparent
      this.instances = instance
      this.indexCount = indexCount
      this.vertexCount = vertexCount
    }

    createBuffer () {
      return new MergeBuffer(this, G3d.POSITION_SIZE, this.transparent ? 4 : 3)
    }
  }

  /**
   * Allocates and holds all arrays needed to merge meshes.
   */
  export class MergeBuffer {
    // output
    indices: Uint32Array
    vertices: Float32Array
    colors: Float32Array
    groups: number[]
    colorSize: number
    boxes: THREE.Box3[]

    constructor (info: MergeInfo, positionSize: number, colorSize: number) {
      // allocate all memory required for merge
      this.indices = new Uint32Array(info.indexCount)
      this.vertices = new Float32Array(info.vertexCount * positionSize)
      this.colors = new Float32Array(info.vertexCount * colorSize)
      this.groups = new Array(info.instances.length)
      this.boxes = new Array(info.instances.length)
      this.colorSize = colorSize
    }

    toBufferGeometry () {
      const geometry = createGeometryFromArrays(
        this.vertices,
        this.indices,
        this.colors,
        this.colorSize
      )

      return geometry
    }
  }

  /**
   * Holds the result from a merge operation.
   */
  export class MergeResult {
    geometry: THREE.BufferGeometry
    instances: number[]
    submeshes: number[]
    boxes: THREE.Box3[]

    constructor (
      geometry: THREE.BufferGeometry,
      instance: number[],
      submeshes: number[],
      boxes: THREE.Box3[]
    ) {
      this.geometry = geometry
      this.instances = instance
      this.submeshes = submeshes
      this.boxes = boxes
    }
  }
}

export class InsertableMesh {
  mesh: THREE.Mesh
  geometry: THREE.BufferGeometry

  indexCount = 0
  vertexCount = 0
  colorSize: number
  section: MeshSection
  transparent: boolean

  indexAttribute: THREE.Uint32BufferAttribute
  vertexAttribute: THREE.BufferAttribute
  colorAttribute: THREE.BufferAttribute

  meshes: number[]
  offsets: G3dMeshOffsets

  getMeshCount () {
    return this.offsets.indexOffsets.length
  }

  constructor (
    indexCapacity: number,
    vertexCapacity: number,
    transparent: boolean,
    meshes: number[],
    offsets: G3dMeshOffsets,
    section: MeshSection
  ) {
    this.offsets = offsets
    this.meshes = meshes
    this.section = section

    this.transparent = transparent
    this.colorSize = transparent ? 4 : 3

    this.indexAttribute = new THREE.Uint32BufferAttribute(indexCapacity, 1)
    this.vertexAttribute = new THREE.Float32BufferAttribute(
      vertexCapacity * G3d.POSITION_SIZE,
      G3d.POSITION_SIZE
    )
    this.colorAttribute = new THREE.Float32BufferAttribute(
      vertexCapacity * this.colorSize,
      this.colorSize
    )

    this.indexAttribute.count = 0
    this.vertexAttribute.count = 0
    this.colorAttribute.count = 0

    this.geometry = new THREE.BufferGeometry()
    this.geometry.setIndex(this.indexAttribute)
    this.geometry.setAttribute('position', this.vertexAttribute)
    this.geometry.setAttribute('color', this.colorAttribute)

    const material = transparent
      ? VimMaterials.getInstance().transparent.material
      : VimMaterials.getInstance().opaque.material
    this.mesh = new THREE.Mesh(this.geometry, material)
  }

  static fromIndex (
    index: G3dMeshIndex,
    meshes: number[],
    section: MeshSection,
    transparent: boolean
  ) {
    const counts = index.getAttributeCounts(meshes, section, true)
    const offsets = index.getMergedMeshOffsets(meshes, section)
    return new InsertableMesh(
      counts.indexCount,
      counts.vertexCount,
      transparent,
      meshes,
      offsets,
      section
    )
  }

  append (g3d: G3d) {
    for (let i = 0; i < g3d.getIndexCount(); i++) {
      this.indexAttribute.setX(
        this.indexCount + i,
        g3d.indices[i] + this.vertexCount
      )
    }
    console.log(this.indexAttribute)

    const vector = new THREE.Vector3()
    const matrix = new THREE.Matrix4().fromArray(g3d.getInstanceMatrix(0))

    for (let i = 0; i < g3d.getVertexCount(); i++) {
      vector.fromArray(g3d.positions, i * G3d.POSITION_SIZE)
      vector.applyMatrix4(matrix)

      this.vertexAttribute.setXYZ(
        this.vertexCount + i,
        vector.x,
        vector.y,
        vector.z
      )

      if (this.colorSize === 3) {
        this.colorAttribute.setXYZ(this.vertexCount + i, 1, 1, 1)
      } else {
        this.colorAttribute.setXYZW(this.vertexCount + i, 1, 1, 1, 1)
      }
    }

    this.indexCount += g3d.getIndexCount()
    this.vertexCount += g3d.getVertexCount()

    this.indexAttribute.count = this.indexCount
    this.vertexAttribute.count = this.vertexCount
    this.colorAttribute.count = this.vertexCount

    this.indexAttribute.needsUpdate = true
    this.vertexAttribute.needsUpdate = true
    this.colorAttribute.needsUpdate = true

    this.geometry.computeBoundingBox()
  }

  appendMesh (g3d: G3dMesh) {
    for (let i = 0; i < g3d.getIndexCount(); i++) {
      this.indexAttribute.setX(
        this.indexCount + i,
        g3d.indices[i] + this.vertexCount
      )
    }
    console.log(this.indexAttribute)

    const vector = new THREE.Vector3()
    const matrix = new THREE.Matrix4().fromArray(g3d.getInstanceMatrix(0))

    for (let i = 0; i < g3d.getVertexCount(); i++) {
      vector.fromArray(g3d.positions, i * G3d.POSITION_SIZE)
      vector.applyMatrix4(matrix)

      this.vertexAttribute.setXYZ(
        this.vertexCount + i,
        vector.x,
        vector.y,
        vector.z
      )

      if (this.colorSize === 3) {
        this.colorAttribute.setXYZ(this.vertexCount + i, 1, 1, 1)
      } else {
        this.colorAttribute.setXYZW(this.vertexCount + i, 1, 1, 1, 1)
      }
    }

    this.indexCount += g3d.getIndexCount()
    this.vertexCount += g3d.getVertexCount()

    this.indexAttribute.count = this.indexCount
    this.vertexAttribute.count = this.vertexCount
    this.colorAttribute.count = this.vertexCount

    this.geometry.computeBoundingBox()
  }

  insertMesh (g3d: G3dMesh, mesh: number) {
    const indexOffset = this.offsets.indexOffsets[mesh]
    const vertexOffset = this.offsets.vertexOffsets[mesh]

    for (let i = 0; i < g3d.getIndexCount(); i++) {
      this.indexAttribute.setX(indexOffset + i, g3d.indices[i] + vertexOffset)
    }
    console.log(this.indexAttribute)

    const vector = new THREE.Vector3()
    const matrix = new THREE.Matrix4().fromArray(g3d.getInstanceMatrix(0))

    for (let i = 0; i < g3d.getVertexCount(); i++) {
      vector.fromArray(g3d.positions, i * G3d.POSITION_SIZE)
      vector.applyMatrix4(matrix)

      this.vertexAttribute.setXYZ(
        vertexOffset + i,
        vector.x,
        vector.y,
        vector.z
      )

      if (this.colorSize === 3) {
        this.colorAttribute.setXYZ(vertexOffset + i, 1, 1, 1)
      } else {
        this.colorAttribute.setXYZW(vertexOffset + i, 1, 1, 1, 1)
      }
    }

    this.indexCount = Math.max(
      indexOffset + g3d.getIndexCount(),
      this.indexCount
    )
    this.vertexCount = Math.max(
      vertexOffset + g3d.getVertexCount(),
      this.vertexCount
    )

    this.indexAttribute.count = this.indexCount
    this.vertexAttribute.count = this.vertexCount
    this.colorAttribute.count = this.vertexCount

    this.geometry.computeBoundingBox()
  }

  insertAllMesh (g3d: G3dMesh, mesh: number) {
    const indexStart = this.offsets.indexOffsets[mesh]
    const vertexStart = this.offsets.vertexOffsets[mesh]

    for (let instance = 0; instance < g3d.getInstanceCount(); instance++) {
      const indexCount = g3d.getIndexCount()
      const vertexCount = g3d.getVertexCount()
      const indexOffset = indexCount * instance
      const vertexOffset = vertexCount * instance

      for (let i = 0; i < indexCount; i++) {
        this.indexAttribute.setX(
          indexStart + indexOffset + i,
          g3d.indices[i] + vertexStart + vertexOffset
        )
      }

      const matrix = new THREE.Matrix4().fromArray(
        g3d.getInstanceMatrix(instance)
      )
      const vector = new THREE.Vector3()

      for (let v = 0; v < vertexCount; v++) {
        vector.fromArray(g3d.positions, v * G3d.POSITION_SIZE)
        vector.applyMatrix4(matrix)

        this.vertexAttribute.setXYZ(
          vertexStart + vertexOffset + v,
          vector.x,
          vector.y,
          vector.z
        )
      }

      for (let sub = 0; sub < g3d.submeshIndexOffset.length; sub++) {
        const start = g3d.submeshIndexOffset[sub]
        const end =
          sub + 1 < g3d.submeshIndexOffset.length
            ? g3d.submeshIndexOffset[sub + 1]
            : g3d.indices.length
        const mat = g3d.submeshMaterial[sub]
        const r = g3d.materialColors[mat * G3d.COLOR_SIZE]
        const g = g3d.materialColors[mat * G3d.COLOR_SIZE + 1]
        const b = g3d.materialColors[mat * G3d.COLOR_SIZE + 2]
        const a = g3d.materialColors[mat * G3d.COLOR_SIZE + 3]

        const transparentColor = a < 1
        const reject = this.transparent !== transparentColor

        for (let i = start; i < end; i++) {
          const v = g3d.indices[i]
          const vertex = vertexStart + vertexOffset + v
          if (this.colorSize === 3) {
            this.colorAttribute.setXYZ(vertex, r, g, b)
          } else {
            this.colorAttribute.setXYZW(vertex, r, g, b, a)
          }
          if (reject) {
            this.indexAttribute.setX(indexStart + indexOffset + i, 0)
            this.vertexAttribute.setXYZ(vertex, 0, 0, 0)
          }
        }
      }
    }

    this.indexCount = Math.max(
      indexStart + g3d.getIndexCount() * g3d.getInstanceCount(),
      this.indexCount
    )

    this.vertexCount = Math.max(
      vertexStart + g3d.getVertexCount() * g3d.getInstanceCount(),
      this.vertexCount
    )

    this.indexAttribute.count = this.indexCount
    this.vertexAttribute.count = this.vertexCount
    this.colorAttribute.count = this.vertexCount

    this.geometry.computeBoundingBox()
  }

  insertAllMesh2 (g3d: G3dMesh, mesh: number) {
    const vector = new THREE.Vector3()
    const matrix = new THREE.Matrix4()

    const indexOffset = this.offsets.indexOffsets[mesh]
    const vertexOffset = this.offsets.vertexOffsets[mesh]
    let i = 0
    let v = 0
    let c = 0
    for (let instance = 0; instance < g3d.getInstanceCount(); instance++) {
      const indexStart = g3d.getIndexStart(this.section)
      const indexEnd = g3d.getIndexEnd(this.section)

      const vertexStart = g3d.getVertexStart(this.section)
      const vertexEnd = g3d.getVertexEnd(this.section)
      const vertexCount = vertexEnd - vertexStart
      const vertexMergeOffset = vertexCount * instance

      // console.log('indexCount : ' + indexCount)
      // console.log('instance : ' + instance)
      const sectionOffset = g3d.getVertexStart(this.section)

      for (let index = indexStart; index < indexEnd; index++) {
        this.indexAttribute.setX(
          indexOffset + i,
          vertexOffset + vertexMergeOffset + g3d.indices[index] - sectionOffset
        )
        /*
        console.log(
          `[${indexOffset + i}] = ${
            vertexOffset + indexMergeOffset + g3d.indices[index] - sectionOffset
          }`
        )

        console.log('i : ' + i)
        console.log('indexStart : ' + indexStart)
        console.log('indexOffset : ' + indexOffset)
        console.log('vertexOffset : ' + vertexOffset)
        console.log('indexMergeOffset : ' + indexMergeOffset)
        console.log('g3d.indices[index]  : ' + g3d.indices[index])
        console.log('sectionOffset : ' + sectionOffset)
*/
        i++
      }

      // console.log('vertexStart' + vertexStart)
      // console.log('vertexEnd' + vertexEnd)
      matrix.fromArray(g3d.getInstanceMatrix(instance))
      for (let vertex = vertexStart; vertex < vertexEnd; vertex++) {
        vector.fromArray(g3d.positions, vertex * G3d.POSITION_SIZE)
        // console.log('v:' + v)
        // console.log(vector.clone())
        vector.applyMatrix4(matrix)
        this.vertexAttribute.setXYZ(
          vertexOffset + v,
          vector.x,
          vector.y,
          vector.z
        )

        this.colorAttribute.setXYZW(vertexOffset + v, 1, 1, 1, 0.5)
        v++
      }

      const subStart = g3d.getSubmeshStart(this.section)
      const subEnd = g3d.getSubmeshEnd(this.section)
      for (let sub = subStart; sub < subEnd; sub++) {
        const color = g3d.getSubmeshColor(sub * G3d.COLOR_SIZE)
        const vCount = g3d.getSubmeshVertexCount(sub)
        console.log('color' + color)
        console.log('c' + c)
        for (let subV = 0; subV < vCount; subV++) {
          console.log('c' + c)
          if (this.colorSize === 3) {
            this.colorAttribute.setXYZ(
              vertexOffset + c,
              color[0],
              color[1],
              color[2]
            )
          } else {
            this.colorAttribute.setXYZW(
              vertexOffset + c,
              color[0],
              color[1],
              color[2],
              color[3]
            )
          }
          c++
        }
      }

      this.indexAttribute.count = Math.max(indexOffset + i)
      const vCount = vertexOffset + v
      const max = Math.max(vCount, this.vertexAttribute.count)
      this.vertexAttribute.count = max
      this.colorAttribute.count = max
      // console.log(this.indexAttribute.count)
    }
  }

  update () {
    this.geometry.computeBoundingSphere()
    this.geometry.computeBoundingBox()
    this.indexAttribute.needsUpdate = true
    this.vertexAttribute.needsUpdate = true
    this.colorAttribute.needsUpdate = true
  }
}
