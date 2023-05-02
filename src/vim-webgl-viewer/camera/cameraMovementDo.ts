import { Camera } from './camera'
import { CameraMovement } from './cameraMovement'
import { Object } from '../../vim'
import * as THREE from 'three'

export class CameraMovementDo extends CameraMovement {
  /**
   * Moves the camera closer or farther away from orbit target.
   * @param amount movement size.
   */
  zoom (amount: number): void {
    const dist = this._camera.orbitDistance * amount
    this.setDistance(dist)
  }

  reset () {
    this.set(this._camera._savedPosition, this._camera._savedTarget)
  }

  setDistance (dist: number): void {
    const pos = this._camera.target
      .clone()
      .sub(this._camera.forward.multiplyScalar(dist))
      .multiply(this._camera.allowedMovement)

    this.set(pos, this._camera.target)
  }

  rotate (angle: THREE.Vector2): void {
    const locked = angle.clone().multiply(this._camera.allowedRotation)
    const rotation = this.predictRotate(locked)
    this.applyRotation(rotation)
  }

  applyRotation (quaternion: THREE.Quaternion) {
    this._camera.quaternion.copy(quaternion)
    const target = this._camera.forward
      .multiplyScalar(this._camera.orbitDistance)
      .add(this._camera.position)

    this.set(this._camera.position, target)
  }

  target (target: Object | THREE.Vector3): void {
    const pos = target instanceof Object ? target.getCenter() : target
    if (!pos) return
    this.set(this._camera.position, pos)
  }

  orbit (angle: THREE.Vector2): void {
    const locked = angle.clone().multiply(this._camera.allowedRotation)
    const pos = this.predictOrbit(locked)
    this.set(pos)
  }

  override move3 (vector: THREE.Vector3): void {
    const v = vector.clone()
    v.applyQuaternion(this._camera.quaternion)
    const locked = this.lockVector(v, new THREE.Vector3())
    const pos = this._camera.position.clone().add(locked)
    const target = this._camera.target.clone().add(locked)
    this.set(pos, target)
  }

  set (position: THREE.Vector3, target?: THREE.Vector3) {
    // apply position
    const locked = this.lockVector(position, this._camera.position)
    this._camera.position.copy(locked)

    // apply target and rotation
    target = target ?? this._camera.target
    this._camera.target.copy(target)
    this._camera.camPerspective.camera.lookAt(target)
    this._camera.camPerspective.camera.up.set(0, 1, 0)
  }

  private lockVector (position: THREE.Vector3, fallback: THREE.Vector3) {
    const x = this._camera.allowedMovement.x === 0 ? fallback.x : position.x
    const y = this._camera.allowedMovement.y === 0 ? fallback.y : position.y
    const z = this._camera.allowedMovement.z === 0 ? fallback.z : position.z

    return new THREE.Vector3(x, y, z)
  }

  predictOrbit (angle: THREE.Vector2) {
    const rotation = this.predictRotate(angle)

    const delta = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(rotation)
      .multiplyScalar(this._camera.orbitDistance)

    return this._camera.target.clone().add(delta)
  }

  predictRotate (angle: THREE.Vector2) {
    const euler = new THREE.Euler(0, 0, 0, 'YXZ')
    euler.setFromQuaternion(this._camera.quaternion)

    euler.x += (angle.x * Math.PI) / 180
    euler.y += (angle.y * Math.PI) / 180
    euler.z = 0

    // Clamp X rotation to prevent performing a loop.
    const max = Math.PI * 0.4999
    euler.x = Math.max(-max, Math.min(max, euler.x))

    const rotation = new THREE.Quaternion().setFromEuler(euler)
    return rotation
  }
}
