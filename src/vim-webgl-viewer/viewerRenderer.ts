import * as THREE from 'three'
import { Model } from '../vim-webgl-viewer'
import { ViewerSettings } from './viewerSettings'

export class ViewerRenderer {
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  clock = new THREE.Clock()
  canvas: HTMLCanvasElement

  // state
  scene: THREE.Scene
  meshes: THREE.Object3D[] = []
  private localBoundingBox: THREE.Box3
  private worldBoundingBox: THREE.Box3

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
    this.localBoundingBox = new THREE.Box3()
    this.fitToCanvas()
    this.setOnResize(this.fitToCanvas, settings.getCanvasResizeDelay())
  }

  /**
   * Set a callback for canvas resize with debouncing
   * https://stackoverflow.com/questions/5825447/javascript-event-for-canvas-resize/30688151
   * @param callback code to be called
   * @param timeout time after the last resize before code will be called
   */
  setOnResize (callback, timeout) {
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

  getBoundingSphere () {
    return this.worldBoundingBox?.getBoundingSphere(new THREE.Sphere())
  }

  getBoundingBox () {
    return this.worldBoundingBox?.clone()
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

  clearModels () {
    this.meshes.forEach((m) => this.scene.remove(m))
    this.meshes = []
    this.localBoundingBox = undefined
    this.worldBoundingBox = undefined
  }

  addObjects (meshes: THREE.Object3D[]) {
    meshes.forEach((m) => {
      this.addObject(m)
    })
  }

  addObject (mesh: THREE.Object3D) {
    this.scene.add(mesh)
  }

  removeObject (mesh: THREE.Object3D) {
    this.scene.remove(mesh)
    const i = this.meshes.indexOf(mesh)
    if (i > 0) this.meshes.splice(i, 1)
  }

  addModel (model: Model) {
    model.meshes.forEach((m) => {
      this.scene.add(m)
      this.meshes.push(m)
    })

    this.localBoundingBox = this.localBoundingBox
      ? this.localBoundingBox.union(model.boundingBox)
      : model.boundingBox.clone()

    this.worldBoundingBox = this.worldBoundingBox ?? this.localBoundingBox
  }

  applyMatrix4 (matrix: THREE.Matrix4) {
    for (let i = 0; i < this.meshes.length; i++) {
      this.meshes[i].matrixAutoUpdate = false
      this.meshes[i].matrix.copy(matrix)
    }
    this.worldBoundingBox = this.localBoundingBox.clone().applyMatrix4(matrix)
  }

  computeBoundingBox (matrix: THREE.Matrix4) {
    this.localBoundingBox = this._computeBoundingBox(this.scene)
    this.worldBoundingBox = this.localBoundingBox.clone().applyMatrix4(matrix)
  }

  _computeBoundingBox (scene: THREE.Scene): THREE.Box3 {
    let box: THREE.Box3 | undefined

    const grow = (geometry: THREE.BufferGeometry, matrix: THREE.Matrix4) => {
      geometry.computeBoundingSphere()
      let currentBox = geometry.boundingBox!.clone()
      currentBox = currentBox.applyMatrix4(matrix)
      box = box ? box.union(currentBox) : currentBox
    }
    const matrix = new THREE.Matrix4()
    scene.traverse((obj) => {
      if (obj instanceof THREE.InstancedMesh) {
        for (let i = 0; i < obj.count; i++) {
          obj.getMatrixAt(i, matrix)
          grow(obj.geometry, matrix)
        }
      } else if (obj instanceof THREE.Mesh) {
        grow(obj.geometry, obj.matrix)
      }
    })

    return box ?? new THREE.Box3()
  }
}
