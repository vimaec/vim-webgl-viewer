/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { Scene } from '../vim-loader/scene'
import { Viewport } from './viewport'
import { RenderScene } from './renderScene'

/**
 * Manages how vim objects are added and removed from the THREE.Scene to be rendered
 */
export class Renderer {
  renderer: THREE.WebGLRenderer
  viewport: Viewport
  scene: RenderScene

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
  }

  dispose () {
    this.clear()

    this.renderer.clear()
    this.renderer.forceContextLoss()
    this.renderer.dispose()
    this.renderer = undefined
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
