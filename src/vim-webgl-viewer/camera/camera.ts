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

  camActive: PerspectiveWrapper | OrthographicWrapper
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
  private _orbitMode: boolean = false
  private _orbitTarget = new THREE.Vector3()

  // updates
  private _lastPosition = new THREE.Vector3()
  private _lastQuaternion = new THREE.Quaternion()

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
  private _sceneSizeMultiplier: number = 1
  private _velocityBlendFactor: number = 0.0001
  private _moveSpeed: number = 0.8
  private _rotateSpeed: number = 1
  private _orbitSpeed: number = 1
  private _firstPersonSpeed = 10

  constructor (scene: RenderScene, viewport: Viewport, settings: Settings) {
    this.camPerspective = new PerspectiveWrapper(
      new THREE.PerspectiveCamera(),
      viewport
    )
    this.camOrthographic = new OrthographicWrapper(
      new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1),
      viewport
    )
    this._movement = new CameraMovementDo(this)
    this._lerp = new CameraLerp(this, this._movement)
    this.camActive = this.camPerspective
    this._scene = scene
    this._viewport = viewport
    this._viewport.onResize.subscribe(() => {
      this.updateProjection(this._scene.getBoundingBox())
    })
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
    return this.camActive.frustrumSizeAt(point)
  }

  dispose () {
    this.gizmo?.dispose()
    this.gizmo = undefined
  }

  get three () {
    return this.camActive.camera
  }

  get quaternion () {
    return this.camActive.quaternion
  }

  get position () {
    return this.camActive.position
  }

  get matrix () {
    this.camActive.camera.updateMatrix()
    return this.camActive.camera.matrix
  }

  get forward () {
    return this.camActive.forward
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
    result.applyQuaternion(this.camActive.quaternion.clone().invert())
    result.setZ(-result.z)
    result.multiplyScalar((1 / this.getVelocityMultiplier()) * this._moveSpeed)
    return result
  }

  get orbitPosition () {
    return this._orbitTarget
  }

  /**
   * Set current velocity of the camera.
   */
  set localVelocity (vector: THREE.Vector3) {
    this._lerp.cancel()
    this._inputVelocity.copy(vector)
    this._inputVelocity.setZ(-this._inputVelocity.z)
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
    this._rotateSpeed = settings.camera.controls.rotateSpeed
    this._orbitSpeed = settings.camera.controls.orbitSpeed

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

  private updateProjection (target: THREE.Sphere | THREE.Box3) {
    this.camActive.updateProjection(target)
  }

  get orthographic () {
    return this.camActive instanceof OrthographicWrapper
  }

  set orthographic (value: boolean) {
    if (value === this.orthographic) return

    const next = value ? this.camOrthographic! : this.camPerspective

    next.position.copy(this.camActive.position)
    next.quaternion.copy(this.camActive.quaternion)
    this.camActive = next

    this.updateProjection(this._scene.getBoundingBox())
    this._onValueChanged.dispatch()
  }

  private getBaseMultiplier () {
    return Math.pow(1.25, this.speed)
  }

  private getVelocityMultiplier () {
    const dist = this.orbitMode
      ? this.orbitDistance / this._vimReferenceSize
      : this._firstPersonSpeed
    return this.getBaseMultiplier() * dist
  }

  private getMoveMultiplier () {
    return this.orbitDistance / this._vimReferenceSize
  }

  update (deltaTime: number) {
    this.applyVelocity(deltaTime)
    return this.checkForMovement()
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
      .multiplyScalar(deltaTime * this.getBaseMultiplier() * 100)

    this._movement.move3(deltaPosition)
  }

  checkForMovement () {
    this._hasMoved = false
    if (
      !this._lastPosition.equals(this.position) ||
      !this.quaternion.equals(this._lastQuaternion)
    ) {
      this.gizmo?.setPosition(this._orbitTarget)
      this.gizmo.show(true)
      this._hasMoved = true
      this._onMoved.dispatch()
    }
    this._lastPosition.copy(this.position)
    this._lastQuaternion.copy(this.quaternion)
    return this._hasMoved
  }
}

class Interpolator {
  spd: number = 0
  max: number
  accel: number
  decel: number

  constructor (max: number, accel: number, decel: number) {
    this.max = max
    this.accel = accel
    this.decel = decel
  }

  interpolate (dist: number, deltaTime: number) {
    const d = (this.spd * this.spd) / (2 * this.decel)
    if (d > dist) {
      // decel
      this.spd = Math.sqrt(2 * dist * this.decel)
    } else {
      // acceleration
      this.spd = this.spd + this.accel * deltaTime
      this.spd = Math.min(this.spd, this.max)
    }
    return Math.min(this.spd * deltaTime, dist)
  }

  reset () {
    this.spd = 0
  }
}
