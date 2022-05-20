/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { Object } from '../vim-loader/object'
import { Renderer } from './renderer'

// TODO: Fix circular dependency
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
    this.clear()
    if (object) {
      this._object = object
      this._highlight = object.createWireframe()
      if (this._highlight) this._renderer.add(this._highlight)
    }
  }

  /**
   * Clear selection and related highlights
   */
  clear () {
    this._object = undefined

    if (this._highlight) {
      this._highlight.geometry.dispose()
      this._renderer.remove(this._highlight)
      this._highlight = undefined
    }
  }
}
