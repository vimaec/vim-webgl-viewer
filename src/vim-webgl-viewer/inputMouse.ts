import * as THREE from 'three'
import { Viewer } from './viewer'
import { HitTester } from './hitTester'
import { InputKeyboard } from './inputKeyboard'

export class InputMouse {
  // Dependencies
  viewer: Viewer
  hitTester: HitTester
  inputKeyboard: InputKeyboard

  get camera () {
    return this.viewer.camera
  }

  get renderer () {
    return this.viewer.renderer
  }

  // State
  isMouseDown: Boolean = false
  hasMouseMoved: Boolean = false

  constructor (viewer: Viewer, keyboard: InputKeyboard) {
    this.viewer = viewer
    this.hitTester = new HitTester(viewer)
    this.inputKeyboard = keyboard
  }

  reset = () => {
    this.isMouseDown = this.hasMouseMoved = false
  }

  onMouseOut = (_: any) => {
    this.isMouseDown = this.hasMouseMoved = false
  }

  onMouseMove = (event: any) => {
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
      // right button
      this.camera.truckPedestalCameraBy(delta)
    } else if (event.buttons & 4) {
      // Midle button
      this.camera.truckDollyCameraBy(delta)
    } else {
      // left button
      this.camera.rotateCameraBy(delta)
    }
  }

  onMouseWheel = (event: any) => {
    event.preventDefault()
    event.stopPropagation()

    // Value of event.deltaY will change from browser to browser
    // https://stackoverflow.com/questions/38942821/wheel-event-javascript-give-inconsistent-values
    // Thus we only use the direction of the value
    const scrollValue = Math.sign(event.deltaY)

    if (this.inputKeyboard.isCtrlPressed) {
      this.camera.SpeedMultiplier -= scrollValue
    } else if (this.camera.MouseOrbit) {
      this.camera.updateOrbitalDistance(-scrollValue)
    } else {
      const impulse = new THREE.Vector3(0, 0, scrollValue)
      this.camera.applyLocalImpulse(impulse)
    }
  }

  onMouseDown = (event: any) => {
    event.preventDefault()
    this.isMouseDown = true
    this.hasMouseMoved = false

    // Manually set the focus since calling preventDefault above
    // prevents the browser from setting it automatically.
    this.renderer.canvas.focus()
  }

  onMouseUp = (event: any) => {
    if (this.isMouseDown && !this.hasMouseMoved) {
      this.onMouseClick(new THREE.Vector2(event.x, event.y), false)
    }
    this.isMouseDown = false
    event.preventDefault()
  }

  onDoubleClick = (event: any) => {
    this.onMouseClick(new THREE.Vector2(event.x, event.y), true)
  }

  onMouseClick = (position: THREE.Vector2, doubleClick: boolean) => {
    const result = this.hitTester.onMouseClick(position, doubleClick)
    const onClick = this.viewer.settings.options.onClick
    if (onClick) {
      onClick(this.viewer, result)
    }
  }
}
