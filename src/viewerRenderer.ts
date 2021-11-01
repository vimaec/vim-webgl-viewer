import * as THREE from 'three'

export class ViewerRenderer {
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  clock = new THREE.Clock()
  canvas: HTMLCanvasElement

  boundingSphere: THREE.Sphere
  meshes: THREE.Object3D[] = []

  constructor (canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      precision: 'highp', // 'lowp', 'mediump', 'highp'

      alpha: false,
      stencil: false,
      powerPreference: 'high-performance'
    })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.shadowMap.enabled = false

    this.camera = new THREE.PerspectiveCamera()
    this.scene = new THREE.Scene()
    this.boundingSphere = new THREE.Sphere()
    this.fitToCanvas()
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

  computeBoundingSphere (matrix: THREE.Matrix4) {
    this.boundingSphere = this._computeBoundingSphere(this.scene)
    this.boundingSphere.applyMatrix4(matrix)
  }

  _computeBoundingSphere (scene: THREE.Scene): THREE.Sphere {
    let sphere: THREE.Sphere | undefined

    const grow = (geometry: THREE.BufferGeometry, matrix: THREE.Matrix4) => {
      geometry.computeBoundingSphere()
      let currentSphere = geometry.boundingSphere!.clone()
      currentSphere = currentSphere.applyMatrix4(matrix)
      sphere = sphere ? sphere.union(currentSphere) : currentSphere
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

    return sphere ?? new THREE.Sphere()
  }
}
