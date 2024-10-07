import { Vim } from '../../vim-loader/vim'
import { Viewer } from '../viewer'
import * as THREE from 'three'
import { ObjectAttribute } from '../../vim-loader/objectAttributes'
import { SimpleMesh } from '../../vim-loader/mesh'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls'
import { createTransparent } from '../../vim-loader/materials/standardMaterial'

/**
 * Class representing a 2D plan in a 3D viewer.
 */
export class Plan2D {
  /** The type of the object, always 'Plan2D'. */
  public readonly type = 'Plan2D'

  private readonly _viewer: Viewer
  private readonly _mesh: SimpleMesh
  private readonly _frameMaterial: THREE.MeshPhongMaterial
  private readonly _texMaterial: THREE.MeshBasicMaterial
  private readonly _texture: THREE.Texture
  private readonly _geometry: THREE.PlaneGeometry
  private readonly _gizmo: TransformControls

  private _outlineAttribute: ObjectAttribute<boolean>
  private _subs: (() => void)[] = []
  private _focused: boolean = false

  /** The vim object from which this object came from. */
  vim: Vim | undefined

  /**
   * Creates an instance of Plan2D.
   * @param viewer - The viewer in which the Plan2D will be displayed.
   * @param canvas - The canvas containing the 2D plan image.
   */
  constructor (viewer: Viewer, canvas: HTMLCanvasElement) {
    this._viewer = viewer

    this._texture = new THREE.CanvasTexture(canvas)

    // Create a plane geometry (width and height based on canvas dimensions)
    this._geometry = new THREE.PlaneGeometry(100, 100)

    this._texMaterial = new THREE.MeshBasicMaterial({ map: this._texture })
    this._texMaterial.side = THREE.DoubleSide
    this._frameMaterial = createTransparent().material
    this._frameMaterial.opacity = 0

    const frameMesh = new THREE.Mesh(this._geometry, this._frameMaterial)
    frameMesh.scale.set(canvas.width, canvas.height, 1).multiplyScalar(0.001)
    const texMesh = new THREE.Mesh(this._geometry, this._texMaterial)

    frameMesh.add(texMesh)
    frameMesh.userData.vim = this

    // Set variables
    this._mesh = new SimpleMesh(frameMesh)
    this._gizmo = this.addGizmo(this.mesh)

    const array = [this._mesh]
    this._outlineAttribute = new ObjectAttribute(
      false,
      'selected',
      'selected',
      array,
      (v) => (v ? 1 : 0)
    )
  }

  /**
   * Initializes the transform controls (gizmo) for the Plan2D.
   * @param object - The object to which the gizmo will be attached.
   */
  private addGizmo (object: THREE.Object3D): TransformControls {
    // Create and add the control to your scene
    const gizmo = new TransformControls(this._viewer.camera.three, this._viewer.viewport.canvas)
    gizmo.attach(object) // Attach to the plane mesh

    // Hide the gizmo when the object is not selected
    gizmo.visible = false
    gizmo.enabled = false
    this._subs.push(
      this._viewer.selection.onValueChanged.sub(() => {
        gizmo.visible = this.selected
        gizmo.enabled = this.selected
      })
    )
    this._viewer.renderer.add(gizmo)

    // Freeze the camera when dragging the gizmo
    const onChange = (): void => {
      this._viewer.camera.freeze = gizmo.dragging
      this._viewer.renderer.needsUpdate = true
    }
    gizmo.addEventListener('change', onChange)
    this._subs.push(() => gizmo.removeEventListener('change', onChange))

    // Enable interaction modes
    gizmo.setMode('translate') // Can be 'translate', 'rotate', or 'scale'

    // Optional: Add key binding to toggle between translation and rotation
    const onKey = (event: KeyboardEvent): void => {
      if (!this.selected) return
      switch (event.key) {
        case 't': // 't' for translate
          gizmo.setMode('translate')
          break
        case 'r': // 'r' for rotate
          gizmo.setMode('rotate')
          break
        case 's': // 's' for scale
          gizmo.setMode('scale')
          break
      }
    }
    window.addEventListener('keydown', onKey)
    this._subs.push(() => window.removeEventListener('keydown', onKey))

    return gizmo
  }

  /**
   * Gets the Three.js mesh associated with this Plan2D.
   */
  get mesh (): THREE.Mesh {
    return this._mesh.mesh
  }

  /**
   * Checks if the Plan2D is currently selected in the viewer.
   */
  get selected (): boolean {
    return this._viewer.selection.has(this)
  }

  /**
   * Gets the position of the Plan2D in the 3D scene.
   */
  get position (): THREE.Vector3 {
    return this.mesh.position
  }

  /**
   * Sets the position of the Plan2D in the 3D scene.
   */
  set position (value: THREE.Vector3) {
    this.mesh.position.copy(value)
  }

  /**
   * Gets whether the Plan2D has an outline applied.
   */
  get outline (): boolean {
    return this._outlineAttribute.value
  }

  /**
   * Sets whether the Plan2D should have an outline applied.
   */
  set outline (value: boolean) {
    this._outlineAttribute.apply(value)
    this._viewer.renderer.needsUpdate = true
  }

  /**
   * Gets whether the Plan2D is focused.
   */
  get focused (): boolean {
    return this._focused
  }

  /**
   * Sets the focused state of the Plan2D.
   */
  set focused (value: boolean) {
    this._focused = value
    this._frameMaterial.opacity = value ? 0.1 : 0
  }

  /**
   * Gets the visibility of the Plan2D.
   */
  get visible (): boolean {
    return this.mesh.visible
  }

  /**
   * Sets the visibility of the Plan2D.
   */
  set visible (value: boolean) {
    this.mesh.visible = value
    this._viewer.renderer.needsUpdate = true
  }

  /**
   * Gets the color of the Plan2D frame.
   */
  get color (): THREE.Color {
    return this._frameMaterial.color
  }

  /**
   * Sets the color of the Plan2D frame.
   */
  set color (color: THREE.Color) {
    this._frameMaterial.color.copy(color)
    this._viewer.renderer.needsUpdate = true
  }

  /**
   * Gets the size of the Plan2D.
   */
  get size (): THREE.Vector2 {
    return new THREE.Vector2(this.mesh.scale.x, this.mesh.scale.y)
  }

  /**
   * Sets the size of the Plan2D.
   */
  set size (value: THREE.Vector2) {
    this.mesh.scale.set(value.x, value.y, 1)
    this.mesh.geometry.computeBoundingBox()
    this._viewer.renderer.needsUpdate = true
  }

  /**
   * Retrieves the bounding box of the Plan2D, computing it if necessary.
   */
  getBoundingBox (): THREE.Box3 {
    if (!this.mesh.geometry.boundingBox) {
      this.mesh.geometry.computeBoundingBox()
    }
    return this.mesh.geometry.boundingBox!
  }

  /**
   * Disposes of the Plan2D, cleaning up resources.
   */
  dispose (): void {
    this._viewer.renderer.remove(this.mesh)
    this._viewer.renderer.remove(this._gizmo)
    this._frameMaterial.dispose()
    this._texMaterial.dispose()
    this._texture.dispose()
    this._geometry.dispose()
    this._subs.forEach((s) => s())
    this._subs = []
    this._viewer.renderer.needsUpdate = true
  }
}
