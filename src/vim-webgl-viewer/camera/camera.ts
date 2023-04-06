import * as THREE from 'three'

import { Viewport } from '../viewport'
import { Settings } from '../viewerSettings'
import { Object } from '../../vim'
import { RenderScene } from '../rendering/renderScene'
import { Quaternion } from 'three'
import { clamp } from 'three/src/math/MathUtils'
import { ISignal, SignalDispatcher } from 'ste-signals'
import { CameraGizmo } from '../gizmos/gizmoOrbit'
import { PerspectiveWrapper } from './perspective'
import { OrthographicWrapper } from './orthographic'
import { CameraLerp } from './cameraMovementLerp'
import { CameraMovementDo } from './cameraMovementDo'
import { CameraMovement } from './cameraMovement'

/**
 * Manages viewer camera movement and position
 */
export class Camera {
  gizmo: CameraGizmo | undefined

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
  private _sceneSizeMultiplier: number

  // orbit
  private _orthographic: boolean = false
  private _orbitMode: boolean = false
  private _orbitTarget = new THREE.Vector3()

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

  // Settings
  private _vimReferenceSize: number = 1
  private _velocityBlendFactor: number = 0.0001
  private _moveSpeed: number = 0.8

  constructor (scene: RenderScene, viewport: Viewport, settings: Settings) {
    this.camPerspective = new PerspectiveWrapper(new THREE.PerspectiveCamera())

    this.camOrthographic = new OrthographicWrapper(
      new THREE.OrthographicCamera()
    )
    this.camPerspective.camera.position.set(0, 0, -1000)
    this._movement = new CameraMovementDo(this)
    this._lerp = new CameraLerp(this, this._movement)
    this._scene = scene
    this._viewport = viewport

    this.applySettings(settings)
  }

  do () {
    this._lerp.cancel()
    return this._movement as CameraMovement
  }

  lerp (duration: number) {
    this._lerp.init(duration)
    return this._lerp as CameraMovement
  }

  frustrumSizeAt (point: THREE.Vector3) {
    return this.camPerspective.frustrumSizeAt(point)
  }

  dispose () {
    this.gizmo?.dispose()
    this.gizmo = undefined
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
    this._inputVelocity.setZ(this.orthographic ? 0 : -this._inputVelocity.z)
  }

  get orbitPosition () {
    return this._orbitTarget
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
    if (this._orbitMode === value) return
    this._orbitMode = value
    if (this.gizmo) {
      this.gizmo.enabled = value
      this.gizmo.show(value)
    }
    this._onValueChanged.dispatch()
  }

  applySettings (settings: Settings) {
    // Mode
    this.orbitMode = settings.camera.controls.orbit

    // Camera
    this.camPerspective.applySettings(settings)
    this.camOrthographic.applySettings(settings)

    // Controls
    this._moveSpeed = settings.camera.controls.moveSpeed

    // Values
    this._vimReferenceSize = settings.camera.controls.modelReferenceSize
    this._onValueChanged.dispatch()
  }

  /**
   * Adapts camera speed to be faster for large model and slower for small models.
   */
  adaptToContent () {
    const sphere = this._scene
      .getBoundingBox()
      .getBoundingSphere(new THREE.Sphere())

    this._sceneSizeMultiplier = sphere
      ? sphere.radius / this._vimReferenceSize
      : 1
  }

  get orbitDistance () {
    return this.position.distanceTo(this._orbitTarget)
  }

  save () {
    this._lerp.cancel()
    this._savedPosition.copy(this.position)
    this._savedTarget.copy(this._orbitTarget)
  }

  private updateProjection () {
    const aspect = this._viewport.getAspectRatio()
    this.camPerspective.updateProjection(aspect)

    const size = this.camPerspective.frustrumSizeAt(this.orbitPosition)
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
    this.applyVelocity(deltaTime)
    const moved = this.checkForMovement()
    if (moved) {
      this.camOrthographic.camera.position.copy(this.position)
      this.camOrthographic.camera.quaternion.copy(this.quaternion)
    }
    this.updateProjection()
    return moved
  }

  private applyVelocity (deltaTime: number) {
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
      return
    }

    const deltaPosition = this._velocity
      .clone()
      .multiplyScalar(deltaTime * this.getVelocityMultiplier() * 100)

    this._movement.move3(deltaPosition)
  }

  private getVelocityMultiplier () {
    return Math.pow(1.25, this.speed) * this._moveSpeed
  }

  private checkForMovement () {
    this._hasMoved = false
    if (
      !this._lastPosition.equals(this.position) ||
      !this._lastQuaternion.equals(this.quaternion) ||
      !this._lastTarget.equals(this._orbitTarget)
    ) {
      this.gizmo?.setPosition(this._orbitTarget)
      this.gizmo.show(true)
      this._hasMoved = true
      this._onMoved.dispatch()
    }
    this._lastPosition.copy(this.position)
    this._lastQuaternion.copy(this.quaternion)
    this._lastTarget.copy(this._orbitTarget)
    return this._hasMoved
  }
}
