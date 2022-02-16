/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { Viewer } from './viewer'
import { HitTester } from './hitTester'
import { Keyboard } from './keyboard'

/**
 * Manages mouse user inputs
 */
export class Mouse {
  // Dependencies
  viewer: Viewer
  hitTester: HitTester
  inputKeyboard: Keyboard

  get camera () {
    return this.viewer.camera
  }

  get renderer () {
    return this.viewer.renderer
  }

  // State
  isMouseDown: Boolean = false
  hasMouseMoved: Boolean = false

  constructor (viewer: Viewer, keyboard: Keyboard) {
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

    event.preventDefault()

    // https://github.com/mrdoob/three.js/blob/master/examples/jsm/controls/PointerLockControls.js
    const deltaX =
      event.movementX || event.mozMovementX || event.webkitMovementX || 0
    const deltaY =
      event.movementY || event.mozMovementY || event.webkitMovementY || 0
    const [width, height] = this.renderer.getContainerSize()
    const delta = new THREE.Vector2(deltaX / width, deltaY / height)

    this.hasMouseMoved =
      this.hasMouseMoved || Math.abs(deltaX) + Math.abs(deltaY) > 3

    if (event.buttons & 2) {
      // right button
      this.camera.truckPedestal(delta)
    } else if (event.buttons & 4) {
      // Midle button
      this.camera.truckDolly(delta)
    } else {
      // left button
      this.camera.rotate(delta)
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
      this.camera.speedMultiplier -= scrollValue
    } else if (this.camera.mouseOrbit) {
      const impulse = new THREE.Vector3(0, 0, scrollValue)
      this.camera.addLocalImpulse(impulse)
      // this.camera.updateOrbitalDistance(-scrollValue)
    } else {
      const impulse = new THREE.Vector3(0, 0, scrollValue)
      this.camera.addLocalImpulse(impulse)
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
      this.onMouseClick(new THREE.Vector2(event.offsetX, event.offsetY), false)
    }
    this.isMouseDown = false
    event.preventDefault()
  }

  onDoubleClick = (event: any) => {
    this.onMouseClick(new THREE.Vector2(event.offsetX, event.offsetY), true)
  }

  onMouseClick = (position: THREE.Vector2, doubleClick: boolean) => {
    const result = this.hitTester.onMouseClick(position, doubleClick)
    this.viewer.onMouseClick(result)
  }
}
