import * as THREE from 'three'
import { Viewport } from '../viewport'
import { Settings } from '../viewerSettings'

export class PerspectiveWrapper {
  camera: THREE.PerspectiveCamera
  _viewport: Viewport
  _zoomSpeed: number = 0.25
  _minOrbitDistance: number = 0.05
  _minModelScrenSize: number = 0.05

  constructor (camera: THREE.PerspectiveCamera, viewport: Viewport) {
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

  zoom (
    orbitTarget: THREE.Vector3,
    modelSize: number,
    currentTarget: number,
    amount: number
  ) {
    const reverse = 1 / (1 - this._zoomSpeed) - 1
    const factor = amount < 0 ? this._zoomSpeed : reverse
    let offset = currentTarget * factor
    offset = Math.max(this._minOrbitDistance, offset)
    let targetDist = currentTarget + offset * amount
    targetDist = Math.max(this._minOrbitDistance, targetDist)

    // Distance is capped such that model is at least a certain screen size.
    const rad = (this.camera.fov / 2) * (Math.PI / 180)
    if (modelSize / (targetDist * Math.tan(rad)) < this._minModelScrenSize) {
      return
    }

    const target = new THREE.Vector3(0, 0, targetDist)
    target.applyQuaternion(this.camera.quaternion)
    target.add(orbitTarget)
    console.assert(Number.isFinite(target.x))
    return target
  }
}
