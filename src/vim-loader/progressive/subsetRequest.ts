/**
 * @module vim-loader
 */

import { InsertableMesh } from './insertableMesh'
import { InstancedMeshFactory } from './instancedMeshFactory'
import { Vimx, Scene } from '../..'

import { G3dMesh } from 'vim-format'
import { G3dSubset } from './g3dSubset'
import { InstancedMesh } from './instancedMesh'
import { LoadingSynchronizer } from './loadingSynchronizer'

export type LoadSettings = {
  /** Delay in ms between each rendering list update. @default: 400ms */
  updateDelayMs: number
  /** If true, will wait for geometry to be ready before it is added to the renderer. @default: false */
  delayRender: boolean
}

export type LoadPartialSettings = Partial<LoadSettings>
function getFullSettings (option: LoadPartialSettings) {
  return {
    updateDelayMs: option?.updateDelayMs ?? 400,
    delayRender: option?.delayRender ?? false
  } as LoadSettings
}

/**
 * Manages geometry downloads and loads it into a scene for rendering.
 */
export class SubsetRequest {
  private _subset: G3dSubset

  private _uniques: G3dSubset
  private _nonUniques: G3dSubset
  private _opaqueMesh: InsertableMesh
  private _transparentMesh: InsertableMesh

  private _synchronizer: LoadingSynchronizer
  private _meshFactory: InstancedMeshFactory
  private _meshes = new Array<InstancedMesh>()
  private _pushedMesh = 0

  private _disposed: boolean = false
  private _started: boolean = false

  private _scene: Scene

  getBoundingBox () {
    return this._subset.getBoundingBox()
  }

  constructor (scene: Scene, localVimx: Vimx, subset: G3dSubset) {
    this._subset = subset
    this._scene = scene

    this._uniques = this._subset.filterUniqueMeshes()
    this._nonUniques = this._subset.filterNonUniqueMeshes()

    const opaqueOffsets = this._uniques.getOffsets('opaque')
    this._opaqueMesh = new InsertableMesh(
      opaqueOffsets,
      localVimx.materials,
      false
    )
    this._opaqueMesh.mesh.name = 'Opaque_Merged_Mesh'

    const transparentOffsets = this._uniques.getOffsets('transparent')
    this._transparentMesh = new InsertableMesh(
      transparentOffsets,
      localVimx.materials,
      true
    )
    this._transparentMesh.mesh.name = 'Transparent_Merged_Mesh'

    this._scene.addMesh(this._transparentMesh)
    this._scene.addMesh(this._opaqueMesh)

    this._meshFactory = new InstancedMeshFactory(localVimx.materials)

    this._synchronizer = new LoadingSynchronizer(
      this._uniques,
      this._nonUniques,
      (mesh) => localVimx.getMesh(mesh),
      (mesh, index) => this.mergeMesh(mesh, index),
      (mesh, index) =>
        this.instanceMesh(mesh, this._nonUniques.getMeshInstances(index))
    )

    return this
  }

  dispose () {
    if (!this._disposed) {
      this._disposed = true
      this._synchronizer.abort()
    }
  }

  async start (settings: LoadPartialSettings) {
    if (this._started) {
      return
    }
    this._started = true
    const fullSettings = getFullSettings(settings)

    // Loading and updates are independants
    this._synchronizer.loadAll()

    // Loop until done or disposed.
    let lastUpdate = Date.now()
    while (true) {
      await this.nextFrame()
      if (this._disposed) {
        return
      }
      if (this._synchronizer.isDone) {
        this.updateMeshes()
        return
      }
      if (
        !fullSettings.delayRender &&
        Date.now() - lastUpdate > fullSettings.updateDelayMs
      ) {
        this.updateMeshes()
        lastUpdate = Date.now()
      }
    }
  }

  private async nextFrame () {
    return new Promise((resolve) => setTimeout(resolve, 0))
  }

  private mergeMesh (g3dMesh: G3dMesh, index: number) {
    this._transparentMesh.insert(g3dMesh, index)
    this._opaqueMesh.insert(g3dMesh, index)
  }

  private instanceMesh (g3dMesh: G3dMesh, instances: number[]) {
    const opaque = this._meshFactory.createOpaque(g3dMesh, instances)
    const transparent = this._meshFactory.createTransparent(g3dMesh, instances)

    if (opaque) {
      this._meshes.push(opaque)
    }
    if (transparent) {
      this._meshes.push(transparent)
    }
  }

  private updateMeshes () {
    // Update Instanced meshes
    while (this._pushedMesh < this._meshes.length) {
      const mesh = this._meshes[this._pushedMesh++]
      this._scene.addMesh(mesh)
    }

    // Update Merged meshes
    this._transparentMesh.update()
    this._opaqueMesh.update()
    this._scene.setDirty()
  }
}
