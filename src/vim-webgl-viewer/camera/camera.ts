import * as THREE from 'three'

import { Viewport } from '../viewport'
import { Settings } from '../viewerSettings'
import { Object } from '../../vim'
import { RenderScene } from '../rendering/renderScene'
import { Quaternion } from 'three'
import { clamp } from 'three/src/math/MathUtils'
import { ISignal, SignalDispatcher } from 'ste-signals'
import { CameraGizmo } from '../gizmos/gizmoOrbit'
import { ICamera, FrameAngle } from './cameraInterface'
import { PerspectiveWrapper } from './perspective'
import { OrthographicWrapper } from './orthographic'

/**
 * Manages viewer camera movement and position
 */
export class Camera implements ICamera {
  gizmo: CameraGizmo | undefined

  camActive: PerspectiveWrapper | OrthographicWrapper
  camPerspective: PerspectiveWrapper
  camOrthographic: OrthographicWrapper

  private _viewport: Viewport
  private _scene: RenderScene

  // movements
  private _targetPosition: THREE.Vector3 = new THREE.Vector3()
  private _targetVelocity = new THREE.Vector3()
  private _velocity = new THREE.Vector3()
  private _speed: number = 0

  // orbit
  private _orbitMode: boolean = false
  private _orbitTarget = new THREE.Vector3()

  // lerps
  private _lerpPosition: boolean = false
  private _lerpRotation: boolean = false
  private _lerpOrbit: boolean = false

  // updates
  private _lastPosition = new THREE.Vector3()
  private _lastQuaternion = new THREE.Quaternion()

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
  private _minOrbitDistance: number = 0.05
  private _vimReferenceSize: number = 1
  private _sceneSizeMultiplier: number = 1
  private _velocityBlendFactor: number = 0.0001
  private _moveSpeed: number = 0.8
  private _rotateSpeed: number = 1
  private _orbitSpeed: number = 1
  private _zoomSpeed: number = 0.25
  private _firstPersonSpeed = 10
  private _minModelScrenSize = 0.05

  private _posSpeed = 1
  private _posMinSpeed = 0.001
  private _posMaxSpeed = 5

  private _decelTime = 0.1
  private _accelTime = 0.05

  private _rotMaxSpeed = Math.PI / 2
  private _rotSpeed = 1

  constructor (scene: RenderScene, viewport: Viewport, settings: Settings) {
    this.camPerspective = new PerspectiveWrapper(
      new THREE.PerspectiveCamera(),
      viewport
    )
    this.camOrthographic = new OrthographicWrapper(
      new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1),
      viewport
    )
    this.camActive = this.camPerspective
    this._scene = scene
    this._viewport = viewport
    this._viewport.onResize.subscribe(() => {
      this.updateProjection(this._scene.getBoundingBox())
    })
    this.applySettings(settings)
    this.reset()
  }

  frustrumSizeAt (point: THREE.Vector3) {
    return this.camActive.frustrumSizeAt(point)
  }

  dispose () {
    this.gizmo?.dispose()
    this.gizmo = undefined
  }

  /**
   * Resets camera to default state.
   */
  reset () {
    this.camActive.position.set(0, 0, -1000)
    this._targetPosition = this.camActive.position

    this._targetVelocity.set(0, 0, 0)
    this._velocity.set(0, 0, 0)

    this._orbitTarget.set(0, 0, 0)
    this.lookAt(this._orbitTarget)
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
    const move = vector.clone()
    move.setZ(-move.z)
    move.applyQuaternion(this.camActive.quaternion)
    move.multiplyScalar(this.getVelocityMultiplier() * this._moveSpeed)

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
    this._onValueChanged.dispatch()
  }

  /**
   * Sets Orbit mode target and moves camera accordingly
   */
  target (target: Object | THREE.Vector3, lerp: boolean = false) {
    if (target instanceof Object && !target.hasMesh) {
      throw new Error('Attempting to target a mesh with no geometry.')
    }

    const position =
      target instanceof THREE.Vector3 ? target : target.getCenter()!

    this._orbitTarget = position
    this._lerpRotation = lerp
  }

  frame (
    target: Object | THREE.Sphere | THREE.Box3 | 'all' | undefined,
    angle: FrameAngle = 'none',
    lerp: boolean = false
  ) {
    if (target instanceof Object) {
      target = target.getBoundingBox()
    }
    if (target === 'all') {
      target = this._scene.getBoundingBox()
    }
    if (target instanceof THREE.Box3) {
      target = target.getBoundingSphere(new THREE.Sphere())
    }
    if (target instanceof THREE.Sphere) {
      this.frameSphere(target, angle, lerp)
    }
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
    return this.camActive.position.distanceTo(this._orbitTarget)
  }

  get targetOrbitDistance () {
    return this._targetPosition.distanceTo(this._orbitTarget)
  }

  /**
   * Moves the camera closer or farther away from orbit target.
   * @param amount movement size.
   */
  zoom (amount: number, lerp: boolean = false) {
    const sphere = this._scene
      .getBoundingBox()
      .getBoundingSphere(new THREE.Sphere())

    const targetPos = this.camActive.zoom(
      this._orbitTarget,
      sphere.radius,
      this.targetOrbitDistance,
      amount
    )

    if (targetPos) {
      this._targetPosition.copy(targetPos)
      this._lerpPosition = lerp
      this.gizmo?.show()
    }
  }

  /**
   * Moves the camera along all three axes.
   */
  move3 (vector: THREE.Vector3) {
    const spd = this.getMoveMultiplier() * this._moveSpeed
    const v = this.camActive.move3(vector, spd)

    this._orbitTarget.add(v)
    this._targetPosition.add(v)
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
  rotate (vector: THREE.Vector2, lerp: boolean = false) {
    const euler = new THREE.Euler(0, 0, 0, 'YXZ')
    euler.setFromQuaternion(this.camActive.quaternion)

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
      this.orbit(target, lerp)
    } else {
      const offset = new THREE.Vector3(0, 0, -this.orbitDistance)

      offset.applyQuaternion(rotation)
      this._orbitTarget = this.camActive.position.clone().add(offset)

      this._lerpRotation = lerp
      /*
      if (!lerp) {
        // apply rotation directly to camera
        this.camActive.quaternion.copy(rotation)
        offset.applyQuaternion(this.camActive.quaternion)
      } else {
        // apply rotation to target and lerp
        offset.applyQuaternion(rotation)
        this._lerpRotation = lerp
      }
      this._orbitTarget = this.camActive.position.clone().add(offset)
      */
    }
  }

  orbit (forward: THREE.Vector3, lerp: boolean) {
    const direction = this.clampY(
      this._orbitTarget,
      this.camActive.position,
      forward
    )
    const pos = this._orbitTarget.clone()
    const delta = direction.normalize().multiplyScalar(this.orbitDistance)
    this._targetPosition = pos.add(delta)
    this._lerpPosition = lerp
    this._lerpOrbit = lerp
  }

  /**
   * Rotates the camera so that it looks at sphere
   * Adjusts distance so that the sphere is well framed
   */
  private frameSphere (
    sphere: THREE.Sphere,
    angle: FrameAngle,
    lerp: boolean = false
  ) {
    const offset = this.camActive.position.clone().sub(sphere.center)
    const dist = this.camActive.position.distanceTo(sphere.center)
    if (angle === 'center') {
      offset.setY(0)
    }
    if (typeof angle === 'number') {
      const y = Math.sin(angle * (Math.PI / 180)) * dist
      offset.setY(y)
    }
    offset.normalize()
    offset.multiplyScalar(Math.max(sphere.radius * 3, 1))
    this._targetPosition = sphere.center.clone().add(offset)
    this._orbitTarget = sphere.center
    this._lerpRotation = lerp
    this._lerpPosition = lerp
    this.updateProjection(sphere)
    this.gizmo?.show()
  }

  private lookAt (position: THREE.Vector3) {
    this.camActive.camera.lookAt(position)
    this.camActive.camera.up.set(0, 1, 0)
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

  /**
   * Apply the camera frame update
   */
  update (deltaTime: number) {
    if (this._lerpPosition) {
      this.applyPositionLerp(deltaTime)
    } else {
      this.camActive.position.copy(this._targetPosition)
      this.applyVelocity(deltaTime)
    }
    if (this._lerpRotation) {
      this.applyRotationLerp(deltaTime)
    } else {
      this.lookAt(this._orbitTarget)
    }

    this.gizmo?.setPosition(this._orbitTarget)

    this._hasMoved = false
    if (
      !this._lastPosition.equals(this.camActive.position) ||
      !this.camActive.quaternion.equals(this._lastQuaternion)
    ) {
      this._hasMoved = true
      this._onMoved.dispatch()
    }

    this._lastPosition.copy(this.camActive.position)
    this._lastQuaternion.copy(this.camActive.quaternion)
    return this._hasMoved
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

  private applyVelocity (deltaTime: number) {
    // Update the camera velocity and position
    const invBlendFactor = Math.pow(this._velocityBlendFactor, deltaTime)
    const blendFactor = 1.0 - invBlendFactor

    this._velocity.multiplyScalar(invBlendFactor)
    const deltaVelocity = this._targetVelocity
      .clone()
      .multiplyScalar(blendFactor)
    this._velocity.add(deltaVelocity)
    if (this._velocity.lengthSq() < 0.01) {
      this._velocity.set(0, 0, 0)
    }

    const deltaPosition = this._velocity.clone().multiplyScalar(deltaTime)
    const endPosition = this.camActive.position.clone().add(deltaPosition)
    this._targetPosition.copy(endPosition)
    this._orbitTarget.add(deltaPosition)

    this.camOrthographic.applyVelocity(deltaPosition)
  }

  private applyPositionLerp (deltaTime: number) {
    const dist = this.camActive.position.distanceTo(this._targetPosition)

    if (this._posSpeed * this._decelTime * this._sceneSizeMultiplier > dist) {
      const spd = this._posSpeed * (1 - deltaTime / this._decelTime)
      this._posSpeed = Math.max(spd, this._posMinSpeed)
    } else if (this._posSpeed < this._posMaxSpeed) {
      this._posSpeed =
        this._posSpeed + this._posMaxSpeed * (deltaTime / this._accelTime)
      this._posSpeed = Math.min(this._posSpeed, this._posMaxSpeed)
    }

    const direction = this._targetPosition
      .clone()
      .sub(this.camActive.position)
      .normalize()
    const delta = direction.multiplyScalar(
      this._posSpeed * deltaTime * this._sceneSizeMultiplier
    )

    const orbitDist = this.orbitDistance
    this.camActive.position.add(delta)
    if (this._lerpOrbit) {
      const offset = this.camActive.position
        .clone()
        .sub(this._orbitTarget)
        .normalize()
        .multiplyScalar(orbitDist)
      this.camActive.position.copy(this._orbitTarget).add(offset)
    }

    if (this._posSpeed > dist) {
      this._posSpeed = 0.1
      this._lerpPosition = false
      this._lerpOrbit = false
    }
  }

  private applyRotationLerp (deltaTime: number) {
    const a = this.camActive.forward
    const b = this._orbitTarget.clone().sub(this.camActive.position)
    const current = this.camActive.position
      .clone()
      .add(this.camActive.forward.multiplyScalar(this.orbitDistance))
    const angle = a.angleTo(b)

    if (this._rotSpeed * this._decelTime > angle) {
      const spd = this._rotSpeed * (1 - deltaTime / this._decelTime)
      this._rotSpeed = Math.max(spd, this._posMinSpeed)
    } else if (this._rotSpeed < this._rotMaxSpeed) {
      const spd = this._rotSpeed * (1 + deltaTime / this._accelTime)
      this._rotSpeed = Math.min(spd, this._rotMaxSpeed)
    }

    const delta = deltaTime * this._rotSpeed
    const p = Math.min(delta / angle, 1.0)

    const look = current.lerp(this._orbitTarget, p)
    if (p >= 1) {
      this._lerpRotation = false
    }
    this.lookAt(look)
  }
}
