import { MeshSection } from 'vim-format'
import { G3dSubset } from './g3dSubset'

export class G3dMeshCounts {
  instances: number = 0
  meshes: number = 0
  indices: number = 0
  vertices: number = 0
}

/**
 * Holds the offsets needed to preallocate geometry for a given meshIndexSubset
 */
export class G3dMeshOffsets {
  // inputs
  readonly subset: G3dSubset
  readonly section: MeshSection

  // computed
  readonly counts: G3dMeshCounts
  private readonly _indexOffsets: Int32Array
  private readonly _vertexOffsets: Int32Array

  /**
   * Computes geometry offsets for given subset and section
   * @param subset subset for which to compute offsets
   * @param section 'opaque' | 'transparent' | 'all'
   */
  constructor (subset: G3dSubset, section: MeshSection) {
    this.subset = subset
    this.section = section

    this.counts = subset.getAttributeCounts(section)
    this._indexOffsets = this.computeOffsets(subset, (m) =>
      subset.getMeshIndexCount(m, section)
    )
    this._vertexOffsets = this.computeOffsets(subset, (m) =>
      subset.getMeshVertexCount(m, section)
    )
  }

  private computeOffsets (subset: G3dSubset, getter: (mesh: number) => number) {
    const meshCount = subset.getMeshCount()
    const offsets = new Int32Array(meshCount)

    for (let i = 1; i < meshCount; i++) {
      offsets[i] = offsets[i - 1] + getter(i - 1)
    }
    return offsets
  }

  /**
   * Returns the index offset for given mesh and its instances.
   * @param mesh subset-based mesh index
   */
  getIndexOffset (mesh: number) {
    return mesh < this.counts.meshes
      ? this._indexOffsets[mesh]
      : this.counts.indices
  }

  /**
   * Returns the vertex offset for given mesh and its instances.
   * @param mesh subset-based mesh index
   */
  getVertexOffset (mesh: number) {
    return mesh < this.counts.meshes
      ? this._vertexOffsets[mesh]
      : this.counts.vertices
  }

  /**
   * Returns instance counts of given mesh.
   * @param mesh subset-based mesh index
   */
  getMeshInstanceCount (mesh: number) {
    return this.subset.getMeshInstanceCount(mesh)
  }

  /**
   * Returns source-based instance for given mesh and index.
   * @mesh subset-based mesh index
   * @index mesh-based instance index
   */
  getMeshInstance (mesh: number, index: number) {
    return this.subset.getMeshInstance(mesh, index)
  }

  /**
   * Returns the source-based mesh index at given index
   */
  getSourceMesh (index: number) {
    return this.subset.getSourceMesh(index)
  }
}
