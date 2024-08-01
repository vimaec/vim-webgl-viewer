/**
 * @module viw-webgl-viewer/gizmos
 */

import * as THREE from 'three'
import { Camera } from '../../camera/camera'
import { Viewport } from '../../viewport'
import { AxesSettings } from './axesSettings'
import { Axis, createAxes } from './axes'

/**
 * The axis gizmos of the viewer.
 */
export class GizmoAxes {
  // settings
  private _initialOptions: AxesSettings
  private _options: AxesSettings

  // dependencies
  private _camera: Camera
  private _canvas: HTMLCanvasElement
  private _context: CanvasRenderingContext2D

  // setup
  private _rect: DOMRect
  private _reparentConnection: Function
  private _axes: Axis[]

  // state
  private _isDragging = false
  private _isDragSignificant = false
  private _dragStart = new THREE.Vector2()
  private _dragLast = new THREE.Vector2()
  private _pointer = new THREE.Vector3()
  private _center: THREE.Vector3
  private _invRotMat = new THREE.Matrix4()
  private _selectedAxis: Axis | null = null

  /**
   * The canvas on which the axes are drawn.
   */
  get canvas () {
    return this._canvas
  }

  constructor (camera: Camera, viewport: Viewport, options?: Partial<AxesSettings>) {
    this._initialOptions = new AxesSettings(options)
    this._options = new AxesSettings(options)
    this._camera = camera
    this._reparentConnection = viewport.onReparent.subscribe(() => this.reparent(viewport.parent))
    this._canvas = this.createCanvas()

    this._context = this._canvas.getContext('2d')!

    this._context.imageSmoothingEnabled = true
    this._context.imageSmoothingQuality = 'high'

    this.resize(this._options.size)
    this.animate()
  }

  reparent (parent: HTMLElement) {
    parent.appendChild(this._canvas)
  }

  resize (size: number) {
    const ratio = size / this._initialOptions.size
    this._options.size = size
    this._options.bubbleSizePrimary = ratio * this._initialOptions.bubbleSizePrimary
    this._options.bubbleSizeSecondary = ratio * this._initialOptions.bubbleSizeSecondary
    this._options.fontPxSize = ratio * this._initialOptions.fontPxSize

    this._canvas.width = size
    this._canvas.height = size
    this._rect = this._canvas.getBoundingClientRect()

    const margin = 24 * ratio
    this._canvas.style.top = `${margin}px`
    this._canvas.style.right = `${margin}px`

    this._center = new THREE.Vector3(size / 2, size / 2, 0)
    this._axes = createAxes(this._options)
  }

  private animate () {
    this.update()
    requestAnimationFrame(() => this.animate())
  }

  private createCanvas () {
    const canvas = document.createElement('canvas')
    canvas.classList.add(this._options.className)
    canvas.style.position = 'absolute'

    canvas.addEventListener('pointerdown', this.onPointerDown, false)
    canvas.addEventListener('pointerenter', this.onPointerEnter, false)
    canvas.addEventListener('pointermove', this.onPointerMove, false)
    return canvas
  }

  private onTouchMove = (e: TouchEvent) => {
    if (e.touches.length > 1) return
    const touch = e.touches[0]
    this.updateDrag(touch.clientX, touch.clientY)
  }

  private onTouchEnd = (e: TouchEvent) => {
    e.preventDefault()
    this.endDrag()
    this._selectedAxis = null
    window.removeEventListener('touchmove', this.onTouchMove, false)
    window.removeEventListener('touchend', this.onTouchEnd, false)
  }

  private onPointerDown = (e: MouseEvent) => {
    this.initDrag(e.clientX, e.clientY)

    window.addEventListener('pointermove', this.onPointerDrag, false)
    window.addEventListener('pointerup', this.onPointerUp, false)
  }

  private onPointerUp = (event: PointerEvent) => {
    this.endDrag()
    if (event.pointerType !== 'mouse') {
      this._pointer.set(0, 0, 0)
    }

    window.removeEventListener('pointermove', this.onPointerDrag, false)
    window.removeEventListener('pointerup', this.onPointerUp, false)
  }

  private onPointerEnter = () => {
    this._rect = this._canvas.getBoundingClientRect()
  }

  // Hover
  private onPointerMove = (e: MouseEvent) => {
    if (this._isDragging) return

    if (e) {
      this._pointer = this.toMouseVector(e, this._pointer)
    }
  }

  private toMouseVector (e: MouseEvent, target: THREE.Vector3) {
    return target.set(e.clientX - this._rect.left, e.clientY - this._rect.top, 0)
  }

  // Drag
  private onPointerDrag = (e: MouseEvent) => {
    this.updateDrag(e.clientX, e.clientY)
  }

  private initDrag (x: number, y: number) {
    this._dragStart.set(x, y)
    this._dragLast.set(x, y)
    this._isDragging = true
    this._isDragSignificant = false

    if (!this._isDragging) {
      this._canvas.classList.add('dragging')
    }
  }

  private updateDrag (x: number, y: number) {
    if (new THREE.Vector2(x, y).sub(this._dragStart).length() > 3) {
      this._isDragSignificant = true
    }

    const drag = new THREE.Vector2(x, y).sub(this._dragLast)
    this._dragLast.set(x, y)

    const rotX = drag.y / this._canvas.height
    const rotY = drag.x / this._canvas.width

    this._camera.snap().orbit(new THREE.Vector2(rotX * -180, rotY * -180))
  }

  private endDrag () {
    this._isDragging = false
    if (!this._isDragSignificant) {
      this.onMouseClick()
      this._isDragSignificant = false
    }

    this._canvas.classList.remove('dragging')
  }

  private onMouseClick = () => {
    if (this._isDragging || !this._selectedAxis) return
    this._camera
      .lerp(1)
      .orbitTowards(this._selectedAxis.direction.clone().multiplyScalar(-1))
    this._selectedAxis = null
  }

  private update = () => {
    this._invRotMat.extractRotation(this._camera.matrix).invert()

    for (let i = 0, length = this._axes.length; i < length; i++) {
      this.setAxisPosition(this._axes[i])
    }

    // Sort the layers where the +Z position is last so its drawn on top of anything below it
    this._axes.sort((a, b) => (a.position.z > b.position.z ? 1 : -1))

    // Draw the layers
    this.drawLayers(true)

    // Keep axis selected during drag.
    if (!this._isDragging) {
      this.pickAxes(this._pointer)
    }
  }

  private drawLayers (clear: boolean) {
    if (clear) {
      this._context.clearRect(0, 0, this._canvas.width, this._canvas.height)
    }

    // For each layer, draw the axis
    for (let i = 0, length = this._axes.length; i < length; i++) {
      const axis = this._axes[i]

      // Set the color
      const highlight = this._selectedAxis === axis
      const color = axis.position.z >= -0.01 ? axis.color : axis.colorSub

      // Draw the line that connects it to the center if enabled
      const center2 = new THREE.Vector2(this._center.x, this._center.y)
      const pos2 = new THREE.Vector2(axis.position.x, axis.position.y)
      if (axis.line) this.drawLine(center2, pos2, axis.line, color)

      // Draw the circle for the axis
      const circleColor = new THREE.Color(color)
      circleColor.multiplyScalar(highlight ? 1.5 : 1)
      this.drawCircle(axis.position, axis.size, `#${circleColor.getHexString()}`)

      // Write the axis label (X,Y,Z) if provided
      if (axis.label) {
        this._context.font = [
          this._options.fontWeight,
          `${this._options.fontPxSize}px`,
          this._options.fontFamily
        ].join(' ')
        this._context.fillStyle = this._options.fontColor
        this._context.textBaseline = 'middle'
        this._context.textAlign = 'center'
        this._context.fillText(axis.label, axis.position.x, axis.position.y)
      }
    }
  }

  private drawCircle (pos: THREE.Vector3, radius = 10, color = '#FF0000') {
    this._context.beginPath()
    this._context.arc(pos.x, pos.y, radius, 0, 2 * Math.PI, false)
    this._context.fillStyle = color
    this._context.fill()
    this._context.closePath()
  }

  private drawLine (
    p1: THREE.Vector2,
    p2: THREE.Vector2,
    width: number = 1,
    color = '#FF0000'
  ) {
    this._context.beginPath()
    this._context.moveTo(p1.x, p1.y)
    this._context.lineTo(p2.x, p2.y)
    this._context.lineWidth = width
    this._context.strokeStyle = color
    this._context.stroke()
    this._context.closePath()
  }

  private setAxisPosition (axis: Axis) {
    const position = axis.direction.clone().applyMatrix4(this._invRotMat)
    const size = axis.size
    axis.position.set(
      position.x * (this._center.x - size / 2 - this._options.padding) +
        this._center.x,
      this._center.y -
        position.y * (this._center.y - size / 2 - this._options.padding),
      position.z
    )
  }

  private pickAxes (mouse: THREE.Vector3) {
    const currentAxis = this._selectedAxis
    this._selectedAxis = null

    // Loop through each layer
    for (let i = 0, length = this._axes.length; i < length; i++) {
      const distance = mouse.distanceTo(this._axes[i].position)

      if (distance < this._axes[i].size) this._selectedAxis = this._axes[i]
    }

    if (currentAxis !== this._selectedAxis) this.drawLayers(false)
  }

  /**
   * Disposes of the gizmo, removing event listeners and cleaning up resources.
   */
  dispose () {
    this._reparentConnection?.()
    this._reparentConnection = undefined

    this._canvas.removeEventListener('pointerdown', this.onPointerDown, false)
    this._canvas.removeEventListener('pointerenter', this.onPointerEnter, false)
    this._canvas.removeEventListener('pointermove', this.onPointerDrag, false)
    window.removeEventListener('pointermove', this.onPointerDrag, false)
    window.removeEventListener('pointerup', this.onPointerUp, false)
    this._canvas.remove()
  }
}

export { GizmoAxes as OrbitControlsGizmo }
