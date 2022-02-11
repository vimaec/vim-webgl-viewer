/**
 * Provides methods to create BufferGeometry from g3d geometry data.
 * @module vim-loader
 */

import * as THREE from 'three'
import { G3d } from './g3d'

/**
 * Determines how to draw (or not) transparent and opaque objects
 */
export type TransparencyMode =
  | 'opaqueOnly'
  | 'transparentOnly'
  | 'allAsOpaque'
  | 'all'

/**
 * Returns true if the transparency mode is one of the valid values
 */
export function transparencyIsValid (value: string): value is TransparencyMode {
  return ['all', 'opaqueOnly', 'transparentOnly', 'allAsOpaque'].includes(value)
}

/**
 * Returns true if the transparency mode requires to use RGBA colors
 */
export function transparencyRequiresAlpha (mode: TransparencyMode) {
  return mode === 'all' || mode === 'transparentOnly'
}

/**
 * Returns true if the transparency mode requires using meshes of given opacity
 */
export function transparencyMatches (
  mode: TransparencyMode,
  transparent: boolean
) {
  return (
    mode === 'allAsOpaque' ||
    mode === 'all' ||
    (!transparent && mode === 'opaqueOnly') ||
    (transparent && mode === 'transparentOnly')
  )
}

/**
 * Creates a BufferGeometry with all given instances merged
 * @param instances indices of the instances from the g3d to merge
 * @returns a BufferGeometry
 */
export function createFromInstances (g3d: G3d, instances: number[]) {
  const merger = MeshMerger.MergeInstances(g3d, instances, 'all')
  return merger.toBufferGeometry()
}

/**
 * Creates a BufferGeometry from a given mesh index in the g3d
 * @param mesh mesh index in the g3d
 * @param useAlpha specify to use RGB or RGBA for colors
 */
export function createFromMesh (
  g3d: G3d,
  mesh: number,
  useAlpha: boolean
): THREE.BufferGeometry {
  const colors = createVertexColors(g3d, mesh, useAlpha)

  return createBufferGeometryFromArrays(
    g3d.positions.subarray(
      g3d.getMeshVertexStart(mesh) * 3,
      g3d.getMeshVertexEnd(mesh) * 3
    ),
    g3d.indices.subarray(
      g3d.getMeshIndexStart(mesh),
      g3d.getMeshIndexEnd(mesh)
    ),
    colors,
    useAlpha ? 4 : 3
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
  const result = new Float32Array(
    g3d.getMeshVertexCount(mesh) * (useAlpha ? 4 : 3)
  )

  const subStart = g3d.getMeshSubmeshStart(mesh)
  const subEnd = g3d.getMeshSubmeshEnd(mesh)
  // const [subStart, subEnd] = g3d.getMeshSubmeshRange(mesh)

  for (let submesh = subStart; submesh < subEnd; submesh++) {
    const color = g3d.getSubmeshColor(submesh)

    const start = g3d.getSubmeshIndexStart(submesh)
    const end = g3d.getSubmeshIndexEnd(submesh)
    // const [start, end] = g3d.getSubmeshIndexRange(submesh)
    let v = 0
    for (let i = start; i < end; i++) {
      result[v++] = color[0]
      result[v++] = color[1]
      result[v++] = color[2]
      if (useAlpha) result[v++] = color[3]
    }
  }
  return result
}

/**
 * Helper to merge many instances/meshes from a g3d direcly into a BufferGeometry
 */
export class MeshMerger {
  g3d: G3d
  colorSize: number

  meshes: number[]
  indices: Uint32Array
  vertices: Float32Array
  colors: Float32Array
  uvs: Float32Array
  instances: number[]
  submeshes: number[]

  constructor (
    g3d: G3d,
    transparency: TransparencyMode,
    instances: number[],
    meshes: number[],
    indexCount: number,
    vertexCount: number
  ) {
    this.g3d = g3d
    this.colorSize = transparencyRequiresAlpha(transparency) ? 4 : 3
    this.instances = instances
    this.meshes = meshes

    // allocate all memory required for merge
    this.indices = new Uint32Array(indexCount)
    this.vertices = new Float32Array(vertexCount * this.g3d.positionArity)
    this.colors = new Float32Array(vertexCount * this.colorSize)
    this.uvs = new Float32Array(vertexCount * 2)
    this.submeshes = new Array(this.instances.length)
  }

  /**
   * Prepares a merge of all meshes referenced by only one instance.
   */
  static MergeUniqueMeshes (g3d: G3d, transparency: TransparencyMode) {
    let vertexCount = 0
    let indexCount = 0
    const instances = []
    const meshes = []

    const meshCount = g3d.getMeshCount()
    for (let mesh = 0; mesh < meshCount; mesh++) {
      const meshInstances = g3d.meshInstances[mesh]
      if (!meshInstances || meshInstances.length !== 1) continue
      if (!transparencyMatches(transparency, g3d.meshTransparent[mesh])) {
        continue
      }

      vertexCount += g3d.getMeshVertexCount(mesh)
      indexCount += g3d.getMeshIndexCount(mesh)
      instances.push(meshInstances[0])
      meshes.push(mesh)
    }
    return new MeshMerger(
      g3d,
      transparency,
      instances,
      meshes,
      indexCount,
      vertexCount
    )
  }

  /**
   * Prepares a merge of all meshes referenced by given instances.
   */
  static MergeInstances (
    g3d: G3d,
    instances: number[],
    transparency: TransparencyMode
  ) {
    let vertexCount = 0
    let indexCount = 0
    const instancesFiltered = []
    const meshes = []
    for (let i = 0; i < instances.length; i++) {
      const instance = instances[i]
      const mesh = g3d.instanceMeshes[instance]
      if (mesh < 0) continue
      if (!transparencyMatches(transparency, g3d.meshTransparent[mesh])) {
        continue
      }

      vertexCount += g3d.getMeshVertexCount(mesh)
      indexCount += g3d.getMeshIndexCount(mesh)
      instancesFiltered.push(instance)
      meshes.push(mesh)
    }

    return new MeshMerger(
      g3d,
      transparency,
      instancesFiltered,
      meshes,
      indexCount,
      vertexCount
    )
  }

  /**
   * Concatenates the arrays of each of the (instance,matrix) pairs into large arrays
   * Vertex position is transformed with the relevent matrix at it is copied
   * Index is offset to match the vertices in the concatenated vertex buffer
   * Color is expanded from submehes to vertex color into a concatenated array
   * UVs are used to track which instance eache vertex came from
   * Returns a BufferGeometry from the concatenated array
   */
  private merge () {
    let index = 0
    let vertex = 0
    let uv = 0
    let offset = 0

    // matrix and vector is reused to avoid needless allocations
    const matrix = new THREE.Matrix4()
    const vector = new THREE.Vector3()

    for (let i = 0; i < this.instances.length; i++) {
      const mesh = this.meshes[i]
      const instance = this.instances[i]
      this.submeshes[i] = index

      // Copy all indices to merge array
      const indexStart = this.g3d.getMeshIndexStart(mesh)
      const indexEnd = this.g3d.getMeshIndexEnd(mesh)
      for (let i = indexStart; i < indexEnd; i++) {
        this.indices[index++] = this.g3d.indices[i] + offset
      }

      // Copy all colors to merged array
      const subStart = this.g3d.getMeshSubmeshStart(mesh)
      const subEnd = this.g3d.getMeshSubmeshEnd(mesh)
      // const [subStart, subEnd] = this.g3d.getMeshSubmeshRange(mesh)
      for (let sub = subStart; sub < subEnd; sub++) {
        const startIndex = this.g3d.getSubmeshIndexStart(sub)
        const endIndex = this.g3d.getSubmeshIndexEnd(sub)
        // const [startIndex, endIndex] = this.g3d.getSubmeshIndexRange(sub)

        const subColor = this.g3d.getSubmeshColor(sub)
        for (let i = startIndex; i < endIndex; i++) {
          const v = (this.g3d.indices[i] + offset) * this.colorSize
          this.colors[v] = subColor[0]
          this.colors[v + 1] = subColor[1]
          this.colors[v + 2] = subColor[2]
          if (this.colorSize > 3) {
            this.colors[v + 3] = subColor[3]
          }
        }
      }

      // Apply Matrices and copy vertices to merged array
      getInstanceMatrix(this.g3d, instance, matrix)
      const vertexStart = this.g3d.getMeshVertexStart(mesh)
      const vertexEnd = this.g3d.getMeshVertexEnd(mesh)

      for (let p = vertexStart; p < vertexEnd; p++) {
        vector.fromArray(this.g3d.positions, p * this.g3d.positionArity)
        vector.applyMatrix4(matrix)
        vector.toArray(this.vertices, vertex)

        vertex += this.g3d.positionArity

        // Fill uvs with instances at the same time as vertices. Used for picking
        this.uvs[uv++] = instance
        this.uvs[uv++] = 1
      }

      // Keep offset for next mesh
      offset += vertexEnd - vertexStart
    }
  }

  toBufferGeometry () {
    this.merge()

    const geometry = createBufferGeometryFromArrays(
      this.vertices,
      this.indices,
      this.colors,
      this.colorSize,
      this.uvs
    )
    return geometry
  }
}

/**
 * Creates a BufferGeometry from given geometry data arrays
 * @param vertices vertex data with 3 number per vertex (XYZ)
 * @param indices index data with 3 indices per face
 * @param vertexColors color data with 3 or 4 number per vertex. RBG or RGBA
 * @param colorSize specify whether to treat colors as RGB or RGBA
 * @param uvs uv data with 2 number per vertex (XY)
 * @returns a BufferGeometry
 */
export function createBufferGeometryFromArrays (
  vertices: Float32Array,
  indices: Uint32Array,
  vertexColors: Float32Array | undefined = undefined,
  colorSize: number = 3,
  uvs: Float32Array | undefined = undefined
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
    if (uvs) {
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    }
  }

  return geometry
}

export function getInstanceMatrix (
  g3d: G3d,
  index: number,
  target: THREE.Matrix4 = new THREE.Matrix4()
): THREE.Matrix4 {
  const matrixAsArray = g3d.getInstanceTransform(index)
  target.fromArray(matrixAsArray)
  return target
}
