import * as THREE from 'three'
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

  reset () {
    this.elementIndex = -1
    this.boundingSphere = null
    this.disposeResources()
  }

  disposeResources () {
    this.highlightDisposer?.()
    this.highlightDisposer = null
  }

  select (elementIndex: number) {
    this.reset()
    if (elementIndex < 0)
    {
      return
    }
    this.elementIndex = elementIndex
    this.highlightDisposer = this.viewer.highlightElementByIndex(elementIndex)
    this.boundingSphere =
      this.viewer
        .getBoundingBoxForElementIndex(elementIndex)
        ?.getBoundingSphere(new THREE.Sphere()) ?? null
  }
}
