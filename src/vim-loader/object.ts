/**
 * @module vim-loader
 */

// External
import * as THREE from 'three'

// Vim
import { Geometry } from './geometry'
import { Vim } from './vim'
import { VimDocument, IElement, VimHelpers } from 'vim-format'
import { ObjectAttribute } from './objectAttributes'
import { ColorAttribute } from './colorAttributes'
import { Submesh } from './mesh'
import { IObject, ObjectType } from './objectInterface'

/**
 * High level api to interact with the loaded vim geometry and data.
 */
export class Object implements IObject {
  public readonly type: ObjectType = "Architectural"
  vim: Vim
  document: VimDocument
  element: number
  instances: number[] | undefined
  private _color: THREE.Color | undefined
  private _boundingBox: THREE.Box3 | undefined
  private _meshes: Submesh[] | undefined

  private _outlineAttribute: ObjectAttribute<boolean>
  private _visibleAttribute: ObjectAttribute<boolean>
  private _coloredAttribute: ObjectAttribute<boolean>
  private _focusedAttribute: ObjectAttribute<boolean>
  private _colorAttribute: ColorAttribute

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
  

  private get meshBuilder () {
    return this.vim.scene.builder.meshBuilder
  }

  /**
   * Returns true if this object has geometry
   */
  get hasMesh () {
    return (this._meshes?.length ?? 0) > 0
  }

  /**
   * Toggles selection outline for this object.
   * @param value true to show object, false to hide object.
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
   * Toggles focused highlight for this object.
   * @param value true to highlight object.
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
   * Toggles visibility of this object.
   * @param value true to show object, false to hide object.
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
   * Changes the display color of this object.
   * @param color Color to apply, undefined to revert to default color.
   */
  get color () {
    return this._color
  }

  set color (color: THREE.Color | undefined) {
    this._color = color
    this.vim.scene.setDirty()
    this._color = this._color
    this._coloredAttribute.apply(this._color !== undefined)
    this._colorAttribute.apply(this._color)
  }

  /**
   * Internal - Replace this object meshes and apply color as needed.
   */
  private updateMeshes (meshes: Submesh[] | undefined) {
    this._meshes = meshes
    this.vim.scene.setDirty()

    this._outlineAttribute.updateMeshes(meshes)
    this._visibleAttribute.updateMeshes(meshes)
    this._focusedAttribute.updateMeshes(meshes)
    this._coloredAttribute.updateMeshes(meshes)
    this._colorAttribute.updateMeshes(meshes)
  }

  /**
   * Internal - Replace this object meshes and apply color as needed.
   */
  addMesh (mesh: Submesh) {
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

  /**
   * Returns Bim data for the element associated with this object.
   * Returns undefined if no associated bim
   */
  getBimElement (): Promise<IElement> {
    return this.vim.bim.element.get(this.element)
  }

  /**
   * Returns Bim data for the element associated with this object.
   */
  getBimParameters (): Promise<VimHelpers.ElementParameter[]> {
    return VimHelpers.getElementParameters(this.vim.bim, this.element)
  }

  /**
   * Returns the element id of the element associated with this object
   */
  get elementId () {
    return this.vim.map.getElementId(this.element)
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
    if (!this.instances || !this.vim.g3d) return

    const wireframe = this.meshBuilder.createWireframe(
      this.vim.g3d,
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
    if (!this.instances || !this.vim.g3d) return

    const geometry = Geometry.createGeometryFromInstances(this.vim.g3d, {
      matrix: this.vim.settings.matrix,
      section: 'all',
      transparent: false,
      legacyInstances: this.instances,
      legacyLoadRooms: true
    })
    geometry?.applyMatrix4(this.vim.getMatrix())
    return geometry
  }
}

