import * as THREE from 'three'
import { ViewerCamera } from './viewer_camera'
import { Viewer } from './viewer'
import { Vector2 } from 'three'

export class InputMouse {
  // Consts
  MouseMoveSensitivity: number = 0.05
  MouseRotateSensitivity: number = 0.2
  MouseScrollSensitivity: number = 0.05

  // Dependencies
  private camera: ViewerCamera
  private canvas: HTMLCanvasElement
  private viewer: Viewer

  // State
  private isMouseDown: Boolean
  private hasMouseMoved: Boolean
  private ctrlDown: Boolean

  constructor (camera: ViewerCamera, canvas: HTMLCanvasElement, viewer: Viewer) {
    this.camera = camera
    this.canvas = canvas
    this.viewer = viewer
  }

  reset = () => {
    this.isMouseDown = this.hasMouseMoved = this.ctrlDown = false
  }

  setCtrl = (value: Boolean) => {
    this.ctrlDown = value
  }

  onMouseMove = (event) => {
    if (!this.isMouseDown) {
      return
    }
    this.hasMouseMoved = true

    event.preventDefault()

    // https://github.com/mrdoob/three.js/blob/master/examples/jsm/controls/PointerLockControls.js
    const deltaX =
      event.movementX || event.mozMovementX || event.webkitMovementX || 0
    const deltaY =
      event.movementY || event.mozMovementY || event.webkitMovementY || 0
    const delta = new THREE.Vector2(deltaX, deltaY)

    if (event.buttons & 2) {
      this.camera.panCameraBy(delta)
    } else {
      delta.multiplyScalar(this.MouseRotateSensitivity)
      this.camera.rotateCameraBy(delta)
    }
  }

  onMouseWheel = (event: any) => {
    event.preventDefault()
    event.stopPropagation()
    if (this.ctrlDown) {
      this.camera.SpeedMultiplier -= event.deltaY * 0.01
    } else if (this.camera.MouseOrbit) {
      this.camera.updateOrbitalDistance(
        -event.deltaY * this.MouseScrollSensitivity
      )
    } else {
      const impulse = new THREE.Vector3(
        0,
        0,
        event.deltaY *
          this.MouseScrollSensitivity *
          this.camera.getSpeedMultiplier()
      )
      this.camera.applyLocalImpulse(impulse)
    }
  }

  onMouseDown = (event) => {
    event.preventDefault()
    this.isMouseDown = true
    this.hasMouseMoved = false

    // Manually set the focus since calling preventDefault above
    // prevents the browser from setting it automatically.
    this.canvas.focus ? this.canvas.focus() : window.focus()
  }

  mouseRaycast (mouseX, mouseY) {
    const x = (mouseX / window.innerWidth) * 2 - 1
    const y = -(mouseY / window.innerHeight) * 2 + 1
    const mouse = new THREE.Vector2(x, y)
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, this.camera.camera)
    // raycaster.firstHitOnly = true;
    return raycaster.intersectObjects(this.viewer.meshes)
  }

  onMouseUp = (event) => {
    if (this.isMouseDown && !this.hasMouseMoved) {
      this.onMouseClick(new THREE.Vector2(event.x, event.y))
    }
    this.isMouseDown = false
  }

  onMouseClick = (position: Vector2) => {
    const hits = this.mouseRaycast(position.x, position.y)
    if (hits.length > 0) {
      const mesh = hits[0].object
      const index = hits[0].instanceId

      console.log(
        `Raycast hit. Position (${hits[0].point.x}, ${hits[0].point.y}, ${hits[0].point.z})`
      )
      if (mesh instanceof THREE.Mesh) {
        this.viewer.select(mesh, index)
      }
    }
  }
}
