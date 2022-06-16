/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { Scene } from '../vim-loader/scene'
import { Viewport } from './viewport'
import { RenderScene } from './renderScene'
import { Materials } from '../vim-loader/materials'

class Section {
  private _renderer: THREE.WebGLRenderer
  private _active: boolean

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

  constructor (renderer: THREE.WebGLRenderer) {
    this._renderer = renderer
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
    const materials = Materials.getDefaultLibrary()
    const p = value ? this.planes : undefined
    materials.opaque.clippingPlanes = p
    materials.transparent.clippingPlanes = p
    materials.wireframe.clippingPlanes = p
    this._renderer.localClippingEnabled = value
    this._active = value
  }

  get active () {
    return this._active
  }
}

/**
 * Manages how vim objects are added and removed from the THREE.Scene to be rendered
 */
export class Renderer {
  renderer: THREE.WebGLRenderer
  viewport: Viewport
  scene: RenderScene
  section: Section

  constructor (scene: RenderScene, viewport: Viewport) {
    this.viewport = viewport

    this.scene = scene
    this.renderer = new THREE.WebGLRenderer({
      canvas: viewport.canvas,
      antialias: true,
      precision: 'highp', // 'lowp', 'mediump', 'highp'
      alpha: true,
      stencil: false,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true
    })

    this.fitViewport()
    this.viewport.onResize(() => this.fitViewport())

    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.shadowMap.enabled = false
    this.section = new Section(this.renderer)
  }

  dispose () {
    this.clear()

    this.renderer.clear()
    this.renderer.forceContextLoss()
    this.renderer.dispose()
  }

  /**
   * Returns the bounding sphere encompasing all rendererd objects.
   * @param target sphere in which to copy result, a new instance is created if undefined.
   */
  getBoundingSphere (target: THREE.Sphere = new THREE.Sphere()) {
    return this.scene.getBoundingSphere(target)
  }

  /**
   * Returns the bounding box encompasing all rendererd objects.
   * @param target box in which to copy result, a new instance is created if undefined.
   */
  getBoundingBox (target: THREE.Box3 = new THREE.Box3()) {
    return this.scene.getBoundingBox(target)
  }

  /**
   * Render what is in camera.
   */
  render (camera: THREE.Camera) {
    this.renderer.render(this.scene.scene, camera)
  }

  /**
   * Add object to be rendered
   */
  add (target: Scene | THREE.Object3D) {
    this.scene.add(target)
  }

  /**
   * Remove object from rendering
   */
  remove (target: Scene | THREE.Object3D) {
    this.scene.remove(target)
  }

  /**
   * Removes all rendered objects
   */
  clear () {
    this.scene.clear()
  }

  private fitViewport = () => {
    const [width, height] = this.viewport.getParentSize()
    this.renderer.setSize(width, height)
  }
}
