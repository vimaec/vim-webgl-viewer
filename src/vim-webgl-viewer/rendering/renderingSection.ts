/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { VimMaterials } from '../../vim-loader/materials/materials'

export class RenderingSection {
  private _renderer: THREE.WebGLRenderer

  private _materials: VimMaterials
  private _active: boolean = true

  readonly box: THREE.Box3 = new THREE.Box3(
    new THREE.Vector3(-100, -100, -100),
    new THREE.Vector3(100, 100, 100)
  )

  private maxX: THREE.Plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0))
  private minX: THREE.Plane = new THREE.Plane(new THREE.Vector3(1, 0, 0))
  private maxY: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, -1, 0))
  private minY: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0))
  private maxZ: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 0, -1))
  private minZ: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 0, 1))
  private planes: THREE.Plane[] = [
    this.maxX,
    this.minX,
    this.maxY,
    this.minY,
    this.maxZ,
    this.minZ
  ]

  constructor (renderer: THREE.WebGLRenderer, materials: VimMaterials) {
    this._renderer = renderer
    this._materials = materials
  }

  fitBox (box: THREE.Box3) {
    this.maxX.constant = box.max.x
    this.minX.constant = -box.min.x
    this.maxY.constant = box.max.y
    this.minY.constant = -box.min.y
    this.maxZ.constant = box.max.z
    this.minZ.constant = -box.min.z
    this.box.copy(box)
  }

  set active (value: boolean) {
    this._materials.clippingPlanes = value ? this.planes : null
    this._renderer.localClippingEnabled = value
    this._active = value
  }

  get active () {
    return this._active
  }
}
