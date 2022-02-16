/**
 @module viw-webgl-viewer
*/

import * as THREE from 'three'
import { CameraGizmo } from './gizmos'
import { Renderer } from './renderer'
import { ViewerSettings } from './settings'

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

  private _mouseOrbit: boolean = false

  public get mouseOrbit () {
    return this._mouseOrbit
  }

  public set mouseOrbit (value: boolean) {
    this._mouseOrbit = value
    this.gizmo.show(value)
  }

  // Settings
  private vimReferenceSize: number
  private sceneSizeMultiplier: number = 1
  private velocityBlendFactor: number = 0.0001
  private moveSpeed: number = 0.8
  private rotateSpeed: number = 1
  private orbitSpeed: number = 1
  private wheelSpeed: number = 0.2

  constructor (renderer: Renderer, settings: ViewerSettings) {
    this.gizmo = new CameraGizmo(this, renderer)
    this.camera = renderer.camera
    this.applyViewerSettings(settings)

    this.inputVelocity = new THREE.Vector3(0, 0, 0)
    this.velocity = new THREE.Vector3(0, 0, 0)
    this.impulse = new THREE.Vector3(0, 0, 0)
    this.speedMultiplier = 0
    this.sceneSizeMultiplier = 1
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

  applyViewerSettings (settings: ViewerSettings) {
    // Mode
    this.mouseOrbit = settings.getCameraIsOrbit()

    // Camera
    this.camera.fov = settings.getCameraFov()
    this.camera.zoom = settings.getCameraZoom()
    this.camera.near = settings.getCameraNear()
    this.camera.far = settings.getCameraFar()
    this.camera.updateProjectionMatrix()

    // Controls
    this.moveSpeed = settings.getCameraMoveSpeed()
    this.rotateSpeed = settings.getCameraRotateSpeed()
    this.orbitSpeed = settings.getCameraOrbitSpeed()

    // Gizmo
    this.gizmo.applyViewerSettings(settings)

    // Values
    this.vimReferenceSize = settings.getCameraReferenceVimSize()
  }

  /**
   * Adapts camera speed to be faster for large model and slower for small models.
   * @param sphere bounding sphere of the renderered scene
   */
  adaptToContent (sphere: THREE.Sphere) {
    this.sceneSizeMultiplier = sphere.radius / this.vimReferenceSize
    // Gizmo
    this.gizmo.applyVimSettings(this.sceneSizeMultiplier)
    this.gizmo.show(this.mouseOrbit)
  }

  addLocalImpulse (impulse: THREE.Vector3) {
    const localImpulse = impulse
      .clone()
      .multiplyScalar(this.getSpeedMultiplier() * this.wheelSpeed)
    localImpulse.applyQuaternion(this.camera.quaternion)
    this.impulse.add(localImpulse)
  }

  move (vector: THREE.Vector3 = DIRECTIONS.forward, speed: number) {
    const v = vector.clone()
    if (speed) v.multiplyScalar(speed)
    v.applyQuaternion(this.camera.quaternion)

    this.orbitalTarget.add(v)
    this.gizmo.show()
    if (!this._mouseOrbit) {
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
    if (this._mouseOrbit) {
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
    const factor = this._mouseOrbit
      ? Math.PI * this.orbitSpeed
      : Math.PI * this.rotateSpeed

    euler.y -= vector.x * factor
    euler.x -= vector.y * factor
    euler.z = 0

    // Clamp X rotation to prevent performing a loop.
    const max = Math.PI * 0.48
    euler.x = Math.max(-max, Math.min(max, euler.x))

    this.camera.quaternion.setFromEuler(euler)

    if (!this._mouseOrbit) {
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

  frameUpdate (deltaTime: number) {
    const targetVelocity = this.inputVelocity.clone()

    // Update the camera velocity and position
    const invBlendFactor = Math.pow(this.velocityBlendFactor, deltaTime)
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
    if (this._mouseOrbit) {
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
        this.minOrbitalDistance * this.sceneSizeMultiplier
      )
      this.orbitalTargetDistance = this.currentOrbitalDistance
    }

    this.impulse.multiplyScalar(invBlendFactor)
    this.camera.position.add(positionDelta)
    this.orbitalTarget.add(orbitDelta)

    if (this._mouseOrbit) {
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

    this.gizmo.update(this.orbitalTarget)
  }

  private getSpeedMultiplier () {
    return (
      Math.pow(1.25, this.speedMultiplier) *
      this.sceneSizeMultiplier *
      this.moveSpeed
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
    const min = (0.01 * this.sceneSizeMultiplier) / 60
    return (
      Math.abs(vector.x) > min ||
      Math.abs(vector.y) > min ||
      Math.abs(vector.z) > min
    )
  }
}
