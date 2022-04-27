/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { Viewer } from './viewer'
import { Raycaster } from './raycaster'
import { Keyboard } from './keyboard'

/**
 * Manages mouse user inputs
 */
export class Mouse {
  // Dependencies
  private _viewer: Viewer
  private _raycaster: Raycaster
  private _inputKeyboard: Keyboard

  private get camera () {
    return this._viewer.camera
  }

  private get viewport () {
    return this._viewer.viewport
  }

  // State
  isMouseDown: Boolean = false
  hasMouseMoved: Boolean = false

  constructor (viewer: Viewer, keyboard: Keyboard) {
    this._viewer = viewer
    this._raycaster = this._viewer.raycaster
    this._inputKeyboard = keyboard
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
    const [width, height] = this.viewport.getSize()
    const delta = new THREE.Vector2(deltaX / width, deltaY / height)

    this.hasMouseMoved =
      this.hasMouseMoved || Math.abs(deltaX) + Math.abs(deltaY) > 3

    if (event.buttons & 2) {
      // right button
      this.camera.move2(delta, 'XY')
    } else if (event.buttons & 4) {
      // Midle button
      this.camera.move2(delta, 'XZ')
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

    if (this._inputKeyboard.isCtrlPressed) {
      this.camera.speed -= scrollValue
    } else if (this.camera.orbitMode) {
      this.camera.zoom(scrollValue)
    } else {
      const impulse = new THREE.Vector3(0, 0, scrollValue)
      this.camera.addImpulse(impulse)
    }
  }

  onMouseDown = (event: any) => {
    event.preventDefault()
    this.isMouseDown = true
    this.hasMouseMoved = false

    // Manually set the focus since calling preventDefault above
    // prevents the browser from setting it automatically.
    this.viewport.canvas.focus()
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
    const result = this._raycaster.screenRaycast(position)
    result.doubleClick = doubleClick
    this._viewer.onMouseClick(result)
  }
}
