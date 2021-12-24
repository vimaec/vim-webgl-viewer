import * as THREE from 'three'
import { Viewer } from './viewer'

// TODO: Fix circular dependency
export class Selection {
  // Dependencies
  viewer: Viewer

  // State
  elementIndex: number | null = null
  boundingSphere: THREE.Sphere | null = null

  // Disposable State
  highlightDisposer: Function | null = null

  constructor (viewer: Viewer) {
    this.viewer = viewer
  }

  hasSelection () {
    return this.elementIndex !== null
  }

  clear () {
    this.elementIndex = null
    this.boundingSphere = null
    this.disposeResources()
  }

  disposeResources () {
    this.highlightDisposer?.()
    this.highlightDisposer = null
  }

  select (elementIndex: number) {
    this.disposeResources()
    this.elementIndex = elementIndex
    this.highlightDisposer = this.viewer.highlightElementByIndex(elementIndex)
    this.boundingSphere =
      this.viewer
        .getBoudingBoxForElementIndex(elementIndex)
        ?.getBoundingSphere(new THREE.Sphere()) ?? null
  }
}
