/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { Vim, ViewerMaterials } from '..'
import { SignalDispatcher } from 'ste-signals'
import { GizmoMarker } from './gizmos/markers/gizmoMarker'
import { Object3D } from '../vim-loader/object3D'
import { Plan2D } from './gizmos/plan2D'

export type SelectableObject = Object3D | GizmoMarker | Plan2D

/**
 * Provides selection behaviour for the viewer
 * Supports multi-selection as long as all objects are from the same vim.
 */
export class Selection {
  // dependencies
  private _materials: ViewerMaterials

  // State
  private _objects = new Set<SelectableObject>()
  private _focusedObject: SelectableObject | undefined
  private _vim: Vim | undefined
  private _lastFocusTime: number = Date.now()

  // Disposable State
  private _onValueChanged = new SignalDispatcher()
  private _unsub: (() => void)[] = []

  constructor (materials: ViewerMaterials) {
    this._materials = materials
  }

  /**
   * Event called when selection changes or is cleared
   */
  get onValueChanged () {
    return this._onValueChanged.asEvent()
  }

  /**
   * Returns the Vim instance from which elements are selected.
   * Cross-Vim selection is not supported.
   */
  get vim () {
    return this._vim
  }

  /**
   * Returns selected object as an iterator.
   */
  get objects () {
    return this._objects.values()
  }

  /**
   * Retrieves the bounding box of the selection. Returns `undefined` if there's no selection.
   * @param {THREE.Box3} [target] Optional parameter to specify a box to use for the result.
   * @returns {THREE.Box3 | undefined} The bounding box of the selection or `undefined` if no selection exists.
   */
  getBoundingBox (
    target: THREE.Box3 = new THREE.Box3()
  ): THREE.Box3 | undefined {
    if (this._objects.size === 0) return
    let initialized = false
    for (const o of this._objects) {
      const other = o.getBoundingBox()
      if (!other) continue
      if (!initialized) {
        target.copy(other)
      } else {
        target.union(other)
      }
      initialized = true
    }
    if (!initialized) {
      return
    }
    return target
  }

  /**
   * Adds focus highlight to a single object. Pass `undefined` to remove the highlight.
   * @param {IObject | undefined} object The object to focus on, or `undefined` to remove the highlight.
   */
  focus (object: SelectableObject | undefined) {
    if (this._focusedObject === object) return

    if (this._focusedObject) this._focusedObject.focused = false
    if (object) object.focused = true
    this._focusedObject = object
    this._lastFocusTime = Date.now()
    this._materials.focusIntensity = 0
  }

  /**
   * Selects the given objects and unselects all other objects.
   * Pass `null`, `undefined`, or an empty array as argument to clear selection.
   * @param {IObject | IObject[] | undefined} object The object or array of objects to select,
   *        or `null`, `undefined`, or an empty array to clear the selection.
   */
  select (object: SelectableObject | SelectableObject[] | undefined) {
    object =
      object === undefined ? [] : Array.isArray(object) ? object : [object]

    object = object.filter((o) => o)
    if (
      object.length === this._objects.size &&
      object.every((o) => this._objects.has(o))
    ) {
      // Value is unchanged, exit early.
      return
    }

    this._objects.forEach((o) => (o.outline = false))
    this._objects.clear()
    this._vim = undefined

    object?.forEach((o) => {
      this.clearOnNewVim(o.vim)
      this._objects.add(o)
      o.outline = true
    })
    this._onValueChanged.dispatch()
  }

  /**
   * Returns true if the given object is currently selected.
   * @param {IObject} object The object to check for selection.
   * @returns {boolean} True if the object is selected, false otherwise.
   */
  has (object: SelectableObject) {
    return this._objects.has(object)
  }

  /**
   * Returns the current count of selected objects.
   */
  get count () {
    return this._objects.size
  }

  /**
   * Adds the given objects to the current selection.
   * @param {...IObject[]} objects The objects to add to the selection.
   */
  add (...objects: SelectableObject[]) {
    if (!objects) return
    if (objects.length === 0) return
    const count = this._objects.size
    const oldVim = this._vim
    objects.forEach((o) => {
      this.clearOnNewVim(o.vim)
      this._objects.add(o)
      o.outline = true
    })
    if (oldVim === this._vim && this._objects.size === count) return

    this._onValueChanged.dispatch()
  }

  /**
   * Removes the given objects from the current selection.
   * @param {...IObject[]} objects The objects to remove from the selection.
   */
  remove (...objects: SelectableObject[]) {
    if (!objects) return
    if (objects.length === 0) return
    const count = this._objects.size
    objects.forEach((o) => {
      o.outline = false
      this._objects.delete(o)
    })
    if (this._objects.size === count) return
    if (this._objects.size === 0) {
      this._vim = undefined
    }

    this._onValueChanged.dispatch()
  }

  /**
   * Toggles the selection state of the given objects:
   * - Adds unselected elements of the given objects to the selection.
   * - Removes selected elements of the given objects from the selection.
   * @param {...IObject[]} objects The objects to toggle selection for.
   */
  toggle (...objects: SelectableObject []) {
    if (!objects) return
    if (objects.length === 0) return
    const count = this._objects.size
    const oldVim = this.vim
    objects.forEach((o) => {
      if (this._objects.has(o)) {
        this._objects.delete(o)
        o.outline = false
      } else {
        this.clearOnNewVim(o.vim)
        this._objects.add(o)
        o.outline = true
      }
    })
    if (oldVim === this._vim && this._objects.size === count) return
    this._onValueChanged.dispatch()
  }

  /**
   * Clears the current selection.
   */
  clear () {
    this._vim = undefined
    if (this._objects.size === 0) return
    this._objects.forEach((o) => (o.outline = false))
    this._objects.clear()
    this._onValueChanged.dispatch()
  }

  /**
   * Disposes of all resources and stops animations.
   */
  dispose () {
    this._unsub.forEach((u) => u())
    this._unsub.length = 0
  }

  private clearOnNewVim (vim: Vim) {
    if (this._vim) {
      if (this._vim !== vim) {
        console.log('Cross vim selection. Clearing selection.')
        this._objects.clear()
        this._vim = vim
      }
    } else {
      this._vim = vim
    }
  }

  public update () {
    if (!this._focusedObject) return
    const time = Date.now()
    const timeElapsed = time - this._lastFocusTime
    const focus = Math.min(timeElapsed / 100, 1)
    this._materials.focusIntensity = focus / 2
  }
}
