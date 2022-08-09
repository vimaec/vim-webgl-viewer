/**
 * @module viw-webgl-viewer
 */

import { Viewer } from './viewer'
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

class BoxInputs {
  // dependencies
  viewer: Viewer
  cube: THREE.Object3D
  sharedBox: THREE.Box3

  // state
  faceNormal: THREE.Vector3 = new THREE.Vector3()
  dragOrigin: THREE.Vector3 = new THREE.Vector3()
  dragpPlane: THREE.Plane
  mouseDown: boolean
  raycaster: THREE.Raycaster = new THREE.Raycaster()
  lastBox: THREE.Box3 = new THREE.Box3()
  unregisters: (() => void)[] = []

  // Called when mouse enters or leave a face
  onFaceEnter: (normal: THREE.Vector3) => void
  // Called the box is reshaped
  onBoxStretch: (box: THREE.Box3) => void
  // Called when the user is done reshaping the box
  onBoxConfirm: (box: THREE.Box3) => void

  constructor (viewer: Viewer, cube: THREE.Object3D, box: THREE.Box3) {
    this.viewer = viewer
    this.cube = cube
    this.sharedBox = box
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
    this.reg(canvas, 'pointerdown', this.onMouseClick.bind(this))
    this.reg(canvas, 'pointermove', this.onMouseMove.bind(this))
    this.reg(canvas, 'pointerup', this.onMouseUp.bind(this))
  }

  unregister () {
    this.unregisters.forEach((unreg) => unreg())
    this.unregisters.length = 0
  }

  onMouseMove (event: any) {
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
      // this.faceNormal = new THREE.Vector3()
      this.mouseDown = false
      this.viewer.inputs.registerAll()
      if (event.pointerType === 'mouse') {
        this.onMouseMove(event)
      } else {
        this.faceNormal = new THREE.Vector3()
        this.onFaceEnter?.(this.faceNormal)
      }
      this.onBoxConfirm?.(this.sharedBox)
    }
  }

  onMouseClick (event: any) {
    const hits = this.raycast(new THREE.Vector2(event.offsetX, event.offsetY))
    const hit = hits?.[0]
    if (!hit?.face?.normal) return

    this.lastBox.copy(this.sharedBox)
    this.faceNormal = hit.face.normal
    this.dragOrigin.copy(hit.point)
    const dist = hit.point.clone().dot(this.viewer.camera.forward)

    this.dragpPlane = new THREE.Plane(this.viewer.camera.forward, -dist)
    this.mouseDown = true
    this.viewer.inputs.unregisterAll()
    this.onFaceEnter?.(this.faceNormal)
  }

  onDrag (event: any) {
    this.raycaster = this.viewer.raycaster.fromPoint(
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
    const box = this.stretch(this.faceNormal, amount)
    this.onBoxStretch?.(box)
  }

  stretch (normal: THREE.Vector3, amount: number) {
    const result = this.sharedBox.clone()
    if (normal.x > 0.1) {
      result.max.setX(Math.max(this.lastBox.max.x + amount, result.min.x - 1))
    }
    if (normal.x < -0.1) {
      result.min.setX(Math.min(this.lastBox.min.x - amount, result.max.x + 1))
    }

    if (normal.y > 0.1) {
      result.max.setY(Math.max(this.lastBox.max.y + amount, result.min.y - 1))
    }
    if (normal.y < -0.1) {
      result.min.setY(Math.min(this.lastBox.min.y - amount, result.max.y + 1))
    }

    if (normal.z > 0.1) {
      result.max.setZ(Math.max(this.lastBox.max.z + amount, result.min.z - 1))
    }
    if (normal.z < -0.1) {
      result.min.setZ(Math.min(this.lastBox.min.z - amount, result.max.z + 1))
    }
    return result
  }

  raycast (position: THREE.Vector2) {
    this.raycaster = this.viewer.raycaster.fromPoint(position, this.raycaster)
    return this.raycaster.intersectObject(this.cube)
  }
}

/**
 * Gizmo for section box, it acts as a proxy between renderer and user.
 */
export class GizmoSection {
  // dependencies
  private _viewer: Viewer

  // resources
  private _inputs: BoxInputs
  private _cube: BoxMesh
  private _outline: BoxOutline
  private _highlight: BoxHighlight

  // State
  private _normal: THREE.Vector3
  private _clip: boolean
  private _show: boolean
  private _interactive: boolean

  /**
   * Callback for when box is done changing
   */
  onBoxConfirm: (box: THREE.Box3) => void

  private get renderer () {
    return this._viewer.renderer
  }

  private get section () {
    return this._viewer.renderer.section
  }

  constructor (viewer: Viewer) {
    this._viewer = viewer

    this._normal = new THREE.Vector3()

    this._cube = new BoxMesh()
    this._outline = new BoxOutline()
    this._highlight = new BoxHighlight()

    this.renderer.add(this._cube)
    this.renderer.add(this._outline)
    this.renderer.add(this._highlight)

    this._inputs = new BoxInputs(
      viewer,
      this._cube,
      this._viewer.renderer.section.box
    )
    this._inputs.onFaceEnter = (normal) => {
      this._normal = normal
      if (this.visible) this._highlight.highlight(this.section.box, normal)
    }
    this._inputs.onBoxStretch = (box) => {
      this.renderer.section.fitBox(box)
      this.update()
    }
    this._inputs.onBoxConfirm = (box) => this.onBoxConfirm?.(box)

    this.clip = false
    this.visible = false
    this.interactive = false
    this.update()
  }

  /**
   * When true the section gizmo will section the model with clipping planes.
   */
  get clip () {
    return this._clip
  }

  set clip (value: boolean) {
    this._clip = value
    this.renderer.section.active = value
  }

  /**
   * When true the section gizmo will react to user inputs.
   */
  get interactive () {
    return this._interactive
  }

  set interactive (value: boolean) {
    if (!this._interactive && value) this._inputs.register()
    if (this._interactive && !value) this._inputs.unregister()
    this._interactive = value
    this._highlight.visible = false
  }

  /**
   * When true the section gizmo will be rendered.
   */
  get visible () {
    return this._show
  }

  set visible (value: boolean) {
    this._show = value
    this._cube.visible = value
    this._outline.visible = value
    this._highlight.visible = value
    if (value) this.update()
  }

  /**
   * Sets the section gizmo size to match given box
   */
  public fitBox (box: THREE.Box3) {
    this._cube.fitBox(box)
    this._outline.fitBox(box)
    this.renderer.section.fitBox(box)
  }

  /**
   * Call this if there were direct changes to renderer.section
   */
  update () {
    this.fitBox(this.section.box)
    this._highlight.highlight(this.section.box, this._normal)
  }

  dispose () {
    this.renderer.remove(this._cube)
    this.renderer.remove(this._outline)
    this.renderer.remove(this._highlight)

    this._inputs.unregister()
    this._cube.dispose()
    this._outline.dispose()
    this._highlight.dispose()
  }
}
