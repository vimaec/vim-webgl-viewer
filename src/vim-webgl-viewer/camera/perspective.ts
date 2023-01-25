import * as THREE from 'three'
import { Viewport } from '../viewport'
import { Settings } from '../viewerSettings'

export class PerspectiveWrapper {
  camera: THREE.PerspectiveCamera
  _viewport: Viewport

  constructor (camera: THREE.PerspectiveCamera, viewport: Viewport) {
    this.camera = camera
    this._viewport = viewport
  }

  applySettings (settings: Settings) {
    this.camera.fov = settings.camera.fov
    this.camera.zoom = settings.camera.zoom
    this.camera.near = settings.camera.near
    this.camera.far = settings.camera.far
    this.camera.updateProjectionMatrix()
  }

  move3 (vector: THREE.Vector3, spd: number) {
    const v = new THREE.Vector3()
    v.copy(vector)
    v.applyQuaternion(this.camera.quaternion)
    v.multiplyScalar(spd)
    return v
  }

  updateProjection (target: THREE.Sphere | THREE.Box3) {
    const aspect = this._viewport.getAspectRatio()
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
  }

  applyVelocity () {}

  frustrumSizeAt (delta: THREE.Vector3) {
    const dist = this.camera.position.distanceTo(delta)
    const size = dist * Math.tan((this.camera.fov / 2) * (Math.PI / 180))
    return new THREE.Vector2(size, size)
  }
}
