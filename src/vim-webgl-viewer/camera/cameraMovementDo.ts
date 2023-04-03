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
    const dist = this.camera.orbitDistance * amount
    this.setDistance(dist)
  }

  reset () {
    this.set(this.camera._savedPosition, this.camera._savedTarget)
  }

  setDistance (dist: number): void {
    const pos = this.camera.orbitPosition
      .clone()
      .sub(this.camera.forward.multiplyScalar(dist))
    this.camera.position.copy(pos)
  }

  rotate (angle: THREE.Vector2): void {
    const rotation = this.predictRotate(this.camera.quaternion, angle)
    this.applyRotation(rotation)
  }

  applyRotation (quaternion: THREE.Quaternion) {
    const offset = this.camera.forward.multiplyScalar(this.camera.orbitDistance)
    this.camera.quaternion.copy(quaternion)
    this.camera.orbitPosition.copy(this.camera.position).add(offset)
  }

  target (target: Object | THREE.Vector3): void {
    const pos = target instanceof Object ? target.getCenter() : target
    if (!pos) return
    this.camera.orbitPosition.copy(pos)
    this.camera.camActive.camera.lookAt(pos)
    this.camera.camActive.camera.up.set(0, 1, 0)
  }

  set (position: THREE.Vector3, target?: THREE.Vector3) {
    this.camera.position.copy(position)
    this.target(target ?? this.camera.orbitPosition)
  }

  protected override frameSphere (
    sphere: THREE.Sphere,
    angle: number | undefined
  ) {
    // Compute best distance to frame sphere
    const fov = (this.camera.camPerspective.camera.fov * Math.PI) / 180
    const dist = (sphere.radius * 1.2) / Math.tan(fov / 2)
    console.log(dist)
    if (angle !== undefined) {
      this.camera.position.setY(sphere.center.y)
    }

    this.target(sphere.center)
    this.setDistance(dist)

    if (angle !== undefined) {
      const rot = angle
      this.orbit(new THREE.Vector2(-rot, 0))
    }
  }

  orbit (angle: THREE.Vector2): void {
    const rotation = this.predictRotate(this.camera.quaternion, angle)

    const delta = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(rotation)
      .multiplyScalar(this.camera.orbitDistance)

    const pos = this.camera.orbitPosition.clone().add(delta)
    this.set(pos, this.camera.orbitPosition)
  }

  orbitTowards (direction: THREE.Vector3) {
    const offset = direction.clone().multiplyScalar(this.camera.orbitDistance)
    this.camera.position.copy(this.camera.orbitPosition).sub(offset)
    this.target(this.camera.orbitPosition)
  }

  override move3 (vector: THREE.Vector3): void {
    const v = vector.clone()
    v.applyQuaternion(this.camera.quaternion)

    this.camera.orbitPosition.add(v)
    this.camera.position.add(v)
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
