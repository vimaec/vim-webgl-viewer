/**
 @module viw-webgl-viewer
*/

import * as THREE from 'three'
import { CameraGizmo } from './gizmoOrbit'
import { Viewport } from './viewport'
import { ViewerSettings } from './viewerSettings'
import { Object } from '../vim'
import { RenderScene } from './renderScene'
import { Quaternion } from 'three'
import { clamp } from 'three/src/math/MathUtils'

export const DIRECTIONS = {
  forward: new THREE.Vector3(0, 0, -1),
  back: new THREE.Vector3(0, 0, 1),
  left: new THREE.Vector3(-1, 0, 0),
  right: new THREE.Vector3(1, 0, 0),
  up: new THREE.Vector3(0, 1, 0),
  down: new THREE.Vector3(0, -1, 0)
}

export interface ICamera {
  /**
   * Wrapped Three.js camera
   */
  camera: THREE.Camera
  /**
   * Multiplier for camera movements.
   */
  speed: number

  /**
   * True: Camera orbit around target mode.
   * False: First person free camera mode.
   */
  orbitMode: boolean

  /**
   * True: Orthographic camera.
   * False: Perspective camera.
   */
  orthographic: boolean

  /**
   * Current local velocity
   */
  localVelocity: THREE.Vector3
  /**
   * Rotates the camera around the X or Y axis or both
   * @param vector where coordinates are in relative screen size. ie [-1, 1]
   */

  defaultLerpDuration: number

  /**
   * Moves the camera along all three axes.
   */
  move3(vector: THREE.Vector3): void

  /**
   * Moves the camera along two axes.
   */
  move2(vector: THREE.Vector2, axes: 'XY' | 'XZ'): void

  /**
   * Moves the camera along one axis.
   */
  move1(amount: number, axis: 'X' | 'Y' | 'Z'): void

  /**
   * Rotates the camera around the X or Y axis or both
   * @param vector where coordinates in range [-1, 1] for rotations of [-180, 180] degrees
   */
  rotate(vector: THREE.Vector2, duration?: number): void

  /**
   * Moves the camera closer or farther away from orbit target.
   * @param amount movement size.
   */
  zoom(amount: number, duration?: number): void

  /**
   * Moves the camera around the target so that it looks down given forward vector
   * @param forward direction vector
   */
  orbit(forward: THREE.Vector3, duration?: number): void

  /**
   * Sets orbit mode target and moves camera accordingly
   */
  target(target: Object | THREE.Vector3, duration?: number): void

  /**
   * Moves and rotates the camera so that target is well framed.
   * if center is true -> camera.y = target.y
   */
  frame(
    target: Object | THREE.Sphere | 'all',
    center?: boolean,
    duration?: number
  ): void

  forward: THREE.Vector3

  onChanged: () => void | undefined
}

type Lerp = 'None' | 'Position' | 'Rotation' | 'Both'

/**
 * Manages viewer camera movement and position
 */
export class Camera implements ICamera {
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
  private cameraPerspective: THREE.PerspectiveCamera
  private cameraOrthographic: THREE.OrthographicCamera
  gizmo: CameraGizmo | undefined
  private _viewport: Viewport
  private _scene: RenderScene

  private _targetVelocity: THREE.Vector3
  private _velocity: THREE.Vector3
  private _speed: number = 0

  private _orbitMode: boolean = false
  private _orbitTarget: THREE.Vector3
  private _minOrbitalDistance: number = 0.05
  private _targetPosition: THREE.Vector3

  private _lerpStartMs: number = 0
  private _lerpEndMs: number = 0
  private _lockDirection: boolean = false
  private _lerpPosition: boolean
  private _lerpRotation: boolean

  onChanged = () => {}

  // Settings
  defaultLerpDuration: number = 2
  private _vimReferenceSize: number = 1
  private _sceneSizeMultiplier: number = 1
  private _velocityBlendFactor: number = 0.0001
  private _moveSpeed: number = 0.8
  private _rotateSpeed: number = 1
  private _orbitSpeed: number = 1
  private _zoomSpeed: number = 0.25
  private _firstPersonSpeed = 10
  private _minModelScrenSize = 0.05
  private _minOrthoSize = 1

  constructor (
    scene: RenderScene,
    viewport: Viewport,
    settings: ViewerSettings
  ) {
    this.cameraPerspective = new THREE.PerspectiveCamera()
    this.camera = this.cameraPerspective
    this.camera.position.set(0, 0, -1000)
    this._orbitTarget = new THREE.Vector3(0, 0, 0)
    this.lookAt(this._orbitTarget)
    this._scene = scene
    this._viewport = viewport
    this._viewport.onResize(() => {
      this.updateProjection(this._scene.getBoundingSphere())
    })
    this.applySettings(settings)

    this._targetVelocity = new THREE.Vector3(0, 0, 0)
    this._velocity = new THREE.Vector3(0, 0, 0)
    this._targetPosition = this.camera.position
  }

  dispose () {
    this.gizmo?.dispose()
    this.gizmo = undefined
  }

  /**
   * Resets camera to default state.
   */
  reset () {
    this.camera.position.set(0, 0, -5)

    this._targetVelocity.set(0, 0, 0)
    this._velocity.set(0, 0, 0)

    this._orbitTarget.set(0, 0, 0)
    this.lookAt(this._orbitTarget)
  }

  get speed () {
    return this._speed
  }

  set speed (value: number) {
    this._speed = clamp(value, -25, 25)
  }

  get localVelocity () {
    const result = this._velocity.clone()
    result.applyQuaternion(this.camera.quaternion.clone().invert())
    result.setZ(-result.z)
    result.multiplyScalar((1 / this.getSpeedMultiplier()) * this._moveSpeed)
    return result
  }

  get forward () {
    return this.camera.getWorldDirection(new THREE.Vector3())
  }

  /**
   * Set current velocity of the camera.
   */
  set localVelocity (vector: THREE.Vector3) {
    this.cancelLerp()
    const move = vector.clone()
    move.setZ(-move.z)
    move.applyQuaternion(this.camera.quaternion)
    move.multiplyScalar(this.getSpeedMultiplier() * this._moveSpeed)

    this._targetVelocity.copy(move)
  }

  /**
   * True: Camera orbit around target mode.
   * False: First person free camera mode.
   */
  public get orbitMode () {
    return this._orbitMode
  }

  /**
   * True: Camera orbit around target mode.
   * False: First person free camera mode.
   */
  public set orbitMode (value: boolean) {
    this._orbitMode = value
    if (this.gizmo) {
      this.gizmo.enabled = value
      this.gizmo.show(value)
    }
  }

  /**
   * Sets Orbit mode target and moves camera accordingly
   */
  target (target: Object | THREE.Vector3, duration: number = 0) {
    if (target instanceof Object && !target.hasMesh) {
      throw new Error('Attempting to target a mesh with no geometry.')
    }

    const position =
      target instanceof THREE.Vector3 ? target : target.getCenter()!

    this._orbitTarget = position
    this.startLerp(duration, 'Rotation')
  }

  frame (
    target: Object | THREE.Sphere | 'all',
    center: boolean = false,
    duration: number = 0
  ) {
    const sphere =
      target === 'all'
        ? this._scene.getBoundingSphere()
        : target instanceof Object
          ? target.getBoundingSphere()
          : target instanceof THREE.Sphere
            ? target
            : undefined

    this.frameSphere(sphere, center, duration)
  }

  applySettings (settings: ViewerSettings) {
    // Mode
    this.orbitMode = settings.getCameraIsOrbit()

    // Camera
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.fov = settings.getCameraFov()
      this.camera.zoom = settings.getCameraZoom()
      this.camera.near = settings.getCameraNear()
      this.camera.far = settings.getCameraFar()
      this.camera.updateProjectionMatrix()
    }

    // Controls
    this._moveSpeed = settings.getCameraMoveSpeed()
    this._rotateSpeed = settings.getCameraRotateSpeed()
    this._orbitSpeed = settings.getCameraOrbitSpeed()

    // Values
    this._vimReferenceSize = settings.getCameraReferenceVimSize()
  }

  /**
   * Adapts camera speed to be faster for large model and slower for small models.
   */
  adaptToContent () {
    const sphere = this._scene.getBoundingSphere()
    this._sceneSizeMultiplier = sphere
      ? sphere.radius / this._vimReferenceSize
      : 1
  }

  get orbitDistance () {
    return this.camera.position.distanceTo(this._orbitTarget)
  }

  get targetOrbitDistance () {
    return this._targetPosition.distanceTo(this._orbitTarget)
  }

  /**
   * Moves the camera closer or farther away from orbit target.
   * @param amount movement size.
   */
  zoom (amount: number, duration: number = 0) {
    const sphere = this._scene.getBoundingSphere()

    if (this.camera instanceof THREE.PerspectiveCamera) {
      const reverse = 1 / (1 - this._zoomSpeed) - 1
      const factor = amount < 0 ? this._zoomSpeed : reverse
      const dist = this.targetOrbitDistance
      let offset = dist * factor
      offset = Math.max(this._minOrbitalDistance, offset)
      let targetDist = dist + offset * amount
      targetDist = Math.max(this._minOrbitalDistance, targetDist)

      // Distance is capped such that model is at least a certain screen size.
      const rad = (this.camera.fov / 2) * (Math.PI / 180)
      if (
        sphere.radius / (targetDist * Math.tan(rad)) <
        this._minModelScrenSize
      ) {
        return
      }

      const target = new THREE.Vector3(0, 0, targetDist)
      target.applyQuaternion(this.camera.quaternion)
      target.add(this._orbitTarget)
      this._targetPosition = target
      this.startLerp(duration, 'Position')
    } else {
      const multiplier = this._zoomSpeed * this.getBaseMultiplier()
      const padX = (this.camera.right - this.camera.left) * amount * multiplier
      const padY = (this.camera.top - this.camera.bottom) * amount * multiplier

      const X = this.camera.right - this.camera.left + 2 * padX
      const Y = this.camera.top - this.camera.bottom + 2 * padY
      const radius = Math.min(X / 2, Y / 2)

      // View box size is capped such that model is at least a certain screen size.
      // And tha box is of size at least min orbit distance
      if (sphere.radius / radius < this._minModelScrenSize) return
      if (radius * 2 < this._minOrbitalDistance) return

      this.camera.left -= padX
      this.camera.right += padX
      this.camera.bottom -= padY
      this.camera.top += padY
      this.camera.updateProjectionMatrix()
      this.onChanged?.()
    }
    this.gizmo?.show()
  }

  /**
   * Moves the camera along all three axes.
   */
  move3 (vector: THREE.Vector3) {
    this.cancelLerp()
    const v = new THREE.Vector3()
    if (this.orthographic) {
      const aspect = this._viewport.getAspectRatio()
      const dx = this.cameraOrthographic.right - this.cameraOrthographic.left
      const dy = this.cameraOrthographic.top - this.cameraOrthographic.bottom
      v.set(-vector.x * dx * aspect, vector.y * dy, 0)
    } else {
      v.copy(vector)
      v.applyQuaternion(this.camera.quaternion)
      v.multiplyScalar(this.getSpeedMultiplier() * this._moveSpeed)
    }

    this._orbitTarget.add(v)
    this._targetPosition.add(v)
    this._lockDirection = true
    this.startLerp(0, 'Position')
    this.gizmo?.show()
  }

  /**
   * Moves the camera along two axis
   */
  move2 (vector: THREE.Vector2, axes: 'XY' | 'XZ') {
    const direction =
      axes === 'XY'
        ? new THREE.Vector3(-vector.x, vector.y, 0)
        : axes === 'XZ'
          ? new THREE.Vector3(-vector.x, 0, vector.y)
          : undefined

    if (direction) this.move3(direction)
  }

  /**
   * Moves the camera along one axis
   */
  move1 (amount: number, axis: 'X' | 'Y' | 'Z') {
    const direction = new THREE.Vector3(
      axis === 'X' ? -amount : 0,
      axis === 'Y' ? amount : 0,
      axis === 'Z' ? amount : 0
    )

    this.move3(direction)
  }

  /**
   * Rotates the camera around the X or Y axis or both
   * @param vector where coordinates in range [-1, 1] for rotations of [-180, 180] degrees
   */
  rotate (vector: THREE.Vector2, duration: number = 0) {
    const euler = new THREE.Euler(0, 0, 0, 'YXZ')
    euler.setFromQuaternion(this.camera.quaternion)

    const factor = this.orbitMode
      ? -Math.PI * this._orbitSpeed
      : -Math.PI * this._rotateSpeed

    // When moving the mouse one full sreen
    // Orbit will rotate 180 degree around the scene
    euler.y += vector.x * factor
    euler.x += vector.y * factor
    euler.z = 0

    // Clamp X rotation to prevent performing a loop.
    const max = Math.PI * 0.48
    euler.x = Math.max(-max, Math.min(max, euler.x))
    const rotation = new Quaternion().setFromEuler(euler)

    if (this.orbitMode) {
      const target = new THREE.Vector3(0, 0, 1)
      target.applyQuaternion(rotation)
      this.orbit(target, duration)
    } else {
      const offset = new THREE.Vector3(0, 0, -this.orbitDistance)
      if (duration <= 0) {
        // apply rotation directly to camera
        this.camera.quaternion.copy(rotation)
        offset.applyQuaternion(this.camera.quaternion)
      } else {
        // apply rotation to target and lerp
        offset.applyQuaternion(rotation)
        this.startLerp(duration, 'Rotation')
      }
      this._orbitTarget = this.camera.position.clone().add(offset)
    }
  }

  orbit (forward: THREE.Vector3, duration: number = 0) {
    const direction = this.clampY(
      this._orbitTarget,
      this.camera.position,
      forward
    )

    const pos = this._orbitTarget.clone()
    const delta = direction.normalize().multiplyScalar(this.orbitDistance)
    this._targetPosition = pos.add(delta)
    this.startLerp(duration, 'Position')
  }

  /**
   * Rotates the camera so that it looks at sphere
   * Adjusts distance so that the sphere is well framed
   */
  private frameSphere (sphere: THREE.Sphere, center: boolean, duration: number) {
    const offset = this.camera.position.clone().sub(sphere.center)
    if (center) offset.setY(0)
    offset.normalize()
    offset.multiplyScalar(sphere.radius * 3)
    this._targetPosition = sphere.center.clone().add(offset)
    this._orbitTarget = sphere.center
    this.startLerp(duration, 'Both')
    this.updateProjection(sphere)
    this.gizmo?.show()
  }

  private lookAt (position: THREE.Vector3) {
    this.camera.lookAt(position)
    this.camera.up.set(0, 1, 0)
  }

  private updateProjection (sphere?: THREE.Sphere) {
    const aspect = this._viewport.getAspectRatio()
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = aspect
    } else {
      if (sphere) {
        this.camera.left = -sphere.radius * aspect
        this.camera.right = sphere.radius * aspect
        this.camera.top = sphere.radius
        this.camera.bottom = -sphere.radius
      }

      this.camera.near = -this.cameraPerspective.far
      this.camera.far = this.cameraPerspective.far
    }
    this.camera.updateProjectionMatrix()
  }

  get orthographic () {
    return this.camera instanceof THREE.OrthographicCamera
  }

  set orthographic (value: boolean) {
    if (value === this.orthographic) return

    if (value && !this.cameraOrthographic) {
      // prettier-ignore
      this.cameraOrthographic = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1)
    }

    const next = value ? this.cameraOrthographic : this.cameraPerspective
    next.position.copy(this.camera.position)
    next.rotation.copy(this.camera.rotation)
    this.camera = next

    this.updateProjection(this._scene.getBoundingSphere())
  }

  private getBaseMultiplier () {
    return Math.pow(1.25, this.speed)
  }

  private getSpeedMultiplier () {
    return (
      this.getBaseMultiplier() *
      // (dist / size) * (size / ref). Size gets canceled.
      (this.orbitMode
        ? this.orbitDistance / this._vimReferenceSize
        : this._firstPersonSpeed)
    )
  }

  private clampY (
    center: THREE.Vector3,
    origin: THREE.Vector3,
    value: THREE.Vector3
  ) {
    const result = value.clone()
    if (value.y !== 0 && value.x === 0 && value.z === 0) {
      const delta = origin.clone().sub(center)
      delta.setY(0)
      delta.normalize().multiplyScalar(0.01)
      result.x = delta.x
      result.z = delta.z
    }
    return result
  }

  private slerp (
    center: THREE.Vector3,
    start: THREE.Vector3,
    end: THREE.Vector3,
    value: number
  ) {
    const mid = start.clone().lerp(end, value)
    const d1 = start.distanceTo(center)
    const d2 = end.distanceTo(center)
    const dist = d1 + (d2 - d1) * value
    const dir = mid.clone().sub(center).normalize()
    const pos = center.clone().add(dir.multiplyScalar(dist))

    return pos
  }

  private startLerp (seconds: number, lerp: Lerp) {
    const time = new Date().getTime()
    this._lerpEndMs = time + seconds * 1000
    this._lerpStartMs = time
    this._lerpPosition = lerp === 'Position' || lerp === 'Both'
    this._lerpRotation = lerp === 'Rotation' || lerp === 'Both'
  }

  private shouldLerp () {
    return new Date().getTime() < this._lerpEndMs
  }

  private lerpProgress () {
    const done = new Date().getTime() - this._lerpStartMs
    const duration = this._lerpEndMs - this._lerpStartMs
    let progress = done / duration
    progress = Math.min(progress, 1)
    return progress
  }

  /**
   * Apply the camera frame update
   */
  update (deltaTime: number) {
    if (this.shouldLerp()) {
      if (this._lerpPosition && !this.isNearTarget()) {
        this.applyPositionLerp()
      }
      if (this._lerpRotation && !this.isLookingAtTarget()) {
        this.applyRotationLerp()
      } else if (!this._lockDirection) {
        this.lookAt(this._orbitTarget)
      }
      this.onChanged?.()
    } else {
      // End any outstanding lerp
      if (this._lerpPosition || this._lerpRotation) {
        this.endLerp()
      }

      this._targetPosition.copy(this.camera.position)

      this.applyVelocity(deltaTime)
    }

    this.gizmo?.setPosition(this._orbitTarget)
  }

  private isNearTarget () {
    return this.camera.position.distanceTo(this._targetPosition) < 0.1
  }

  private isLookingAtTarget () {
    return this.goesThrough(
      this.camera.position,
      this.forward,
      this._orbitTarget,
      0.01
    )
  }

  private goesThrough (
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    point: THREE.Vector3,
    tolerance: number
  ) {
    const x = (point.x - origin.x) / direction.x
    const y = (point.y - origin.y) / direction.y
    const z = (point.z - origin.z) / direction.z

    const result =
      Math.abs(x - y) < tolerance &&
      Math.abs(x - z) < tolerance &&
      Math.abs(y - z) < tolerance

    return result
  }

  private cancelLerp () {
    this._lerpPosition = false
    this._lerpRotation = false
    this._lockDirection = false
    this._lerpEndMs = 0
  }

  private endLerp () {
    this.cancelLerp()
    this.camera.position.copy(this._targetPosition)
    this.lookAt(this._orbitTarget)
  }

  private applyVelocity (deltaTime: number) {
    // Update the camera velocity and position
    const invBlendFactor = Math.pow(this._velocityBlendFactor, deltaTime)
    const blendFactor = 1.0 - invBlendFactor

    this._velocity.multiplyScalar(invBlendFactor)
    const deltaVelocity = this._targetVelocity
      .clone()
      .multiplyScalar(blendFactor)
    this._velocity.add(deltaVelocity)

    const deltaPosition = this._velocity.clone().multiplyScalar(deltaTime)

    this.camera.position.add(deltaPosition)
    this._orbitTarget.add(deltaPosition)

    if (this.orthographic) {
      const aspect = this._viewport.getAspectRatio()
      const d = -deltaPosition.dot(this.forward)

      const dx =
        this.cameraOrthographic.right -
        this.cameraOrthographic.left +
        2 * d * aspect
      const dy =
        this.cameraOrthographic.top -
        this.cameraOrthographic.bottom +
        2 * d * aspect
      const radius = Math.min(dx, dy)
      if (radius < this._minOrthoSize) return

      this.cameraOrthographic.left -= d * aspect
      this.cameraOrthographic.right += d * aspect
      this.cameraOrthographic.top += d
      this.cameraOrthographic.bottom -= d
      this.cameraOrthographic.updateProjectionMatrix()
      this.gizmo?.show()
    }

    if (this.isSignificant(deltaPosition)) {
      this.onChanged?.()
      this.gizmo?.show()
    }
  }

  private isSignificant (vector: THREE.Vector3) {
    // One hundreth of standard scene size per frame
    const min = (0.01 * this._sceneSizeMultiplier) / 60
    return (
      Math.abs(vector.x) > min ||
      Math.abs(vector.y) > min ||
      Math.abs(vector.z) > min
    )
  }

  private applyPositionLerp () {
    const alpha = this.lerpProgress()

    const pos = this.slerp(
      this._orbitTarget,
      this.camera.position,
      this._targetPosition,
      alpha
    )

    this.camera.position.copy(pos)
  }

  private applyRotationLerp () {
    const current = this.camera.position
      .clone()
      .add(this.forward.multiplyScalar(this.orbitDistance))
    const look = current.lerp(this._orbitTarget, this.lerpProgress())
    this.lookAt(look)
  }
}
