/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { VimObject } from '../vim-loader/vimObject'
import { Viewer } from './viewer'

// TODO: Fix circular dependency
export class Selection {
  // Dependencies
  viewer: Viewer

  // State
  object: VimObject | undefined = undefined
  boundingSphere: THREE.Sphere | null = null

  // Disposable State
  highlightDisposer: Function | null = null

  constructor (viewer: Viewer) {
    this.viewer = viewer
  }

  hasSelection () {
    return this.object !== undefined
  }

  clear () {
    this.object = undefined
    this.boundingSphere = null
    this.disposeResources()
  }

  disposeResources () {
    this.highlightDisposer?.()
    this.highlightDisposer = null
  }

  select (object: VimObject) {
    this.clear()
    this.object = object
    const wireframe = object.createWireframe()
    this.viewer.renderer.addObject(wireframe)
    this.highlightDisposer = () => this.viewer.renderer.removeObject(wireframe)
    this.boundingSphere = object.getBoundingSphere()
  }
}
