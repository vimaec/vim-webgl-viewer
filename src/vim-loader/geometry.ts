/**
 * @module vim-loader
 */

import * as THREE from 'three'
import { G3d } from './g3d'

export namespace Transparency {
  /**
   * Determines how to draw (or not) transparent and opaque objects
   */
  export type Mode = 'opaqueOnly' | 'transparentOnly' | 'allAsOpaque' | 'all'

  /**
   * Returns true if the transparency mode is one of the valid values
   */
  export function isValid (value: string): value is Mode {
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

  /**
   * Returns true if the transparency mode requires using meshes of given opacity
   */
  export function match (mode: Mode, transparent: boolean) {
    return (
      mode === 'allAsOpaque' ||
      mode === 'all' ||
      (!transparent && mode === 'opaqueOnly') ||
      (transparent && mode === 'transparentOnly')
    )
  }
}

export namespace Geometry {
  /**
   * Creates a BufferGeometry with all given instances merged
   * @param instances indices of the instances from the g3d to merge
   * @returns a BufferGeometry
   */
  export function createGeometryFromInstances (g3d: G3d, instances: number[]) {
    const merger = Merger.createFromInstances(g3d, instances, 'all')
    return merger.toBufferGeometry()
  }

  /**
   * Creates a BufferGeometry from a given mesh index in the g3d
   * @param mesh g3d mesh index
   * @param useAlpha specify to use RGB or RGBA for colors
   */
  export function createGeometryFromMesh (
    g3d: G3d,
    mesh: number,
    useAlpha: boolean
  ): THREE.BufferGeometry {
    const colors = createVertexColors(g3d, mesh, useAlpha)

    return createGeometryFromArrays(
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
   * Helper to merge many instances/meshes from a g3d direcly into a BufferGeometry
   */
  export class Merger {
    private _g3d: G3d
    private _colorSize: number

    private _meshes: number[]
    private _indices: Uint32Array
    private _vertices: Float32Array
    private _colors: Float32Array
    private _uvs: Float32Array
    private _instances: number[]
    private _submeshes: number[]

    constructor (
      g3d: G3d,
      transparency: Transparency.Mode,
      instances: number[],
      meshes: number[],
      indexCount: number,
      vertexCount: number
    ) {
      this._g3d = g3d
      this._colorSize = Transparency.requiresAlpha(transparency) ? 4 : 3
      this._instances = instances
      this._meshes = meshes

      // allocate all memory required for merge
      this._indices = new Uint32Array(indexCount)
      this._vertices = new Float32Array(vertexCount * this._g3d.POSITION_SIZE)
      this._colors = new Float32Array(vertexCount * this._colorSize)
      this._uvs = new Float32Array(vertexCount * 2)
      this._submeshes = new Array(this._instances.length)
    }

    getInstances = () => this._instances
    getSubmeshes = () => this._submeshes

    /**
     * Prepares a merge of all meshes referenced by only one instance.
     */
    static createFromUniqueMeshes (g3d: G3d, transparency: Transparency.Mode) {
      let vertexCount = 0
      let indexCount = 0
      const instances = []
      const meshes = []

      const meshCount = g3d.getMeshCount()
      for (let mesh = 0; mesh < meshCount; mesh++) {
        const meshInstances = g3d.meshInstances[mesh]
        if (!meshInstances || meshInstances.length !== 1) continue
        if (!Transparency.match(transparency, g3d.meshTransparent[mesh])) {
          continue
        }

        vertexCount += g3d.getMeshVertexCount(mesh)
        indexCount += g3d.getMeshIndexCount(mesh)
        instances.push(meshInstances[0])
        meshes.push(mesh)
      }
      return new Merger(
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
    static createFromInstances (
      g3d: G3d,
      instances: number[],
      transparency: Transparency.Mode
    ) {
      let vertexCount = 0
      let indexCount = 0
      const instancesFiltered = []
      const meshes = []
      for (let i = 0; i < instances.length; i++) {
        const instance = instances[i]
        const mesh = g3d.instanceMeshes[instance]
        if (mesh < 0) continue
        if (!Transparency.match(transparency, g3d.meshTransparent[mesh])) {
          continue
        }

        vertexCount += g3d.getMeshVertexCount(mesh)
        indexCount += g3d.getMeshIndexCount(mesh)
        instancesFiltered.push(instance)
        meshes.push(mesh)
      }

      return new Merger(
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

      for (let i = 0; i < this._instances.length; i++) {
        const mesh = this._meshes[i]
        const instance = this._instances[i]
        this._submeshes[i] = index

        // Copy all indices to merge array
        const indexStart = this._g3d.getMeshIndexStart(mesh)
        const indexEnd = this._g3d.getMeshIndexEnd(mesh)
        for (let i = indexStart; i < indexEnd; i++) {
          this._indices[index++] = this._g3d.indices[i] + offset
        }

        // Copy all colors to merged array
        const subStart = this._g3d.getMeshSubmeshStart(mesh)
        const subEnd = this._g3d.getMeshSubmeshEnd(mesh)
        for (let sub = subStart; sub < subEnd; sub++) {
          const startIndex = this._g3d.getSubmeshIndexStart(sub)
          const endIndex = this._g3d.getSubmeshIndexEnd(sub)

          const subColor = this._g3d.getSubmeshColor(sub)
          for (let i = startIndex; i < endIndex; i++) {
            const v = (this._g3d.indices[i] + offset) * this._colorSize
            this._colors[v] = subColor[0]
            this._colors[v + 1] = subColor[1]
            this._colors[v + 2] = subColor[2]
            if (this._colorSize > 3) {
              this._colors[v + 3] = subColor[3]
            }
          }
        }

        // Apply Matrices and copy vertices to merged array
        getInstanceMatrix(this._g3d, instance, matrix)
        const vertexStart = this._g3d.getMeshVertexStart(mesh)
        const vertexEnd = this._g3d.getMeshVertexEnd(mesh)

        for (let p = vertexStart; p < vertexEnd; p++) {
          vector.fromArray(this._g3d.positions, p * this._g3d.POSITION_SIZE)
          vector.applyMatrix4(matrix)
          vector.toArray(this._vertices, vertex)

          vertex += this._g3d.POSITION_SIZE

          // Fill uvs with instances at the same time as vertices. Used for picking
          this._uvs[uv++] = instance
          this._uvs[uv++] = 1
        }

        // Keep offset for next mesh
        offset += vertexEnd - vertexStart
      }
    }

    /**
     * Runs the merge process and return the resulting BufferGeometry
     */
    toBufferGeometry () {
      this.merge()

      const geometry = createGeometryFromArrays(
        this._vertices,
        this._indices,
        this._colors,
        this._colorSize,
        this._uvs
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
  export function createGeometryFromArrays (
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
}
