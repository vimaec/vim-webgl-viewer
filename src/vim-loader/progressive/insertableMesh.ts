import * as THREE from 'three'
import { G3d, G3dMesh, G3dMaterial } from 'vim-format'
import { Vim, VimMaterials, VimSettings } from '../../vim'
import { SignalDispatcher } from 'ste-signals'
import { InsertableGeometry } from './insertableGeometry'
import { InsertableSubmesh } from './insertableSubmesh'
import { G3dMeshOffsets } from './g3dOffsets'

export class InsertableMesh {
  offsets: G3dMeshOffsets
  mesh: THREE.Mesh
  vim: Vim

  /**
   * Wether the mesh is merged or not.
   */
  get merged () {
    return true
  }

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
    offsets: G3dMeshOffsets,
    materials: G3dMaterial,
    transparent: boolean
  ) {
    this.offsets = offsets
    this.transparent = transparent

    this.geometry = new InsertableGeometry(offsets, materials, transparent)

    this._material = transparent
      ? VimMaterials.getInstance().transparent.material
      : VimMaterials.getInstance().opaque.material

    this.mesh = new THREE.Mesh(this.geometry.geometry, this._material)
    this.mesh.userData.vim = this
    // this.mesh.frustumCulled = false
  }

  get progress () {
    return this.geometry.progress
  }

  insert (g3d: G3dMesh, mesh: number) {
    const added = this.geometry.insert(g3d, mesh)
    if (!this.vim) {
      return
    }

    for (const i of added) {
      this.vim.scene.addSubmesh(new InsertableSubmesh(this, i))
    }
  }

  insertFromVim (g3d: G3d, mesh: number) {
    this.geometry.insertFromG3d(g3d, mesh)
  }

  update () {
    this.geometry.update()
  }

  clearUpdate () {
    this.geometry.flushUpdate()
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
    const submeshes = new Array<InsertableSubmesh>(
      this.geometry.submeshes.length
    )
    for (let i = 0; i < submeshes.length; i++) {
      submeshes[i] = new InsertableSubmesh(this, i)
    }
    return submeshes
  }

  /**
   *
   * @returns Returns submesh for given index.
   */
  getSubmesh (index: number) {
    // if (this.geometry.submeshes.has(index)) {
    return new InsertableSubmesh(this, index)
    // }
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
