/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { Vim, VimMaterials } from '../vim'
import { Object } from '../vim-loader/object'
import { SignalDispatcher } from 'ste-signals'

/**
 * Provides selection behaviour for the viewer
 * Supports multi-selection as long as all objects are from the same vim.
 */
export class Selection {
  // State
  private _materials: VimMaterials
  private _objects = new Set<Object>()
  private _focusedObject: Object | undefined
  private _vim: Vim | undefined
  private _lastFocusTime: number = new Date().getTime()

  constructor (materials: VimMaterials) {
    this._materials = materials
  }

  // Disposable State
  private _onValueChanged = new SignalDispatcher()

  /**
   * Event called when selection changes or is cleared
   */
  get onValueChanged () {
    return this._onValueChanged.asEvent()
  }

  /**
   * Returns the vim from which elements are selected.
   * Cross-vim selection is not supported.
   */
  get vim () {
    return this._vim
  }

  /**
   * Returns first selected object.
   */
  get objects () {
    return this._objects.values()
  }

  /**
   * Returns the bounding box of the selection or undefined if no selection.
   * @param target box to use for result.
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
   * Adds focus highlight to a single object.
   * Pass undefined to remove highlight
   */
  focus (object: Object | undefined) {
    if (this._focusedObject === object) return

    if (this._focusedObject) this._focusedObject.focused = false
    if (object) object.focused = true
    this._focusedObject = object
    this._lastFocusTime = new Date().getTime()
    this._materials.applyFocusSettings(new THREE.Color(1, 1, 1), 0)
  }

  /**
   * Select given objects and unselect all other objects
   * using no or undefined as argument will clear selection.
   */
  select (object: Object | Object[] | undefined) {
    object =
      object === undefined ? [] : object instanceof Object ? [object] : object

    object = object.filter((o) => o)
    if (
      object.length === this._objects.size &&
      object.every((o) => this._objects.has(o))
    ) {
      // Value is unchanged, exit early.
      return
    }

    this._objects.forEach((o) => (o.selected = false))
    this._objects.clear()
    this._vim = undefined

    object?.forEach((o) => {
      this.clearOnNewVim(o.vim)
      this._objects.add(o)
      o.selected = true
    })
    this._onValueChanged.dispatch()
  }

  /**
   * Returns true if given object is currently selected
   */
  has (object: Object) {
    return this._objects.has(object)
  }

  /**
   * Returns current selection object count
   */
  get count () {
    return this._objects.size
  }

  /**
   * Adds given objects to the current selection
   */
  add (...objects: Object[]) {
    if (!objects) return
    if (objects.length === 0) return
    const count = this._objects.size
    const oldVim = this._vim
    objects.forEach((o) => {
      this.clearOnNewVim(o.vim)
      this._objects.add(o)
      o.selected = true
    })
    if (oldVim === this._vim && this._objects.size === count) return

    this._onValueChanged.dispatch()
  }

  /**
   * Remove given objects from the current selection
   */
  remove (...objects: Object[]) {
    if (!objects) return
    if (objects.length === 0) return
    const count = this._objects.size
    objects.forEach((o) => {
      o.selected = false
      this._objects.delete(o)
    })
    if (this._objects.size === count) return
    if (this._objects.size === 0) {
      this._vim = undefined
    }

    this._onValueChanged.dispatch()
  }

  /**
   * Adds unselected elements of given objects to the selection
   * Remove selected elements of given objects from the selection
   */
  toggle (...objects: Object[]) {
    if (!objects) return
    if (objects.length === 0) return
    const count = this._objects.size
    const oldVim = this.vim
    objects.forEach((o) => {
      if (this._objects.has(o)) {
        this._objects.delete(o)
        o.selected = false
      } else {
        this.clearOnNewVim(o.vim)
        this._objects.add(o)
        o.selected = true
      }
    })
    if (oldVim === this._vim && this._objects.size === count) return
    this._onValueChanged.dispatch()
  }

  /**
   * Clears selection
   */
  clear () {
    this._vim = undefined
    if (this._objects.size === 0) return
    this._objects.forEach((o) => (o.selected = false))
    this._objects.clear()
    this._onValueChanged.dispatch()
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

  onAnimate () {
    const time = new Date().getTime()
    const timeElapsed = time - this._lastFocusTime
    const focus = Math.min(timeElapsed / 100, 1)
    this._materials.applyFocusSettings(new THREE.Color(1, 1, 1), focus / 2)
  }
}
