/**
 @author VIM / https://vimaec.com
*/

import * as THREE from 'three'

export const direction = {
  forward: new THREE.Vector3(0, 0, -1),
  back: new THREE.Vector3(0, 0, 1),
  left: new THREE.Vector3(-1, 0, 0),
  right: new THREE.Vector3(1, 0, 0),
  up: new THREE.Vector3(0, 1, 0),
  down: new THREE.Vector3(0, -1, 0)
}

export class ViewerCamera {
  camera: THREE.PerspectiveCamera
  settings: any
  initialPosition: THREE.Vector3
  initialRotation: THREE.Quaternion
  cameraTarget!: THREE.Vector3

  constructor (camera: THREE.PerspectiveCamera, settings: any) {
    this.camera = camera
    this.applySettings(settings)

    // Save initial position
    this.initialPosition = new THREE.Vector3()
    this.initialRotation = new THREE.Quaternion()
    this.initialPosition.copy(this.camera.position)
    this.initialRotation.copy(this.camera.quaternion)
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
}

// Helpers
// TODO Remove this
function toVec3 (obj: { x: number; y: number; z: number }) {
  return new THREE.Vector3(obj.x, obj.y, obj.z)
}
