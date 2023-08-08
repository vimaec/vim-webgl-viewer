import { InstancedMesh } from './instancedMesh'

export class InstancedSubmesh {
  mesh: InstancedMesh
  index: number

  constructor (mesh: InstancedMesh, index: number) {
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
    return this.mesh.instances[this.index]
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
