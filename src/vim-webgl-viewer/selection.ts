/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { Object } from '../vim-loader/object'
import { Viewer } from './viewer'

// TODO: Fix circular dependency
/**
 * Provides basic selection mechanic in viewer
 */
export class Selection {
  // Dependencies
  private _viewer: Viewer

  // State
  private _object: Object | undefined

  // Disposable State
  private _highligt: THREE.LineSegments | undefined

  constructor (viewer: Viewer) {
    this._viewer = viewer
  }

  get object () { return this._object }

  select (object: Object) {
    this.clear()
    if (object) {
      this._object = object
      this._highligt = object.createWireframe()
      this._viewer.renderer.add(this._highligt)
    }
  }

  clear () {
    this._object = undefined

    if (this._highligt) {
      this._highligt.geometry.dispose()
      this._viewer.renderer.remove(this._highligt)
      this._highligt = undefined
    }
  }
}
