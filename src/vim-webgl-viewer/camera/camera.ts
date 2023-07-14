/**
 * @module viw-webgl-viewer/camera
 */

import * as THREE from 'three'

import { Viewport } from '../viewport'
import { Settings } from '../viewerSettings'
import { RenderScene } from '../rendering/renderScene'
import { clamp } from 'three/src/math/MathUtils'
import { ISignal, SignalDispatcher } from 'ste-signals'
import { PerspectiveWrapper } from './perspective'
import { OrthographicWrapper } from './orthographic'
import { CameraLerp } from './cameraMovementLerp'
import { CameraMovementDo } from './cameraMovementDo'
import { CameraMovement } from './cameraMovement'

/**
 * Manages viewer camera movement and position
 */
export class Camera {
  camPerspective: PerspectiveWrapper
  camOrthographic: OrthographicWrapper

  private _viewport: Viewport
  _scene: RenderScene // make private again
  private _lerp: CameraLerp
  private _movement: CameraMovementDo

  // movements
  private _inputVelocity = new THREE.Vector3()
  private _velocity = new THREE.Vector3()
  private _speed: number = 0

  // orbit
  private _orthographic: boolean = false
  private _target = new THREE.Vector3()

  // updates
  private _lastPosition = new THREE.Vector3()
  private _lastQuaternion = new THREE.Quaternion()
  private _lastTarget = new THREE.Vector3()

  // saves
  _savedPosition: THREE.Vector3 = new THREE.Vector3(0, 0, -5)
  _savedTarget: THREE.Vector3 = new THREE.Vector3(0, 0, 0)

  private _onValueChanged = new SignalDispatcher()

  get onValueChanged () {
    return this._onValueChanged.asEvent()
  }

  private _hasMoved: boolean
  get hasMoved () {
    return this._hasMoved
  }

  private _onMoved = new SignalDispatcher()
  get onMoved (): ISignal {
    return this._onMoved.asEvent()
  }

  /** Ignore movement permissions when true */
  private _force: boolean = false

  // Allowed Movement
  /** Vector3 of 0 or 1 to enable/disable movement along each axis */
  private _allowedMovement = new THREE.Vector3(1, 1, 1)
  get allowedMovement () {
    return this._force ? new THREE.Vector3(1, 1, 1) : this._allowedMovement
  }

  set allowedMovement (axes: THREE.Vector3) {
    this._allowedMovement.copy(axes)
    this._allowedMovement.x = this._allowedMovement.x === 0 ? 0 : 1
    this._allowedMovement.y = this._allowedMovement.y === 0 ? 0 : 1
    this._allowedMovement.z = this._allowedMovement.z === 0 ? 0 : 1
  }

  // Allowed Rotation
  /** Vector2 of 0 or 1 to enable/disable rotation around x or y. */
  get allowedRotation () {
    return this._force ? new THREE.Vector2(1, 1) : this._allowedRotation
  }

  set allowedRotation (axes: THREE.Vector2) {
    this._allowedRotation.copy(axes)
    this._allowedRotation.x = this._allowedRotation.x === 0 ? 0 : 1
    this._allowedRotation.y = this._allowedRotation.y === 0 ? 0 : 1
  }

  private _allowedRotation = new THREE.Vector2(1, 1)

  // Default Forward
  private _defaultForward = new THREE.Vector3(0, 0, 1)
  get defaultForward () {
    return this._defaultForward
  }

  set defaultForward (value: THREE.Vector3) {
    if (value.x === 0 && value.y === 0 && value.z === 0) {
      this._defaultForward.set(0, 0, 1)
    } else {
      this._defaultForward.copy(value)
    }
  }

  // Settings
  private _velocityBlendFactor: number = 0.0001
  private _moveSpeed: number = 1

  constructor (scene: RenderScene, viewport: Viewport, settings: Settings) {
    this.camPerspective = new PerspectiveWrapper(new THREE.PerspectiveCamera())

    this.camOrthographic = new OrthographicWrapper(
      new THREE.OrthographicCamera()
    )

    this._movement = new CameraMovementDo(this)
    this._lerp = new CameraLerp(this, this._movement)

    this._scene = scene
    this._viewport = viewport

    this.applySettings(settings)
    this.do().orbitTowards(this._defaultForward)
    this.do().setDistance(-1000)
  }

  /**
   * Interface to move camera instantaneously
   * @param force Set to true to ignore locked axis and rotation.
   */
  do (force: boolean = false) {
    this._force = force
    this._lerp.cancel()
    return this._movement as CameraMovement
  }

  /**
   * Interface to move camera over time
   * @param force Set to true to ignore locked axis and rotation.
   */
  lerp (duration: number = 1, force: boolean = false) {
    this.stop()
    this._force = force
    this._lerp.init(duration)
    return this._lerp as CameraMovement
  }

  frustrumSizeAt (point: THREE.Vector3) {
    return this.camPerspective.frustrumSizeAt(point)
  }

  notifyMovement () {
    this._hasMoved = true
    this._onMoved.dispatch()
  }

  get three () {
    return this._orthographic
      ? this.camOrthographic.camera
      : this.camPerspective.camera
  }

  get quaternion () {
    return this.camPerspective.camera.quaternion
  }

  get position () {
    return this.camPerspective.camera.position
  }

  get matrix () {
    this.camPerspective.camera.updateMatrix()
    return this.camPerspective.camera.matrix
  }

  get forward () {
    return this.camPerspective.camera.getWorldDirection(new THREE.Vector3())
  }

  get speed () {
    return this._speed
  }

  set speed (value: number) {
    this._speed = clamp(value, -25, 25)
    this._onValueChanged.dispatch()
  }

  get localVelocity () {
    const result = this._velocity.clone()
    result.applyQuaternion(this.quaternion.clone().invert())
    result.setZ(-result.z)
    return result
  }

  /**
   * Set current velocity of the camera.
   */
  set localVelocity (vector: THREE.Vector3) {
    this._lerp.cancel()
    this._inputVelocity.copy(vector)
    this._inputVelocity.setZ(-this._inputVelocity.z)
  }

  stop () {
    this._inputVelocity.set(0, 0, 0)
    this._velocity.set(0, 0, 0)
  }

  get target () {
    return this._target
  }

  applySettings (settings: Settings) {
    // Camera
    this._defaultForward = new THREE.Vector3().copy(settings.camera.forward)
    this._orthographic = settings.camera.orthographic
    this.allowedMovement = settings.camera.allowedMovement
    this.allowedRotation = settings.camera.allowedRotation
    this.camPerspective.applySettings(settings)
    this.camOrthographic.applySettings(settings)

    // Controls
    this._moveSpeed = settings.camera.controls.moveSpeed

    // Values
    this._onValueChanged.dispatch()
  }

  get orbitDistance () {
    return this.position.distanceTo(this._target)
  }

  save () {
    this._lerp.cancel()
    this._savedPosition.copy(this.position)
    this._savedTarget.copy(this._target)
  }

  private updateProjection () {
    const aspect = this._viewport.getAspectRatio()
    this.camPerspective.updateProjection(aspect)

    const size = this.camPerspective.frustrumSizeAt(this.target)
    this.camOrthographic.updateProjection(size, aspect)
  }

  get orthographic () {
    return this._orthographic
  }

  set orthographic (value: boolean) {
    if (value === this._orthographic) return
    this._orthographic = value
    this._onValueChanged.dispatch()
  }

  update (deltaTime: number) {
    if (this.applyVelocity(deltaTime)) {
      this.updateOrthographic()
    }

    const moved = this.checkForMovement()
    if (moved) {
      this.camOrthographic.camera.position.copy(this.position)
      this.camOrthographic.camera.quaternion.copy(this.quaternion)
    }
    this.updateProjection()
    return moved
  }

  private applyVelocity (deltaTime: number) {
    if (
      this._inputVelocity.x === 0 &&
      this._inputVelocity.y === 0 &&
      this._inputVelocity.z === 0 &&
      this._velocity.x === 0 &&
      this._velocity.y === 0 &&
      this._velocity.z === 0
    ) {
      // Skip update if unneeded.
      return false
    }

    // Update the camera velocity and position
    const invBlendFactor = Math.pow(this._velocityBlendFactor, deltaTime)
    const blendFactor = 1.0 - invBlendFactor
    this._velocity.multiplyScalar(invBlendFactor)
    const deltaVelocity = this._inputVelocity
      .clone()
      .multiplyScalar(blendFactor)
    this._velocity.add(deltaVelocity)
    if (this._velocity.lengthSq() < deltaTime / 10) {
      this._velocity.set(0, 0, 0)
      return false
    }

    const deltaPosition = this._velocity
      .clone()
      .multiplyScalar(deltaTime * this.getVelocityMultiplier())

    this.do().move3(deltaPosition)
    return true
  }

  private updateOrthographic () {
    if (this.orthographic) {
      // Cancel target movement in Z in orthographic mode.
      const delta = this._lastTarget.clone().sub(this.position)
      const dist = delta.dot(this.forward)
      this.target.copy(this.forward).multiplyScalar(dist).add(this.position)

      // Prevent orthograpic camera from moving past orbit.
      const prev = this._lastPosition.clone().sub(this._target)
      const next = this.position.clone().sub(this._target)
      if (prev.dot(next) < 0 || next.lengthSq() < 1) {
        this.position.copy(this._target).add(this.forward.multiplyScalar(-1))
      }
    }
  }

  private getVelocityMultiplier () {
    const rotated = !this._lastQuaternion.equals(this.quaternion)
    const mod = rotated ? 1 : 1.66
    return Math.pow(1.25, this.speed) * this._moveSpeed * mod * 100
  }

  private checkForMovement () {
    this._hasMoved = false
    if (
      !this._lastPosition.equals(this.position) ||
      !this._lastQuaternion.equals(this.quaternion) ||
      !this._lastTarget.equals(this._target)
    ) {
      this._hasMoved = true
      this._onMoved.dispatch()
    }
    this._lastPosition.copy(this.position)
    this._lastQuaternion.copy(this.quaternion)
    this._lastTarget.copy(this._target)
    return this._hasMoved
  }
}
