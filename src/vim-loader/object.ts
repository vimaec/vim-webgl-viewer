/**
 * @module vim-loader
 */

// external
import * as THREE from 'three'
import { Geometry } from './geometry'
import { Vim } from './vim'
import { ObjectAttribute, ColorAttribute } from './objectAttributes'

export class VimMesh {
  mesh: THREE.Mesh
  ignoreSceneMaterial: boolean
  mat: THREE.Material | THREE.Material[]
  vim: Vim
  /**
   * bounding box of each instance
   */
  boxes: THREE.Box3[]
  merged: boolean
  /**
   * Indices of the g3d instances that went into creating the mesh
   */
  instances: number[]
  submeshes: number[]

  constructor (mesh: THREE.Mesh) {
    this.mesh = mesh
    this.mesh.userData.vim = this
  }

  static createMerged (
    mesh: THREE.Mesh,
    instances: number[],
    boxes: THREE.Box3[],
    submeshes: number[]
  ) {
    const result = new VimMesh(mesh)
    result.merged = true
    result.instances = instances
    result.boxes = boxes
    result.submeshes = submeshes
    return result
  }

  static createInstanced (
    mesh: THREE.Mesh,
    instances: number[],
    boxes: THREE.Box3[]
  ) {
    const result = new VimMesh(mesh)
    result.merged = false
    result.instances = instances
    result.boxes = boxes
    return result
  }

  getInstanceFromFace (faceIndex: number) {
    const index = this.binarySearch(this.submeshes, faceIndex * 3)
    return this.instances[index]
  }

  private binarySearch (array: number[], element: number) {
    let m = 0
    let n = array.length - 1
    while (m <= n) {
      const k = (n + m) >> 1
      const cmp = element - array[k]
      if (cmp > 0) {
        m = k + 1
      } else if (cmp < 0) {
        n = k - 1
      } else {
        return k
      }
    }
    return m - 1
  }
}

export class MeshInfo {
  ignoreSceneMaterial: boolean
  mat: THREE.Material | THREE.Material[]
  vim: Vim
  /**
   * bounding box of each instance
   */
  boxes: THREE.Box3[]
  merged: boolean
  /**
   * Indices of the g3d instances that went into creating the mesh
   */
  instances: number[]
  submeshes: number[]
  // userData.instances = number[]
  // userData.boxes = THREE.Box3[] ()
}

/**
 * High level api to interact with the loaded vim geometry and data.
 */
export class Object {
  vim: Vim
  element: number
  instances: number[] | undefined
  private _color: THREE.Color | undefined
  private _boundingBox: THREE.Box3 | undefined
  private _meshes: [THREE.Mesh, number][] | undefined

  private selectedAttribute: ObjectAttribute<boolean>
  private visibleAttribute: ObjectAttribute<boolean>
  private coloredAttribute: ObjectAttribute<boolean>
  private focusedAttribute: ObjectAttribute<boolean>
  private colorAttribute: ColorAttribute

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

    this.selectedAttribute = new ObjectAttribute(
      false,
      'selected',
      'selected',
      meshes,
      (v) => (v ? 1 : 0)
    )

    this.visibleAttribute = new ObjectAttribute(
      true,
      'ignore',
      'ignore',
      meshes,
      (v) => (v ? 0 : 1)
    )

    this.focusedAttribute = new ObjectAttribute(
      false,
      'focused',
      'focused',
      meshes,
      (v) => (v ? 1 : 0)
    )

    this.coloredAttribute = new ObjectAttribute(
      false,
      'colored',
      'colored',
      meshes,
      (v) => (v ? 1 : 0)
    )

    this.colorAttribute = new ColorAttribute(meshes, undefined, vim)
  }

  private get meshBuilder () {
    return this.vim.scene.builder.meshBuilder
  }

  /**
   * Returns true if this object has geometry
   */
  get hasMesh () {
    return this._meshes?.length!!
  }

  /**
   * Toggles selection outline for this object.
   * @param value true to show object, false to hide object.
   */
  get outline () {
    return this.selectedAttribute.value
  }

  set outline (value: boolean) {
    if (this.selectedAttribute.apply(value)) {
      if (value) this.vim.scene.addOutline()
      else this.vim.scene.removeOutline()
    }
  }

  /**
   * Toggles focused highlight for this object.
   * @param value true to highlight object.
   */
  get focused () {
    return this.focusedAttribute.value
  }

  set focused (value: boolean) {
    this.vim.scene.updated = this.focusedAttribute.apply(value)
  }

  /**
   * Toggles visibility of this object.
   * @param value true to show object, false to hide object.
   */
  get visible () {
    return this.visibleAttribute.value
  }

  set visible (value: boolean) {
    this.vim.scene.updated = this.visibleAttribute.apply(value)
  }

  /**
   * Changes the display color of this object.
   * @param color Color to apply, undefined to revert to default color.
   */
  get color () {
    return this.colorAttribute.value
  }

  set color (color: THREE.Color | undefined) {
    if (
      !this._color || !color
        ? !this._color && !color
        : this._color.equals(color)
    ) {
      return
    }
    this.vim.scene.updated = true
    this._color = color
    this.coloredAttribute.apply(color !== undefined)
    this.colorAttribute.apply(color)
  }

  /**
   * Internal - Replace this object meshes and apply color as needed.
   */
  updateMeshes (meshes: [THREE.Mesh, number][] | undefined) {
    this._meshes = meshes
    if (!meshes) return
    this.vim.scene.updated = true
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

  /**
   * Returns the element id of the element associated with this object
   */
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
      const info = mesh.userData as MeshInfo
      const b = info.boxes[index]
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
}
