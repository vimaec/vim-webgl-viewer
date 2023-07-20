// loader
import { getFullSettings, VimSettings } from '../vim-loader/vimSettings'
import { Vim } from '../vim-loader/vim'
import { InsertableMesh, Scene } from '../vim'

import { ElementMapping2, ElementNoMapping } from '../vim-loader/elementMapping'
import { Renderer } from './rendering/renderer'
import {
  BFast,
  RemoteBuffer,
  Requester,
  G3dMeshIndex,
  G3dMesh,
  VimDocument,
  G3dMeshIndexSubset,
  G3dMaterial
} from 'vim-format'
import { SimpleEventDispatcher } from 'ste-simple-events'
import { ISignalHandler, SignalDispatcher } from 'ste-signals'

type ProgressiveScene = {
  scene: Scene
  subset: G3dMeshIndexSubset
  opaqueMesh: InsertableMesh
  transparentMesh: InsertableMesh
}

export class ProgressiveVim {
  settings: VimSettings
  g3dPath: string
  bim: VimDocument | undefined
  scene: Scene
  mapping: ElementMapping2 | ElementNoMapping

  renderer: Renderer

  // TODO: Put these two meshes into a Scene class
  subset: G3dMeshIndexSubset
  opaqueMesh: InsertableMesh
  transparentMesh: InsertableMesh

  // Vim instance here is only for transition.
  vim: Vim

  requester: MeshRequester

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
    g3dPath: string,
    bim: VimDocument | undefined,
    scene: ProgressiveScene,
    mapping: ElementMapping2 | ElementNoMapping
  ) {
    this.settings = getFullSettings(settings)
    this.g3dPath = g3dPath
    this.bim = bim

    this.scene = scene.scene
    this.subset = scene.subset
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

    this.opaqueMesh.vim = this.vim
    this.transparentMesh.vim = this.vim

    this.requester = new MeshRequester(
      g3dPath,
      settings.gzipped,
      settings.loghttp
    )
  }

  static async fromPath (
    g3dPath: string,
    bimPath: string,
    settings: VimSettings
  ) {
    const extension = settings.gzipped ? 'gz' : 'g3d'
    const bim = await ProgressiveVim.createBim(bimPath, settings)
    const index = await G3dMeshIndex.createFromPath(
      `${g3dPath}_index.${extension}`
    )
    const materials = await G3dMaterial.createFromPath(
      `${g3dPath}_materials.${extension}`
    )

    const scene = await ProgressiveVim.createScene(index, materials, settings)

    const mapping = settings.noMap
      ? new ElementNoMapping()
      : new ElementMapping2(index)

    return new ProgressiveVim(settings, g3dPath, bim, scene, mapping)
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
    const subset = index.filter(settings.filterMode, settings.filter)

    const opaqueOffsets = subset.getOffsets('opaque', true)
    const opaqueMesh = new InsertableMesh(opaqueOffsets, materials, false)
    opaqueMesh.applySettings(settings)

    const transparentOffsets = subset.getOffsets('transparent', true)
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
      subset,
      scene,
      opaqueMesh,
      transparentMesh
    } as ProgressiveScene
  }

  // TODO Remove this ?
  addToRenderer (renderer: Renderer) {
    renderer.add(this.scene)
    this.renderer = renderer
  }

  async build (refreshRate: number = 1000) {
    let done = false
    this.loadAllMeshes().finally(() => (done = true))

    while (!done) {
      await this.wait(refreshRate)
      this.updateMeshes()
    }
    this.updateMeshes()
    this._onCompleted.dispatch()
  }

  abort () {
    this.requester.abort()
  }

  remove () {
    this.renderer.remove(this.scene)
    this._onUpdate.clear()
    this._onCompleted.clear()
  }

  private async wait (delay: number) {
    return new Promise((resolve) => setTimeout(resolve, delay))
  }

  private async loadAllMeshes () {
    return Promise.all(this.subset.meshes.map((m, i) => this.addMesh(m, i)))
  }

  private async addMesh (mesh: number, index: number) {
    const g3dMesh = await this.requester.download(mesh)
    this.transparentMesh.insertAllMesh(g3dMesh, index)
    this.opaqueMesh.insertAllMesh(g3dMesh, index)
  }

  private async updateMeshes () {
    this.transparentMesh.update()
    this.opaqueMesh.update()
    if (this.renderer) {
      this.renderer.needsUpdate = true
    }
    this._onUpdate.dispatch()
  }
}

class MeshRequester {
  private requester: Requester

  path: string
  extension: string
  indexPath: string

  constructor (path: string, gzipped: boolean, verbose: boolean) {
    this.path = path
    this.extension = gzipped ? 'gz' : 'g3d'
    this.requester = new Requester(verbose)
    this.indexPath = `${path}_index.${this.extension}`
  }

  getMeshPath (mesh: number) {
    return `${this.path}_mesh_${mesh}.${this.extension}`
  }

  async download (mesh: number) {
    const url = this.getMeshPath(mesh)
    const buffer = await this.requester.http(url)
    return await G3dMesh.createFromBuffer(buffer)
  }

  abort () {
    this.requester.abort()
  }
}
