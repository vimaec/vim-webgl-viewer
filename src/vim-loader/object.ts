/**
 * @module vim-loader
 */

// external
import * as THREE from 'three'
import { Geometry } from './geometry'
import {
  BufferAttribute,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh
} from 'three'
import { Vim } from './vim'

/**
 * High level api to interact with the loaded vim geometry and data.
 */
export class Object {
  vim: Vim
  element: number
  instances: number[] | undefined
  private _color: THREE.Color | undefined
  private _visible: boolean = true
  private _boundingBox: THREE.Box3 | undefined
  private _meshes: [THREE.Mesh, number][] | undefined

  constructor (
    vim: Vim,
    element: number,
    instances: number[] | undefined,
    meshes: [THREE.Mesh, number][] | undefined
  ) {
    this.vim = vim
    this.element = element
    this.instances = instances
    this._meshes = meshes
  }

  private get meshBuilder () {
    return this.vim.scene.builder.meshBuilder
  }

  get hasMesh () {
    return this._meshes?.length!!
  }

  /**
   * Internal - Replace this object meshes and apply color as needed.
   */
  updateMeshes (meshes: [THREE.Mesh, number][] | undefined) {
    this._meshes = meshes
    if (!meshes) return

    // if there was a color override reapply to new meshes.
    if (this.color) {
      this.color = this._color
    }
  }

  /**
   * Returns Bim data for the element associated with this object.
   * Returns undefined if no associated bim
   */
  getBimElement () {
    return this.vim.document.getElement(this.element)
  }

  /**
   * Returns Bim data for the element associated with this object.
   */
  async getBimElementValue (field: string, resolveString: boolean) {
    const value = await this.vim.document.getElementValue(this.element, field)
    if (!value) return
    return resolveString ? this.vim.document.getString(value) : value
  }

  /**
   * Returns Bim data for the element associated with this object.
   */
  async getBimParameters () {
    return await this.vim.document.getElementParameters(this.element)
  }

  get elementId () {
    return this.vim.document.getElementId(this.element)
  }

  /**
   * returns the bounding box of the object from cache or computed if needed.
   * Returns undefined if object has no geometry.
   */
  getBoundingBox () {
    if (!this.instances || !this._meshes) return
    if (this._boundingBox) return this._boundingBox

    let box: THREE.Box3 | undefined
    this._meshes.forEach((m) => {
      const [mesh, index] = m
      const b = mesh.userData.boxes[index]
      box = box ? box.union(b) : b.clone()
    })
    if (box) {
      box.applyMatrix4(this.vim.getMatrix())
      this._boundingBox = box
    }

    return this._boundingBox
  }

  /**
   * Returns the center position of this object
   * @param target Vector3 where to copy data. A new instance is created if none provided.
   * Returns undefined if object has no geometry.
   */
  public getCenter (target: THREE.Vector3 = new THREE.Vector3()) {
    return this.getBoundingBox()?.getCenter(target)
  }

  /**
   * Creates a new three wireframe Line object from the object geometry
   */
  createWireframe () {
    if (!this.instances || !this.vim.document.g3d) return

    const wireframe = this.meshBuilder.createWireframe(
      this.vim.document.g3d,
      this.instances
    )
    wireframe?.applyMatrix4(this.vim.getMatrix())
    return wireframe
  }

  /**
   * Creates a new THREE.BufferGeometry for this object
   * Returns undefined if object has no geometry.
   */
  createGeometry () {
    if (!this.instances || !this.vim.document.g3d) return

    const geometry = Geometry.createGeometryFromInstances(
      this.vim.document.g3d,
      this.instances
    )
    geometry?.applyMatrix4(this.vim.getMatrix())
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
    this.vim.scene.visibilityChanged = true
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
      : mesh.geometry.index!.count
  }

  /**
   * Writes new color to the appropriate section of merged mesh color buffer.
   * @param index index of the merged mesh instance
   * @param color rgb representation of the color to apply
   */
  private applyMergedVisible (mesh: THREE.Mesh, index: number, show: boolean) {
    const positions = mesh.geometry.getAttribute('position')
    const attribute =
      mesh.geometry.getAttribute('ignoreVertex') ??
      new Float32BufferAttribute(new Float32Array(positions.count), 1)
    mesh.geometry.setAttribute('ignoreVertex', attribute)

    const start = this.getMergedMeshStart(mesh, index)
    const end = this.getMergedMeshEnd(mesh, index)
    const indices = mesh.geometry.index!

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
    const colored = this.getOrAddColoredAttribute(mesh)
    const indices = mesh.geometry.index!

    for (let i = start; i < end; i++) {
      const v = indices.getX(i)
      // alpha is left to its current value
      colors.setXYZ(v, color.r, color.g, color.b)
      colored.setX(v, 1)
    }
    colors.needsUpdate = true
    colored.needsUpdate = true
  }

  /**
   * Repopulates the color buffer of the merged mesh from original g3d data.
   * @param index index of the merged mesh instance
   */
  private resetMergedColor (mesh: THREE.Mesh, index: number) {
    if (!this.vim.document.g3d) return
    const colors = mesh.geometry.getAttribute('color')
    const colored = this.getOrAddColoredAttribute(mesh)
    const indices = mesh.geometry.index!
    let mergedIndex = this.getMergedMeshStart(mesh, index)

    const instance = this.vim.scene.getInstanceFromMesh(mesh, index)
    if (!instance) throw new Error('Could not reset original color.')
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
        colored.setX(v, 0)
        mergedIndex++
      }
    }
    colors.needsUpdate = true
    colored.needsUpdate = true
  }

  /**
   * Adds an instanceColor buffer to the instanced mesh and sets new color for given instance
   * @param index index of the instanced instance
   * @param color rgb representation of the color to apply
   */
  private applyInstancedColor (
    mesh: THREE.InstancedMesh,
    index: number,
    color: THREE.Color | undefined
  ) {
    const colors = this.getOrAddInstanceColorAttribute(mesh)
    const colored = this.getOrAddColoredAttribute(mesh)
    if (color) {
      // Set instance to use instance color provided
      colors.setXYZ(index, color.r, color.g, color.b)
      colored.setX(index, 1)
    } else {
      // Revert to vertex color
      colored.setX(index, 0)
    }

    // Set attributes dirty
    colored.needsUpdate = true
    colors.needsUpdate = true
  }

  private getOrAddInstanceColorAttribute (mesh: THREE.InstancedMesh) {
    if (mesh.instanceColor) return mesh.instanceColor
    const count = mesh.instanceMatrix.count
    // Add color instance attribute
    const colors = new Float32Array(count * 3)
    const attribute = new THREE.InstancedBufferAttribute(colors, 3)
    mesh.instanceColor = attribute
    return attribute
  }

  private getOrAddColoredAttribute (mesh: THREE.Mesh) {
    const colored = mesh.geometry.getAttribute('colored')
    if (colored) {
      return colored
    }

    const count =
      mesh instanceof InstancedMesh
        ? mesh.instanceMatrix.count
        : mesh.geometry.getAttribute('position').count

    const array = new Float32Array(count)
    const attribute =
      mesh instanceof InstancedMesh
        ? new THREE.InstancedBufferAttribute(array, 1)
        : new BufferAttribute(array, 1)

    // Add custom colored instance attribute
    mesh.geometry.setAttribute('colored', attribute)

    return attribute
  }
}
