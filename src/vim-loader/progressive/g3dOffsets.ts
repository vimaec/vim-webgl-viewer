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
  subset: G3dSubset
  section: MeshSection

  // computed
  counts: G3dMeshCounts
  indexOffsets: Int32Array
  vertexOffsets: Int32Array

  /**
   * Computes geometry offsets for given subset and section
   * @param subset subset for which to compute offsets
   * @param section on of 'opaque' | 'transparent' | 'all'
   */
  static fromSubset (subset: G3dSubset, section: MeshSection) {
    const result = new G3dMeshOffsets()
    result.subset = subset
    result.section = section

    function computeOffsets (getter: (mesh: number) => number) {
      const meshCount = subset.getMeshCount()
      const offsets = new Int32Array(meshCount)

      for (let i = 1; i < meshCount; i++) {
        offsets[i] = offsets[i - 1] + getter(i - 1)
      }
      return offsets
    }

    result.counts = subset.getAttributeCounts(section)
    result.indexOffsets = computeOffsets((m) =>
      subset.getMeshIndexCount(m, section)
    )
    result.vertexOffsets = computeOffsets((m) =>
      subset.getMeshVertexCount(m, section)
    )

    return result
  }

  getIndexOffset (mesh: number) {
    return mesh < this.counts.meshes
      ? this.indexOffsets[mesh]
      : this.counts.indices
  }

  getVertexOffset (mesh: number) {
    return mesh < this.counts.meshes
      ? this.vertexOffsets[mesh]
      : this.counts.vertices
  }

  /**
   * Returns how many instances of given meshes are the filtered view.
   */
  getMeshInstanceCount (mesh: number) {
    return this.subset.getMeshInstanceCount(mesh)
  }

  /**
   * Returns instance for given mesh.
   * @mesh view-relative mesh index
   * @at view-relative instance index for given mesh
   * @returns mesh-relative instance index
   */
  getMeshInstance (mesh: number, index: number) {
    return this.subset.getMeshInstance(mesh, index)
  }

  /**
   * Returns the vim-relative mesh index at given index
   */
  getMesh (index: number) {
    return this.subset.getMesh(index)
  }
}
