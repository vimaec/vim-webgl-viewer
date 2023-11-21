// loader
import { getFullSettings, VimSettings } from '../vimSettings'
import { Vim } from '../vim'
import { Scene, VimBuilder } from '../../vim'
import { LegacyMeshFactory } from './legacyMeshFactory'

import {
  ElementMapping,
  ElementMapping2,
  ElementNoMapping
} from '../elementMapping'
import {
  BFast,
  RemoteBuffer,
  VimDocument,
  G3dMaterial,
  RemoteVimx,
  G3d,
  requestHeader,
  VimHeader,
  G3dScene,
  FilterMode,
  IProgressLogs
} from 'vim-format'
import { LoadPartialSettings, SubsetRequest } from './subsetRequest'
import { G3dSubset } from './g3dSubset'
import {
  VimxSubsetBuilder,
  VimSubsetBuilder,
  SubsetBuilder
} from './subsetBuilder'

export interface IRenderer {
  add(scene: Scene | THREE.Object3D)
  remove(scene: Scene)
  updateBox(box: THREE.Box3)
  notifySceneUpdate()
}

export class VimX {
  settings: VimSettings
  vim: Vim
  private _builder: SubsetBuilder
  private _instances = new Set<number>()

  get scene () {
    return this.vim.scene
  }

  /** Dispatched whenever a subset begins or finishes loading. */
  get onLoadingUpdate () {
    return this._builder.onUpdate
  }

  /** True if there are subsets being loaded. */
  get isLoading () {
    return this._builder.isLoading
  }

  constructor (
    settings: VimSettings,
    builder: VimxSubsetBuilder | VimSubsetBuilder,
    vim: Vim
  ) {
    this.settings = settings
    this._builder = builder
    this.vim = vim
  }

  /**
   * Creates a VimX object from given path to a vimx file
   */
  static async fromVimX (
    source: string | ArrayBuffer,
    settings: VimSettings,
    onProgress: (p: IProgressLogs) => void
  ) {
    // Start fetch bim data
    // const bimPromise = vimPath ? VimX.createBim(vimPath, settings) : null

    // Fetch geometry data
    const remoteVimx = new RemoteVimx(source)
    if (remoteVimx.bfast.source instanceof RemoteBuffer) {
      remoteVimx.bfast.source.onProgress = onProgress
    }

    console.log('Downloading Scene Index..')
    const localVimx = await LocalVimx.fromRemote(
      remoteVimx,
      !settings.progressive
    )
    console.log('Scene Index Downloaded.')

    // Create scene
    const scene = new Scene(undefined, settings.matrix)
    const mapping = new ElementMapping2(localVimx.scene)

    // wait for bim data.
    // const bim = bimPromise ? await bimPromise : undefined

    const builder = new VimxSubsetBuilder(localVimx, scene)
    const vim = new Vim(
      localVimx.header,
      undefined,
      undefined,
      scene,
      settings,
      mapping
    )
    const vimx = new VimX(settings, builder, vim)
    vimx.vim.source = typeof source === 'string' ? source : undefined

    if (remoteVimx.bfast.source instanceof RemoteBuffer) {
      remoteVimx.bfast.source.onProgress = undefined
    }

    return vimx
  }

  /**
   * Fetches bim document from path
   */
  private static async createBim (path: string, settings: VimSettings) {
    const buffer = new RemoteBuffer(path, settings.loghttp)
    const bfast = new BFast(buffer)
    return VimDocument.createFromBfast(bfast, settings.noStrings)
  }

  /**
   * Creates a legacy vim object from given path to a vim file
   */
  static async fromVim (
    source: string | ArrayBuffer,
    settings: VimSettings,
    onProgress?: (p: IProgressLogs) => void
  ) {
    const fullSettings = getFullSettings(settings)
    const bfast = new BFast(source)
    if (bfast.source instanceof RemoteBuffer) {
      bfast.source.onProgress = onProgress
    }

    // Fetch g3d data
    const geometry = await bfast.getBfast('geometry')
    const g3d = await G3d.createFromBfast(geometry)
    const materials = new G3dMaterial(g3d.materialColors)

    // Create scene
    const scene = new Scene(undefined, settings.matrix)
    const factory = new LegacyMeshFactory(g3d, materials, scene)

    // Create legacy mapping
    const doc = await VimDocument.createFromBfast(bfast, true)
    const mapping = await ElementMapping.fromG3d(g3d, doc)
    const header = await requestHeader(bfast)

    // Return legacy vim
    const vim = new Vim(header, doc, g3d, scene, fullSettings, mapping)
    vim.source = typeof source === 'string' ? source : undefined

    if (bfast.source instanceof RemoteBuffer) {
      bfast.source.onProgress = undefined
    }

    const builder = new VimSubsetBuilder(factory)
    const vimx = new VimX(settings, builder, vim)
    return vimx
  }

  /**
   * Unloads all loaded geometry from renderer.
   * New subsets can be loaded.
   */
  clear () {
    this._builder.clear()
    this._instances.clear()
    this.vim.clear()
  }

  getFullSet () {
    return this._builder.getSubset()
  }

  async loadAll (settings?: LoadPartialSettings) {
    return this.loadSubset(this.getFullSet(), settings)
  }

  async loadSubset (subset: G3dSubset, settings?: LoadPartialSettings) {
    subset = subset.except('instance', this._instances)
    const count = subset.getInstanceCount()
    for (let i = 0; i < count; i++) {
      this._instances.add(subset.getVimInstance(i))
    }

    // Add box to rendering.
    const box = subset.getBoundingBox()
    this.vim.scene.updateBox(box)

    if (subset.getInstanceCount() === 0) {
      console.log('Empty subset. Ignoring')
      return
    }
    // Launch loading
    await this._builder.loadSubset(subset)
  }

  async loadFilter (
    filterMode: FilterMode,
    filter: number[],
    settings?: LoadPartialSettings
  ) {
    const subset = this.getFullSet().filter(filterMode, filter)
    await this.loadSubset(subset, settings)
  }

  dispose () {
    this.vim.dispose()
    this._builder.clear()
  }
}

export class LocalVimx {
  private readonly vimx: RemoteVimx
  readonly scene: G3dScene
  readonly materials: G3dMaterial
  readonly header: VimHeader

  static async fromRemote (vimx: RemoteVimx, downloadMeshes: boolean) {
    if (downloadMeshes) {
      await vimx.bfast.forceDownload()
    }
    const [header, scene, materials] = await Promise.all([
      await vimx.getHeader(),
      await vimx.getScene(),
      await vimx.getMaterials()
    ])

    return new LocalVimx(vimx, header, scene, materials)
  }

  private constructor (
    vimx: RemoteVimx,
    header: VimHeader,
    scene: G3dScene,
    material: G3dMaterial
  ) {
    this.vimx = vimx
    this.header = header
    this.scene = scene
    this.materials = material
  }

  getMesh (mesh: number) {
    return this.vimx.getMesh(mesh)
  }

  abort () {
    this.vimx.abort()
  }
}
