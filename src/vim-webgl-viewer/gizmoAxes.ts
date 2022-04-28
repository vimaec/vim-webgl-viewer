import * as THREE from 'three'
import { ICamera } from './camera'

class Axis {
  axis: string
  direction: THREE.Vector3
  size: number
  color: string
  colorSub: string
  line: number
  label: string
  position: THREE.Vector3

  constructor (init: Partial<Axis>) {
    this.axis = init.axis
    this.direction = init.direction
    this.size = init.size
    this.color = init.color
    this.colorSub = init.colorSub
    this.line = init.line
    this.label = init.label
    this.position = init.position
  }
}

class GizmoOptions {
  size: number = 90
  padding: number = 8
  bubbleSizePrimary: number = 8
  bubbleSizeSecondary: number = 6
  lineWidth: number = 2
  fontSize: string = '12px'
  fontFamily: string = 'arial'
  fontWeight: string = 'bold'
  fontColor: string = '#222222'
  className: string = 'gizmo-axis-canvas'
  colorX: string = '#f73c3c'
  // colorX: string = '#ffffff'

  colorY: string = '#6ccb26'
  colorZ: string = '#178cf0'
  colorXSub: string = '#942424'
  // colorXSub: string = '#ffffff'

  colorYSub: string = '#417a17'
  // colorYSub: string = '#ffffff'
  colorZSub: string = '#0e5490'
  // colorZSub: string = '#ffffff'

  constructor (init: Partial<GizmoOptions>) {
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

export class GizmoAxes {
  // settings
  options: GizmoOptions
  axes: Axis[]

  // dependencies
  controller: ICamera
  camera: THREE.Camera
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  rect: DOMRect

  // state
  isDragging: boolean
  dragStart: THREE.Vector2
  dragEnd: THREE.Vector2
  drag: THREE.Vector2
  mouse: THREE.Vector3
  center: THREE.Vector3
  invRotMat: THREE.Matrix4 = new THREE.Matrix4()
  selectedAxis: Axis

  constructor (
    camera: THREE.Camera,
    controller: ICamera,
    options?: Partial<GizmoOptions>
  ) {
    this.options = new GizmoOptions(options)
    this.controller = controller
    this.camera = camera
    this.mouse = new THREE.Vector3()
    this.dragStart = new THREE.Vector2()
    this.dragEnd = new THREE.Vector2()
    this.drag = new THREE.Vector2()
    this.center = new THREE.Vector3(
      this.options.size / 2,
      this.options.size / 2,
      0
    )
    this.axes = this.createAxes()
    this.selectedAxis = null
    this.isDragging = false

    this.canvas = this.createCanvas()

    this.animate()
  }

  animate () {
    this.update()
    requestAnimationFrame(() => this.animate())
  }

  createAxes () {
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
        position: new THREE.Vector3(0, 0, 0)
      }),
      new Axis({
        axis: '-y',
        direction: new THREE.Vector3(0, -1, 0),
        size: this.options.bubbleSizeSecondary,
        color: this.options.colorY,
        colorSub: this.options.colorYSub,
        position: new THREE.Vector3(0, 0, 0)
      }),
      new Axis({
        axis: '-z',
        // inverted Z
        direction: new THREE.Vector3(0, 0, -1),
        size: this.options.bubbleSizeSecondary,
        color: this.options.colorZ,
        colorSub: this.options.colorZSub,
        position: new THREE.Vector3(0, 0, 0)
      })
    ]
  }

  createCanvas () {
    const canvas = document.createElement('canvas')
    canvas.width = this.options.size
    canvas.height = this.options.size
    canvas.classList.add(this.options.className)

    canvas.addEventListener('pointerdown', this.onPointerDown, false)
    canvas.addEventListener('pointerenter', this.onPointerEnter, false)
    canvas.addEventListener('pointermove', this.onPointerMove, false)
    canvas.addEventListener('click', this.onMouseClick, false)

    this.context = canvas.getContext('2d')

    return canvas
  }

  onPointerDown = (e) => {
    this.dragStart.set(e.clientX, e.clientY)
    window.addEventListener('pointermove', this.onDrag, false)
    window.addEventListener('pointerup', this.onPointerUp, false)
  }

  onPointerUp = () => {
    setTimeout(() => (this.isDragging = false), 0)
    this.canvas.classList.remove('dragging')
    window.removeEventListener('pointermove', this.onDrag, false)
    window.removeEventListener('pointerup', this.onPointerUp, false)
  }

  onPointerEnter = () => {
    this.rect = this.canvas.getBoundingClientRect()
  }

  onPointerMove = (e) => {
    if (this.isDragging) return

    const currentAxis = this.selectedAxis

    this.selectedAxis = null
    if (e) {
      this.mouse.set(e.clientX - this.rect.left, e.clientY - this.rect.top, 0)
    }

    // Loop through each layer
    for (let i = 0, length = this.axes.length; i < length; i++) {
      const distance = this.mouse.distanceTo(this.axes[i].position)

      if (distance < this.axes[i].size) this.selectedAxis = this.axes[i]
    }

    if (currentAxis !== this.selectedAxis) this.drawLayers(false)
  }

  onDrag = (e) => {
    if (!this.isDragging) this.canvas.classList.add('dragging')

    this.isDragging = true

    this.selectedAxis = null

    this.dragEnd.set(e.clientX, e.clientY)

    this.drag.subVectors(this.dragEnd, this.dragStart)

    const rotX = this.drag.x / this.canvas.width
    const rotY = this.drag.y / this.canvas.height
    this.controller.rotate(new THREE.Vector2(rotX, rotY))
    this.dragStart.copy(this.dragEnd)
  }

  onMouseClick = () => {
    // FIXME Don't like the current animation
    if (this.isDragging || !this.selectedAxis) return

    this.controller.forward = this.selectedAxis.direction
    this.selectedAxis = null
  }

  drawCircle (p, radius = 10, color = '#FF0000') {
    this.context.beginPath()
    this.context.arc(p.x, p.y, radius, 0, 2 * Math.PI, false)
    this.context.fillStyle = color
    this.context.fill()
    this.context.closePath()
  }

  drawLine (
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

  drawLayers (clear: boolean) {
    if (clear) {
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
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

  setAxisPosition (axis) {
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

  update = () => {
    this.camera.updateMatrix()
    this.invRotMat.extractRotation(this.camera.matrix).invert()

    for (let i = 0, length = this.axes.length; i < length; i++) {
      this.setAxisPosition(this.axes[i])
    }

    // Sort the layers where the +Z position is last so its drawn on top of anything below it
    this.axes.sort((a, b) => (a.position.z > b.position.z ? 1 : -1))

    // Draw the layers
    this.drawLayers(true)
  }

  dispose = () => {
    /*
    this.orbit?.removeEventListener('change', this.update)
    this.orbit?.removeEventListener('start', () =>
      this.domElement.classList.add('inactive')
    )
    this.orbit?.removeEventListener('end', () =>
      this.domElement.classList.remove('inactive')
    )
    */
    this.canvas.removeEventListener('pointerdown', this.onPointerDown, false)
    this.canvas.removeEventListener('pointerenter', this.onPointerEnter, false)
    this.canvas.removeEventListener('pointermove', this.onPointerMove, false)
    this.canvas.removeEventListener('click', this.onMouseClick, false)
    window.removeEventListener('pointermove', this.onDrag, false)
    window.removeEventListener('pointerup', this.onPointerUp, false)
    this.canvas.remove()
  }
}

export { GizmoAxes as OrbitControlsGizmo }
