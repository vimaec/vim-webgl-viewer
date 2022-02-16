/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { Scene } from '../vim-loader/scene'
import { ViewerSettings } from './settings'

/**
 * Manages how vim objects are added and removed from the THREE.Scene to be rendered
 */
export class Renderer {
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  clock = new THREE.Clock()
  canvas: HTMLCanvasElement

  // state
  scene: THREE.Scene
  private boundingBox: THREE.Box3

  constructor (canvas: HTMLCanvasElement, settings: ViewerSettings) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      precision: 'highp', // 'lowp', 'mediump', 'highp'
      alpha: true,
      stencil: false,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true
    })
    this.canvas = this.renderer.domElement

    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.shadowMap.enabled = false

    this.camera = new THREE.PerspectiveCamera()
    this.scene = new THREE.Scene()
    this.fitToCanvas()
    this.setOnResize(this.fitToCanvas, settings.getCanvasResizeDelay())
  }

  /**
   * Set a callback for canvas resize with debouncing
   * https://stackoverflow.com/questions/5825447/javascript-event-for-canvas-resize/30688151
   * @param callback code to be called
   * @param timeout time after the last resize before code will be called
   */
  private setOnResize (callback, timeout) {
    let timerId
    window.addEventListener('resize', function () {
      if (timerId !== undefined) {
        clearTimeout(timerId)
        timerId = undefined
      }
      timerId = setTimeout(function () {
        timerId = undefined
        callback()
      }, timeout)
    })
  }

  getBoundingSphere (target: THREE.Sphere = new THREE.Sphere()) {
    return this.boundingBox?.getBoundingSphere(target)
  }

  getBoundingBox (target: THREE.Box3 = new THREE.Box3()) {
    return target.copy(this.boundingBox)
  }

  render () {
    this.renderer.render(this.scene, this.camera)
  }

  getContainerSize (): [width: number, height: number] {
    return [
      this.canvas.parentElement.clientWidth,
      this.canvas.parentElement.clientHeight
    ]
  }

  fitToCanvas = () => {
    const [width, height] = this.getContainerSize()

    this.renderer.setSize(width, height)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  addObject (mesh: THREE.Object3D) {
    this.scene.add(mesh)
  }

  addScene (scene: Scene) {
    scene.meshes.forEach((m) => {
      this.scene.add(m)
    })

    this.boundingBox = this.boundingBox
      ? this.boundingBox.union(scene.boundingBox)
      : scene.boundingBox.clone()
  }

  removeObject (mesh: THREE.Object3D) {
    this.scene.remove(mesh)
  }

  removeScene (scene: Scene) {
    for (let i = 0; i < scene.meshes.length; i++) {
      this.scene.remove(scene.meshes[i])
    }
  }

  clear () {
    this.scene.clear()
    this.boundingBox = undefined
  }
}
