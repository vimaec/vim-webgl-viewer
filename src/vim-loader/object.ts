/**
 * @module vim-loader
 */

// external
import * as THREE from 'three'
import { Vim } from './vim'
import { Mesh } from './mesh'
import { Geometry } from './geometry'

/**
 * High level api to interact with the loaded vim geometry and data.
 */
export class Object {
  vim: Vim
  element: number
  instances: number[]
  private _color: THREE.Color | undefined
  private _boundingBox: THREE.Box3 | undefined
  private _meshes: [THREE.Mesh, number][]

  constructor (
    vim: Vim,
    element: number,
    instances: number[],
    meshes: [THREE.Mesh, number][]
  ) {
    this.vim = vim
    this.element = element
    this.instances = instances
    this._meshes = meshes
  }

  get color () {
    return this._color
  }

  /**
   * Internal - Replace this object meshes and apply color as needed.
   */
  updateMeshes (meshes: [THREE.Mesh, number][]) {
    this._meshes = meshes
    if (meshes) {
      for (let i = 0; i < meshes.length; i++) {
        if (this.color) {
          this.changeColor(this.color)
        }
      }
    }
  }

  /**
   * Returns Bim data for the element associated with this object.
   */
  getBimElement () {
    return this.vim.document.getElement(this.element)
  }

  /**
   * returns the bounding box of the object from cache or computed if needed.
   */
  getBoundingBox () {
    if (this._boundingBox) return this._boundingBox

    const geometry = Geometry.createGeometryFromInstances(
      this.vim.document.g3d,
      this.instances
    )
    geometry.applyMatrix4(this.vim.getMatrix())

    geometry.computeBoundingBox()
    this._boundingBox = geometry.boundingBox
    geometry.dispose()
    return this._boundingBox
  }

  /**
   * Returns the center position of this object
   * @param target Vector3 where to copy data. A new instance is created if none provided.
   */
  public getCenter (target: THREE.Vector3 = new THREE.Vector3()) {
    return this.getBoundingBox().getCenter(target)
  }

  /**
   * returns the bounding sphere of the object from cache or computed if needed.
   */
  getBoundingSphere (target: THREE.Sphere = new THREE.Sphere()) {
    return this.getBoundingBox().getBoundingSphere(target)
  }

  /**
   * Creates a new three wireframe Line object from the object geometry
   */
  createWireframe () {
    const wireframe = Mesh.getDefaultBuilder().createWireframe(
      this.vim.document.g3d,
      this.instances
    )
    wireframe.applyMatrix4(this.vim.getMatrix())
    return wireframe
  }

  /**
   * Changes the display color of this object.
   * @param color Color to apply, undefined to revert to default color.
   */
  changeColor (color: THREE.Color | undefined = undefined) {
    this._color = color
    if (!this._meshes) return

    for (let m = 0; m < this._meshes.length; m++) {
      const [mesh, index] = this._meshes[m]
      if (mesh.userData.merged) {
        this.changeMergedMeshColor(mesh, index, color)
      } else {
        this.changeInstancedMeshColor(mesh as THREE.InstancedMesh, index, color)
      }
    }
  }

  /**
   * NOT READY YET
   * Toggles visibility of this object.
   * @param value true to show object, false to hide object.

  show (value: boolean) {
    for (let m = 0; m < this.meshes.length; m++) {
      const [mesh, index] = this.meshes[m]
      if (mesh.userData.merged) {
        this.showMerged()
      } else {
        if (value) this.showInstanced(mesh as THREE.InstancedMesh, index)
        else this.hideInstanced(mesh as THREE.InstancedMesh, index)
      }
    }
  }
  */

  /**
   * @param index index of the merged mesh instance
   * @returns inclusive first index of the index buffer related to given merged mesh index
   */
  private getMergedMeshStart (mesh: THREE.Mesh, index: number) {
    return mesh.userData.submeshes[index]
  }

  /**
   * @param index index of the merged mesh instance
   * @returns return the last+1 index of the index buffer related to given merged mesh index
   */
  private getMergedMeshEnd (mesh: THREE.Mesh, index: number) {
    return index + 1 < mesh.userData.submeshes.length
      ? mesh.userData.submeshes[index + 1]
      : mesh.geometry.getIndex().count
  }

  /**
   * Writes new color to the appropriate section of merged mesh color buffer.
   * @param index index of the merged mesh instance
   * @param color rgb representation of the color to apply
   */
  private changeMergedMeshColor (
    mesh: THREE.Mesh,
    index: number,
    color: THREE.Color | undefined
  ) {
    if (!color) {
      this.resetMergedMeshColor(mesh, index)
      return
    }

    const start = this.getMergedMeshStart(mesh, index)
    const end = this.getMergedMeshEnd(mesh, index)

    const colors = mesh.geometry.getAttribute('color')
    const uvs = mesh.geometry.getAttribute('uv')
    const indices = mesh.geometry.getIndex()

    for (let i = start; i < end; i++) {
      const v = indices.getX(i)
      // alpha is left to its current value
      colors.setXYZ(v, color.r, color.g, color.b)
      uvs.setY(v, 0)
    }
    colors.needsUpdate = true
    uvs.needsUpdate = true
  }

  /**
   * Repopulates the color buffer of the merged mesh from original g3d data.
   * @param index index of the merged mesh instance
   */
  private resetMergedMeshColor (mesh: THREE.Mesh, index: number) {
    const colors = mesh.geometry.getAttribute('color')
    const uvs = mesh.geometry.getAttribute('uv')
    const indices = mesh.geometry.getIndex()
    let mergedIndex = this.getMergedMeshStart(mesh, index)

    const instance = this.vim.scene.getInstanceFromMesh(mesh, index)
    const g3d = this.vim.document.g3d
    const g3dMesh = g3d.instanceMeshes[instance]
    const subStart = g3d.getMeshSubmeshStart(g3dMesh)
    const subEnd = g3d.getMeshSubmeshEnd(g3dMesh)

    for (let sub = subStart; sub < subEnd; sub++) {
      const start = g3d.getSubmeshIndexStart(sub)
      const end = g3d.getSubmeshIndexEnd(sub)
      const color = g3d.getSubmeshColor(sub)
      for (let i = start; i < end; i++) {
        const v = indices.getX(mergedIndex)
        colors.setXYZ(v, color[0], color[1], color[2])
        uvs.setY(v, 1)
        mergedIndex++
      }
    }
    colors.needsUpdate = true
    uvs.needsUpdate = true
  }

  /**
   * Adds an instanceColor buffer to the instanced mesh and sets new color for given instance
   * @param index index of the instanced instance
   * @param color rgb representation of the color to apply
   */
  private changeInstancedMeshColor (
    mesh: THREE.InstancedMesh,
    index: number,
    color: THREE.Color
  ) {
    if (!mesh.instanceColor) {
      // Add color instance attribute
      const colorSize = mesh.geometry.getAttribute('color').itemSize
      const colors = new Float32Array(mesh.count * colorSize)
      colors.fill(1)
      mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 4)

      // Add custom useVertexColor instance attribute
      const useVertexColor = new Float32Array(mesh.count)
      useVertexColor.fill(1)
      mesh.geometry.setAttribute(
        'useVertexColor',
        new THREE.InstancedBufferAttribute(useVertexColor, 1)
      )
    }
    if (color) {
      // Set instance to use instance color provided
      mesh.instanceColor.setXYZW(index, color.r, color.g, color.b, 1)
      mesh.geometry.getAttribute('useVertexColor').setX(index, 0)
    } else {
      // Revert to vertex color
      mesh.geometry.getAttribute('useVertexColor').setX(index, 1)
    }

    // Set attributes dirty
    mesh.geometry.getAttribute('useVertexColor').needsUpdate = true
    mesh.instanceColor.needsUpdate = true
  }

  /**
   * Sends the given instance past instanced mesh count to hide it.
   */
  private hideInstanced (mesh: THREE.InstancedMesh, index: number) {
    this.vim.scene.swapInstances(mesh, index, mesh.count - 1)
    mesh.count--
  }

  /**
   * Sends the given instance before mesh count to show it.
   */
  private showInstanced (mesh: THREE.InstancedMesh, index: number) {
    this.vim.scene.swapInstances(mesh, index, mesh.instanceMatrix.count - 1)
    mesh.count++
  }

  private showMerged () {
    throw new Error('Show Hide not yet implemented for merged meshes')
  }
}
