import { InsertableMesh } from './insertableMesh'
import { InsertableGeometry } from './insertableGeometry'

export class InsertableSubmesh {
  mesh: InsertableMesh
  index: number
  private _colors: Float32Array

  constructor (mesh: InsertableMesh, index: number) {
    this.mesh = mesh
    this.index = index
  }

  /**
   * Returns parent three mesh.
   */
  get three () {
    return this.mesh.mesh
  }

  /**
   * True if parent mesh is merged.
   */
  get merged () {
    return this.mesh.merged
  }

  /**
   * Returns vim instance associated with this submesh.
   */
  get instance () {
    return this.index
  }

  /**
   * Returns bounding box for this submesh.
   */
  get boundingBox () {
    return this.mesh.geometry.submeshes.get(this.index).boundingBox
  }

  /**
   * Returns starting position in parent mesh for merged mesh.
   */
  get meshStart () {
    return this.mesh.geometry.submeshes.get(this.index).start
  }

  /**
   * Returns ending position in parent mesh for merged mesh.
   */
  get meshEnd () {
    return this.mesh.geometry.submeshes.get(this.index).end
  }

  /**
   * Returns vim object for this submesh.
   */
  get object () {
    return this.mesh.vim.getObjectFromInstance(this.instance)
  }

  saveColors (colors: Float32Array) {
    if (this._colors) return
    this._colors = colors
  }

  popColors () {
    const result = this._colors
    this._colors = undefined
    return result
  }
}
