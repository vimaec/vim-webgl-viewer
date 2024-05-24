/**
 * @module viw-webgl-viewer/camera
 */

import * as THREE from 'three'

import { Viewport } from '../viewport'
import { ViewerSettings } from '../settings/viewerSettings'
import { RenderScene } from '../rendering/renderScene'
import { clamp } from 'three/src/math/MathUtils'
import { ISignal, SignalDispatcher } from 'ste-signals'
import { PerspectiveWrapper } from './perspective'
import { OrthographicWrapper } from './orthographic'
import { CameraLerp } from './cameraMovementLerp'
import { CameraMovementSnap } from './cameraMovementSnap'
import { CameraMovement } from './cameraMovement'

/**
 * Interface representing a camera with various properties and methods for controlling its behavior.
 */
export interface ICamera {
  /**
   * A signal that is dispatched when camera settings change.
   */
  onSettingsChanged: ISignal

  /**
   * A signal that is dispatched when camera moves.
   */
  onMoved: ISignal

  /**
   * True if the camera has moved this frame.
   */
  get hasMoved() : boolean

  /**
   * Represents allowed movement along each axis using a Vector3 object.
   * Each component of the Vector3 should be either 0 or 1 to enable/disable movement along the corresponding axis.
   */
  allowedMovement : THREE.Vector3

  /**
   * Represents allowed rotation using a Vector2 object.
   * Each component of the Vector2 should be either 0 or 1 to enable/disable rotation around the corresponding axis.
   */
  allowedRotation : THREE.Vector2

  /**
   * The default forward direction that can be used to initialize the camera.
   */
  defaultForward : THREE.Vector3

  /**
   * Interface for instantaneously moving the camera.
   * @param {boolean} [force=false] - Set to true to ignore locked axis and rotation.
   * @returns {CameraMovement} The camera movement api.
   */
  snap (force?: boolean) : CameraMovement

  /**
   * Interface for smoothly moving the camera over time.
   * @param {number} [duration=1] - The duration of the camera movement animation.
   * @param {boolean} [force=false] - Set to true to ignore locked axis and rotation.
   * @returns {CameraMovement} The camera movement api.
   */
  lerp (duration: number, force?: boolean) : CameraMovement

  /**
   * Calculates the frustum size at a given point in the scene.
   * @param {THREE.Vector3} point - The point in the scene to calculate the frustum size at.
   * @returns {number} The frustum size at the specified point.
   */
  frustrumSizeAt (point: THREE.Vector3) : THREE.Vector2

  /**
   * The current THREE Camera
   */
  get three () : THREE.Camera

  /**
   * The quaternion representing the orientation of the object.
   */
  get quaternion () : THREE.Quaternion

   /**
   * The position of the camera.
   */
  get position () : THREE.Vector3

  /**
   * The matrix representing the transformation of the camera.
   */
  get matrix () : THREE.Matrix4

  /**
   * The forward direction of the camera.
   */
  get forward () : THREE.Vector3

  get isLerping () : boolean

  /**
   * The camera speed factor.
   */
  speed : number

  /**
   * The current or target velocity of the camera.
   */
  localVelocity : THREE.Vector3

  /**
   * Immediately stops the camera movement.
   */
  stop () : void

  /**
   * The target at which the camera is looking at and around which it rotates.
   */
  get target () : THREE.Vector3

  /**
   * The distance from the camera to the target.
   */
  get orbitDistance () : number

  /**
   * Saves current camera orientation to restore on next reset.
   */
  save () : void

  /**
   * Represents whether the camera projection is orthographic.
   */
  orthographic : boolean
}

/**
 * Manages viewer camera movement and position
 */
export class Camera implements ICamera {
  camPerspective: PerspectiveWrapper
  camOrthographic: OrthographicWrapper

  private _viewport: Viewport
  _scene: RenderScene // make private again
  private _lerp: CameraLerp
  private _movement: CameraMovementSnap

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

  /**
   * A signal that is dispatched when camera settings change.
   */
  get onSettingsChanged () {
    return this._onValueChanged.asEvent()
  }

  private _onValueChanged = new SignalDispatcher()

  /**
   * True if the camera has moved this frame.
   */
  get hasMoved () {
    return this._hasMoved
  }

  private _hasMoved: boolean

  get isLerping () {
    return this._lerp.isLerping
  }

  /**
   * A signal that is dispatched when the camera is moved.
   */
  get onMoved (): ISignal {
    return this._onMoved.asEvent()
  }

  private _onMoved = new SignalDispatcher()

  /** Ignore movement permissions when true */
  private _force: boolean = false

  /**
   * Represents allowed movement along each axis using a Vector3 object.
   * Each component of the Vector3 should be either 0 or 1 to enable/disable movement along the corresponding axis.
   */
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

  /**
   * Represents allowed rotation using a Vector2 object.
   * Each component of the Vector2 should be either 0 or 1 to enable/disable rotation around the corresponding axis.
   */
  get allowedRotation () {
    return this._force ? new THREE.Vector2(1, 1) : this._allowedRotation
  }

  set allowedRotation (axes: THREE.Vector2) {
    this._allowedRotation.copy(axes)
    this._allowedRotation.x = this._allowedRotation.x === 0 ? 0 : 1
    this._allowedRotation.y = this._allowedRotation.y === 0 ? 0 : 1
  }

  private _allowedRotation = new THREE.Vector2(1, 1)

  /**
   * The default forward direction that can be used to initialize the camera.
   */
  private _defaultForward = new THREE.Vector3(1, -1, 1).normalize()
  get defaultForward () {
    return this._defaultForward
  }

  set defaultForward (value: THREE.Vector3) {
    if (value.x === 0 && value.y === 0 && value.z === 0) {
      this._defaultForward.set(1, -1, 1).normalize()
    } else {
      this._defaultForward.copy(value).normalize()
    }
  }

  // Settings
  private _velocityBlendFactor: number = 0.0001
  private _moveSpeed: number = 1

  constructor (scene: RenderScene, viewport: Viewport, settings: ViewerSettings) {
    this.camPerspective = new PerspectiveWrapper(new THREE.PerspectiveCamera())

    this.camOrthographic = new OrthographicWrapper(
      new THREE.OrthographicCamera()
    )

    this._movement = new CameraMovementSnap(this)
    this._lerp = new CameraLerp(this, this._movement)

    this._scene = scene
    this._viewport = viewport

    this.applySettings(settings)
    this.snap(true).setDistance(-1000)
    this.snap(true).orbitTowards(this._defaultForward)
  }

  /**
   * Interface for instantaneously moving the camera.
   * @param {boolean} [force=false] - Set to true to ignore locked axis and rotation.
   * @returns {CameraMovement} The camera movement api.
   */
  snap (force: boolean = false) : CameraMovement {
    this._force = force
    this._lerp.cancel()
    return this._movement as CameraMovement
  }

  /**
   * Interface for smoothly moving the camera over time.
   * @param {number} [duration=1] - The duration of the camera movement animation.
   * @param {boolean} [force=false] - Set to true to ignore locked axis and rotation.
   * @returns {CameraMovement} The camera movement api.
   */
  lerp (duration: number = 1, force: boolean = false) {
    this.stop()
    this._force = force
    this._lerp.init(duration)
    return this._lerp as CameraMovement
  }

  /**
   * Calculates the frustum size at a given point in the scene.
   * @param {THREE.Vector3} point - The point in the scene to calculate the frustum size at.
   * @returns {number} The frustum size at the specified point.
   */
  frustrumSizeAt (point: THREE.Vector3) {
    return this.camPerspective.frustrumSizeAt(point)
  }

  /**
   * The current THREE Camera
   */
  get three () {
    return this._orthographic
      ? this.camOrthographic.camera
      : this.camPerspective.camera
  }

  /**
   * The quaternion representing the orientation of the object.
   */
  get quaternion () {
    return this.camPerspective.camera.quaternion
  }

  /**
   * The position of the camera.
   */
  get position () {
    return this.camPerspective.camera.position
  }

  /**
   * The matrix representing the transformation of the camera.
   */
  get matrix () {
    this.camPerspective.camera.updateMatrix()
    return this.camPerspective.camera.matrix
  }

  /**
   * The forward direction of the camera.
   */
  get forward () {
    return this.camPerspective.camera.getWorldDirection(new THREE.Vector3())
  }

  /**
   * The camera speed factor.
   */
  get speed () {
    return this._speed
  }

  set speed (value: number) {
    this._speed = clamp(value, -25, 25)
    this._onValueChanged.dispatch()
  }

  /**
   * The current or target velocity of the camera.
   */
  get localVelocity () {
    const result = this._velocity.clone()
    result.applyQuaternion(this.quaternion.clone().invert())
    result.setZ(-result.z)
    return result
  }

  /**
   * The current or target velocity of the camera.
   */
  set localVelocity (vector: THREE.Vector3) {
    this._lerp.cancel()
    this._inputVelocity.copy(vector)
    this._inputVelocity.setZ(-this._inputVelocity.z)
  }

  /**
   * Immediately stops the camera movement.
   */
  stop () {
    this._lerp.cancel()
    this._inputVelocity.set(0, 0, 0)
    this._velocity.set(0, 0, 0)
  }

  /**
   * The target at which the camera is looking at and around which it rotates.
   */
  get target () {
    return this._target
  }

  applySettings (settings: ViewerSettings) {
    // Camera

    this.defaultForward = settings.camera.forward
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

  /**
   * The distance from the camera to the target.
   */
  get orbitDistance () {
    return this.position.distanceTo(this._target)
  }

  /**
   * Saves current camera orientation to restore on next reset.
   */
  save () {
    this._lerp.cancel()
    this._savedPosition.copy(this.position)
    this._savedTarget.copy(this._target)
  }

  /**
   * Represents whether the camera projection is orthographic.
   */
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

  private updateProjection () {
    const aspect = this._viewport.getAspectRatio()
    this.camPerspective.updateProjection(aspect)

    const size = this.camPerspective.frustrumSizeAt(this.target)
    this.camOrthographic.updateProjection(size, aspect)
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

    this.snap().move3(deltaPosition)
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
    const frustrum = this.frustrumSizeAt(this.target).length()
    return Math.pow(1.25, this.speed) * this._moveSpeed * mod * frustrum
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
