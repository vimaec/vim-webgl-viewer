/**
 @author VIM / https://vimaec.com
 @module viw-webgl-viewer
*/

import * as THREE from 'three'
import { CameraGizmo } from './cameraGizmo'
import { ViewerRenderer } from './viewerRenderer'
import { ViewerSettings } from './settings'

const direction = {
  forward: new THREE.Vector3(0, 0, -1),
  back: new THREE.Vector3(0, 0, 1),
  left: new THREE.Vector3(-1, 0, 0),
  right: new THREE.Vector3(1, 0, 0),
  up: new THREE.Vector3(0, 1, 0),
  down: new THREE.Vector3(0, -1, 0)
}

class ViewerCamera {
  gizmo: CameraGizmo
  public camera: THREE.PerspectiveCamera

  private MinOrbitalDistance: number = 0.02

  private InputVelocity: THREE.Vector3
  private Velocity: THREE.Vector3
  private Impulse: THREE.Vector3
  public SpeedMultiplier: number

  public OrbitalTarget: THREE.Vector3
  public CurrentOrbitalDistance: number
  public OrbitalTargetDistance: number

  private lerpSecondsDuration: number
  private lerpMsEndtime: number

  private _isMouseOrbit: boolean = false

  public get IsMouseOrbit () {
    return this._isMouseOrbit
  }

  public set IsMouseOrbit (value: boolean) {
    this._isMouseOrbit = value
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

  constructor (renderer: ViewerRenderer, settings: ViewerSettings) {
    this.gizmo = new CameraGizmo(this, renderer)
    this.camera = renderer.camera
    this.applyViewerSettings(settings)

    this.InputVelocity = new THREE.Vector3(0, 0, 0)
    this.Velocity = new THREE.Vector3(0, 0, 0)
    this.Impulse = new THREE.Vector3(0, 0, 0)
    this.SpeedMultiplier = 0
    this.sceneSizeMultiplier = 1
    this.OrbitalTarget = new THREE.Vector3(0, 0, 0)
    this.CurrentOrbitalDistance = this.camera.position
      .clone()
      .sub(this.OrbitalTarget)
      .length()
    this.OrbitalTargetDistance = this.CurrentOrbitalDistance
  }

  lookAt (position: THREE.Vector3) {
    this.camera.lookAt(position)
  }

  lookAtSphere (sphere: THREE.Sphere, setY: boolean = false) {
    if (!sphere) return

    if (setY) {
      this.camera.position.setY(sphere.center.y)
    }

    const axis = this.camera.position.clone().sub(sphere.center).normalize()
    const fovRadian = (this.camera.fov * Math.PI) / 180
    const dist = 1.33 * sphere.radius * (1 + 2 / Math.tan(fovRadian))
    const pos = axis.clone().multiplyScalar(dist).add(sphere.center)

    this.camera.lookAt(sphere.center)
    this.camera.position.copy(pos)
    this.OrbitalTarget = sphere.center
    this.CurrentOrbitalDistance = this.OrbitalTarget.clone().sub(pos).length()
    this.OrbitalTargetDistance = this.CurrentOrbitalDistance
  }

  reset () {
    this.camera.position.set(0, 0, -5)
    this.camera.lookAt(0, 0, 1)

    this.InputVelocity.set(0, 0, 0)
    this.Velocity.set(0, 0, 0)
    this.Impulse.set(0, 0, 0)

    this.CurrentOrbitalDistance = 5
    this.OrbitalTarget.set(0, 0, 0)
    this.OrbitalTargetDistance = this.CurrentOrbitalDistance
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
    this.OrbitalTarget = sphere.center
    this.CurrentOrbitalDistance = this.OrbitalTarget.clone()
      .sub(this.camera.position)
      .length()
    this.OrbitalTargetDistance = this.CurrentOrbitalDistance
  }

  applyViewerSettings (settings: ViewerSettings) {
    // Mode
    this.IsMouseOrbit = settings.getCameraIsOrbit()

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

  fitToContent (boundingSphere: THREE.Sphere) {
    this.sceneSizeMultiplier = boundingSphere.radius / this.vimReferenceSize
    // Gizmo
    this.gizmo.applyVimSettings(this.sceneSizeMultiplier)
    this.gizmo.show(this.IsMouseOrbit)
  }

  applyLocalImpulse (impulse: THREE.Vector3) {
    const localImpulse = impulse
      .clone()
      .multiplyScalar(this.getSpeedMultiplier() * this.wheelSpeed)
    localImpulse.applyQuaternion(this.camera.quaternion)
    this.Impulse.add(localImpulse)
  }

  moveCameraBy (dir: THREE.Vector3 = direction.forward, speed: number) {
    const vector = dir.clone()
    if (speed) vector.multiplyScalar(speed)
    vector.applyQuaternion(this.camera.quaternion)

    this.OrbitalTarget.add(vector)
    this.gizmo.show()
    if (!this._isMouseOrbit) {
      this.camera.position.add(vector)
    }
  }

  truckPedestalCameraBy (pt: THREE.Vector2) {
    this.moveCameraBy(
      new THREE.Vector3(-pt.x, pt.y, 0),
      this.getSpeedMultiplier()
    )
  }

  truckDollyCameraBy (pt: THREE.Vector2) {
    this.moveCameraBy(
      new THREE.Vector3(-pt.x, 0, pt.y),
      this.getSpeedMultiplier()
    )
  }

  dollyCameraBy (amount: number) {
    if (this._isMouseOrbit) {
      this.CurrentOrbitalDistance += amount
    } else {
      this.moveCameraBy(
        new THREE.Vector3(0, 0, amount),
        this.getSpeedMultiplier()
      )
    }
  }

  setCameraLocalVelocity (vector: THREE.Vector3) {
    const move = vector.clone()
    move.setZ(-move.z)
    move.applyQuaternion(this.camera.quaternion)
    move.multiplyScalar(this.getSpeedMultiplier())
    this.InputVelocity.copy(move)
  }

  /**
   * Rotates the camera around the X or Y axis or both
   * @param delta where coordinates are in relative screen size. ie [-1, 1]
   */
  rotateCameraBy (delta: THREE.Vector2) {
    if (this.isLerping()) return
    const euler = new THREE.Euler(0, 0, 0, 'YXZ')
    euler.setFromQuaternion(this.camera.quaternion)

    // When moving the mouse one full sreen
    // Orbit will rotate 180 degree around the scene
    // Basic will rotate 180 degrees on itself
    const factor = this._isMouseOrbit
      ? Math.PI * this.orbitSpeed
      : Math.PI * this.rotateSpeed

    euler.y -= delta.x * factor
    euler.x -= delta.y * factor
    euler.z = 0

    // Clamp X rotation to prevent performing a loop.
    const max = Math.PI * 0.48
    euler.x = Math.max(-max, Math.min(max, euler.x))

    this.camera.quaternion.setFromEuler(euler)

    if (!this._isMouseOrbit) {
      const offset = new THREE.Vector3(0, 0, 1)
        .applyQuaternion(this.camera.quaternion)
        .multiplyScalar(this.CurrentOrbitalDistance)

      this.OrbitalTarget = this.camera.position.clone().sub(offset)
    }
  }

  isLerping () {
    return new Date().getTime() < this.lerpMsEndtime
  }

  startLerp (seconds: number) {
    this.lerpMsEndtime = new Date().getTime() + seconds * 1000
    this.lerpSecondsDuration = seconds
  }

  setTarget (position: THREE.Vector3) {
    this.OrbitalTarget = position
    this.OrbitalTargetDistance = this.camera.position.distanceTo(position)
    this.startLerp(0.4)
  }

  getSpeedMultiplier () {
    return (
      Math.pow(1.25, this.SpeedMultiplier) *
      this.sceneSizeMultiplier *
      this.moveSpeed
    )
  }

  updateOrbitalDistance (diff: number) {
    this.OrbitalTargetDistance -= diff * this.getSpeedMultiplier()
    this.OrbitalTargetDistance = Math.max(
      this.OrbitalTargetDistance,
      this.MinOrbitalDistance
    )
  }

  frameUpdate (deltaTime: number) {
    const targetVelocity = this.InputVelocity.clone()

    // Update the camera velocity and position
    const invBlendFactor = Math.pow(this.velocityBlendFactor, deltaTime)
    const blendFactor = 1.0 - invBlendFactor

    this.Velocity.multiplyScalar(invBlendFactor)
    targetVelocity.multiplyScalar(blendFactor)
    this.Velocity.add(targetVelocity)

    this.CurrentOrbitalDistance =
      this.CurrentOrbitalDistance * invBlendFactor +
      this.OrbitalTargetDistance * blendFactor

    const positionDelta = this.Velocity.clone().multiplyScalar(deltaTime)
    const impulse = this.Impulse.clone().multiplyScalar(blendFactor)
    positionDelta.add(impulse)

    const orbitDelta = positionDelta.clone()
    if (this._isMouseOrbit) {
      // compute local space forward component of movement
      const inv = this.camera.quaternion.clone().invert()
      const local = positionDelta.clone().applyQuaternion(inv)
      // remove z component
      orbitDelta.set(local.x, local.y, 0)
      // compute back to world space
      orbitDelta.applyQuaternion(this.camera.quaternion)

      // apply local space z to orbit distance,
      this.CurrentOrbitalDistance = Math.max(
        this.CurrentOrbitalDistance + local.z,
        this.MinOrbitalDistance * this.sceneSizeMultiplier
      )
      this.OrbitalTargetDistance = this.CurrentOrbitalDistance
    }

    this.Impulse.multiplyScalar(invBlendFactor)
    this.camera.position.add(positionDelta)
    this.OrbitalTarget.add(orbitDelta)

    if (this._isMouseOrbit) {
      const target = new THREE.Vector3(0, 0, this.CurrentOrbitalDistance)
      target.applyQuaternion(this.camera.quaternion)
      target.add(this.OrbitalTarget)

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

    this.gizmo.update(this.OrbitalTarget)
  }

  isSignificant (vector: THREE.Vector3) {
    // One hundreth of standard scene size per frame
    const min = (0.01 * this.sceneSizeMultiplier) / 60
    return (
      Math.abs(vector.x) > min ||
      Math.abs(vector.y) > min ||
      Math.abs(vector.z) > min
    )
  }
}

export { direction, ViewerCamera }
