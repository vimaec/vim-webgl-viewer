/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { Scene } from '../vim-loader/scene'
import { ViewerSettings } from './viewerSettings'

/**
 * Manages how vim objects are added and removed from the THREE.Scene to be rendered
 */
export class Renderer {
  renderer: THREE.WebGLRenderer
  canvas: HTMLCanvasElement
  camera: THREE.PerspectiveCamera

  // state
  scene: THREE.Scene
  private _scenes: Scene[] = []
  private _boundingBox: THREE.Box3
  private _unregisterResize: Function
  private _ownedCanvas: boolean

  constructor (settings: ViewerSettings) {
    const [canvas, owned] = Renderer.getOrCreateCanvas(settings.getCanvasId())
    this._ownedCanvas = owned
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
    this.camera = new THREE.PerspectiveCamera()
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.shadowMap.enabled = false

    this.scene = new THREE.Scene()
    this.fitToCanvas()
    this.setOnResize(this.fitToCanvas, settings.getCanvasResizeDelay())
  }

  dispose () {
    this.clear()

    this._unregisterResize()
    this._unregisterResize = undefined

    this.renderer.clear()
    this.renderer.forceContextLoss()
    this.renderer.dispose()
    this.renderer = undefined

    if (this._ownedCanvas) this.canvas.remove()
  }

  /**
   * Either returns html canvas at provided Id or creates a canvas at root level
   */
  private static getOrCreateCanvas (
    canvasId?: string
  ): [HTMLCanvasElement, boolean] {
    let canvas = canvasId
      ? (document.getElementById(canvasId) as HTMLCanvasElement)
      : undefined

    if (canvas) return [canvas, false]

    canvas = document.createElement('canvas')
    document.body.appendChild(canvas)
    return [canvas, true]
  }

  /**
   * Returns the bounding sphere encompasing all rendererd objects.
   * @param target sphere in which to copy result, a new instance is created if undefined.
   */
  getBoundingSphere (target: THREE.Sphere = new THREE.Sphere()) {
    return this._boundingBox?.getBoundingSphere(target)
  }

  /**
   * Returns the bounding box encompasing all rendererd objects.
   * @param target box in which to copy result, a new instance is created if undefined.
   */
  getBoundingBox (target: THREE.Box3 = new THREE.Box3()) {
    return target.copy(this._boundingBox)
  }

  /**
   * Render what is in camera.
   */
  render () {
    this.renderer.render(this.scene, this.camera)
  }

  /**
   * Returns the pixel size of the canvas.
   */
  getContainerSize (): [width: number, height: number] {
    return [
      this.canvas.parentElement.clientWidth,
      this.canvas.parentElement.clientHeight
    ]
  }

  /**
   * Add object to be rendered
   */
  add (target: Scene | THREE.Object3D) {
    if (target instanceof Scene) {
      this.addScene(target)
    } else {
      this.scene.add(target)
    }
  }

  /**
   * Remove object from rendering
   */
  remove (target: Scene | THREE.Object3D) {
    if (target instanceof Scene) {
      this.removeScene(target)
    } else {
      this.scene.remove(target)
    }
  }

  /**
   * Removes all rendered objects
   */
  clear () {
    this.scene.clear()
    this._boundingBox = undefined
  }

  private addScene (scene: Scene) {
    this._scenes.push(scene)
    scene.meshes.forEach((m) => {
      this.scene.add(m)
    })

    // Recompute bounding box
    this._boundingBox = this._boundingBox
      ? this._boundingBox.union(scene.boundingBox)
      : scene.boundingBox.clone()
  }

  private removeScene (scene: Scene) {
    // Remove from array
    this._scenes = this._scenes.filter((f) => f !== scene)

    // Remove all meshes from three scene
    for (let i = 0; i < scene.meshes.length; i++) {
      this.scene.remove(scene.meshes[i])
    }

    // Recompute bounding box
    this._boundingBox =
      this._scenes.length > 0
        ? this._scenes
          .map((s) => s.boundingBox.clone())
          .reduce((b1, b2) => b1.union(b2))
        : undefined
  }

  /**
   * Set a callback for canvas resize with debouncing
   * https://stackoverflow.com/questions/5825447/javascript-event-for-canvas-resize/30688151
   * @param callback code to be called
   * @param timeout time after the last resize before code will be called
   */
  private setOnResize (callback, timeout) {
    let timerId
    const onResize = function () {
      if (timerId !== undefined) {
        clearTimeout(timerId)
        timerId = undefined
      }
      timerId = setTimeout(function () {
        timerId = undefined
        callback()
      }, timeout)
    }
    window.addEventListener('resize', onResize)
    this._unregisterResize = () =>
      window.removeEventListener('resize', onResize)
  }

  private fitToCanvas = () => {
    const [width, height] = this.getContainerSize()

    this.renderer.setSize(width, height)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }
}
