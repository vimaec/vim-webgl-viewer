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
    const pos = this._camera.orbitPosition
      .clone()
      .sub(this._camera.forward.multiplyScalar(dist))
    this._camera.position.copy(pos)
    this._camera.notifyMovement()
  }

  rotate (angle: THREE.Vector2): void {
    const rotation = this.predictRotate(this._camera.quaternion, angle)
    this.applyRotation(rotation)
  }

  applyRotation (quaternion: THREE.Quaternion) {
    this._camera.quaternion.copy(quaternion)
    const offset = this._camera.forward.multiplyScalar(
      this._camera.orbitDistance
    )

    this._camera.orbitPosition.copy(this._camera.position).add(offset)
    this._camera.notifyMovement()
  }

  target (target: Object | THREE.Vector3): void {
    const pos = target instanceof Object ? target.getCenter() : target
    if (!pos) return
    this._camera.orbitPosition.copy(pos)
    this._camera.camPerspective.camera.lookAt(pos)
    this._camera.camPerspective.camera.up.set(0, 1, 0)
    this._camera.notifyMovement()
  }

  set (position: THREE.Vector3, target?: THREE.Vector3) {
    this._camera.position.copy(position)
    this.target(target ?? this._camera.orbitPosition)
  }

  protected override frameSphere (
    sphere: THREE.Sphere,
    angle: number | undefined
  ) {
    // Compute best distance to frame sphere
    const fov = (this._camera.camPerspective.camera.fov * Math.PI) / 180
    const dist = (sphere.radius * 1.2) / Math.tan(fov / 2)
    console.log(dist)
    if (angle !== undefined) {
      this._camera.position.setY(sphere.center.y)
    }

    this.target(sphere.center)
    this.setDistance(dist)

    if (angle !== undefined) {
      const rot = angle
      this.orbit(new THREE.Vector2(-rot, 0))
    }
  }

  orbit (angle: THREE.Vector2): void {
    const rotation = this.predictRotate(this._camera.quaternion, angle)

    const delta = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(rotation)
      .multiplyScalar(this._camera.orbitDistance)

    const pos = this._camera.orbitPosition.clone().add(delta)
    this.set(pos, this._camera.orbitPosition)
  }

  orbitTowards (direction: THREE.Vector3) {
    const offset = direction.clone().multiplyScalar(this._camera.orbitDistance)
    this._camera.position.copy(this._camera.orbitPosition).sub(offset)
    this.target(this._camera.orbitPosition)
  }

  override move3 (vector: THREE.Vector3): void {
    const v = vector.clone()
    v.applyQuaternion(this._camera.quaternion)

    this._camera.orbitPosition.add(v)
    this._camera.position.add(v)
    this._camera.notifyMovement()
  }

  private predictRotate (current: THREE.Quaternion, angle: THREE.Vector2) {
    const euler = new THREE.Euler(0, 0, 0, 'YXZ')
    euler.setFromQuaternion(current)

    euler.x += (angle.x * Math.PI) / 180
    euler.y += (angle.y * Math.PI) / 180
    euler.z = 0

    // Clamp X rotation to prevent performing a loop.
    const max = Math.PI * 0.48
    euler.x = Math.max(-max, Math.min(max, euler.x))

    const rotation = new THREE.Quaternion().setFromEuler(euler)
    return rotation
  }
}
