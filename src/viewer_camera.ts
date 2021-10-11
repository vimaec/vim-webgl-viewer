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
  camera: THREE.PerspectiveCamera
  settings: any
  initialPosition: THREE.Vector3
  initialRotation: THREE.Quaternion
  cameraTarget!: THREE.Vector3

  Rotation: THREE.Vector2
  InputVelocity: THREE.Vector3
  Velocity: THREE.Vector3
  Impulse: THREE.Vector3
  SpeedMultiplier: number
  Orbit: boolean
  CenterOfInterest: THREE.Vector3
  OrbitalTarget: THREE.Vector3
  //OrbitalTargetSize: number
  CurrentOrbitalDistance: number
  TargetOrbitalDistance: number
  
  MouseRotate : Boolean
  MouseOrbit : Boolean
  MouseMoveDolly : Boolean
  MouseMovePan : Boolean

  VelocityBlendFactor: number = 0.0001;

  constructor (camera: THREE.PerspectiveCamera, settings: any) {
    this.camera = camera
    this.applySettings(settings)

    // Save initial position
    this.initialPosition = new THREE.Vector3()
    this.initialRotation = new THREE.Quaternion()
    this.initialPosition.copy(this.camera.position)
    this.initialRotation.copy(this.camera.quaternion)

    this.Rotation = new THREE.Vector2(0, 0)
    this.InputVelocity = new THREE.Vector3(0, 0, 0)
    this.Velocity = new THREE.Vector3(0, 0, 0)
    this.Impulse = new THREE.Vector3(0, 0, 0)
    this.SpeedMultiplier = 0.0
    this.Orbit = false
    this.CenterOfInterest = new THREE.Vector3(0, 0, 0)
    this.OrbitalTarget = new THREE.Vector3(0, 0, 0)
    this.CurrentOrbitalDistance = 1.0
    this.TargetOrbitalDistance = 1.0
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
  }

  applySettings (newSettings: any) {
    // TODO: camera updates aren't working
    this.camera.fov = newSettings.camera.fov
    this.camera.zoom = newSettings.camera.zoom
    this.camera.near = newSettings.camera.near
    this.camera.far = newSettings.camera.far
    this.camera.position.copy(toVec3(newSettings.camera.position))
    this.cameraTarget = toVec3(newSettings.camera.target)
    this.camera.lookAt(this.cameraTarget)
    this.settings = newSettings
  }

  applyLocalImpulse(impulse : THREE.Vector3)
  {
      var localImpulse = impulse.clone()
      localImpulse.applyQuaternion(this.camera.quaternion);
      this.Impulse.add(localImpulse);
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
  }

  resetCamera () {
    this.camera.position.copy(this.initialPosition)
    this.camera.quaternion.copy(this.initialRotation)
  }

  getSpeedMultiplier()
  {
    return Math.pow(1.1, this.SpeedMultiplier);
  }

  frameUpdate(deltaTime: number) {
    var targetVelocity = this.GetInputVelocity();

    // Multiply the speed 
    targetVelocity.multiplyScalar(this.getSpeedMultiplier());

    // Orient the velocity vector to the camera location
    targetVelocity.applyQuaternion(this.camera.quaternion);

    // Update the camera velocity and position
    var invBlendFactor = Math.pow(this.VelocityBlendFactor, deltaTime);
    var blendFactor = 1.0 - invBlendFactor;

//    this.Velocity = this.Velocity.multiplyScalar(invBlendFactor).add(targetVelocity.multiplyScalar(blendFactor));
    this.Velocity.multiplyScalar(invBlendFactor)
    targetVelocity.multiplyScalar(blendFactor)
    this.Velocity.add(targetVelocity);
    
    this.CurrentOrbitalDistance = this.CurrentOrbitalDistance * invBlendFactor + this.TargetOrbitalDistance * blendFactor;

//    var positionDelta = this.Velocity.multiplyScalar(deltaTime).add(this.Impulse.multiplyScalar(blendFactor));
    var positionDelta = this.Velocity.clone()
    positionDelta.multiplyScalar(deltaTime)
    var impulse = this.Impulse.clone()
    impulse.multiplyScalar(blendFactor);
    positionDelta.add(impulse);

    this.Impulse.multiplyScalar(invBlendFactor);
    this.camera.position.add(positionDelta);
    this.OrbitalTarget.add(positionDelta);

    if (this.MouseOrbit)
    {
        var translation = new THREE.Vector3(0.0, -this.CurrentOrbitalDistance, 0.0);

        // this.Position = translation.applyQuaternion(this.Orientation).add(this.OrbitalTarget);
        translation.applyQuaternion(this.camera.quaternion)
        translation.add(this.OrbitalTarget);
     // todo: fix ->   this.Position = translation
    }
  }

  GetInputVelocity()
  {
      var velocity = this.InputVelocity.clone();

      // UX special case: shift, ctrl and shift+ctrl are three distinct speeds.
/*      var shiftDown = Keyboard.IsKeyDown(Key.LeftShift) || Keyboard.IsKeyDown(Key.RightShift);
      var ctrlDown = Keyboard.IsKeyDown(Key.LeftCtrl) || Keyboard.IsKeyDown(Key.RightCtrl);
      if (shiftDown ^ ctrlDown)
      {
          if (shiftDown)
              velocity *= ShiftMultiplier;
          if (ctrlDown)
              velocity *= CtrlMultiplier;
      }
      else if (shiftDown && ctrlDown)
      {
          velocity *= CtrlShiftMultiplier;
      }*/

      return velocity;
    }


}

// Helpers
// TODO Remove this
function toVec3 (obj: { x: number; y: number; z: number }) {
  return new THREE.Vector3(obj.x, obj.y, obj.z)
}

export { direction, ViewerCamera }
