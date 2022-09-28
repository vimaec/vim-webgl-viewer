/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { InputHandler } from './inputHandler'
import { InputAction } from './raycaster'

type Button = 'main' | 'middle' | 'right' | undefined
/**
 * Manages mouse user inputs
 */
export class MouseHandler extends InputHandler {
  private readonly _idleDelayMs = 150
  private readonly ZOOM_SPEED = 5

  // State
  private buttonDown: Button
  private hasMouseMoved: Boolean = false

  private _idleTimeout: ReturnType<typeof setTimeout>
  private _idle: boolean
  private _idlePosition: THREE.Vector2

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
    super._unregisters.push(
      this.camera.onMoved.subscribe(() => this.onCameraMoved())
    )
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
    if (this.buttonDown) return
    const action = new InputAction(
      'idle',
      this.getModifier(),
      position,
      this.raycaster
    )
    this._viewer.inputs.IdleAction(action)
    this._idle = true
    this._idlePosition = position
  }

  private onCameraMoved = () => {
    if (this._idle) {
      this._viewer.inputs.IdleAction(undefined)
    }
    this.resetIdleTimeout()
  }

  private onMouseMove = (event: any) => {
    this._lastPosition = new THREE.Vector2(event.offsetX, event.offsetY)

    if (this._idle && this._lastPosition.distanceTo(this._idlePosition) > 5) {
      this._viewer.inputs.IdleAction(undefined)
      this.resetIdleTimeout()
    }
    if (!this._idle) {
      this.resetIdleTimeout()
    }

    if (!this.buttonDown) return
    this.onMouseDrag(event)
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

    const pointer =
      this.buttonDown === 'middle'
        ? 'pan'
        : this.buttonDown === 'right'
          ? 'look'
          : undefined
    this._viewer.inputs.pointerOverride = pointer

    if (pointer === 'look') this._viewer.camera.orbitMode = false
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

    switch (this.buttonDown) {
      case 'main':
        this.onMouseMainDrag(delta)
        break
      case 'middle':
        this.onMouseMiddleDrag(delta)
        break
      case 'right':
        this.onMouseRightDrag(delta)
        break
    }
  }

  private onMouseMainDrag (delta: THREE.Vector2) {
    switch (this.inputs.pointerActive) {
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
  }

  private onMouseMiddleDrag (delta: THREE.Vector2) {
    this.camera.move2(delta, 'XY')
  }

  private onMouseRightDrag (delta: THREE.Vector2) {
    this.camera.rotate(delta)
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
        ? 'right'
        : event.buttons & 4
          ? 'middle'
          : undefined
  }

  private onMouseUp = (event: MouseEvent) => {
    this.resetIdleTimeout()
    const btn = this.getButton(event)
    if (btn === this.buttonDown) return // the active button is still down.

    this._viewer.gizmoRectangle.visible = false
    event.preventDefault()
    if (!this.buttonDown) return

    if (this.inputs.pointerActive === 'rect' && this.hasMouseMoved) {
      this.onRectEnd()
    } else if (event.button === 0 && !this.hasMouseMoved) {
      this.onMouseClick(new THREE.Vector2(event.offsetX, event.offsetY), false)
    } else if (event.button === 2 && !this.hasMouseMoved) {
      this.inputs.ContextMenu(new THREE.Vector2(event.clientX, event.clientY))
    }
    this.camera.orbitMode = this.inputs.pointerActive === 'orbit'
    this.buttonDown = undefined
    this.inputs.pointerOverride = undefined
  }

  private onRectEnd () {
    // Shrink box for better camera fit.
    const box = this._viewer.gizmoRectangle.getBoundingBox()
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

  private onMouseClick = (position: THREE.Vector2, doubleClick: boolean) => {
    const action = new InputAction(
      doubleClick ? 'double' : 'main',
      this.getModifier(),
      position,
      this.raycaster
    )

    this._viewer.inputs.MainAction(action)
  }

  private getModifier () {
    return this.keyboard.isCtrlPressed
      ? 'ctrl'
      : this.keyboard.isShiftPressed
        ? 'shift'
        : 'none'
  }

  private drawSelection () {
    this._viewer.gizmoRectangle.visible = true
    this._viewer.gizmoRectangle.update(this._downPosition, this._lastPosition)
  }
}
