/**
 @module viw-webgl-viewer
*/

import * as THREE from 'three'
import { CameraGizmo } from './gizmos'
import { Renderer } from './renderer'
import { ViewerSettings } from './viewerSettings'
import { DEG2RAD } from 'three/src/math/MathUtils'

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
  gizmo: CameraGizmo
  camera: THREE.PerspectiveCamera

  private inputVelocity: THREE.Vector3
  private velocity: THREE.Vector3
  private impulse: THREE.Vector3
  public speedMultiplier: number

  private orbitalTarget: THREE.Vector3
  private minOrbitalDistance: number = 0.02
  private currentOrbitalDistance: number
  private orbitalTargetDistance: number

  private lerpSecondsDuration: number
  private lerpMsEndtime: number

  private _orbitMode: boolean = false

  public get orbitMode () {
    return this._orbitMode
  }

  public set orbitMode (value: boolean) {
    this._orbitMode = value
    this.gizmo.show(value)
  }

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
    this.gizmo = new CameraGizmo(renderer)
    this.applySettings(settings)

    this.inputVelocity = new THREE.Vector3(0, 0, 0)
    this.velocity = new THREE.Vector3(0, 0, 0)
    this.impulse = new THREE.Vector3(0, 0, 0)
    this.speedMultiplier = 0
    this._sceneSizeMultiplier = 1
    this.orbitalTarget = new THREE.Vector3(0, 0, 0)
    this.currentOrbitalDistance = this.camera.position
      .clone()
      .sub(this.orbitalTarget)
      .length()
    this.orbitalTargetDistance = this.currentOrbitalDistance
  }

  reset () {
    this.camera.position.set(0, 0, -5)
    this.camera.lookAt(0, 0, 1)

    this.inputVelocity.set(0, 0, 0)
    this.velocity.set(0, 0, 0)
    this.impulse.set(0, 0, 0)

    this.currentOrbitalDistance = 5
    this.orbitalTarget.set(0, 0, 0)
    this.orbitalTargetDistance = this.currentOrbitalDistance
  }

  lookAtPosition (position: THREE.Vector3) {
    this.camera.lookAt(position)
  }

  frameSphere (sphere?: THREE.Sphere) {
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
    this.orbitalTarget = sphere.center
    this.currentOrbitalDistance = this.orbitalTarget
      .clone()
      .sub(this.camera.position)
      .length()
    this.orbitalTargetDistance = this.currentOrbitalDistance
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
    this.gizmo.applySettings(settings)

    // Values
    this._vimReferenceSize = settings.getCameraReferenceVimSize()
  }

  /**
   * Adapts camera speed to be faster for large model and slower for small models.
   * @param sphere bounding sphere of the renderered scene
   */
  adaptToContent (sphere: THREE.Sphere) {
    this._sceneSizeMultiplier = sphere.radius / this._vimReferenceSize
    // Gizmo
    const gizmoSize =
      Math.tan((DEG2RAD * this.camera.fov) / 2) *
      (this._sceneSizeMultiplier / 10)
    this.gizmo.setScale(gizmoSize)
    this.gizmo.show(this.orbitMode)
  }

  addLocalImpulse (impulse: THREE.Vector3) {
    const localImpulse = impulse
      .clone()
      .multiplyScalar(this.getSpeedMultiplier() * this._wheelSpeed)
    localImpulse.applyQuaternion(this.camera.quaternion)
    this.impulse.add(localImpulse)
  }

  move (vector: THREE.Vector3 = DIRECTIONS.forward, speed: number) {
    const v = vector.clone()
    if (speed) v.multiplyScalar(speed)
    v.applyQuaternion(this.camera.quaternion)

    this.orbitalTarget.add(v)
    this.gizmo.show()
    if (!this.orbitMode) {
      this.camera.position.add(v)
    }
  }

  truckPedestal (vector: THREE.Vector2) {
    this.move(
      new THREE.Vector3(-vector.x, vector.y, 0),
      this.getSpeedMultiplier()
    )
  }

  truckDolly (vector: THREE.Vector2) {
    this.move(
      new THREE.Vector3(-vector.x, 0, vector.y),
      this.getSpeedMultiplier()
    )
  }

  dolly (amount: number) {
    if (this.orbitMode) {
      this.currentOrbitalDistance += amount
    } else {
      this.move(new THREE.Vector3(0, 0, amount), this.getSpeedMultiplier())
    }
  }

  setLocalVelocity (vector: THREE.Vector3) {
    const move = vector.clone()
    move.setZ(-move.z)
    move.applyQuaternion(this.camera.quaternion)
    move.multiplyScalar(this.getSpeedMultiplier())
    this.inputVelocity.copy(move)
  }

  /**
   * Rotates the camera around the X or Y axis or both
   * @param vector where coordinates are in relative screen size. ie [-1, 1]
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
        .multiplyScalar(this.currentOrbitalDistance)

      this.orbitalTarget = this.camera.position.clone().sub(offset)
    }
  }

  setTarget (position: THREE.Vector3) {
    this.orbitalTarget = position
    this.orbitalTargetDistance = this.camera.position.distanceTo(position)
    this.startLerp(0.4)
  }

  update (deltaTime: number) {
    const targetVelocity = this.inputVelocity.clone()

    // Update the camera velocity and position
    const invBlendFactor = Math.pow(this._velocityBlendFactor, deltaTime)
    const blendFactor = 1.0 - invBlendFactor

    this.velocity.multiplyScalar(invBlendFactor)
    targetVelocity.multiplyScalar(blendFactor)
    this.velocity.add(targetVelocity)

    this.currentOrbitalDistance =
      this.currentOrbitalDistance * invBlendFactor +
      this.orbitalTargetDistance * blendFactor

    const positionDelta = this.velocity.clone().multiplyScalar(deltaTime)
    const impulse = this.impulse.clone().multiplyScalar(blendFactor)
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
      this.currentOrbitalDistance = Math.max(
        this.currentOrbitalDistance + local.z,
        this.minOrbitalDistance * this._sceneSizeMultiplier
      )
      this.orbitalTargetDistance = this.currentOrbitalDistance
    }

    this.impulse.multiplyScalar(invBlendFactor)
    this.camera.position.add(positionDelta)
    this.orbitalTarget.add(orbitDelta)

    if (this.orbitMode) {
      const target = new THREE.Vector3(0, 0, this.currentOrbitalDistance)
      target.applyQuaternion(this.camera.quaternion)
      target.add(this.orbitalTarget)

      if (this.isLerping()) {
        const frames = this.lerpSecondsDuration / deltaTime
        const alpha = 1 - Math.pow(0.01, 1 / frames)
        this.camera.position.lerp(target, alpha)
        this.gizmo.show(false)
      } else {
        this.camera.position.copy(target)
        if (this.isSignificant(positionDelta)) {
          this.gizmo.show()
        }
      }
    }

    this.gizmo.setPosition(this.orbitalTarget)
  }

  private getSpeedMultiplier () {
    return (
      Math.pow(1.25, this.speedMultiplier) *
      this._sceneSizeMultiplier *
      this._moveSpeed
    )
  }

  private isLerping () {
    return new Date().getTime() < this.lerpMsEndtime
  }

  private startLerp (seconds: number) {
    this.lerpMsEndtime = new Date().getTime() + seconds * 1000
    this.lerpSecondsDuration = seconds
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