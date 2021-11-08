/**
 @author VIM / https://vimaec.com
*/

import * as THREE from 'three'

const direction = {
  forward: new THREE.Vector3(0, 0, -1),
  back: new THREE.Vector3(0, 0, 1),
  left: new THREE.Vector3(-1, 0, 0),
  right: new THREE.Vector3(1, 0, 0),
  up: new THREE.Vector3(0, 1, 0),
  down: new THREE.Vector3(0, -1, 0)
}

class ViewerCamera {
  MinOrbitalDistance: number = 1.0

  camera: THREE.PerspectiveCamera
  settings: any

  Rotation: THREE.Vector2
  InputVelocity: THREE.Vector3
  Velocity: THREE.Vector3
  Impulse: THREE.Vector3
  SpeedMultiplier: number
  Orbit: boolean
  CenterOfInterest: THREE.Vector3
  OrbitalTarget: THREE.Vector3
  // OrbitalTargetSize: number
  CurrentOrbitalDistance: number
  TargetOrbitalDistance: number

  MouseRotate: Boolean = false
  MouseOrbit: Boolean = false
  MouseMoveDolly: Boolean = false
  MouseMovePan: Boolean = false

  VelocityBlendFactor: number = 0.0001

  constructor (camera: THREE.PerspectiveCamera, settings: any) {
    this.camera = camera
    this.applySettings(settings)

    this.Rotation = new THREE.Vector2(0, 0)
    this.InputVelocity = new THREE.Vector3(0, 0, 0)
    this.Velocity = new THREE.Vector3(0, 0, 0)
    this.Impulse = new THREE.Vector3(0, 0, 0)
    this.SpeedMultiplier = 0.0
    this.Orbit = false
    this.CenterOfInterest = new THREE.Vector3(0, 0, 0)
    this.OrbitalTarget = new THREE.Vector3(0, 0, 0)
    this.CurrentOrbitalDistance = camera.position
      .clone()
      .sub(this.OrbitalTarget)
      .length()
    this.TargetOrbitalDistance = this.CurrentOrbitalDistance
  }

  lookAt (position: THREE.Vector3) {
    this.camera.lookAt(position)
  }

  lookAtSphere (sphere: THREE.Sphere, setY: boolean = false) {
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

  frameScene (sphere: THREE.Sphere) {
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

  applySettings (newSettings: any) {
    // TODO: camera updates aren't working
    this.camera.fov = newSettings.camera.fov
    this.camera.zoom = newSettings.camera.zoom
    this.camera.near = newSettings.camera.near
    this.camera.far = newSettings.camera.far
    this.settings = newSettings
  }

  applyLocalImpulse (impulse: THREE.Vector3) {
    const localImpulse = impulse.clone()
    localImpulse.applyQuaternion(this.camera.quaternion)
    this.Impulse.add(localImpulse)
  }

  moveCameraBy (
    dir: THREE.Vector3 = direction.forward,
    speed: number = 1,
    onlyHoriz: boolean = false
  ) {
    const vector = new THREE.Vector3()
    vector.copy(dir)
    if (speed) vector.multiplyScalar(speed)
    vector.applyQuaternion(this.camera.quaternion)
    const y = this.camera.position.y
    this.camera.position.add(vector)
    if (onlyHoriz) this.camera.position.y = y
  }

  panCameraBy (pt: THREE.Vector2) {
    const speed = this.settings.camera.controls.panSpeed
    this.moveCameraBy(new THREE.Vector3(-pt.x, pt.y, 0), speed)
  }

  rotateCameraBy (pt: THREE.Vector2) {
    const euler = new THREE.Euler(0, 0, 0, 'YXZ')
    euler.setFromQuaternion(this.camera.quaternion)
    euler.y += -pt.x * this.settings.camera.controls.rotateSpeed
    euler.x += -pt.y * this.settings.camera.controls.rotateSpeed
    euler.z = 0
    const PI_2 = Math.PI / 2
    const minPolarAngle = -2 * Math.PI
    const maxPolarAngle = 2 * Math.PI
    euler.x = Math.max(
      PI_2 - maxPolarAngle,
      Math.min(PI_2 - minPolarAngle, euler.x)
    )
    this.camera.quaternion.setFromEuler(euler)

    if (!this.MouseOrbit) {
      const offset = new THREE.Vector3(0, 0, 1)
        .applyQuaternion(this.camera.quaternion)
        .multiplyScalar(this.CurrentOrbitalDistance);
        
      this.OrbitalTarget = this.camera.position
        .clone()
        .sub(offset);
    }
  }

  getSpeedMultiplier () {
    return Math.pow(1.1, this.SpeedMultiplier)
  }

  updateOrbitalDistance (diff: number) {
    this.TargetOrbitalDistance -= diff * this.getSpeedMultiplier()
    this.TargetOrbitalDistance = Math.max(
      this.TargetOrbitalDistance,
      this.MinOrbitalDistance
    )
  }

  frameUpdate (deltaTime: number) {
    const targetVelocity = this.GetInputVelocity()

    // Multiply the speed
    targetVelocity.multiplyScalar(this.getSpeedMultiplier())

    // Orient the velocity vector to the camera location
    targetVelocity.applyQuaternion(this.camera.quaternion)

    // Update the camera velocity and position
    const invBlendFactor = Math.pow(this.VelocityBlendFactor, deltaTime)
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

    this.Impulse.multiplyScalar(invBlendFactor)
    this.camera.position.add(positionDelta)
    this.OrbitalTarget.add(positionDelta)

    if (positionDelta.length() > 0) {
      this.GetInputVelocity()
    }

    if (this.MouseOrbit) {
      // this.Position = translation.applyQuaternion(this.Orientation).add(this.OrbitalTarget);
      this.camera.position.set(0.0, 0.0, this.CurrentOrbitalDistance)
      this.camera.position.applyQuaternion(this.camera.quaternion)
      this.camera.position.add(this.OrbitalTarget)
    }
  }

  GetInputVelocity () {
    return this.InputVelocity.clone()
  }
}

export { direction, ViewerCamera }
