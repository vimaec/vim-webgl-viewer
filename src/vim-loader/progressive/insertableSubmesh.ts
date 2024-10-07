/**
 * @module vim-loader
 */

import { Submesh } from '../mesh'
import { InsertableMesh } from './insertableMesh'

export class InsertableSubmesh {
  mesh: InsertableMesh
  index: number
  private _colors: Float32Array
  readonly merged = true

  constructor (mesh: InsertableMesh, index: number) {
    this.mesh = mesh
    this.index = index
  }

  equals (other: Submesh) {
    return this.mesh === other.mesh && this.index === other.index
  }

  /**
   * Returns parent three mesh.
   */
  get three () {
    return this.mesh.mesh
  }

  private get submesh () {
    return this.mesh.geometry.submeshes[this.index]
  }

  /**
   * Returns vim instance associated with this submesh.
   */
  get instance () {
    return this.submesh.instance
  }

  /**
   * Returns bounding box for this submesh.
   */
  get boundingBox () {
    return this.submesh.boundingBox
  }

  /**
   * Returns starting position in parent mesh for merged mesh.
   */
  get meshStart () {
    return this.submesh.start
  }

  /**
   * Returns ending position in parent mesh for merged mesh.
   */
  get meshEnd () {
    return this.submesh.end
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
