/**
 * @module vim-loader
 */

import { Submesh } from '../mesh'
import { InstancedMesh } from './instancedMesh'

export class InstancedSubmesh {
  mesh: InstancedMesh
  index: number
  readonly merged = false

  constructor (mesh: InstancedMesh, index: number) {
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

  /**
   * Returns vim instance associated with this submesh.
   */
  get instance () {
    return this.mesh.bimInstances[this.index]
  }

  /**
   * Returns bounding box for this submesh.
   */
  get boundingBox () {
    return this.mesh.boxes[this.index]
  }

  /**
   * Returns vim object for this submesh.
   */
  get object () {
    return this.mesh.vim.getObjectFromInstance(this.instance)
  }
}
