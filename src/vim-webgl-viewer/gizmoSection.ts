import { Viewer } from './viewer'
import { Materials } from '../vim-loader/materials'
import * as THREE from 'three'

class BoxOutline extends THREE.LineSegments {
  constructor () {
    // prettier-ignore
    const vertices = new Float32Array([
      -0.5, -0.5, -0.5,
      0.5, -0.5, -0.5,
      0.5, 0.5, -0.5,
      -0.5, 0.5, -0.5,
      -0.5, -0.5, 0.5,
      0.5, -0.5, 0.5,
      0.5, 0.5, 0.5,
      -0.5, 0.5, 0.5
    ])
    // prettier-ignore
    const indices = [

      0.5, 1,
      1, 2,
      2, 3,
      3, 0,

      4, 5,
      5, 6,
      6, 7,
      7, 4,

      0, 4,
      1, 5,
      2, 6,
      3, 7
    ]
    const geo = new THREE.BufferGeometry()
    const mat = new THREE.LineBasicMaterial()
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
    geo.setIndex(indices)
    super(geo, mat)
  }

  fitBox (box: THREE.Box3) {
    this.scale.set(
      box.max.x - box.min.x,
      box.max.y - box.min.y,
      box.max.z - box.min.z
    )
    this.position.set(
      (box.max.x + box.min.x) / 2,
      (box.max.y + box.min.y) / 2,
      (box.max.z + box.min.z) / 2
    )
  }

  dispose () {
    this.geometry.dispose()
    ;(this.material as THREE.Material).dispose()
  }
}

class BoxMesh extends THREE.Mesh {
  constructor () {
    const geo = new THREE.BoxGeometry()
    const mat = new THREE.MeshBasicMaterial({
      opacity: 0.1,
      transparent: true,
      color: new THREE.Color(0, 0.5, 1),
      depthTest: false
    })

    super(geo, mat)
  }

  fitBox (box: THREE.Box3) {
    this.scale.set(
      box.max.x - box.min.x,
      box.max.y - box.min.y,
      box.max.z - box.min.z
    )
    this.position.set(
      (box.max.x + box.min.x) / 2,
      (box.max.y + box.min.y) / 2,
      (box.max.z + box.min.z) / 2
    )
  }

  dispose () {
    this.geometry.dispose()
    ;(this.material as THREE.Material).dispose()
  }
}

class BoxHighlight extends THREE.Mesh {
  constructor () {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(12), 3)
    )
    geo.setIndex([0, 1, 2, 0, 2, 3])

    const mat = new THREE.MeshBasicMaterial({
      opacity: 0.5,
      transparent: true,
      depthTest: false,
      side: THREE.DoubleSide
    })
    super(geo, mat)
  }

  highlight (box: THREE.Box3, normal: THREE.Vector3) {
    this.visible = false
    const positions = this.geometry.getAttribute('position')

    if (normal.x > 0.1) {
      positions.setXYZ(0, box.max.x, box.max.y, box.max.z)
      positions.setXYZ(1, box.max.x, box.min.y, box.max.z)
      positions.setXYZ(2, box.max.x, box.min.y, box.min.z)
      positions.setXYZ(3, box.max.x, box.max.y, box.min.z)
      this.visible = true
    }
    if (normal.x < -0.1) {
      positions.setXYZ(0, box.min.x, box.max.y, box.max.z)
      positions.setXYZ(1, box.min.x, box.min.y, box.max.z)
      positions.setXYZ(2, box.min.x, box.min.y, box.min.z)
      positions.setXYZ(3, box.min.x, box.max.y, box.min.z)
      this.visible = true
    }
    if (normal.y > 0.1) {
      positions.setXYZ(0, box.max.x, box.max.y, box.max.z)
      positions.setXYZ(1, box.min.x, box.max.y, box.max.z)
      positions.setXYZ(2, box.min.x, box.max.y, box.min.z)
      positions.setXYZ(3, box.max.x, box.max.y, box.min.z)
      this.visible = true
    }
    if (normal.y < -0.1) {
      positions.setXYZ(0, box.max.x, box.min.y, box.max.z)
      positions.setXYZ(1, box.min.x, box.min.y, box.max.z)
      positions.setXYZ(2, box.min.x, box.min.y, box.min.z)
      positions.setXYZ(3, box.max.x, box.min.y, box.min.z)
      this.visible = true
    }
    if (normal.z > 0.1) {
      positions.setXYZ(0, box.max.x, box.max.y, box.max.z)
      positions.setXYZ(1, box.min.x, box.max.y, box.max.z)
      positions.setXYZ(2, box.min.x, box.min.y, box.max.z)
      positions.setXYZ(3, box.max.x, box.min.y, box.max.z)
      this.visible = true
    }
    if (normal.z < -0.1) {
      positions.setXYZ(0, box.max.x, box.max.y, box.min.z)
      positions.setXYZ(1, box.min.x, box.max.y, box.min.z)
      positions.setXYZ(2, box.min.x, box.min.y, box.min.z)
      positions.setXYZ(3, box.max.x, box.min.y, box.min.z)
      this.visible = true
    }
    positions.needsUpdate = true
  }

  dispose () {
    this.geometry.dispose()
    ;(this.material as THREE.Material).dispose()
  }
}

class BoxClipper {
  viewer: Viewer
  private _active: boolean

  constructor (viewer: Viewer) {
    this.viewer = viewer
  }

  maxX: THREE.Plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0))
  minX: THREE.Plane = new THREE.Plane(new THREE.Vector3(1, 0, 0))
  maxY: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, -1, 0))
  minY: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0))
  maxZ: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 0, -1))
  minZ: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 0, 1))
  planes: THREE.Plane[] = [
    this.maxX,
    this.minX,
    this.maxY,
    this.minY,
    this.maxZ,
    this.minZ
  ]

  fitBox (box: THREE.Box3) {
    this.maxX.constant = box.max.x
    this.minX.constant = -box.min.x
    this.maxY.constant = box.max.y
    this.minY.constant = -box.min.y
    this.maxZ.constant = box.max.z
    this.minZ.constant = -box.min.z
  }

  set active (value: boolean) {
    const materials = Materials.getDefaultLibrary()
    const p = value ? this.planes : undefined
    materials.opaque.clippingPlanes = p
    materials.transparent.clippingPlanes = p
    materials.wireframe.clippingPlanes = p
    this.viewer.renderer.renderer.localClippingEnabled = value
    this._active = value
  }

  get active () {
    return this._active
  }
}

class BoxInputs {
  // dependencies
  viewer: Viewer
  cube: THREE.Object3D
  box: THREE.Box3

  // state
  faceNormal: THREE.Vector3 = new THREE.Vector3()
  dragOrigin: THREE.Vector3 = new THREE.Vector3()
  lastBox: THREE.Box3 = new THREE.Box3()
  dragpPlane: THREE.Plane
  mouseDown: boolean
  raycaster: THREE.Raycaster = new THREE.Raycaster()
  unregisters: (() => void)[] = []

  // Called when mouse enters or leave a face
  onFaceEnter: (normal: THREE.Vector3) => void
  // Called the box is reshaped
  onBoxStretch: (box: THREE.Box3) => void

  constructor (viewer: Viewer, cube: THREE.Object3D, box: THREE.Box3) {
    this.viewer = viewer
    this.cube = cube
    this.box = box
  }

  private reg = (
    // eslint-disable-next-line no-undef
    handler: DocumentAndElementEventHandlers,
    type: string,
    listener: (event: any) => void
  ) => {
    handler.addEventListener(type, listener)
    this.unregisters.push(() => handler.removeEventListener(type, listener))
  }

  register () {
    if (this.unregister.length > 0) return
    const canvas = this.viewer.viewport.canvas
    this.reg(canvas, 'mousedown', this.onMouseClick.bind(this))
    this.reg(canvas, 'mousemove', this.onMouseMove.bind(this))
    this.reg(canvas, 'mouseup', this.onMouseUp.bind(this))
  }

  unregister () {
    this.unregisters.forEach((unreg) => unreg())
    this.unregisters.length = 0
  }

  onMouseMove (event: any) {
    console.log('onMouseMove')

    if (this.mouseDown) {
      this.onDrag(event)
      return
    }

    const hits = this.raycast(new THREE.Vector2(event.offsetX, event.offsetY))
    const hit = hits?.[0]
    const norm = hit?.face?.normal
    if (!norm) {
      if (
        this.faceNormal.x !== 0 ||
        this.faceNormal.y !== 0 ||
        this.faceNormal.z !== 0
      ) {
        this.faceNormal.set(0, 0, 0)
        this.onFaceEnter?.(this.faceNormal)
      }
      return
    }

    if (this.faceNormal.equals(norm)) {
      return
    }

    this.faceNormal = norm
    this.onFaceEnter?.(this.faceNormal)
  }

  onMouseUp (event: any) {
    if (this.mouseDown) {
      this.viewer.selection.clear()
      this.faceNormal = new THREE.Vector3()
      this.mouseDown = false
      this.viewer.inputs.register()
      this.onMouseMove(event)
    }
  }

  onMouseClick (event: any) {
    console.log('OnClick !')
    const hits = this.raycast(new THREE.Vector2(event.offsetX, event.offsetY))
    const hit = hits?.[0]
    if (!hit?.face?.normal) return

    this.faceNormal = hit.face.normal
    this.dragOrigin.copy(hit.point)
    const dist = hit.point.clone().dot(this.viewer.camera.forward)

    this.dragpPlane = new THREE.Plane(this.viewer.camera.forward, -dist)
    this.mouseDown = true
    this.lastBox.copy(this.box)
    this.viewer.inputs.unregister()
  }

  onDrag (event: any) {
    this.raycaster = this.viewer.raycaster.getRaycaster(
      new THREE.Vector2(event.offsetX, event.offsetY),
      this.raycaster
    )
    // We get the mouse raycast intersection on the drag plane.
    const point = this.raycaster.ray.intersectPlane(
      this.dragpPlane,
      new THREE.Vector3()
    )

    // We compute the normal-aligned component of the delta between current drag point and origin drag point.
    const delta = point.sub(this.dragOrigin)
    const amount = delta.dot(this.faceNormal)
    const nextBox = this.stretch(this.faceNormal, amount)
    this.onBoxStretch?.(nextBox)
  }

  stretch (normal: THREE.Vector3, amount: number) {
    const box = this.lastBox.clone()
    if (normal.x > 0.1) {
      box.max.setX(Math.max(this.lastBox.max.x + amount, box.min.x - 1))
    }
    if (normal.x < -0.1) {
      box.min.setX(Math.min(this.lastBox.min.x - amount, box.max.x + 1))
    }

    if (normal.y > 0.1) {
      box.max.setY(Math.max(this.lastBox.max.y + amount, box.min.y - 1))
    }
    if (normal.y < -0.1) {
      box.min.setY(Math.min(this.lastBox.min.y - amount, box.max.y + 1))
    }

    if (normal.z > 0.1) {
      box.max.setZ(Math.max(this.lastBox.max.z + amount, box.min.z - 1))
    }
    if (normal.z < -0.1) {
      box.min.setZ(Math.min(this.lastBox.min.z - amount, this.box.max.z + 1))
    }
    return box
  }

  raycast (position: THREE.Vector2) {
    this.raycaster = this.viewer.raycaster.getRaycaster(
      position,
      this.raycaster
    )
    return this.raycaster.intersectObject(this.cube)
  }
}

export class GizmoSection {
  // dependencies
  viewer: Viewer

  // resources
  inputs: BoxInputs
  cube: BoxMesh
  outline: BoxOutline
  highlight: BoxHighlight
  clipper: BoxClipper

  // State
  box: THREE.Box3
  normal: THREE.Vector3
  private _active: boolean
  private _show: boolean
  private _interactive: boolean

  constructor (viewer: Viewer) {
    this.viewer = viewer

    this.normal = new THREE.Vector3()
    this.box = new THREE.Box3(
      new THREE.Vector3(-30, -30, -30),
      new THREE.Vector3(30, 30, 30)
    )

    this.cube = new BoxMesh()
    this.clipper = new BoxClipper(this.viewer)
    this.outline = new BoxOutline()
    this.highlight = new BoxHighlight()

    this.viewer.renderer.add(this.cube)
    this.viewer.renderer.add(this.outline)
    this.viewer.renderer.add(this.highlight)

    this.inputs = new BoxInputs(viewer, this.cube, this.box)
    this.inputs.onFaceEnter = (normal) => {
      console.log('enter')
      this.highlight.highlight(this.box, normal)
      this.normal = normal
    }
    this.inputs.onBoxStretch = (box) => {
      console.log('stretch')
      this.box.copy(box)
      this.update()
    }
    this.active = false
    this.show = false
    this.interactive = false
    this.update()
  }

  get active () {
    return this._active
  }

  public set active (value: boolean) {
    this._active = value
    this.clipper.active = value
  }

  get interactive () {
    return this._interactive
  }

  set interactive (value: boolean) {
    if (!this._interactive && value) this.inputs.register()
    if (this._interactive && !value) this.inputs.unregister()
    this._interactive = value
    this.highlight.visible = false
  }

  get show () {
    return this._show
  }

  set show (value: boolean) {
    this._show = value
    this.cube.visible = value
    this.outline.visible = value
    this.highlight.visible = value
  }

  public fitBox (box: THREE.Box3) {
    this.cube.fitBox(box)
    this.outline.fitBox(box)
    this.clipper.fitBox(box)
    this.box.copy(box)
  }

  private update () {
    this.fitBox(this.box)
    this.highlight.highlight(this.box, this.normal)
  }

  dispose () {
    this.inputs.unregister()
    this.cube.dispose()
    this.outline.dispose()
    this.highlight.dispose()
  }
}
