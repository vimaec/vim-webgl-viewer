import * as THREE from 'three'
import { ViewerSettings } from './viewerSettings'

export class ViewerRenderer {
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  clock = new THREE.Clock()
  canvas: HTMLCanvasElement

  boundingBox: THREE.Box3
  meshes: THREE.Object3D[] = []

  constructor (canvas: HTMLCanvasElement, settings: ViewerSettings) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      precision: 'highp', // 'lowp', 'mediump', 'highp'

      alpha: true,
      stencil: false,
      powerPreference: 'high-performance'
    })
    this.canvas = this.renderer.domElement

    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.shadowMap.enabled = false

    this.camera = new THREE.PerspectiveCamera()
    this.scene = new THREE.Scene()
    this.boundingBox = new THREE.Box3()
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
    return this.boundingBox.getBoundingSphere(new THREE.Sphere())
  }

  render () {
    this.renderer.render(this.scene, this.camera)
  }

  getContainerSize (): [width: number, height: number] {
    return [
      this.canvas.parentElement.clientWidth / window.devicePixelRatio,
      this.canvas.parentElement.clientHeight / window.devicePixelRatio
    ]
  }

  fitToCanvas = () => {
    const [width, height] = this.getContainerSize()

    this.renderer.setSize(width, height)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  addToScene (mesh: THREE.Object3D) {
    this.scene.add(mesh)
  }

  remove (mesh: THREE.Object3D) {
    this.scene.remove(mesh)
    const i = this.meshes.indexOf(mesh)
    if (i > 0) this.meshes.splice(i, 1)
  }

  addManyToScene (meshes: THREE.Object3D[]) {
    meshes.forEach((m) => {
      this.addToScene(m)
    })
  }

  addToModel (meshes: THREE.Object3D[]) {
    meshes.forEach((m) => {
      this.scene.add(m)
      this.meshes.push(m)
    })
  }

  updateModel (matrix: THREE.Matrix4) {
    for (let i = 0; i < this.meshes.length; i++) {
      this.meshes[i].matrixAutoUpdate = false
      this.meshes[i].matrix.copy(matrix)
    }
  }

  computeBoundingBox (matrix: THREE.Matrix4) {
    this.boundingBox = this._computeBoundingBox(this.scene)
    this.boundingBox.applyMatrix4(matrix)
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
