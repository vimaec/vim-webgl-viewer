import * as THREE from 'three'
import { Viewport } from '../viewport'
import { Settings } from '../viewerSettings'

export class OrthographicWrapper {
  camera: THREE.OrthographicCamera
  _viewport: Viewport
  _minOrthoSize: number = 1
  _zoomSpeed: number
  _minModelScrenSize: number
  _minOrbitDistance: number

  constructor (camera: THREE.OrthographicCamera, viewport: Viewport) {
    this.camera = camera
    this._viewport = viewport
  }

  get position () {
    return this.camera.position
  }

  get quaternion () {
    return this.camera.quaternion
  }

  get forward () {
    return this.camera.getWorldDirection(new THREE.Vector3())
  }

  applySettings (settings: Settings) {
    this.camera.zoom = settings.camera.zoom
    this.camera.near = settings.camera.near
    this.camera.far = settings.camera.far
    this.camera.updateProjectionMatrix()
  }

  move3 (vector: THREE.Vector3, spd: number = 1) {
    const v = new THREE.Vector3()
    const aspect = this._viewport.getAspectRatio()
    const dx = this.camera.right - this.camera.left
    const dy = this.camera.top - this.camera.bottom
    v.set(-vector.x * dx * aspect, vector.y * dy, 0)
    return v
  }

  updateProjection (target: THREE.Sphere | THREE.Box3) {
    if (target instanceof THREE.Box3) {
      target = target.getBoundingSphere(new THREE.Sphere())
    }

    const aspect = this._viewport.getAspectRatio()

    this.camera.left = -target.radius * aspect
    this.camera.right = target.radius * aspect
    this.camera.top = target.radius
    this.camera.bottom = -target.radius

    this.camera.updateProjectionMatrix()
  }

  applyVelocity (delta: THREE.Vector3) {
    const forward = this.camera.getWorldDirection(new THREE.Vector3())
    const aspect = this._viewport.getAspectRatio()
    const d = -delta.dot(forward)

    const dx = this.camera.right - this.camera.left + 2 * d * aspect
    const dy = this.camera.top - this.camera.bottom + 2 * d * aspect
    const radius = Math.min(dx, dy)
    if (radius < this._minOrthoSize) return

    this.camera.left -= d * aspect
    this.camera.right += d * aspect
    this.camera.top += d
    this.camera.bottom -= d
    this.camera.updateProjectionMatrix()
  }

  frustrumSizeAt (delta: THREE.Vector3) {
    return new THREE.Vector2(
      Math.abs(this.camera.right - this.camera.left),
      Math.abs(this.camera.top - this.camera.bottom)
    )
  }

  zoom (
    orbitTarget: THREE.Vector3,
    modelSize: number,
    currentTarget: number,
    amount: number
  ) {
    const padX =
      (this.camera.right - this.camera.left) * amount * this._zoomSpeed
    const padY =
      (this.camera.top - this.camera.bottom) * amount * this._zoomSpeed

    const X = this.camera.right - this.camera.left + 2 * padX
    const Y = this.camera.top - this.camera.bottom + 2 * padY
    const radius = Math.min(X / 2, Y / 2)

    // View box size is capped such that model is at least a certain screen size.
    // And tha box is of size at least min orbit distance
    if (modelSize / radius < this._minModelScrenSize) return
    if (radius * 2 < this._minOrbitDistance) return

    this.camera.left -= padX
    this.camera.right += padX
    this.camera.bottom -= padY
    this.camera.top += padY
    this.camera.updateProjectionMatrix()
  }
}
