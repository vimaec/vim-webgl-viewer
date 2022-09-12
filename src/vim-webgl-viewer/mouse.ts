/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { InputHandler } from './inputHandler'
import { InputAction } from './raycaster'

type Button = 'main' | 'secondary' | undefined
/**
 * Manages mouse user inputs
 */
export class MouseHandler extends InputHandler {
  private readonly _idleDelayMs = 200
  private readonly ZOOM_SPEED = 5

  // State
  private buttonDown: Button
  private hasMouseMoved: Boolean = false

  private _idleTimeout: number
  private _lastPosition: THREE.Vector2
  private _downPosition: THREE.Vector2

  private get camera () {
    return this._viewer.camera
  }

  private get viewport () {
    return this._viewer.viewport
  }

  private get canvas () {
    return this.viewport.canvas
  }

  private get raycaster () {
    return this._viewer.raycaster
  }

  private get inputs () {
    return this._viewer.inputs
  }

  private get keyboard () {
    return this._viewer.inputs.keyboard
  }

  protected override addListeners (): void {
    // mouse
    this.reg(this.canvas, 'mousedown', this.onMouseDown)
    this.reg(this.canvas, 'wheel', this.onMouseWheel)
    this.reg(this.canvas, 'mousemove', this.onMouseMove)
    this.reg(this.canvas, 'mouseup', this.onMouseUp)
    this.reg(this.canvas, 'mouseout', this.onMouseOut)
    this.reg(this.canvas, 'dblclick', this.onDoubleClick)

    // Disable right click menu
    this.reg(this.canvas, 'contextmenu', (e) => e.preventDefault())
  }

  override reset = () => {
    this.buttonDown = undefined
    this.hasMouseMoved = false
    this._lastPosition = this._downPosition = undefined
    clearTimeout(this._idleTimeout)
  }

  private resetIdleTimeout () {
    clearTimeout(this._idleTimeout)
    this._idleTimeout = setTimeout(
      () => this.onMouseIdle(this._lastPosition),
      this._idleDelayMs
    )
  }

  private onMouseOut = (_: any) => {
    this.buttonDown = undefined
    this.hasMouseMoved = false
  }

  private onMouseIdle = (position: THREE.Vector2) => {
    const action = new InputAction(
      'idle',
      this.getModifier(),
      position,
      this.raycaster
    )
    this._viewer.inputs.onIdleAction(action)
  }

  private onMouseMove = (event: any) => {
    this._lastPosition = new THREE.Vector2(event.offsetX, event.offsetY)
    this.resetIdleTimeout()

    if (!this.buttonDown) return
    this.onMouseDrag(event)
  }

  private onMouseDrag (event: any) {
    event.preventDefault()
    // https://github.com/mrdoob/three.js/blob/master/examples/jsm/controls/PointerLockControls.js
    const deltaX =
      event.movementX || event.mozMovementX || event.webkitMovementX || 0
    const deltaY =
      event.movementY || event.mozMovementY || event.webkitMovementY || 0
    const size = this.viewport.getSize()
    const delta = new THREE.Vector2(deltaX / size.x, deltaY / size.y)

    const position = new THREE.Vector2(event.offsetX, event.offsetY)
    this.hasMouseMoved =
      this.hasMouseMoved || this._downPosition.distanceTo(position) > 4

    if (this.buttonDown === 'main') {
      this.onMouseMainDrag(delta)
    } else if (this.buttonDown === 'secondary') {
      this.onMouseSecondaryDrag(delta)
    }
  }

  private onMouseMainDrag (delta: THREE.Vector2) {
    switch (this.inputs.pointerMode) {
      case 'orbit':
        this.camera.rotate(delta)
        break
      case 'look':
        this.camera.rotate(delta)
        break
      case 'pan':
        this.camera.move2(delta, 'XY')
        break
      case 'zoom':
        this.camera.zoom(delta.y * this.ZOOM_SPEED)
        break
      case 'rect':
        this.drawSelection()
        break
      default:
        this.camera.rotate(delta)
    }
    console.log('main')
  }

  private onMouseSecondaryDrag (delta: THREE.Vector2) {
    this.camera.move2(delta, 'XY')
  }

  private onMouseWheel = (event: any) => {
    event.preventDefault()
    event.stopPropagation()

    // Value of event.deltaY will change from browser to browser
    // https://stackoverflow.com/questions/38942821/wheel-event-javascript-give-inconsistent-values
    // Thus we only use the direction of the value
    const scrollValue = Math.sign(event.deltaY)

    if (this.keyboard.isCtrlPressed) {
      this.camera.speed -= scrollValue
    } else {
      this.camera.zoom(scrollValue, this.camera.defaultLerpDuration)
    }
  }

  private getButton (event: MouseEvent) {
    return event.buttons & 1
      ? 'main'
      : event.buttons & 2
        ? 'secondary'
        : event.buttons & 4
          ? 'secondary'
          : undefined
  }

  private onMouseDown = (event: MouseEvent) => {
    event.preventDefault()
    if (this.buttonDown) return
    this._downPosition = new THREE.Vector2(event.offsetX, event.offsetY)
    this.hasMouseMoved = false

    // Manually set the focus since calling preventDefault above
    // prevents the browser from setting it automatically.
    this.viewport.canvas.focus()
    this.buttonDown = this.getButton(event)

    console.log('down ' + this.buttonDown)
  }

  private onMouseUp = (event: MouseEvent) => {
    const btn = this.getButton(event)
    if (btn === this.buttonDown) return
    console.log('up ' + this.buttonDown)

    this._viewer.gizmoSelection.visible = false
    event.preventDefault()
    if (!this.buttonDown) return

    if (this.inputs.pointerMode === 'rect' && this.hasMouseMoved) {
      this.onRectEnd()
    } else if (event.button === 0 && !this.hasMouseMoved) {
      this.onMouseClick(new THREE.Vector2(event.offsetX, event.offsetY), false)
    } else if (event.button === 2 && !this.hasMouseMoved) {
      this.inputs.onContextMenu?.(
        new THREE.Vector2(event.clientX, event.clientY)
      )
    }
    this.buttonDown = undefined
  }

  private onRectEnd () {
    // Shrink box for better camera fit.
    const box = this._viewer.gizmoSelection.getBoundingBox()
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    size.multiplyScalar(0.5)
    box.setFromCenterAndSize(center, size)

    // Frame Camera
    this._viewer.camera.frame(
      box,
      'none',
      this._viewer.camera.defaultLerpDuration
    )
  }

  private onDoubleClick = (event: any) => {
    this.onMouseClick(new THREE.Vector2(event.offsetX, event.offsetY), true)
  }

  // TODO Make private
  onMouseClick = (position: THREE.Vector2, doubleClick: boolean) => {
    const action = new InputAction(
      doubleClick ? 'double' : 'main',
      this.getModifier(),
      position,
      this.raycaster
    )

    this._viewer.inputs.onMainAction(action)
  }

  private getModifier () {
    return this.keyboard.isCtrlPressed
      ? 'ctrl'
      : this.keyboard.isShiftPressed
        ? 'shift'
        : 'none'
  }

  private drawSelection () {
    this._viewer.gizmoSelection.visible = true
    this._viewer.gizmoSelection.update(this._downPosition, this._lastPosition)
  }
}
