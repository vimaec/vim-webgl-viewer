/**
 @module viw-webgl-viewer
*/

import * as THREE from 'three'
import { CameraGizmo } from './gizmos/gizmoOrbit'
import { Viewport } from './viewport'
import { ViewerConfig } from './viewerSettings'
import { Object } from '../vim'
import { RenderScene } from './rendering/renderScene'
import { Quaternion } from 'three'
import { clamp } from 'three/src/math/MathUtils'
import { ISignal, SignalDispatcher } from 'ste-signals'

export const DIRECTIONS = {
  forward: new THREE.Vector3(0, 0, -1),
  back: new THREE.Vector3(0, 0, 1),
  left: new THREE.Vector3(-1, 0, 0),
  right: new THREE.Vector3(1, 0, 0),
  up: new THREE.Vector3(0, 1, 0),
  down: new THREE.Vector3(0, -1, 0)
}

/**
 * None : Frame from current position
 * Center : Cam.y = Object.y
 * number: Angle between the xz plane and the camera
 */
export type FrameAngle = 'none' | 'center' | number

export interface ICamera {
  /**
   * Three.js camera
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
  rotate(vector: THREE.Vector2, lerp?: boolean): void

  /**
   * Moves the camera closer or farther away from orbit target.
   * @param amount movement size.
   */
  zoom(amount: number, lerp?: boolean): void

  /**
   * Moves the camera around the target so that it looks down given forward vector
   * @param forward direction vector
   */
  orbit(forward: THREE.Vector3, lerp?: boolean): void

  /**
   * Sets orbit mode target and moves camera accordingly
   */
  target(target: Object | THREE.Vector3, lerp?: boolean): void

  /**
   * Moves and rotates the camera so that target is well framed.
   * @param target Vim or Three object to frame, all to frame the whole scene, undefined has no effect.
   * @param angle None will not force any angle, Center will force camera.y = object.y, providing an angle will move the camera so it is looking down at object by the provided angle.
   * @param lerp Wether to lerp the camera over time or not.
   */
  frame(
    target: Object | THREE.Sphere | THREE.Box3 | 'all' | undefined,
    angle?: FrameAngle,
    lerp?: boolean
  ): void

  /**
   * Restore camera to initial values.
   */
  reset(): void

  /**
   * Returns the world height of the camera frustrum at given point
   */
  frustrumSizeAt(point: THREE.Vector3): THREE.Vector2

  /**
   * World forward of the camera.
   */
  get forward(): THREE.Vector3

  /**
   * Returns the position of the orbit center.
   */
  get orbitPosition(): THREE.Vector3

  /**
   * Signal dispatched when camera settings are updated.
   */
  get onValueChanged(): ISignal

  /**
   * Signal dispatched when camera is moved.
   */
  get onMoved(): ISignal
}

type Lerp = 'None' | 'Position' | 'Rotation' | 'Both'

/**
 * Manages viewer camera movement and position
 */
export class Camera implements ICamera {
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
  gizmo: CameraGizmo | undefined
  cameraPerspective: THREE.PerspectiveCamera
  cameraOrthographic: THREE.OrthographicCamera | undefined
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
  private _minOrbitalDistance: number = 0.05
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

  private _lerpSpd = 1
  private _posMaxSpd = 5
  private _decelTime = 0.1
  private _accelTime = 0.05
  private _posMinSpd = 0.001
  private _rotMaxSpd = Math.PI / 2
  private _rotSpd = 1

  constructor (scene: RenderScene, viewport: Viewport, settings: ViewerConfig) {
    this.cameraPerspective = new THREE.PerspectiveCamera()
    this.camera = this.cameraPerspective
    this._scene = scene
    this._viewport = viewport
    this._viewport.onResize.subscribe(() => {
      this.updateProjection(this._scene.getBoundingBox())
    })
    this.applySettings(settings)
    this.reset()
  }

  frustrumSizeAt (point: THREE.Vector3) {
    if (this.orthographic && this.cameraOrthographic) {
      return new THREE.Vector2(
        Math.abs(this.cameraOrthographic.right - this.cameraOrthographic.left),
        Math.abs(this.cameraOrthographic.top - this.cameraOrthographic.bottom)
      )
    } else {
      const dist = this.camera.position.distanceTo(point)
      const size =
        dist * Math.tan((this.cameraPerspective.fov / 2) * (Math.PI / 180))
      return new THREE.Vector2(size, size)
    }
  }

  dispose () {
    this.gizmo?.dispose()
    this.gizmo = undefined
  }

  /**
   * Resets camera to default state.
   */
  reset () {
    this.camera.position.set(0, 0, -1000)
    this._targetPosition = this.camera.position

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
    this._onValueChanged.dispatch()
  }

  get localVelocity () {
    const result = this._velocity.clone()
    result.applyQuaternion(this.camera.quaternion.clone().invert())
    result.setZ(-result.z)
    result.multiplyScalar((1 / this.getVelocityMultiplier()) * this._moveSpeed)
    return result
  }

  get forward () {
    return this.camera.getWorldDirection(new THREE.Vector3())
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
    move.applyQuaternion(this.camera.quaternion)
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

  applySettings (settings: ViewerConfig) {
    // Mode
    this.orbitMode = settings.camera.controls.orbit

    // Camera
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.fov = settings.camera.fov
      this.camera.zoom = settings.camera.zoom
      this.camera.near = settings.camera.near
      this.camera.far = settings.camera.far
      this.camera.updateProjectionMatrix()
    }

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
    return this.camera.position.distanceTo(this._orbitTarget)
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
      this._lerpPosition = lerp
      console.log(
        'ZOOM DISTANCE : ' +
          this.camera.position.distanceTo(this._targetPosition)
      )
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
    }
    this.gizmo?.show()
  }

  /**
   * Moves the camera along all three axes.
   */
  move3 (vector: THREE.Vector3) {
    const v = new THREE.Vector3()
    if (this.orthographic && this.cameraOrthographic) {
      const aspect = this._viewport.getAspectRatio()
      const dx = this.cameraOrthographic.right - this.cameraOrthographic.left
      const dy = this.cameraOrthographic.top - this.cameraOrthographic.bottom
      v.set(-vector.x * dx * aspect, vector.y * dy, 0)
    } else {
      v.copy(vector)
      v.applyQuaternion(this.camera.quaternion)
      v.multiplyScalar(this.getMoveMultiplier() * this._moveSpeed)
    }

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
      this.orbit(target, lerp)
    } else {
      const offset = new THREE.Vector3(0, 0, -this.orbitDistance)
      if (!lerp) {
        // apply rotation directly to camera
        this.camera.quaternion.copy(rotation)
        offset.applyQuaternion(this.camera.quaternion)
      } else {
        // apply rotation to target and lerp
        offset.applyQuaternion(rotation)
        this._lerpRotation = lerp
      }
      this._orbitTarget = this.camera.position.clone().add(offset)
    }
  }

  orbit (forward: THREE.Vector3, lerp: boolean) {
    const direction = this.clampY(
      this._orbitTarget,
      this.camera.position,
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
    const offset = this.camera.position.clone().sub(sphere.center)
    const dist = this.camera.position.distanceTo(sphere.center)
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
    this.camera.lookAt(position)
    this.camera.up.set(0, 1, 0)
  }

  private updateProjection (target: THREE.Sphere | THREE.Box3) {
    if (target instanceof THREE.Box3) {
      target = target.getBoundingSphere(new THREE.Sphere())
    }
    const aspect = this._viewport.getAspectRatio()
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = aspect
    } else {
      if (target) {
        this.camera.left = -target.radius * aspect
        this.camera.right = target.radius * aspect
        this.camera.top = target.radius
        this.camera.bottom = -target.radius
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

    const next = value ? this.cameraOrthographic! : this.cameraPerspective
    next.position.copy(this.camera.position)
    next.rotation.copy(this.camera.rotation)
    this.camera = next

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
      this.camera.position.copy(this._targetPosition)
      this.applyVelocity(deltaTime)
    }
    if (this._lerpRotation) {
      this.applyRotationLerp(deltaTime)
    } else {
      this.camera.lookAt(this._orbitTarget)
    }

    this.gizmo?.setPosition(this._orbitTarget)

    this._hasMoved = false
    if (
      !this._lastPosition.equals(this.camera.position) ||
      !this.camera.quaternion.equals(this._lastQuaternion)
    ) {
      this._hasMoved = true
      this._onMoved.dispatch()
    }

    this._lastPosition.copy(this.camera.position)
    this._lastQuaternion.copy(this.camera.quaternion)
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
    const endPosition = this.camera.position.clone().add(deltaPosition)
    this._targetPosition.copy(endPosition)
    this._orbitTarget.add(deltaPosition)

    if (this.orthographic && this.cameraOrthographic) {
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
  }

  private applyPositionLerp (deltaTime: number) {
    const dist = this.camera.position.distanceTo(this._targetPosition)

    if (this._lerpSpd * this._decelTime * this._sceneSizeMultiplier > dist) {
      console.log('position brake')
      const spd = this._lerpSpd * (1 - deltaTime / this._decelTime)
      this._lerpSpd = Math.max(spd, this._posMinSpd)
    } else if (this._lerpSpd < this._posMaxSpd) {
      console.log('position accel')
      this._lerpSpd =
        this._lerpSpd + this._posMaxSpd * (deltaTime / this._accelTime)
      this._lerpSpd = Math.min(this._lerpSpd, this._posMaxSpd)
    }
    console.log(this._lerpSpd)

    const direction = this._targetPosition
      .clone()
      .sub(this.camera.position)
      .normalize()
    const delta = direction.multiplyScalar(
      this._lerpSpd * deltaTime * this._sceneSizeMultiplier
    )

    const orbitDist = this.orbitDistance
    this.camera.position.add(delta)
    if (this._lerpOrbit) {
      const offset = this.camera.position
        .clone()
        .sub(this._orbitTarget)
        .normalize()
        .multiplyScalar(orbitDist)
      this.camera.position.copy(this._orbitTarget).add(offset)
    }

    if (this._lerpSpd > dist) {
      console.log('Position Done')
      this._lerpSpd = 0.1
      this._lerpPosition = false
      this._lerpOrbit = false
    }
  }

  private applyRotationLerp (deltaTime: number) {
    const a = this.forward
    const b = this._orbitTarget.clone().sub(this.camera.position)
    const current = this.camera.position
      .clone()
      .add(this.forward.multiplyScalar(this.orbitDistance))
    const angle = a.angleTo(b)

    if (this._rotSpd * this._decelTime > angle) {
      console.log('rot brake')
      const spd = this._rotSpd * (1 - deltaTime / this._decelTime)
      this._rotSpd = Math.max(spd, this._posMinSpd)
    } else if (this._rotSpd < this._rotMaxSpd) {
      console.log('rot accel')
      const spd = this._rotSpd * (1 + deltaTime / this._accelTime)
      this._rotSpd = Math.min(spd, this._rotMaxSpd)
    }

    const delta = deltaTime * this._rotSpd
    const p = Math.min(delta / angle, 1.0)

    const look = current.lerp(this._orbitTarget, p)
    if (p >= 1) {
      this._lerpRotation = false
      console.log('rotation done')
    }
    this.lookAt(look)
  }
}
