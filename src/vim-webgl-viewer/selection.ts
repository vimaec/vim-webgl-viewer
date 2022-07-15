/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { Object } from '../vim-loader/object'
import { Renderer } from './renderer'

/**
 * Provides basic selection mechanic in viewer
 */
export class Selection {
  // Dependencies
  private _renderer: Renderer

  // State
  private _object: Object | undefined

  // Disposable State
  private _highlight: THREE.LineSegments | undefined

  /**
   * Callback for when selection changes or is cleared
   */
  onValueChanged: () => void

  constructor (renderer: Renderer) {
    this._renderer = renderer
  }

  /**
   * Returns selected object.
   */
  get object () {
    return this._object
  }

  /**
   * Select given object
   */
  select (object: Object | undefined) {
    if (object) {
      if (object !== this._object) {
        this._object = object
        this.createHighlight(object)
        this.onValueChanged?.()
      }
    } else {
      this.clear()
    }
  }

  /**
   * Clear selection and related highlights
   */
  clear () {
    if (this.object !== undefined) {
      this._object = undefined
      this.removeHighlight()
      this.onValueChanged?.()
    }
  }

  private createHighlight (object: Object) {
    this._highlight = object.createWireframe()
    if (this._highlight) this._renderer.add(this._highlight)
  }

  private removeHighlight () {
    if (this._highlight) {
      this._highlight.geometry.dispose()
      this._renderer.remove(this._highlight)
      this._highlight = undefined
    }
  }
}
