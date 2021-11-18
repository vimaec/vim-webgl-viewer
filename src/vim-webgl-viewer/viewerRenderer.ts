import * as THREE from 'three'

export class ViewerRenderer {
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  clock = new THREE.Clock()
  canvas: HTMLCanvasElement

  boundingBox: THREE.Box3
  meshes: THREE.Object3D[] = []

  constructor (canvas: HTMLCanvasElement) {
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
  }

  getBoundingSphere () {
    return this.boundingBox.getBoundingSphere(new THREE.Sphere())
  }

  render () {
    this.renderer.render(this.scene, this.camera)
  }

  fitToCanvas () {
    const w = window.innerWidth / window.devicePixelRatio
    const h = window.innerHeight / window.devicePixelRatio
    this.renderer.setSize(w, h, false)
    this.camera.aspect = this.canvas.width / this.canvas.height
    this.camera.updateProjectionMatrix()
  }

  addToScene (meshes: THREE.Object3D[]) {
    meshes.forEach((m) => {
      this.scene.add(m)
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
