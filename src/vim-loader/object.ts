/**
 * @module vim-loader
 */

// external
import * as THREE from 'three'
import { Mesh } from './mesh'
import { Geometry } from './geometry'
import { Float32BufferAttribute, InstancedBufferAttribute } from 'three'
import { Vim } from './vim'

/**
 * High level api to interact with the loaded vim geometry and data.
 */
export class Object {
  vim: Vim
  element: number
  instances: number[]
  private _color: THREE.Color | undefined
  private _visible: boolean = true
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

  get hasMesh () {
    return this._meshes?.length!!
  }

  /**
   * Internal - Replace this object meshes and apply color as needed.
   */
  updateMeshes (meshes: [THREE.Mesh, number][]) {
    this._meshes = meshes
    if (!meshes) return

    // if there was a color override reapply to new meshes.
    if (this.color) {
      this.color = this._color
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
    if (!this._meshes) return
    const wireframe = Mesh.getDefaultBuilder().createWireframe(
      this.vim.document.g3d,
      this.instances
    )
    wireframe.applyMatrix4(this.vim.getMatrix())
    return wireframe
  }

  createGeometry () {
    if (!this._meshes) return
    const geometry = Geometry.createGeometryFromInstances(
      this.vim.document.g3d,
      this.instances
    )
    geometry.applyMatrix4(this.vim.getMatrix())
    return geometry
  }

  /**
   * Changes the display color of this object.
   * @param color Color to apply, undefined to revert to default color.
   */
  get color () {
    return this._color
  }

  set color (color: THREE.Color | undefined) {
    if (
      !this._color || !color
        ? !this._color && !color
        : this._color.equals(color)
    ) {
      return
    }
    this._color = color
    this.applyColor(color)
  }

  private applyColor (color: THREE.Color | undefined) {
    if (!this._meshes) return

    for (let m = 0; m < this._meshes.length; m++) {
      const [mesh, index] = this._meshes[m]
      if (mesh.userData.merged) {
        this.applyMergedColor(mesh, index, color)
      } else {
        this.applyInstancedColor(mesh as THREE.InstancedMesh, index, color)
      }
    }
  }

  /**
   * Toggles visibility of this object.
   * @param value true to show object, false to hide object.
   */
  get visible () {
    return this._visible
  }

  set visible (value: boolean) {
    if (this._visible === value) return
    this._visible = value
    this.applyVisible(value)
  }

  private applyVisible (value: boolean) {
    if (!this._meshes) return

    for (let m = 0; m < this._meshes.length; m++) {
      const [mesh, index] = this._meshes[m]
      if (mesh.userData.merged) {
        this.applyMergedVisible(mesh, index, value)
      } else {
        this.applyInstancedVisible(mesh as THREE.InstancedMesh, index, value)
      }
    }
  }

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
  private applyMergedVisible (mesh: THREE.Mesh, index: number, show: boolean) {
    const attribute =
      mesh.geometry.getAttribute('ignoreVertex') ??
      new Float32BufferAttribute(
        new Float32Array(mesh.geometry.index.count * 3),
        1
      )
    mesh.geometry.setAttribute('ignoreVertex', attribute)

    const start = this.getMergedMeshStart(mesh, index)
    const end = this.getMergedMeshEnd(mesh, index)
    const indices = mesh.geometry.getIndex()

    for (let i = start; i < end; i++) {
      const v = indices.getX(i)
      attribute.setX(v, show ? 0 : 1)
    }
    attribute.needsUpdate = true
  }

  /**
   * Adds an ignoreInstance buffer to the instanced mesh and sets values to 1 to hide instances
   * @param index index of the instanced instance
   */
  private applyInstancedVisible (
    mesh: THREE.InstancedMesh,
    index: number,
    visible: boolean
  ) {
    let attribute = mesh.geometry.getAttribute('ignoreInstance')
    if (!attribute) {
      attribute = new InstancedBufferAttribute(new Float32Array(mesh.count), 1)
      mesh.geometry.setAttribute('ignoreInstance', attribute)
    }

    attribute.setX(index, visible ? 0 : 1)
    attribute.needsUpdate = true
  }

  /**
   * Writes new color to the appropriate section of merged mesh color buffer.
   * @param index index of the merged mesh instance
   * @param color rgb representation of the color to apply
   */
  private applyMergedColor (
    mesh: THREE.Mesh,
    index: number,
    color: THREE.Color | undefined
  ) {
    if (!color) {
      this.resetMergedColor(mesh, index)
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
  private resetMergedColor (mesh: THREE.Mesh, index: number) {
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
  private applyInstancedColor (
    mesh: THREE.InstancedMesh,
    index: number,
    color: THREE.Color
  ) {
    if (!mesh.instanceColor) {
      this.addColorAttributes(mesh)
    }
    const ignoreVertexColor = mesh.geometry.getAttribute('ignoreVertexColor')
    if (color) {
      // Set instance to use instance color provided
      mesh.instanceColor.setXYZ(index, color.r, color.g, color.b)
      ignoreVertexColor.setX(index, 1)
    } else {
      // Revert to vertex color
      ignoreVertexColor.setX(index, 0)
    }

    // Set attributes dirty
    ignoreVertexColor.needsUpdate = true
    mesh.instanceColor.needsUpdate = true
    // mesh.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 1, 0) })
  }

  private addColorAttributes (mesh: THREE.InstancedMesh) {
    const count = mesh.instanceMatrix.count
    // Add color instance attribute
    const colors = new Float32Array(count * 3)
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3)

    // Add custom ignoreVertexColor instance attribute
    const ignoreVertexColor = new Float32Array(count)
    mesh.geometry.setAttribute(
      'ignoreVertexColor',
      new THREE.InstancedBufferAttribute(ignoreVertexColor, 1)
    )
  }
}
