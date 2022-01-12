/**
 @author VIM / https://vimaec.com
*/

import * as THREE from 'three'
import { CameraGizmo } from './cameraGizmo'
import { ViewerRenderer } from './viewerRenderer'
import { ViewerSettings } from './viewerSettings'

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

  private MinOrbitalDistance: number = 0.02

  public camera: THREE.PerspectiveCamera

  private InputVelocity: THREE.Vector3
  private Velocity: THREE.Vector3
  private Impulse: THREE.Vector3
  public SpeedMultiplier: number

  public OrbitalTarget: THREE.Vector3
  public CurrentOrbitalDistance: number
  public TargetOrbitalDistance: number
  public MouseOrbit: boolean = false

  // Settings
  private velocityBlendFactor: number = 0.0001
  private modelSizeMultiplier: number = 1
  private moveSpeed: number = 0.8
  private rotateSpeed: number = 1
  private orbitSpeed: number = 1
  private wheelSpeed: number = 0.2

  constructor (renderer: ViewerRenderer, settings: ViewerSettings) {
    this.gizmo = new CameraGizmo(this, renderer)

    this.camera = renderer.camera
    this.applySettings(settings)

    this.InputVelocity = new THREE.Vector3(0, 0, 0)
    this.Velocity = new THREE.Vector3(0, 0, 0)
    this.Impulse = new THREE.Vector3(0, 0, 0)
    this.SpeedMultiplier = 0
    this.modelSizeMultiplier = 1
    this.OrbitalTarget = new THREE.Vector3(0, 0, 0)
    this.CurrentOrbitalDistance = this.camera.position
      .clone()
      .sub(this.OrbitalTarget)
      .length()
    this.TargetOrbitalDistance = this.CurrentOrbitalDistance
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
    this.TargetOrbitalDistance = this.CurrentOrbitalDistance
  }

  reset () {
    this.camera.position.set(0, 0, -5)
    this.camera.lookAt(0, 0, 1)

    this.InputVelocity.set(0, 0, 0)
    this.Velocity.set(0, 0, 0)
    this.Impulse.set(0, 0, 0)

    this.CurrentOrbitalDistance = 5
    this.OrbitalTarget.set(0, 0, 0)
    this.TargetOrbitalDistance = this.CurrentOrbitalDistance
  }

  frameScene (sphere?: THREE.Sphere) {
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
    this.TargetOrbitalDistance = this.CurrentOrbitalDistance
  }

  applySettings (newSettings: ViewerSettings, modelSphere?: THREE.Sphere) {
    // Mode
    this.MouseOrbit = newSettings.getCameraIsOrbit()

    // Camera
    this.camera.fov = newSettings.getCameraFov()
    this.camera.zoom = newSettings.getCameraZoom()
    this.camera.near = newSettings.getCameraNear()
    this.camera.far = newSettings.getCameraFar()
    this.camera.updateProjectionMatrix()

    // Controls
    if (modelSphere) {
      this.modelSizeMultiplier =
        modelSphere.radius / newSettings.getCameraReferenceModelSize()
    }
    this.moveSpeed = newSettings.getCameraMoveSpeed()
    this.rotateSpeed = newSettings.getCameraRotateSpeed()
    this.orbitSpeed = newSettings.getCameraOrbitSpeed()

    // Gizmo
    this.gizmo.applySettings(newSettings, this.modelSizeMultiplier)
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
    if (this.MouseOrbit) {
      this.gizmo.show()
    } else {
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
    if (this.MouseOrbit) {
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
    const euler = new THREE.Euler(0, 0, 0, 'YXZ')
    euler.setFromQuaternion(this.camera.quaternion)

    // When moving the mouse one full sreen
    // Orbit will rotate 180 degree around the model
    // Basic will rotate 180 degrees on itself
    const factor = this.MouseOrbit
      ? Math.PI * this.orbitSpeed
      : Math.PI * this.rotateSpeed

    euler.y -= delta.x * factor
    euler.x -= delta.y * factor
    euler.z = 0

    // Clamp X rotation to prevent performing a loop.
    const max = Math.PI * 0.48
    euler.x = Math.max(-max, Math.min(max, euler.x))

    this.camera.quaternion.setFromEuler(euler)

    if (!this.MouseOrbit) {
      const offset = new THREE.Vector3(0, 0, 1)
        .applyQuaternion(this.camera.quaternion)
        .multiplyScalar(this.CurrentOrbitalDistance)

      this.OrbitalTarget = this.camera.position.clone().sub(offset)
    }
  }

  getSpeedMultiplier () {
    return (
      Math.pow(1.25, this.SpeedMultiplier) *
      this.modelSizeMultiplier *
      this.moveSpeed
    )
  }

  updateOrbitalDistance (diff: number) {
    this.TargetOrbitalDistance -= diff * this.getSpeedMultiplier()
    this.TargetOrbitalDistance = Math.max(
      this.TargetOrbitalDistance,
      this.MinOrbitalDistance
    )
  }

  frameUpdate (deltaTime: number) {
    const targetVelocity = this.InputVelocity.clone()

    // Update the camera velocity and position
    const invBlendFactor = Math.pow(this.velocityBlendFactor, deltaTime)
    const blendFactor = 1.0 - invBlendFactor

    // this.Velocity = this.Velocity.multiplyScalar(invBlendFactor).add(targetVelocity.multiplyScalar(blendFactor));
    this.Velocity.multiplyScalar(invBlendFactor)
    targetVelocity.multiplyScalar(blendFactor)
    this.Velocity.add(targetVelocity)

    this.CurrentOrbitalDistance =
      this.CurrentOrbitalDistance * invBlendFactor +
      this.TargetOrbitalDistance * blendFactor

    // var positionDelta = this.Velocity.multiplyScalar(deltaTime).add(this.Impulse.multiplyScalar(blendFactor));
    const positionDelta = this.Velocity.clone().multiplyScalar(deltaTime)
    const impulse = this.Impulse.clone().multiplyScalar(blendFactor)
    positionDelta.add(impulse)

    const orbitDelta = positionDelta.clone()
    if (this.MouseOrbit) {
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
        this.MinOrbitalDistance * this.modelSizeMultiplier
      )
      this.TargetOrbitalDistance = this.CurrentOrbitalDistance
    }

    this.Impulse.multiplyScalar(invBlendFactor)
    this.camera.position.add(positionDelta)
    this.OrbitalTarget.add(orbitDelta)

    if (this.MouseOrbit) {
      // this.Position = translation.applyQuaternion(this.Orientation).add(this.OrbitalTarget);
      this.camera.position.set(0.0, 0.0, this.CurrentOrbitalDistance)
      this.camera.position.applyQuaternion(this.camera.quaternion)
      this.camera.position.add(this.OrbitalTarget)

      if (this.isSignificant(positionDelta)) this.gizmo.show()
    }

    this.gizmo.update(this.OrbitalTarget)
  }

  isSignificant (vector: THREE.Vector3) {
    // One hundreth of standard model size per frame
    const min = (0.01 * this.modelSizeMultiplier) / 60
    return (
      Math.abs(vector.x) > min ||
      Math.abs(vector.y) > min ||
      Math.abs(vector.z) > min
    )
  }
}

export { direction, ViewerCamera }
