/**
 * @module viw-webgl-viewer/inputs
 */


import * as THREE from 'three'
import { InputHandler } from './inputHandler'
import { InputAction } from '../raycaster'
import { Viewer } from '../viewer'

type Button = 'main' | 'middle' | 'right' | undefined
type Modifier = 'ctrl' | 'shift' | 'none'
/**
 * Manages mouse user inputs
 */
export class MouseHandler extends InputHandler {
  private readonly _idleDelayMs = 150
  zoomSpeed = 1
  panSpeed = 100
  rotateSpeed = 1
  orbitSpeed = 1

  // State
  private _buttonDown: Button
  private _hasMouseMoved: Boolean = false
  private _hasCameraMoved: Boolean = false

  private _idleTimeout: ReturnType<typeof setTimeout> | undefined
  private _idlePosition: THREE.Vector2 | undefined

  private _lastPosition: THREE.Vector2 | undefined
  private _downPosition: THREE.Vector2 | undefined

  constructor (viewer: Viewer) {
    super(viewer)
    this.rotateSpeed = viewer.settings.camera.controls.rotateSpeed
    this.orbitSpeed = viewer.settings.camera.controls.orbitSpeed
  }

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

  private get gizmoRect () {
    return this._viewer.gizmoRectangle
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
    this._unregisters.push(
      this.camera.onMoved.subscribe(() => this.onCameraMoved())
    )
  }

  override reset = () => {
    this._buttonDown = undefined
    this._hasMouseMoved = false
    this._lastPosition = this._downPosition = undefined
    clearTimeout(this._idleTimeout)
  }

  private resetIdle () {
    if (this._idlePosition) {
      this._viewer.inputs.IdleAction(undefined)
      this._idlePosition = undefined
    }
    clearTimeout(this._idleTimeout)
    this._idleTimeout = setTimeout(() => {
      this.onMouseIdle(this._lastPosition)
    }, this._idleDelayMs)
  }

  private onMouseOut = (event: MouseEvent) => {
    event.stopImmediatePropagation()
    this._buttonDown = undefined
    this._hasMouseMoved = false
    this._lastPosition = undefined
    this.resetIdle()
  }

  private onMouseIdle = (position: THREE.Vector2 | undefined) => {
    if (this._buttonDown || !position) return
    const action = new InputAction('idle', 'none', position, this.raycaster)
    this._viewer.inputs.IdleAction(action)
    this._idlePosition = position
  }

  private onCameraMoved = () => {
    this.resetIdle()
    this._hasCameraMoved = true
    this.gizmoRect.visible = false
  }

  private onMouseMove = (event: any) => {
    event.stopImmediatePropagation()
    this._lastPosition = new THREE.Vector2(event.offsetX, event.offsetY)

    if (
      !this._idlePosition ||
      this._lastPosition.distanceTo(this._idlePosition) > 5
    ) {
      this.resetIdle()
    }

    if (!this._buttonDown) return
    this.onMouseDrag(event)
  }

  private onMouseDown = (event: MouseEvent) => {
    event.stopImmediatePropagation()
    event.preventDefault()
    if (this._buttonDown) return
    this.inputs.ContextMenu(undefined)
    this._hasCameraMoved = false
    this._downPosition = new THREE.Vector2(event.offsetX, event.offsetY)
    this._hasMouseMoved = false

    // Manually set the focus since calling preventDefault above
    // prevents the browser from setting it automatically.
    this.viewport.canvas.focus()
    this._buttonDown = this.getButton(event)

    const pointer =
      this._buttonDown === 'middle'
        ? 'pan'
        : this._buttonDown === 'right'
          ? 'look'
          : undefined
    this.inputs.pointerOverride = pointer
  }

  private onMouseDrag (event: any) {
    event.stopImmediatePropagation()
    event.preventDefault()
    // https://github.com/mrdoob/three.js/blob/master/examples/jsm/controls/PointerLockControls.js
    const deltaX =
      event.movementX || event.mozMovementX || event.webkitMovementX || 0
    const deltaY =
      event.movementY || event.mozMovementY || event.webkitMovementY || 0
    const size = this.viewport.getSize()
    const delta = new THREE.Vector2(deltaX / size.x, deltaY / size.y)

    const position = new THREE.Vector2(event.offsetX, event.offsetY)
    this._hasMouseMoved =
      this._hasMouseMoved ||
      (this._downPosition && this._downPosition?.distanceTo(position) > 4)

    switch (this._buttonDown) {
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

  private toRotation (delta: THREE.Vector2, speed: number) {
    const rot = delta.clone()
    rot.x = -delta.y
    rot.y = -delta.x
    rot.multiplyScalar(180 * speed)
    return rot
  }

  private onMouseMainDrag (delta: THREE.Vector2) {
    switch (this.inputs.pointerActive) {
      case 'orbit':
        this.camera.do().orbit(this.toRotation(delta, this.orbitSpeed))
        break
      case 'look':
        this.camera.do().rotate(this.toRotation(delta, this.rotateSpeed))
        break
      case 'pan':
        this.camera.do().move2(delta.multiplyScalar(this.panSpeed), 'XY')
        break
      case 'zoom':
        this.camera.do().zoom(1 + delta.y * this.zoomSpeed)
        break
      case 'rect':
        if (!this._hasCameraMoved) {
          this.updateRectangle()
          this.gizmoRect.visible = true
        }
        break
    }
  }

  private onMouseMiddleDrag (delta: THREE.Vector2) {
    this.camera.do().move2(delta.multiplyScalar(100), 'XY')
  }

  private onMouseRightDrag (delta: THREE.Vector2) {
    this.camera.do().rotate(this.toRotation(delta, this.rotateSpeed))
  }

  private onMouseWheel = (event: WheelEvent) => {
    event.preventDefault()
    event.stopImmediatePropagation()

    // Value of event.deltaY will change from browser to browser
    // https://stackoverflow.com/questions/38942821/wheel-event-javascript-give-inconsistent-values
    // Thus we only use the direction of the value
    const scrollValue = Math.sign(event.deltaY)

    if (event.ctrlKey) {
      this.camera.speed -= scrollValue
    } else {
      const zoom = Math.pow(1.3, scrollValue)
      this.camera.lerp(0.75).zoom(zoom)
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
    event.stopImmediatePropagation()
    this.resetIdle()
    const btn = this.getButton(event)
    if (btn === this._buttonDown) return // the active button is still down.

    this._viewer.gizmoRectangle.visible = false
    event.preventDefault()
    if (!this._buttonDown) return

    if (
      this.inputs.pointerActive === 'rect' &&
      this._hasMouseMoved &&
      !this._hasCameraMoved
    ) {
      this.onRectEnd()
    } else if (event.button === 0 && !this._hasMouseMoved) {
      this.onMouseClick(
        new THREE.Vector2(event.offsetX, event.offsetY),
        false,
        this.getModifier(event)
      )
    } else if (event.button === 2 && !this._hasMouseMoved) {
      this.inputs.ContextMenu(new THREE.Vector2(event.clientX, event.clientY))
    }
    this._buttonDown = undefined
    this.inputs.pointerOverride = undefined
  }

  private onRectEnd () {
    const box = this.gizmoRect.getBoundingBox()
    if (!box) return

    // Shrink box for better camera fit.
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    size.multiplyScalar(0.5)
    box.setFromCenterAndSize(center, size)

    // Frame Camera
    this._viewer.camera.lerp(1).frame(box)
  }

  private onDoubleClick = (event: MouseEvent) => {
    event.stopImmediatePropagation()
    this.onMouseClick(
      new THREE.Vector2(event.offsetX, event.offsetY),
      true,
      this.getModifier(event)
    )
  }

  private onMouseClick = (
    position: THREE.Vector2,
    doubleClick: boolean,
    modifier: Modifier
  ) => {
    const action = new InputAction(
      doubleClick ? 'double' : 'main',
      modifier,
      position,
      this.raycaster
    )

    this._viewer.inputs.MainAction(action)
  }

  private getModifier (event: MouseEvent | WheelEvent) {
    return event.ctrlKey ? 'ctrl' : event.shiftKey ? 'shift' : 'none'
  }

  private updateRectangle () {
    if (this._downPosition && this._lastPosition) {
      this.gizmoRect.setCorners(this._downPosition, this._lastPosition)
    }
  }
}
