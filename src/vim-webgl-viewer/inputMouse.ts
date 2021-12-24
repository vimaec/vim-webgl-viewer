import * as THREE from 'three'
import { ViewerCamera } from './viewerCamera'
import { Viewer } from './viewer'
import { Mesh, Vector2 } from 'three'
import { ViewerRenderer } from './viewerRenderer'
import { HitTester } from './hitTester'

export class InputMouse {
  // Dependencies
  private camera: ViewerCamera
  private renderer: ViewerRenderer
  private hitTester: HitTester;

  // State
  private isMouseDown: Boolean = false
  private hasMouseMoved: Boolean = false
  private ctrlDown: Boolean = false

  constructor (viewer: Viewer) {
    this.camera = viewer.camera
    this.renderer = viewer.renderer
    this.hitTester = new HitTester(viewer)
  }

  reset() {
    this.isMouseDown = this.hasMouseMoved = this.ctrlDown = false
  }

  setCtrl(value: Boolean) {
    this.ctrlDown = value
  }

  onMouseOut(_: any) {
    this.isMouseDown = this.hasMouseMoved = false
  }

  onMouseMove(event: any) {
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
    const [width, height] = this.renderer.getContainerSize()
    const delta = new THREE.Vector2(deltaX / width, deltaY / height)

    if (event.buttons & 2) {
      this.camera.truckPedestalCameraBy(delta)
    } else {
      // delta.multiplyScalar(this.MouseRotateSensitivity)
      this.camera.rotateCameraBy(delta)
    }
  }

  onMouseWheel(event: any) {
    event.preventDefault()
    event.stopPropagation()

    // Value of event.deltaY will change from browser to browser
    // https://stackoverflow.com/questions/38942821/wheel-event-javascript-give-inconsistent-values
    // Thus we only use the direction of the value
    const scrollValue = Math.sign(event.deltaY)

    if (this.ctrlDown) {
      this.camera.SpeedMultiplier -= scrollValue
    } else if (this.camera.MouseOrbit) {
      this.camera.updateOrbitalDistance(-scrollValue)
    } else {
      const impulse = new THREE.Vector3(0, 0, scrollValue)
      this.camera.applyLocalImpulse(impulse)
    }
  }

  onMouseDown(event: any) {
    event.preventDefault()
    this.isMouseDown = true
    this.hasMouseMoved = false

    // Manually set the focus since calling preventDefault above
    // prevents the browser from setting it automatically.
    this.renderer.canvas.focus()
  }

  onMouseUp(event: any) {
    if (this.isMouseDown && !this.hasMouseMoved) {
      this.onMouseClick(new THREE.Vector2(event.x, event.y), false)
    }
    this.isMouseDown = false
    event.preventDefault()
  }

  onDoubleClick(event: any) {
    this.onMouseClick(new THREE.Vector2(event.x, event.y), true)
  }

  onMouseClick(position: Vector2, doubleClick: boolean) {
    const result = this.hitTester.onMouseClick(position, doubleClick)
  }
}
