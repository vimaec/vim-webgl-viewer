// loader
import { VimSettings } from '../vimSettings'
import { Vim } from '../vim'
import { InsertableMesh } from './insertableMesh'
import { InstancedMeshFactory } from './instancedMeshFactory'
import { Scene } from '../../vim'

import { G3dScene, G3dMaterial, RemoteVimx, G3dMesh } from 'vim-format'
import { G3dSubset } from './g3dSubset'
import { SignalDispatcher } from 'ste-signals'
import { InstancedMesh } from './instancedMesh'
import { LoadingSynchronizer } from './loadingSynchronizer'

/**
 * Manages geometry downloads and loads it into a scene for rendering.
 */
export class SceneManager {
  private settings: VimSettings

  subset: G3dSubset

  private _uniques: G3dSubset
  private _nonUniques: G3dSubset
  private _opaqueMesh: InsertableMesh
  private _transparentMesh: InsertableMesh

  private _synchronizer: LoadingSynchronizer
  private _meshFactory: InstancedMeshFactory
  private _meshQueue = new Array<InstancedMesh>()

  private _disposed: boolean = false
  private _started: boolean = false

  scene: Scene

  getBoundingBox () {
    const box = this.subset.getBoundingBox()
    box.applyMatrix4(this.settings.matrix)
    return box
  }

  /**
   * Vim associated with this scene
   */
  get vim () {
    return this.scene.vim
  }

  set vim (value: Vim) {
    this.scene.vim = value
  }

  private _onUpdate = new SignalDispatcher()
  /**
   * Event sent whenever new
   */
  get onUpdate () {
    return this._onUpdate.asEvent()
  }

  private _onCompleted = new SignalDispatcher()
  get onCompleted () {
    return this._onCompleted.asEvent()
  }

  static async create (
    vimx: RemoteVimx,
    index: G3dScene,
    materials: G3dMaterial,
    settings: VimSettings
  ) {
    const self = new SceneManager()
    self.settings = settings

    self.subset = new G3dSubset(index, undefined).filter(
      settings.filterMode,
      settings.filter
    )
    self._uniques = self.subset.filterUniqueMeshes()
    self._nonUniques = self.subset.filterNonUniqueMeshes()

    const opaqueOffsets = self._uniques.getOffsets('opaque')
    self._opaqueMesh = new InsertableMesh(opaqueOffsets, materials, false)

    const transparentOffsets = self._uniques.getOffsets('transparent')
    self._transparentMesh = new InsertableMesh(
      transparentOffsets,
      materials,
      true
    )

    self.scene = new Scene(undefined)
    self.scene.addMesh(self._transparentMesh)
    self.scene.addMesh(self._opaqueMesh)

    self._meshFactory = new InstancedMeshFactory(settings, materials)

    self._synchronizer = new LoadingSynchronizer(
      self._uniques,
      self._nonUniques,
      vimx,
      (mesh, index) => self.mergeMesh(mesh, index),
      (mesh, index) =>
        self.instanceMesh(mesh, self._nonUniques.getMeshInstances(index))
    )

    return self
  }

  dispose () {
    if (!this._disposed) {
      this._disposed = true
      this._synchronizer.abort()
      this._onUpdate.clear()
      this._onCompleted.clear()
      this.scene.dispose()
    }
  }

  async start () {
    if (this._started) {
      return
    }
    this._started = true

    // Loading and updates are independants
    this._synchronizer.loadAll()

    // Loop until done or disposed.
    while (!this._synchronizer.isDone) {
      await this.wait(this.settings.refreshInterval)
      if (this._disposed) {
        return
      }
      this.updateMeshes()
    }

    // Completed
    this.updateMeshes()
    this._onCompleted.dispatch()
    console.log(this)
  }

  private async wait (delay: number = 0) {
    return new Promise((resolve) => setTimeout(resolve, delay))
  }

  private mergeMesh (g3dMesh: G3dMesh, index: number) {
    this._transparentMesh.insert(g3dMesh, index)
    this._opaqueMesh.insert(g3dMesh, index)
  }

  private instanceMesh (g3dMesh: G3dMesh, instances: number[]) {
    const opaque = this._meshFactory.createOpaque(g3dMesh, instances)
    const transparent = this._meshFactory.createTransparent(g3dMesh, instances)

    if (opaque) {
      this._meshQueue.push(opaque)
    }
    if (transparent) {
      this._meshQueue.push(transparent)
    }
  }

  private updateMeshes () {
    console.log('updateMeshes')
    // Update Instanced meshes
    while (this._meshQueue.length > 0) {
      const mesh = this._meshQueue.pop()
      this.scene.addMesh(mesh)
    }

    // Update Merged meshes
    this._transparentMesh.update()
    this._opaqueMesh.update()

    // Notify observer
    this._onUpdate.dispatch()
  }
}