/**
 * @module vim-loader
 */

// External
import * as THREE from 'three'

// Vim
import { Vim } from './vim'
import { IElement, VimHelpers } from 'vim-format'
import { ObjectAttribute } from './objectAttributes'
import { ColorAttribute } from './colorAttributes'
import { Submesh } from './mesh'
import { IObject, ObjectType } from './objectInterface'

/**
 * High level api to interact with the loaded vim geometry and data.
 */
export class Object implements IObject {
  private _color: THREE.Color | undefined
  private _boundingBox: THREE.Box3 | undefined
  private _meshes: Submesh[] | undefined

  private _outlineAttribute: ObjectAttribute<boolean>
  private _visibleAttribute: ObjectAttribute<boolean>
  private _coloredAttribute: ObjectAttribute<boolean>
  private _focusedAttribute: ObjectAttribute<boolean>
  private _colorAttribute: ColorAttribute

  /**
   * Indicate whether this object is architectural or markup.
   */
  public readonly type: ObjectType = 'Architectural'

  /**
   * The vim object from which this object came from.
   */
  readonly vim: Vim

  /**
   * The bim element index associated with this object.
   */
  readonly element: number

  /**
   * The ID of the element associated with this object.
   */
  get elementId () : bigint {
    return this.vim.map.getElementId(this.element)
  }

  /**
   * The geometry instances  associated with this object.
   */
  readonly instances: number[] | undefined

  /**
   * Checks if this object has associated geometry.
   * @returns {boolean} True if this object has geometry, otherwise false.
   */
  get hasMesh () {
    return (this._meshes?.length ?? 0) > 0
  }

  /**
   * Determines whether to render selection outline for this object or not.
   */
  get outline () {
    return this._outlineAttribute.value
  }

  set outline (value: boolean) {
    if (this._outlineAttribute.apply(value)) {
      if (value) this.vim.scene.addOutline()
      else this.vim.scene.removeOutline()
    }
  }

  /**
   * Determines whether to render focus highlight for this object or not.
   */
  get focused () {
    return this._focusedAttribute.value
  }

  set focused (value: boolean) {
    if (this._focusedAttribute.apply(value)) {
      this.vim.scene.setDirty()
    }
  }

  /**
   * Determines whether to render this object or not.
   */
  get visible () {
    return this._visibleAttribute.value
  }

  set visible (value: boolean) {
    if (this._visibleAttribute.apply(value)) {
      this.vim.scene.setDirty()
    }
  }

  /**
   * Gets or sets the display color of this object.
   * @param {THREE.Color | undefined} color The color to apply. Pass undefined to revert to the default color.
   * @returns {THREE.Color} The current color of the object.
   */
  get color () {
    return this._color
  }

  set color (color: THREE.Color | undefined) {
    this._color = color
    this.vim.scene.setDirty()
    this._coloredAttribute.apply(this._color !== undefined)
    this._colorAttribute.apply(this._color)
  }

  /**
   * Constructs a new instance of Object.
   * @param {Vim} vim The Vim instance.
   * @param {number} element The element index.
   * @param {number[] | undefined} instances An optional array of instance numbers.
   * @param {Submesh[] | undefined} meshes An optional array of submeshes.
   */
  constructor (
    vim: Vim,
    element: number,
    instances: number[] | undefined,
    meshes: Submesh[] | undefined
  ) {
    this.vim = vim
    this.element = element
    this.instances = instances
    this._meshes = meshes

    this._outlineAttribute = new ObjectAttribute(
      false,
      'selected',
      'selected',
      meshes,
      (v) => (v ? 1 : 0)
    )

    this._visibleAttribute = new ObjectAttribute(
      true,
      'ignore',
      'ignore',
      meshes,
      (v) => (v ? 0 : 1)
    )

    this._focusedAttribute = new ObjectAttribute(
      false,
      'focused',
      'focused',
      meshes,
      (v) => (v ? 1 : 0)
    )

    this._coloredAttribute = new ObjectAttribute(
      false,
      'colored',
      'colored',
      meshes,
      (v) => (v ? 1 : 0)
    )

    this._colorAttribute = new ColorAttribute(meshes, undefined, vim)
  }

  /**
   * Asynchronously retrieves Bim data for the element associated with this object.
   * @returns {IElement} An object containing the bim data for this element.
   */
  async getBimElement (): Promise<IElement> {
    return this.vim.bim.element.get(this.element)
  }

  /**
   * Asynchronously retrieves Bim parameters for the element associated with this object.
   * @returns {VimHelpers.ElementParameter[]} An array of all bim parameters for this elements.
   */
  async getBimParameters (): Promise<VimHelpers.ElementParameter[]> {
    return VimHelpers.getElementParameters(this.vim.bim, this.element)
  }

  /**
   * Retrieves the bounding box of the object from cache or computes it if needed.
   * Returns undefined if the object has no geometry.
   * @returns {THREE.Box3 | undefined} The bounding box of the object, or undefined if the object has no geometry.
   */
  getBoundingBox () {
    if (!this.instances || !this._meshes) return
    if (this._boundingBox) return this._boundingBox

    let box: THREE.Box3 | undefined
    this._meshes.forEach((m) => {
      const sub = m
      const b = sub.boundingBox
      box = box ? box.union(b) : b.clone()
    })
    if (box) {
      box.applyMatrix4(this.vim.getMatrix())
      this._boundingBox = box
    }

    return this._boundingBox
  }

  /**
   * Retrieves the center position of this object.
   * @param {THREE.Vector3} [target=new THREE.Vector3()] Optional parameter specifying where to copy the center position data.
   * A new instance is created if none is provided.
   * @returns {THREE.Vector3 | undefined} The center position of the object, or undefined if the object has no geometry.
   */
  public getCenter (target: THREE.Vector3 = new THREE.Vector3()) {
    return this.getBoundingBox()?.getCenter(target)
  }

  /**
   * Internal method used to replace this object's meshes and apply color as needed.
   * @param {Submesh} mesh The new mesh to be added.
   * @throws {Error} Throws an error if the provided mesh instance does not match any existing instances.
   */
  _addMesh (mesh: Submesh) {
    if (this.instances.findIndex((i) => i === mesh.instance) < 0) {
      throw new Error('Cannot update mismatched instance')
    }

    if (this._meshes) {
      if (this._meshes.findIndex((m) => m.equals(mesh)) < 0) {
        this._meshes.push(mesh)
        this.updateMeshes(this._meshes)
      }
    } else {
      this._meshes = [mesh]
      this.updateMeshes(this._meshes)
    }
  }

  private updateMeshes (meshes: Submesh[] | undefined) {
    this._meshes = meshes
    this.vim.scene.setDirty()

    this._outlineAttribute.updateMeshes(meshes)
    this._visibleAttribute.updateMeshes(meshes)
    this._focusedAttribute.updateMeshes(meshes)
    this._coloredAttribute.updateMeshes(meshes)
    this._colorAttribute.updateMeshes(meshes)
  }
}
