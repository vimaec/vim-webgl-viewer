// loader
import { getFullSettings, VimSettings } from '../vim-loader/vimSettings'
import { Vim } from '../vim-loader/vim'
import { InsertableMesh } from '../vim-loader/progressive/insertableMesh'
import { InstancedMeshFactory } from '../vim-loader/progressive/instancedMeshFactory'
import { Scene } from '../vim'

import { ElementMapping2, ElementNoMapping } from '../vim-loader/elementMapping'
import { Renderer } from './rendering/renderer'
import {
  BFast,
  RemoteBuffer,
  G3dMeshIndex,
  VimDocument,
  G3dMeshIndexSubset,
  G3dMaterial,
  RemoteGeometry,
  G3dMesh
} from 'vim-format'
import { SignalDispatcher } from 'ste-signals'
import { InstancedMesh } from '../vim-loader/progressive/instancedMesh'

type ProgressiveScene = {
  scene: Scene
  uniques: G3dMeshIndexSubset
  nonUniques: G3dMeshIndexSubset
  opaqueMesh: InsertableMesh
  transparentMesh: InsertableMesh
}

export class ProgressiveVim {
  settings: VimSettings
  geometry: RemoteGeometry
  materials: G3dMaterial
  bim: VimDocument | undefined
  scene: Scene
  mapping: ElementMapping2 | ElementNoMapping

  renderer: Renderer
  meshFactory: InstancedMeshFactory
  meshQueue = new Array<InstancedMesh>()

  // TODO: Put these two meshes into a Scene class
  uniques: G3dMeshIndexSubset
  nonUniques: G3dMeshIndexSubset
  opaqueMesh: InsertableMesh
  transparentMesh: InsertableMesh
  synchronizer: LoadingSynchronizer

  // Vim instance here is only for transition.
  vim: Vim

  private _onUpdate = new SignalDispatcher()
  get onUpdate () {
    return this._onUpdate.asEvent()
  }

  private _onCompleted = new SignalDispatcher()
  get onCompleted () {
    return this._onCompleted.asEvent()
  }

  constructor (
    settings: VimSettings,
    geometry: RemoteGeometry,
    materials: G3dMaterial,
    bim: VimDocument | undefined,
    scene: ProgressiveScene,
    mapping: ElementMapping2 | ElementNoMapping
  ) {
    this.settings = getFullSettings(settings)
    this.geometry = geometry
    this.bim = bim
    this.materials = materials

    this.scene = scene.scene
    this.uniques = scene.uniques
    this.nonUniques = scene.nonUniques
    this.opaqueMesh = scene.opaqueMesh
    this.transparentMesh = scene.transparentMesh

    this.mapping = mapping

    this.vim = new Vim(
      undefined,
      bim,
      undefined,
      scene.scene,
      settings,
      mapping
    )

    this.meshFactory = new InstancedMeshFactory(this.vim, materials)

    this.opaqueMesh.vim = this.vim
    this.transparentMesh.vim = this.vim

    this.synchronizer = new LoadingSynchronizer(
      this.uniques,
      this.nonUniques,
      this.geometry,
      (mesh, index) => this.merge(mesh, index),
      (mesh, index) =>
        this.instance(mesh, this.nonUniques.getMeshInstances(index))
    )
  }

  static async fromPath (
    g3dPath: string,
    bimPath: string,
    settings: VimSettings
  ) {
    let time = Date.now()
    const bim = await ProgressiveVim.createBim(bimPath, settings)
    const geometry = await RemoteGeometry.fromPath(g3dPath)
    const index = await geometry.getIndex()
    const materials = await geometry.getMaterials()
    console.log(`Other downloads: ${(Date.now() - time) / 1000} seconds`)

    time = Date.now()
    const scene = await ProgressiveVim.createScene(index, materials, settings)
    console.log(`createScene: ${(Date.now() - time) / 1000} seconds`)

    const mapping = settings.noMap
      ? new ElementNoMapping()
      : new ElementMapping2(index)

    time = Date.now()
    console.log(`Main download: ${(Date.now() - time) / 1000} seconds`)

    return new ProgressiveVim(
      settings,
      geometry,
      materials,
      bim,
      scene,
      mapping
    )
  }

  private static async createBim (path: string, settings: VimSettings) {
    const buffer = new RemoteBuffer(path, settings.loghttp)
    const bfast = new BFast(buffer)
    return VimDocument.createFromBfast(bfast, settings.noStrings)
  }

  private static async createScene (
    index: G3dMeshIndex,
    materials: G3dMaterial,
    settings: VimSettings
  ) {
    console.log('createScene')
    const subset = index.filter(settings.filterMode, settings.filter)
    console.log('createScene done')
    const uniques = subset.filterUniqueMeshes()
    const nonUniques = subset.filterNonUniqueMeshes()

    const opaqueOffsets = uniques.getOffsets('opaque')
    const opaqueMesh = new InsertableMesh(opaqueOffsets, materials, false)
    opaqueMesh.applySettings(settings)

    const transparentOffsets = uniques.getOffsets('transparent')
    const transparentMesh = new InsertableMesh(
      transparentOffsets,
      materials,
      true
    )
    transparentMesh.applySettings(settings)

    const scene = new Scene(undefined)
    scene.addMesh(transparentMesh)
    scene.addMesh(opaqueMesh)
    return {
      scene,
      uniques,
      nonUniques,
      opaqueMesh,
      transparentMesh
    } as ProgressiveScene
  }

  // TODO Remove this ?
  addToRenderer (renderer: Renderer) {
    renderer.add(this.scene)
    this.renderer = renderer
  }

  async start () {
    this.synchronizer.loadAll(this.settings.batchSize)

    while (!this.synchronizer.isDone) {
      await this.wait(this.settings.refreshInterval)
      this.updateMeshes()
    }
    this.updateMeshes()
    this._onCompleted.dispatch()
  }

  abort () {
    // TODO
  }

  remove () {
    this.renderer.remove(this.scene)
    this._onUpdate.clear()
    this._onCompleted.clear()
  }

  private async wait (delay: number = 0) {
    return new Promise((resolve) => setTimeout(resolve, delay))
  }

  private async merge (g3dMesh: G3dMesh, index: number) {
    this.transparentMesh.insert(g3dMesh, index)
    this.opaqueMesh.insert(g3dMesh, index)
  }

  private async instance (g3dMesh: G3dMesh, instances: number[]) {
    const opaque = this.meshFactory.createOpaque(g3dMesh, instances)
    const transparent = this.meshFactory.createTransparent(g3dMesh, instances)

    if (opaque) {
      this.meshQueue.push(opaque)
    }
    if (transparent) {
      this.meshQueue.push(transparent)
    }
  }

  private async updateMeshes () {
    // Update Instanced meshes
    while (this.meshQueue.length > 0) {
      const mesh = this.meshQueue.pop()
      this.scene.addMesh(mesh)
      this.renderer.add(mesh.mesh)
    }

    // Update Merged meshes
    this.transparentMesh.update()
    this.opaqueMesh.update()

    // Notify Update
    if (this.renderer) {
      this.renderer.needsUpdate = true
    }
    this._onUpdate.dispatch()
  }
}

class LoadingSynchronizer {
  private _merged: LoadingBatcher
  private _instanced: LoadingBatcher
  get isDone () {
    return this._merged.isDone && this._instanced.isDone
  }

  constructor (
    uniques: G3dMeshIndexSubset,
    nonUniques: G3dMeshIndexSubset,
    geometry: RemoteGeometry,
    mergeAction: (mesh: G3dMesh, index: number) => void,
    instanceAction: (mesh: G3dMesh, index: number) => void
  ) {
    this._merged = new LoadingBatcher(uniques, geometry, mergeAction)
    this._instanced = new LoadingBatcher(nonUniques, geometry, instanceAction)
  }

  async loadAll (batchSize: number) {
    while (!this._merged.isDone || !this._instanced.isDone) {
      await this.load(batchSize)
    }
  }

  async load (batchSize: number) {
    await Promise.all([
      this._merged.load(batchSize),
      this._instanced.load(batchSize)
    ])
  }
}

class LoadingBatcher {
  private _subset: G3dMeshIndexSubset
  private _geometry: RemoteGeometry
  private _onLoad: (mesh: G3dMesh, index: number) => void

  private _index: number = 0
  private _maxMesh: number = 0

  constructor (
    subset: G3dMeshIndexSubset,
    geometry: RemoteGeometry,
    onLoad: (mesh: G3dMesh, index: number) => void
  ) {
    this._subset = subset
    this._geometry = geometry
    this._onLoad = onLoad
  }

  get isDone () {
    return this._index >= this._subset.meshes.length
  }

  async load (batch: number) {
    if (this.isDone) {
      return Promise.resolve()
    }

    const promises = new Array<Promise<void>>()
    this._maxMesh += batch
    for (; this._index < this._subset.meshes.length; this._index++) {
      const mesh = this._subset.getMesh(this._index)
      if (mesh >= this._maxMesh) break
      promises.push(this.fetch(mesh, this._index))
    }
    return Promise.all(promises)
  }

  private async fetch (mesh: number, index: number) {
    if (this._onLoad) {
      const g3dMesh = await this._geometry.getMesh(mesh)
      this._onLoad(g3dMesh, index)
    }
  }
}
