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
  elementIndex: number = -1
  boundingSphere: THREE.Sphere | null = null

  // Disposable State
  highlightDisposer: Function | null = null

  constructor (viewer: Viewer) {
    this.viewer = viewer
  }

  hasSelection () {
    return this.elementIndex >= 0
  }

  clear () {
    this.elementIndex = -1
    this.boundingSphere = null
    this.disposeResources()
  }

  disposeResources () {
    this.highlightDisposer?.()
    this.highlightDisposer = null
  }

  select (object: VimObject) {
    this.clear()
    const wireframe = object.createWireframe()
    this.viewer.renderer.addObject(wireframe)
    this.highlightDisposer = () => this.viewer.renderer.removeObject(wireframe)
    this.boundingSphere = object.getBoundingSphere()
  }
}
