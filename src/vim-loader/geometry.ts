/**
 * @module vim-loader
 */

import * as THREE from 'three'
import { G3d, MeshSection } from 'vim-format'

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
