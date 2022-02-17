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
  private viewer: Viewer

  // State
  object: Object | undefined
  private _boundingSphere: THREE.Sphere | undefined

  // Disposable State
  private _highlightDisposer: Function | undefined

  constructor (viewer: Viewer) {
    this.viewer = viewer
  }

  getBoundingSphere (target: THREE.Sphere = new THREE.Sphere()) {
    return target.copy(this._boundingSphere)
  }

  hasSelection () {
    return this.object !== undefined
  }

  clear () {
    this.object = undefined
    this._boundingSphere = null
    this.disposeResources()
  }

  disposeResources () {
    this._highlightDisposer?.()
    this._highlightDisposer = null
  }

  select (object: Object) {
    this.clear()
    this.object = object
    const wireframe = object.createWireframe()
    this.viewer.renderer.addObject(wireframe)
    this._highlightDisposer = () => this.viewer.renderer.removeObject(wireframe)
    this._boundingSphere = object.getBoundingSphere()
  }
}
