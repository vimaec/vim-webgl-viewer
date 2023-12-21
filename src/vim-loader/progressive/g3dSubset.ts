import { G3d, MeshSection, G3dScene, FilterMode } from 'vim-format'
import { G3dMeshOffsets, G3dMeshCounts } from './g3dOffsets'
import * as THREE from 'three'

/**
 * Represents a subset of a complete scene definition.
 * Allows for further filtering or to get offsets needed to build the scene.
 */
export class G3dSubset {
  private _source: G3dScene | G3d
  // source-based indices of included instanced
  private _instances: number[]

  /** Source-based mesh indices */
  private _meshes: Array<number>
  /** Source-based instances aligned with corresponding mesh */
  private _meshInstances: Array<Array<number>>

  /**
   * @param source Underlying data source for the subset
   * @param instances source-based instance indices of included instances.
   */
  constructor (
    source: G3dScene | G3d,
    // source-based indices of included instanced
    instances?: number[]
  ) {
    this._source = source

    // Consider removing this if too slow.
    if (!instances) {
      instances = new Array<number>()
      for (let i = 0; i < source.instanceMeshes.length; i++) {
        if (source.instanceMeshes[i] >= 0) {
          instances.push(i)
        }
      }
    }
    this._instances = instances

    const map2 = new Map<number, Array<number>>()
    for (const instance of instances) {
    }

    // Compute mesh data.
    this._meshes = new Array<number>()
    const map = new Map<number, Array<number>>()
    for (const instance of instances) {
      const mesh = source.instanceMeshes[instance]
      if (!map.has(mesh)) {
        this._meshes.push(mesh)
        map.set(mesh, [instance])
      } else {
        map.get(mesh)?.push(instance)
      }
    }

    this._meshInstances = new Array<Array<number>>(this._meshes.length)
    for (let i = 0; i < this._meshes.length; i++) {
      this._meshInstances[i] = map.get(this._meshes[i])
    }
  }

  /**
   * Returns total instance count in subset.
   */
  getInstanceCount () {
    return this._instances.length
  }

  /**
   * Returns the vim-based instance (node) for given subset-based instance.
   */
  getVimInstance (subsetIndex: number) {
    const vimIndex = this._instances[subsetIndex]
    return this._source.instanceNodes[vimIndex]
  }

  /**
   * Returns the vim-based instances (nodes) for current subset.
   */
  getVimInstances () {
    const results = new Array<number>(this._instances.length)
    for (let i = 0; i < results.length; i++) {
      results[i] = this.getVimInstance(i)
    }
    return results
  }

  /**
   * Returns source-based mesh index.
   * @param index subset-based mesh index
   */
  getSourceMesh (index: number) {
    return this._meshes[index]
  }

  /**
   * Returns total mesh count in subset.
   */
  getMeshCount () {
    return this._meshes.length
  }

  /**
   * Returns total index count for given mesh and section.
   * @param mesh subset-based mesh index
   * @param section sections to include based on opacity
   */
  getMeshIndexCount (mesh: number, section: MeshSection) {
    const instances = this.getMeshInstanceCount(mesh)
    const indices = this._source.getMeshIndexCount(
      this.getSourceMesh(mesh),
      section
    )
    return indices * instances
  }

  /**
   * Returns total vertex count for given mesh and section.
   * @param mesh subset-based mesh index
   * @param section sections to include based on opacity
   */
  getMeshVertexCount (mesh: number, section: MeshSection) {
    const instances = this.getMeshInstanceCount(mesh)
    const vertices = this._source.getMeshVertexCount(
      this.getSourceMesh(mesh),
      section
    )
    return vertices * instances
  }

  /**
   * Returns instance count for given mesh.
   * @param mesh subset-based mesh index.
   */
  getMeshInstanceCount (mesh: number) {
    return this._meshInstances[mesh].length
  }

  /**
   * Returns a list of source-based instance indices for given mesh.
   * @param mesh subset-based mesh index.
   */
  getMeshInstances (mesh: number) {
    return this._meshInstances[mesh]
  }

  /**
   * Returns the source-based instance index for given mesh and index.
   * @param mesh subset-based mesh index.
   * @param index mesh-based instance index
   */
  getMeshInstance (mesh: number, index: number) {
    return this._meshInstances[mesh][index]
  }

  /**
   * Returns a new subset that only contains unique meshes.
   */
  filterUniqueMeshes () {
    return this.filterByCount((count) => count === 1)
  }

  /**
   * Returns a new subset that contains only the N largest meshes sorted by largest
   */
  filterLargests (count: number) {
    if (this._source instanceof G3d) {
      throw new Error('Feature requires a vimx file')
    }

    // reuse vector3 to avoid wateful allocations
    const min = new THREE.Vector3()
    const max = new THREE.Vector3()

    // Compute all sizes
    const values = new Array<[number, number]>(this._instances.length)
    for (let i = 0; i < this._instances.length; i++) {
      const instance = this._instances[i]
      min.fromArray(this._source.getInstanceMin(instance))
      max.fromArray(this._source.getInstanceMax(instance))
      const size = min.distanceToSquared(max)
      values.push([i, size])
    }

    // Take top 100 instances
    values.sort((v1, v2) => v2[1] - v1[1])
    const instances = values.slice(0, count).map((v) => v[0])
    return new G3dSubset(this._source, instances)
  }

  /**
   * Returns a new subset that only contains non-unique meshes.
   */
  filterNonUniqueMeshes () {
    return this.filterByCount((count) => count > 1)
  }

  private filterByCount (predicate: (i: number) => boolean) {
    const set = new Set<number>()
    this._meshInstances.forEach((instances, i) => {
      if (predicate(instances.length)) {
        set.add(this._meshes[i])
      }
    })
    const instances = this._instances.filter((instance) =>
      set.has(this._source.instanceMeshes[instance])
    )

    return new G3dSubset(this._source, instances)
  }

  /**
   * Returns offsets needed to build geometry.
   */
  getOffsets (section: MeshSection) {
    return new G3dMeshOffsets(this, section)
  }

  /**
   * Returns the count of each mesh attribute.
   */
  getAttributeCounts (section: MeshSection = 'all') {
    const result = new G3dMeshCounts()
    const count = this.getMeshCount()
    for (let i = 0; i < count; i++) {
      result.instances += this.getMeshInstanceCount(i)
      result.indices += this.getMeshIndexCount(i, section)
      result.vertices += this.getMeshVertexCount(i, section)
    }
    result.meshes = count

    return result
  }

  /**
   * Returns a new subset where the order of meshes is inverted.
   */
  reverse () {
    const reverse = [...this._instances].reverse()
    return new G3dSubset(this._source, reverse)
  }

  /**
   * Returns a new subset with instances not included in given filter.
   * @param mode Defines which field the filter will be applied to.
   * @param filter Array of all values to match for.
   */
  except (mode: FilterMode, filter: number[] | Set<number>): G3dSubset {
    return this._filter(mode, filter, false)
  }

  /**
   * Returns a new subset with instances matching given filter.
   * @param mode Defines which field the filter will be applied to.
   * @param filter Array of all values to match for.
   */
  filter (mode: FilterMode, filter: number[] | Set<number>): G3dSubset {
    return this._filter(mode, filter, true)
  }

  private _filter (
    mode: FilterMode,
    filter: number[] | Set<number>,
    has: boolean
  ): G3dSubset {
    if (filter === undefined || mode === undefined) {
      return new G3dSubset(this._source, undefined)
    }

    if (mode === 'instance') {
      const instances = this.filterOnArray(
        filter,
        this._source.instanceNodes,
        has
      )
      return new G3dSubset(this._source, instances)
    }

    if (mode === 'mesh') {
      const instances = this.filterOnArray(
        filter,
        this._source.instanceMeshes,
        has
      )
      return new G3dSubset(this._source, instances)
    }

    if (mode === 'tag' || mode === 'group') {
      throw new Error('Filter Mode Not implemented')
    }
  }

  private filterOnArray (
    filter: number[] | Set<number>,
    array: Int32Array,
    has: boolean = true
  ) {
    const set = filter instanceof Set ? filter : new Set(filter)
    const result = new Array<number>()
    for (const i of this._instances) {
      const value = array[i]
      if (set.has(value) === has && this._source.instanceMeshes[i] >= 0) {
        result.push(i)
      }
    }
    return result
  }

  /**
   * Return the bounding box of the current subset or undefined if subset is empty.
   */
  getBoundingBox () {
    if (this._instances.length === 0) return
    if (this._source instanceof G3dScene) {
      // To avoid including (0,0,0)
      const box = new THREE.Box3()
      const first = this._instances[0]
      box.min.fromArray(this._source.getInstanceMin(first))
      box.max.fromArray(this._source.getInstanceMax(first))

      for (let i = 1; i < this._instances.length; i++) {
        const instance = this._instances[i]
        minBox(box, this._source.getInstanceMin(instance))
        maxBox(box, this._source.getInstanceMax(instance))
      }
      return box
    }
  }

  /*
  getAverageBoundingBox () {
    if (this._instances.length === 0) return
    if (this._source instanceof G3dScene) {
      const center = new THREE.Vector3()
      const dist = new THREE.Vector3(1, 1, 1)

      const min = new THREE.Vector3()
      const max = new THREE.Vector3()
      const pos = new THREE.Vector3()

      // Compute center
      for (let i = 0; i < this._instances.length; i++) {
        const instance = this._instances[i]
        min.fromArray(this._source.getInstanceMin(instance))
        max.fromArray(this._source.getInstanceMax(instance))
        center.add(min).add(max)
      }
      center.divideScalar(2 * this._instances.length)

      // Compute average distance
      for (let i = 0; i < this._instances.length; i++) {
        const instance = this._instances[i]
        min.fromArray(this._source.getInstanceMin(instance))
        max.fromArray(this._source.getInstanceMax(instance))

        pos.copy(min).lerp(max, 0.5) // center
        pos.sub(center) // delta
        pos.set(Math.abs(pos.x), Math.abs(pos.y), Math.abs(pos.z)) // dist
        dist.add(pos)
      }
      dist.divideScalar(this._instances.length).multiplyScalar(5)

      return new THREE.Box3().setFromCenterAndSize(center, dist)
    }
  }
  */
}

function minBox (box: THREE.Box3, other: Float32Array) {
  box.min.x = Math.min(box.min.x, other[0])
  box.min.y = Math.min(box.min.y, other[1])
  box.min.z = Math.min(box.min.z, other[2])
}

function maxBox (box: THREE.Box3, other: Float32Array) {
  box.max.x = Math.max(box.max.x, other[0])
  box.max.y = Math.max(box.max.y, other[1])
  box.max.z = Math.max(box.max.z, other[2])
}
