import * as THREE from 'three'
import { Viewer } from './viewer'

// TODO: Fix circular dependency
export class Selection {
  // Dependencies
  viewer: Viewer

  // State
  nodeIndex: number | null = null
  boundingSphere: THREE.Sphere | null = null

  // Disposable State
  geometry: THREE.BufferGeometry | null = null
  highlightDisposer: Function | null = null

  constructor (viewer: Viewer) {
    this.viewer = viewer
  }

  hasSelection () {
    return this.nodeIndex !== null
  }

  reset () {
    this.nodeIndex = null
    this.boundingSphere = null
    this.disposeResources()
  }

  disposeResources () {
    this.geometry?.dispose()
    this.geometry = null

    this.highlightDisposer?.()
    this.highlightDisposer = null
  }

  select (nodeIndex: number) {
    this.disposeResources()
    this.nodeIndex = nodeIndex
    this.geometry = this.viewer.createBufferGeometryFromNodeId(nodeIndex)
    this.geometry.computeBoundingSphere()
    this.boundingSphere = this.geometry.boundingSphere
    this.highlightDisposer = this.viewer.highlight(this.geometry)
  }
}
