/**
 @module viw-webgl-viewer
*/

import * as THREE from 'three'
import { CameraGizmo } from './gizmos'
import { Renderer } from './renderer'
import { ViewerSettings } from './viewerSettings'
import { DEG2RAD } from 'three/src/math/MathUtils'
import { Object } from '../vim'

export const DIRECTIONS = {
  forward: new THREE.Vector3(0, 0, -1),
  back: new THREE.Vector3(0, 0, 1),
  left: new THREE.Vector3(-1, 0, 0),
  right: new THREE.Vector3(1, 0, 0),
  up: new THREE.Vector3(0, 1, 0),
  down: new THREE.Vector3(0, -1, 0)
}

/**
 * Manages viewer camera movement and position
 */
export class Camera {
  camera: THREE.PerspectiveCamera
  private _renderer: Renderer
  private _gizmo: CameraGizmo

  private _inputVelocity: THREE.Vector3
  private _velocity: THREE.Vector3
  private _impulse: THREE.Vector3
  speed: number

  private _orbitalTarget: THREE.Vector3
  private _minOrbitalDistance: number = 0.02
  private _currentOrbitalDistance: number
  private _orbitalTargetDistance: number

  private _lerpSecondsDuration: number
  private _lerpMsEndtime: number

  private _orbitMode: boolean = false

  // Settings
  private _vimReferenceSize: number
  private _sceneSizeMultiplier: number = 1
  private _velocityBlendFactor: number = 0.0001
  private _moveSpeed: number = 0.8
  private _rotateSpeed: number = 1
  private _orbitSpeed: number = 1
  private _wheelSpeed: number = 0.2

  constructor (renderer: Renderer, settings: ViewerSettings) {
    this.camera = renderer.camera
    this._renderer = renderer
    this._gizmo = new CameraGizmo(renderer)
    this.applySettings(settings)

    this._inputVelocity = new THREE.Vector3(0, 0, 0)
    this._velocity = new THREE.Vector3(0, 0, 0)
    this._impulse = new THREE.Vector3(0, 0, 0)
    this.speed = 0
    this._sceneSizeMultiplier = 1
    this._orbitalTarget = new THREE.Vector3(0, 0, 0)
    this._currentOrbitalDistance = this.camera.position
      .clone()
      .sub(this._orbitalTarget)
      .length()
    this._orbitalTargetDistance = this._currentOrbitalDistance
  }

  dispose () {
    this._gizmo.dispose()
    this._gizmo = undefined
  }

  /**
   * Resets camera to default state.
   */
  reset () {
    this.camera.position.set(0, 0, -5)
    this.camera.lookAt(0, 0, 1)

    this._inputVelocity.set(0, 0, 0)
    this._velocity.set(0, 0, 0)
    this._impulse.set(0, 0, 0)

    this._currentOrbitalDistance = 5
    this._orbitalTarget.set(0, 0, 0)
    this._orbitalTargetDistance = this._currentOrbitalDistance
  }

  get localVelocity () {
    const result = this._velocity.clone()
    result.applyQuaternion(this.camera.quaternion.clone().invert())
    result.setZ(-result.z)
    result.multiplyScalar(1 / this.getSpeedMultiplier())
    return result
  }

  /**
   * Set current velocity of the camera.
   */
  set localVelocity (vector: THREE.Vector3) {
    const move = vector.clone()
    move.setZ(-move.z)
    move.applyQuaternion(this.camera.quaternion)
    move.multiplyScalar(this.getSpeedMultiplier())
    this._inputVelocity.copy(move)
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
    this._gizmo.show(value)
  }

  /**
   * Sets Orbit mode target and moves camera accordingly
   */
  target (target: Object | THREE.Vector3) {
    const position = target instanceof THREE.Vector3 ? target : target.getCenter()
    this._orbitalTarget = position
    this._orbitalTargetDistance = this.camera.position.distanceTo(position)
    this.startLerp(0.4)
  }

  frame (target: Object | THREE.Sphere | 'all') {
    if (target === 'all') {
      this.frameSphere(this._renderer.getBoundingSphere())
    }
    if (target instanceof Object) {
      this.frameSphere(target.getBoundingSphere())
    }
    if (target instanceof THREE.Sphere) {
      this.frameSphere(target)
    }
  }

  /**
 * Rotates the camera to look at target
 */
  lookAt (target: Object | THREE.Vector3) {
    const position = target instanceof THREE.Vector3 ? target : target.getCenter()
    this.camera.lookAt(position)
  }

  applySettings (settings: ViewerSettings) {
    // Mode
    this.orbitMode = settings.getCameraIsOrbit()

    // Camera
    this.camera.fov = settings.getCameraFov()
    this.camera.zoom = settings.getCameraZoom()
    this.camera.near = settings.getCameraNear()
    this.camera.far = settings.getCameraFar()
    this.camera.updateProjectionMatrix()

    // Controls
    this._moveSpeed = settings.getCameraMoveSpeed()
    this._rotateSpeed = settings.getCameraRotateSpeed()
    this._orbitSpeed = settings.getCameraOrbitSpeed()

    // Gizmo
    this._gizmo.applySettings(settings)

    // Values
    this._vimReferenceSize = settings.getCameraReferenceVimSize()
  }

  /**
   * Adapts camera speed to be faster for large model and slower for small models.
   */
  adaptToContent () {
    const sphere = this._renderer.getBoundingSphere()
    this._sceneSizeMultiplier = sphere.radius / this._vimReferenceSize
    // Gizmo
    const gizmoSize =
      Math.tan((DEG2RAD * this.camera.fov) / 2) *
      (this._sceneSizeMultiplier / 10)
    this._gizmo.setScale(gizmoSize)
    this._gizmo.show(this.orbitMode)
  }

  /**
   * Smoothly moves the camera in given direction for a short distance.
   */
  addImpulse (impulse: THREE.Vector3) {
    const localImpulse = impulse
      .clone()
      .multiplyScalar(this.getSpeedMultiplier() * this._wheelSpeed)
    localImpulse.applyQuaternion(this.camera.quaternion)
    this._impulse.add(localImpulse)
  }

  /**
   * Moves the camera along all three axes.
   */
  move3 (vector: THREE.Vector3) {
    const v = vector.clone()
    v.applyQuaternion(this.camera.quaternion)
    v.multiplyScalar(this.getSpeedMultiplier())

    this._orbitalTarget.add(v)
    this._gizmo.show()
    if (!this.orbitMode) {
      this.camera.position.add(v)
    }
  }

  /**
   * Moves the camera along two axis
   */
  move2 (vector: THREE.Vector2, axes : 'XY' | 'XZ') {
    const direction =
     axes === 'XY'
       ? new THREE.Vector3(-vector.x, vector.y, 0)
       : axes === 'XZ'
         ? new THREE.Vector3(-vector.x, 0, vector.y)
         : undefined

    this.move3(direction)
  }

  /**
   * Moves the camera along one axis
   */
  move1 (amount: number, axis : 'X' | 'Y' | 'Z') {
    const direction = new THREE.Vector3(
      axis === 'X' ? -amount : 0,
      axis === 'Y' ? amount : 0,
      axis === 'Z' ? amount : 0
    )

    this._currentOrbitalDistance += direction.z

    this.move3(direction)
  }

  /**
   * Rotates the camera around the X or Y axis or both
   * @param vector where coordinates in range [-1, 1] for rotations of [-180, 180] degrees
   */
  rotate (vector: THREE.Vector2) {
    if (this.isLerping()) return
    const euler = new THREE.Euler(0, 0, 0, 'YXZ')
    euler.setFromQuaternion(this.camera.quaternion)

    // When moving the mouse one full sreen
    // Orbit will rotate 180 degree around the scene
    // Basic will rotate 180 degrees on itself
    const factor = this.orbitMode
      ? Math.PI * this._orbitSpeed
      : Math.PI * this._rotateSpeed

    euler.y -= vector.x * factor
    euler.x -= vector.y * factor
    euler.z = 0

    // Clamp X rotation to prevent performing a loop.
    const max = Math.PI * 0.48
    euler.x = Math.max(-max, Math.min(max, euler.x))

    this.camera.quaternion.setFromEuler(euler)

    if (!this.orbitMode) {
      const offset = new THREE.Vector3(0, 0, 1)
        .applyQuaternion(this.camera.quaternion)
        .multiplyScalar(this._currentOrbitalDistance)

      this._orbitalTarget = this.camera.position.clone().sub(offset)
    }
  }

  /**
   * Apply the camera frame update
   */
  update (deltaTime: number) {
    const targetVelocity = this._inputVelocity.clone()

    // Update the camera velocity and position
    const invBlendFactor = Math.pow(this._velocityBlendFactor, deltaTime)
    const blendFactor = 1.0 - invBlendFactor

    this._velocity.multiplyScalar(invBlendFactor)
    targetVelocity.multiplyScalar(blendFactor)
    this._velocity.add(targetVelocity)

    this._currentOrbitalDistance =
      this._currentOrbitalDistance * invBlendFactor +
      this._orbitalTargetDistance * blendFactor

    const positionDelta = this._velocity.clone().multiplyScalar(deltaTime)
    const impulse = this._impulse.clone().multiplyScalar(blendFactor)
    positionDelta.add(impulse)

    const orbitDelta = positionDelta.clone()
    if (this.orbitMode) {
      // compute local space forward component of movement
      const inv = this.camera.quaternion.clone().invert()
      const local = positionDelta.clone().applyQuaternion(inv)
      // remove z component
      orbitDelta.set(local.x, local.y, 0)
      // compute back to world space
      orbitDelta.applyQuaternion(this.camera.quaternion)

      // apply local space z to orbit distance,
      this._currentOrbitalDistance = Math.max(
        this._currentOrbitalDistance + local.z,
        this._minOrbitalDistance * this._sceneSizeMultiplier
      )
      this._orbitalTargetDistance = this._currentOrbitalDistance
    }

    this._impulse.multiplyScalar(invBlendFactor)
    this.camera.position.add(positionDelta)
    this._orbitalTarget.add(orbitDelta)

    if (this.orbitMode) {
      const target = new THREE.Vector3(0, 0, this._currentOrbitalDistance)
      target.applyQuaternion(this.camera.quaternion)
      target.add(this._orbitalTarget)

      if (this.isLerping()) {
        const frames = this._lerpSecondsDuration / deltaTime
        const alpha = 1 - Math.pow(0.01, 1 / frames)
        this.camera.position.lerp(target, alpha)
        this._gizmo.show(false)
      } else {
        this.camera.position.copy(target)
        if (this.isSignificant(positionDelta)) {
          this._gizmo.show()
        }
      }
    }

    this._gizmo.setPosition(this._orbitalTarget)
  }

  /**
   * Rotates the camera so that it looks at sphere
   * Adjusts distance so that the sphere is well framed
   */
  private frameSphere (sphere?: THREE.Sphere) {
    if (!sphere) {
      this.reset()
      return
    }

    this.camera.position.copy(
      sphere.center
        .clone()
        .add(new THREE.Vector3(0, sphere.radius, -2 * sphere.radius))
    )
    this.camera.lookAt(sphere.center)
    this._orbitalTarget = sphere.center
    this._currentOrbitalDistance = this._orbitalTarget
      .clone()
      .sub(this.camera.position)
      .length()
    this._orbitalTargetDistance = this._currentOrbitalDistance
  }

  private getSpeedMultiplier () {
    return (
      Math.pow(1.25, this.speed) *
      this._sceneSizeMultiplier *
      this._moveSpeed
    )
  }

  private isLerping () {
    return new Date().getTime() < this._lerpMsEndtime
  }

  private startLerp (seconds: number) {
    this._lerpMsEndtime = new Date().getTime() + seconds * 1000
    this._lerpSecondsDuration = seconds
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
  orbitMode : boolean

  /**
   * Current local velocity
   */
  localVelocity : THREE.Vector3
  /**
   * Rotates the camera around the X or Y axis or both
   * @param vector where coordinates are in relative screen size. ie [-1, 1]
   */

  /**
   * Nudges the camera in given direction for a short distance.
   * @param impulse impulse vector in camera local space.
   */
  addImpulse (impulse: THREE.Vector3): void

  /**
   * Moves the camera along all three axes.
   */
  move3 (vector: THREE.Vector3) : void

  /**
   * Moves the camera along two axes.
   */
  move2 (vector: THREE.Vector2, axes : 'XY' | 'XZ') : void

  /**
   * Moves the camera along one axis.
   */
  move1 (amount: number, axis : 'X' | 'Y' | 'Z') : void

  /**
   * Rotates the camera around the X or Y axis or both
   * @param vector where coordinates in range [-1, 1] for rotations of [-180, 180] degrees
   */
  rotate (vector: THREE.Vector2) : void

  /**
   * Sets orbit mode target and moves camera accordingly
   */
  target (target: Object | THREE.Vector3) : void

  /**
   * Rotates the camera to look at target
   */
  lookAt (target: Object | THREE.Vector3)

  /**
   * Moves and rotates the camera so that target is well framed.
   */
  frame (target: Object | THREE.Sphere | 'all') : void
}
