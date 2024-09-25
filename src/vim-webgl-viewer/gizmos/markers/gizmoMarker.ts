import { Vim } from '../../../vim-loader/vim'
import { Viewer } from '../../viewer'
import * as THREE from 'three'
import { SimpleInstanceSubmesh } from '../../../vim-loader/mesh'
import { ObjectAttribute } from '../../../vim-loader/objectAttributes'
import { ColorAttribute } from '../../../vim-loader/colorAttributes'

/**
 * Marker gizmo that display an interactive sphere at a 3D positions
 * Marker gizmos are still under development.
 */
export class GizmoMarker {
  public readonly type = 'Marker'
  private _viewer: Viewer
  private _submesh: SimpleInstanceSubmesh

  /**
   * The vim object from which this object came from.
   */
  vim: Vim | undefined

  /**
   * The bim element index associated with this object.
   */
  element: number | undefined

  /**
   * The geometry instances  associated with this object.
   */
  instances: number[] | undefined

  private _outlineAttribute: ObjectAttribute<boolean>
  private _visibleAttribute: ObjectAttribute<boolean>
  private _coloredAttribute: ObjectAttribute<boolean>
  private _focusedAttribute: ObjectAttribute<boolean>
  private _colorAttribute: ColorAttribute

  constructor (viewer: Viewer, submesh: SimpleInstanceSubmesh) {
    this._viewer = viewer
    this._submesh = submesh

    const array = [submesh]
    this._outlineAttribute = new ObjectAttribute(
      false,
      'selected',
      'selected',
      array,
      (v) => (v ? 1 : 0)
    )

    this._visibleAttribute = new ObjectAttribute(
      true,
      'ignore',
      'ignore',
      array,
      (v) => (v ? 0 : 1)
    )

    this._focusedAttribute = new ObjectAttribute(
      false,
      'focused',
      'focused',
      array,
      (v) => (v ? 1 : 0)
    )

    this._coloredAttribute = new ObjectAttribute(
      false,
      'colored',
      'colored',
      array,
      (v) => (v ? 1 : 0)
    )

    this._colorAttribute = new ColorAttribute(array, undefined, undefined)
    this.color = new THREE.Color(1, 0.1, 0.1)
  }

  updateMesh (mesh: SimpleInstanceSubmesh) {
    this._submesh = mesh
    const array = [this._submesh]
    this._visibleAttribute.updateMeshes(array)
    this._focusedAttribute.updateMeshes(array)
    this._outlineAttribute.updateMeshes(array)
    this._colorAttribute.updateMeshes(array)
    this._coloredAttribute.updateMeshes(array)
    this._viewer.renderer.needsUpdate = true
  }

  /** Sets the position of the marker in the 3d scene */
  set position (value: THREE.Vector3) {
    const m = new THREE.Matrix4()
    m.compose(value, new THREE.Quaternion(), new THREE.Vector3(1, 1, 1))
    this._submesh.mesh.setMatrixAt(this._submesh.index, m)
    this._submesh.mesh.instanceMatrix.needsUpdate = true
  }

  get position () {
    const m = new THREE.Matrix4()
    this._submesh.mesh.getMatrixAt(0, m)
    return new THREE.Vector3().setFromMatrixPosition(m)
  }

  /**
   * Always false
   */
  get hasMesh (): boolean {
    return false
  }

  /**
   * Applies a color override instead of outlines.
   */
  get outline (): boolean {
    return this._outlineAttribute.value
  }

  set outline (value: boolean) {
    this._outlineAttribute.apply(value)
  }

  /**
   * Enlarges the gizmo to indicate focus.
   */
  get focused (): boolean {
    return this._focusedAttribute.value
  }

  set focused (value: boolean) {
    this._focusedAttribute.apply(value)
    this._viewer.renderer.needsUpdate = true
  }

  /**
   * Determines if the gizmo will be rendered.
   */
  get visible (): boolean {
    return this._visibleAttribute.value
  }

  set visible (value: boolean) {
    this._visibleAttribute.apply(value)
    this._viewer.renderer.needsUpdate = true
  }

  get color (): THREE.Color {
    return this._colorAttribute.value
  }

  set color (color: THREE.Color) {
    if (color) {
      this._coloredAttribute.apply(true)
      this._colorAttribute.apply(color)
    } else {
      this._coloredAttribute.apply(false)
    }
    this._viewer.renderer.needsUpdate = true
  }

  get size () {
    const matrix = new THREE.Matrix4()
    this._submesh.mesh.getMatrixAt(this._submesh.index, matrix)
    return matrix.elements[0]
  }

  set size (value: number) {
    const matrix = new THREE.Matrix4()
    this._submesh.mesh.getMatrixAt(this._submesh.index, matrix)
    matrix.elements[0] = value
    matrix.elements[5] = value
    matrix.elements[10] = value
    this._submesh.mesh.setMatrixAt(this._submesh.index, matrix)
    this._submesh.mesh.instanceMatrix.needsUpdate = true
    this._viewer.renderer.needsUpdate = true
  }

  /**
   * Retrieves the bounding box of the object from cache or computes it if needed.
   * Returns a unit box arount the marker position.
   * @returns {THREE.Box3 | undefined} The bounding box of the object.
   */
  getBoundingBox (): THREE.Box3 {
    return new THREE.Box3().setFromCenterAndSize(this.position.clone(), new THREE.Vector3(1, 1, 1))
  }
}
