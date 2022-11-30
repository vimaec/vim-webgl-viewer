/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { Vim } from '../vim'
import { Object } from '../vim-loader/object'
import { Renderer } from './renderer'
import { SignalDispatcher } from 'ste-signals'

/**
 * Provides selection behaviour for the viewer
 * Supports multi-selection as long as all objects are from the same vim.
 */
export class Selection {
  // Dependencies
  private _renderer: Renderer

  // State
  private _objects = new Set<Object>()
  private _vim: Vim | undefined

  // Disposable State
  private _selectionMesh: THREE.LineSegments | undefined
  private _focusMesh: THREE.Mesh | undefined
  private _focusMaterial: THREE.Material
  private _focusStart: number = 0

  private _onValueChanged = new SignalDispatcher()

  /**
   * Event called when selection changes or is cleared
   */
  get onValueChanged () {
    return this._onValueChanged.asEvent()
  }

  constructor (renderer: Renderer) {
    this._renderer = renderer
    this._focusMaterial = renderer.materials.focus
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
    if (this._focusMesh) {
      this._focusMesh.geometry.dispose()
      this._renderer.remove(this._focusMesh)
    }

    this._focusMaterial.opacity = 0
    this._focusStart = new Date().getTime()

    if (!object) return
    const geometry = object.createGeometry()
    if (geometry) {
      this._focusMesh = new THREE.Mesh(geometry, this._focusMaterial)
      this._renderer.add(this._focusMesh)
      this.focusTransition()
    }
  }

  private focusTransition () {
    const t = (new Date().getTime() - this._focusStart) / 90
    this._focusMaterial.opacity = t * 0.15
    if (t < 1) {
      requestAnimationFrame(() => this.focusTransition())
    }
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

    this._objects.clear()
    this._vim = undefined

    object?.forEach((o) => {
      this.clearOnNewVim(o.vim)
      this._objects.add(o)
    })
    this.updateHighlight()
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
    })
    if (oldVim === this._vim && this._objects.size === count) return

    this.updateHighlight()
  }

  /**
   * Remove given objects from the current selection
   */
  remove (...objects: Object[]) {
    if (!objects) return
    if (objects.length === 0) return
    const count = this._objects.size
    objects.forEach((o) => {
      this._objects.delete(o)
    })
    if (this._objects.size === count) return
    if (this._objects.size === 0) {
      this._vim = undefined
    }

    this.updateHighlight()
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
      } else {
        this.clearOnNewVim(o.vim)
        this._objects.add(o)
      }
    })
    if (oldVim === this._vim && this._objects.size === count) return
    this.updateHighlight()
  }

  /**
   * Clears selection
   */
  clear () {
    this._vim = undefined
    if (this._objects.size === 0) return
    this._objects.clear()
    this.updateHighlight()
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

  private updateHighlight () {
    this.removeHighlight()
    this.createHighlights(this._objects)
    this._onValueChanged.dispatch()
  }

  private createHighlights (objects: Set<Object>) {
    if (objects.size === 0) return

    let vim: Vim | undefined
    const instances: number[] = []
    for (const o of objects.values()) {
      vim = vim ?? o.vim // capture first vim
      if (o.vim !== vim) {
        console.error('Cannot multiselect across vim files')
        return
      }
      if (o.instances) {
        instances.push(...o.instances)
      }
    }
    if (!vim?.document.g3d) return

    const meshBuilder = vim!.scene.builder.meshBuilder
    this._selectionMesh = meshBuilder.createWireframe(
      vim.document.g3d,
      instances
    )
    if (this._selectionMesh) {
      this._selectionMesh.applyMatrix4(vim!.getMatrix())
      if (this._selectionMesh) this._renderer.add(this._selectionMesh)
    }
  }

  private removeHighlight () {
    if (this._selectionMesh) {
      this._selectionMesh.geometry.dispose()
      this._renderer.remove(this._selectionMesh)
      this._selectionMesh = undefined
    }
  }
}
