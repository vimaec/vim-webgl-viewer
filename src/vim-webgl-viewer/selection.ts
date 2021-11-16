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
  geometry: THREE.BufferGeometry | null = null
  highlightDisposer: Function | null = null

  constructor (viewer: Viewer) {
    this.viewer = viewer
  }

  hasSelection () {
    return this.elementIndex !== null
  }

  reset () {
    this.elementIndex = null
    this.boundingSphere = null
    this.disposeResources()
  }

  disposeResources () {
    this.geometry?.dispose()
    this.geometry = null

    this.highlightDisposer?.()
    this.highlightDisposer = null
  }

  select (elementIndex: number) {
    this.disposeResources()
    this.elementIndex = elementIndex
    // TODO Support multi node per Element selection
    const nodes =
      this.viewer.vimScene.getNodeIndicesFromElementIndex(elementIndex)

    this.geometry = this.viewer.createBufferGeometryFromNodeId(nodes)
    if (!this.geometry) {
      console.log(
        'Selection Failed. Could not find elementIndex: ' + elementIndex
      )
      return
    }

    this.geometry.computeBoundingSphere()
    this.boundingSphere = this.geometry.boundingSphere
    this.highlightDisposer = this.viewer.highlight(this.geometry)
  }
}
