/**
 * @module viw-webgl-viewer/gizmos
 */

import * as THREE from 'three'
import { Camera } from '../camera/camera'

// TODO make things private cleanup api.
export class Axis {
  axis: string
  direction: THREE.Vector3
  size: number
  color: string
  colorSub: string
  position: THREE.Vector3

  // Optional
  label: string | undefined
  line: number | undefined

  constructor (init: Axis) {
    this.axis = init.axis
    this.direction = init.direction
    this.size = init.size
    this.position = init.position
    this.color = init.color
    this.colorSub = init.colorSub

    // Optional
    this.line = init.line
    this.label = init.label
  }
}

export class GizmoOptions {
  size: number = 84
  padding: number = 4
  bubbleSizePrimary: number = 8
  bubbleSizeSecondary: number = 6
  lineWidth: number = 2
  fontSize: string = '12px'
  fontFamily: string = 'arial'
  fontWeight: string = 'bold'
  fontColor: string = '#222222'
  className: string = 'gizmo-axis-canvas'

  colorX: string = '#f73c3c'
  colorY: string = '#6ccb26'
  colorZ: string = '#178cf0'
  colorXSub: string = '#942424'
  colorYSub: string = '#417a17'
  colorZSub: string = '#0e5490'

  constructor (init?: Partial<GizmoOptions>) {
    this.size = init?.size ?? this.size
    this.padding = init?.padding ?? this.padding
    this.bubbleSizePrimary = init?.bubbleSizePrimary ?? this.bubbleSizePrimary
    this.bubbleSizeSecondary =
      init?.bubbleSizeSecondary ?? this.bubbleSizeSecondary
    this.lineWidth = init?.lineWidth ?? this.lineWidth
    this.fontSize = init?.fontSize ?? this.fontSize
    this.fontFamily = init?.fontFamily ?? this.fontFamily
    this.fontWeight = init?.fontWeight ?? this.fontWeight
    this.fontColor = init?.fontColor ?? this.fontColor
    this.className = init?.className ?? this.className
    this.colorX = init?.colorX ?? this.colorX
    this.colorY = init?.colorY ?? this.colorY
    this.colorZ = init?.colorZ ?? this.colorZ
    this.colorXSub = init?.colorXSub ?? this.colorXSub
    this.colorYSub = init?.colorYSub ?? this.colorYSub
    this.colorZSub = init?.colorZSub ?? this.colorZSub
  }
}

/**
 * The axis gizmos of the viewer.
 */
export class GizmoAxes {
  // settings
  private options: GizmoOptions
  private axes: Axis[]

  // dependencies
  private camera: Camera
  private _canvas: HTMLCanvasElement
  private context: CanvasRenderingContext2D
  private rect: DOMRect

  // state
  private isDragging: boolean
  private isDragSignificant: boolean
  private dragStart: THREE.Vector2
  private dragLast: THREE.Vector2
  private pointer: THREE.Vector3
  private center: THREE.Vector3
  private invRotMat: THREE.Matrix4 = new THREE.Matrix4()
  private selectedAxis: Axis | null

  /**
   * The canvas on which the axes are drawn.
   */
  get canvas() {
    return this._canvas
  }

  constructor (camera: Camera, options?: Partial<GizmoOptions>) {
    this.options = new GizmoOptions(options)
    this.camera = camera
    this.pointer = new THREE.Vector3()
    this.dragStart = new THREE.Vector2()
    this.dragLast = new THREE.Vector2()
    this.center = new THREE.Vector3(
      this.options.size / 2,
      this.options.size / 2,
      0
    )
    this.axes = this.createAxes()
    this.selectedAxis = null
    this.isDragging = false
    this.isDragSignificant = false

    this._canvas = this.createCanvas()
    this.context = this._canvas.getContext('2d')!
    this.rect = this._canvas.getBoundingClientRect()
    this.context.imageSmoothingEnabled = true
    this.context.imageSmoothingQuality = 'high'

    this.animate()
  }

  private animate () {
    this.update()
    requestAnimationFrame(() => this.animate())
  }

  private createAxes () {
    return [
      new Axis({
        axis: 'x',
        direction: new THREE.Vector3(1, 0, 0),
        size: this.options.bubbleSizePrimary,
        color: this.options.colorX,
        colorSub: this.options.colorXSub,
        line: this.options.lineWidth,
        label: 'X',
        position: new THREE.Vector3(0, 0, 0)
      }),
      new Axis({
        axis: 'y',
        direction: new THREE.Vector3(0, 1, 0),
        size: this.options.bubbleSizePrimary,
        color: this.options.colorY,
        colorSub: this.options.colorYSub,
        line: this.options.lineWidth,
        label: 'Y',
        position: new THREE.Vector3(0, 0, 0)
      }),
      new Axis({
        axis: 'z',
        direction: new THREE.Vector3(0, 0, 1),
        size: this.options.bubbleSizePrimary,
        color: this.options.colorZ,
        colorSub: this.options.colorZSub,
        line: this.options.lineWidth,
        label: 'Z',
        position: new THREE.Vector3(0, 0, 0)
      }),
      new Axis({
        axis: '-x',
        direction: new THREE.Vector3(-1, 0, 0),
        size: this.options.bubbleSizeSecondary,
        color: this.options.colorX,
        colorSub: this.options.colorXSub,
        line: undefined,
        label: undefined,
        position: new THREE.Vector3(0, 0, 0)
      }),
      new Axis({
        axis: '-y',
        direction: new THREE.Vector3(0, -1, 0),
        size: this.options.bubbleSizeSecondary,
        color: this.options.colorY,
        colorSub: this.options.colorYSub,
        line: undefined,
        label: undefined,
        position: new THREE.Vector3(0, 0, 0)
      }),
      new Axis({
        axis: '-z',
        // inverted Z
        direction: new THREE.Vector3(0, 0, -1),
        size: this.options.bubbleSizeSecondary,
        color: this.options.colorZ,
        colorSub: this.options.colorZSub,
        line: undefined,
        label: undefined,
        position: new THREE.Vector3(0, 0, 0)
      })
    ]
  }

  private createCanvas () {
    const canvas = document.createElement('canvas')
    canvas.width = this.options.size
    canvas.height = this.options.size
    canvas.style.position = 'fixed'
    canvas.style.right = '24px'
    canvas.style.top = '24px'
    canvas.classList.add(this.options.className)

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
    this.selectedAxis = null
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
      this.pointer.set(0, 0, 0)
    }

    window.removeEventListener('pointermove', this.onPointerDrag, false)
    window.removeEventListener('pointerup', this.onPointerUp, false)
  }

  private onPointerEnter = () => {
    this.rect = this._canvas.getBoundingClientRect()
  }

  // Hover
  private onPointerMove = (e: MouseEvent) => {
    if (this.isDragging) return

    if (e) {
      this.pointer = this.toMouseVector(e, this.pointer)
    }
  }

  private  toMouseVector (e: MouseEvent, target: THREE.Vector3) {
    return target.set(e.clientX - this.rect.left, e.clientY - this.rect.top, 0)
  }

  // Drag
  private onPointerDrag = (e: MouseEvent) => {
    this.updateDrag(e.clientX, e.clientY)
  }

  private initDrag (x: number, y: number) {
    this.dragStart.set(x, y)
    this.dragLast.set(x, y)
    this.isDragging = true
    this.isDragSignificant = false

    if (!this.isDragging) {
      this._canvas.classList.add('dragging')
    }
  }

  private updateDrag (x: number, y: number) {
    if (new THREE.Vector2(x, y).sub(this.dragStart).length() > 3) {
      this.isDragSignificant = true
    }

    const drag = new THREE.Vector2(x, y).sub(this.dragLast)
    this.dragLast.set(x, y)

    const rotX = drag.y / this._canvas.height
    const rotY = drag.x / this._canvas.width

    this.camera.snap().orbit(new THREE.Vector2(rotX * -180, rotY * -180))
  }

  private endDrag () {
    this.isDragging = false
    if (!this.isDragSignificant) {
      this.onMouseClick()
      this.isDragSignificant = false
    }

    this._canvas.classList.remove('dragging')
  }

  private onMouseClick = () => {
    if (this.isDragging || !this.selectedAxis) return
    this.camera
      .lerp(1)
      .orbitTowards(this.selectedAxis.direction.clone().multiplyScalar(-1))
    this.selectedAxis = null
  }

  private update = () => {
    this.invRotMat.extractRotation(this.camera.matrix).invert()

    for (let i = 0, length = this.axes.length; i < length; i++) {
      this.setAxisPosition(this.axes[i])
    }

    // Sort the layers where the +Z position is last so its drawn on top of anything below it
    this.axes.sort((a, b) => (a.position.z > b.position.z ? 1 : -1))

    // Draw the layers
    this.drawLayers(true)

    // Keep axis selected during drag.
    if (!this.isDragging) {
      this.pickAxes(this.pointer)
    }
  }

  private drawLayers (clear: boolean) {
    if (clear) {
      this.context.clearRect(0, 0, this._canvas.width, this._canvas.height)
    }

    // For each layer, draw the axis
    for (let i = 0, length = this.axes.length; i < length; i++) {
      const axis = this.axes[i]

      // Set the color
      const highlight = this.selectedAxis === axis
      const color = axis.position.z >= -0.01 ? axis.color : axis.colorSub

      // Draw the line that connects it to the center if enabled
      const center2 = new THREE.Vector2(this.center.x, this.center.y)
      const pos2 = new THREE.Vector2(axis.position.x, axis.position.y)
      if (axis.line) this.drawLine(center2, pos2, axis.line, color)

      // Draw the circle for the axis
      this.drawCircle(axis.position, axis.size, highlight ? '#FFFFFF' : color)

      // Write the axis label (X,Y,Z) if provided
      if (axis.label) {
        this.context.font = [
          this.options.fontWeight,
          this.options.fontSize,
          this.options.fontFamily
        ].join(' ')
        this.context.fillStyle = this.options.fontColor
        this.context.textBaseline = 'middle'
        this.context.textAlign = 'center'
        this.context.fillText(axis.label, axis.position.x, axis.position.y)
      }
    }
  }

  private drawCircle (pos: THREE.Vector3, radius = 10, color = '#FF0000') {
    this.context.beginPath()
    this.context.arc(pos.x, pos.y, radius, 0, 2 * Math.PI, false)
    this.context.fillStyle = color
    this.context.fill()
    this.context.closePath()
  }

  private drawLine (
    p1: THREE.Vector2,
    p2: THREE.Vector2,
    width: number = 1,
    color = '#FF0000'
  ) {
    this.context.beginPath()
    this.context.moveTo(p1.x, p1.y)
    this.context.lineTo(p2.x, p2.y)
    this.context.lineWidth = width
    this.context.strokeStyle = color
    this.context.stroke()
    this.context.closePath()
  }

  private setAxisPosition (axis: Axis) {
    const position = axis.direction.clone().applyMatrix4(this.invRotMat)
    const size = axis.size
    axis.position.set(
      position.x * (this.center.x - size / 2 - this.options.padding) +
        this.center.x,
      this.center.y -
        position.y * (this.center.y - size / 2 - this.options.padding),
      position.z
    )
  }

  private pickAxes (mouse: THREE.Vector3) {
    const currentAxis = this.selectedAxis
    this.selectedAxis = null

    // Loop through each layer
    for (let i = 0, length = this.axes.length; i < length; i++) {
      const distance = mouse.distanceTo(this.axes[i].position)

      if (distance < this.axes[i].size) this.selectedAxis = this.axes[i]
    }

    if (currentAxis !== this.selectedAxis) this.drawLayers(false)
  }

  /**
   * Disposes of the gizmo, removing event listeners and cleaning up resources.
   */
  dispose(){
    this._canvas.removeEventListener('pointerdown', this.onPointerDown, false)
    this._canvas.removeEventListener('pointerenter', this.onPointerEnter, false)
    this._canvas.removeEventListener('pointermove', this.onPointerDrag, false)
    window.removeEventListener('pointermove', this.onPointerDrag, false)
    window.removeEventListener('pointerup', this.onPointerUp, false)
    this._canvas.remove()
  }
}

export { GizmoAxes as OrbitControlsGizmo }
