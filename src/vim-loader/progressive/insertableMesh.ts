import * as THREE from 'three'
import { G3d, G3dMesh, G3dMaterial, MeshOffsets } from 'vim-format'
import { Vim, VimMaterials, VimSettings } from '../../vim'
import { SignalDispatcher } from 'ste-signals'
import { InsertableGeometry } from './insertableGeometry'
import { InsertableSubmesh } from './insertableSubmesh'

export class InsertableMesh {
  offsets: MeshOffsets
  mesh: THREE.Mesh
  vim: Vim

  private _onUpdate = new SignalDispatcher()
  get onUpdate () {
    return this._onUpdate.asEvent()
  }

  /**
   * Wether the mesh is merged or not.
   */
  merged: boolean

  /**
   * Wether the mesh is transparent or not.
   */
  transparent: boolean

  /**
   * Total bounding box for this mesh.
   */
  get boundingBox () {
    return this.geometry.boundingBox
  }

  /**
   * Set to true to ignore SetMaterial calls.
   */
  ignoreSceneMaterial: boolean

  /**
   * initial material.
   */
  private _material: THREE.Material | THREE.Material[] | undefined

  geometry: InsertableGeometry

  constructor (
    offsets: MeshOffsets,
    materials: G3dMaterial,
    transparent: boolean
  ) {
    this.offsets = offsets
    this.transparent = transparent
    this.merged = true

    this.geometry = new InsertableGeometry(offsets, materials, transparent)

    this._material = transparent
      ? VimMaterials.getInstance().transparent.material
      : VimMaterials.getInstance().opaque.material

    this.mesh = new THREE.Mesh(this.geometry.geometry, this._material)
    this.mesh.userData.vim = this
  }

  applySettings (settings: VimSettings) {
    this.mesh.matrix.identity()
    this.mesh.applyMatrix4(settings.matrix)
  }

  get progress () {
    return this.geometry.progress
  }

  insert (g3d: G3dMesh, mesh: number) {
    this.geometry.insert(g3d, mesh)
  }

  insertFromVim (g3d: G3d, mesh: number) {
    this.geometry.insertFromVim(g3d, mesh)
  }

  update () {
    this.geometry.update()
    this._onUpdate.dispatch()
  }

  /**
   * Returns submesh corresponding to given face on a merged mesh.
   */
  getSubmeshFromFace (faceIndex: number) {
    // TODO: not iterate through all submeshes
    const hitIndex = faceIndex * 3
    for (const [instance, submesh] of this.geometry.submeshes.entries()) {
      if (hitIndex >= submesh.start && hitIndex < submesh.end) {
        return new InsertableSubmesh(this, instance)
      }
    }
  }

  /**
   *
   * @returns Returns all submeshes
   */
  getSubmeshes () {
    return [...this.geometry.submeshes.keys()].map(
      (i) => new InsertableSubmesh(this, i)
    )
  }

  /**
   *
   * @returns Returns submesh for given index.
   */
  getSubmesh (index: number) {
    return new InsertableSubmesh(this, index)
  }

  /**
   * Overrides mesh material, set to undefine to restore initial material.
   */
  setMaterial (value: THREE.Material) {
    if (this._material === value) return
    if (this.ignoreSceneMaterial) return

    if (value) {
      if (!this._material) {
        this._material = this.mesh.material
      }
      this.mesh.material = value
    } else {
      if (this._material) {
        this.mesh.material = this._material
        this._material = undefined
      }
    }
  }
}
