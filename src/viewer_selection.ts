import * as THREE from 'three'
import { Viewer } from './viewer'

// TODO: Fix circular dependency
export class Selection {
  // Dependencies
  viewer: Viewer

  // State
  mesh: THREE.Mesh | null = null
  instanceIndex: number | null = null
  boundingSphere: THREE.Sphere | null = null

  // Disposable State
  geometry: THREE.BufferGeometry | null = null
  highlightDisposer: Function | null = null

  constructor (viewer: Viewer) {
    this.viewer = viewer
  }

  hasSelection () {
    return this.mesh !== null
  }

  reset () {
    this.mesh = null
    this.instanceIndex = null
    this.boundingSphere = null
    this.disposeResources()
  }

  disposeResources () {
    this.geometry?.dispose()
    this.geometry = null

    this.highlightDisposer?.()
    this.highlightDisposer = null
  }

  select (mesh: THREE.Mesh, index: number) {
    this.disposeResources()
    this.mesh = mesh
    this.instanceIndex = index
    this.geometry = this.viewer.createWorldGeometry(mesh, index)
    this.geometry.computeBoundingSphere()
    this.boundingSphere = this.geometry.boundingSphere
    this.highlightDisposer = this.viewer.highlight(this.geometry)
  }
}
