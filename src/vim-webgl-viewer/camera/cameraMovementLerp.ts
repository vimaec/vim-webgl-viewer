import * as THREE from 'three'
import { Camera } from './camera'
import { Object } from '../../vim'
import { CameraMovementDo } from './cameraMovementDo'
import { CameraMovement } from './cameraMovement'

export class CameraLerp extends CameraMovement {
  _movement: CameraMovementDo
  _clock = new THREE.Clock()

  // position
  onProgress: ((progress: number) => void) | undefined

  _duration = 1

  constructor (camera: Camera, movement: CameraMovementDo) {
    super(camera)
    this._movement = movement
  }

  init (duration: number) {
    this.cancel()
    this._duration = duration
    this._clock.start()
    this.animate()
  }

  cancel () {
    this._clock.stop()
    this.onProgress = undefined
  }

  animate () {
    if (this._clock.running) {
      this.update()
      requestAnimationFrame(() => this.animate())
    }
  }

  easeOutCubic (x: number): number {
    return 1 - Math.pow(1 - x, 3)
  }

  update () {
    let t = this._clock.getElapsedTime() / this._duration
    t = this.easeOutCubic(t)
    if (t >= 1) {
      t = 1
      this._clock.stop()
      this.onProgress = undefined
    }
    this.onProgress?.(t)
  }

  override move3 (vector: THREE.Vector3): void {
    const v = vector.clone()
    v.applyQuaternion(this._camera.quaternion)
    const start = this._camera.position.clone()
    const end = this._camera.position.clone().add(v)
    const pos = new THREE.Vector3()

    this.onProgress = (progress) => {
      pos.copy(start)
      pos.lerp(end, progress)
      const offset = pos.sub(this._camera.position)
      const p = this._camera.position.clone()
      this._movement.move3(pos)
    }
  }

  rotate (angle: THREE.Vector2): void {
    const euler = new THREE.Euler(0, 0, 0, 'YXZ')
    euler.setFromQuaternion(this._camera.quaternion)

    // When moving the mouse one full sreen
    // Orbit will rotate 180 degree around the scene
    euler.x += angle.x
    euler.y += angle.y
    euler.z = 0

    // Clamp X rotation to prevent performing a loop.
    const max = Math.PI * 0.48
    euler.x = Math.max(-max, Math.min(max, euler.x))

    const start = this._camera.quaternion.clone()
    const end = new THREE.Quaternion().setFromEuler(euler)
    const rot = new THREE.Quaternion()
    this.onProgress = (progress) => {
      rot.copy(start)
      rot.slerp(end, progress)
      this._movement.applyRotation(rot)
    }
  }

  zoom (amount: number): void {
    const dist = this._camera.orbitDistance * amount
    this.setDistance(dist)
  }

  setDistance (dist: number): void {
    const start = this._camera.position.clone()
    const end = this._camera.orbitPosition
      .clone()
      .lerp(start, dist / this._camera.orbitDistance)

    this.onProgress = (progress) => {
      this._camera.position.copy(start)
      this._camera.position.lerp(end, progress)
    }
  }

  orbit (vector: THREE.Vector2): void {
    const euler = new THREE.Euler(0, 0, 0, 'YXZ')
    euler.setFromQuaternion(this._camera.quaternion)

    // When moving the mouse one full sreen
    // Orbit will rotate 180 degree around the scene
    const factor = -Math.PI
    euler.y += vector.x * factor
    euler.x += vector.y * factor
    euler.z = 0

    // Clamp X rotation to prevent performing a loop.
    const max = Math.PI * 0.48
    euler.x = Math.max(-max, Math.min(max, euler.x))

    const startRot = this._camera.quaternion.clone()
    const startPos = this._camera.position.clone()
    const endRot = new THREE.Quaternion().setFromEuler(euler)
    const rot = new THREE.Quaternion()

    this.onProgress = (progress) => {
      rot.copy(startRot)
      rot.slerp(endRot, progress)
      const d = startPos.clone()
      d.sub(this._camera.orbitPosition)
      d.applyQuaternion(rot)

      this._movement.set(d)
    }
  }

  orbitTowards (direction: THREE.Vector3) {
    const offset = direction.clone().multiplyScalar(this._camera.orbitDistance)
    const pos = this._camera.orbitPosition.clone().add(offset)
    this.set(pos)
  }

  target (target: Object | THREE.Vector3): void {
    const pos = target instanceof Object ? target.getCenter() : target
    const next = pos.clone().sub(this._camera.position)
    const start = this._camera.quaternion.clone()
    const rot = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, -1),
      next.normalize()
    )
    this.onProgress = (progress) => {
      const r = start.clone().slerp(rot, progress)
      this._movement.applyRotation(r)
    }
  }

  reset (): void {
    this.set(this._camera._savedPosition, this._camera._savedTarget)
  }

  set (position: THREE.Vector3, target?: THREE.Vector3) {
    const endTarget = target ?? this._camera.orbitPosition
    const startPos = this._camera.position.clone()
    const startTarget = this._camera.orbitPosition.clone()
    this.onProgress = (progress) => {
      this._movement.set(
        startPos.clone().lerp(position, progress),
        startTarget.clone().lerp(endTarget, progress)
      )
    }
  }

  override frameSphere (sphere: THREE.Sphere, angle: number | undefined) {
    console.log('frame')
    // Compute best distance to frame sphere
    const fov = (this._camera.camPerspective.camera.fov * Math.PI) / 180
    const dist = (sphere.radius * 1.2) / Math.tan(fov / 2)

    const pos = this._camera.position.clone()

    if (angle !== undefined) {
      pos.setY(sphere.center.y)
    }

    const offset = this._camera.forward.multiplyScalar(-dist)

    pos.copy(sphere.center).add(offset)
    this.set(pos, sphere.center)
  }
}