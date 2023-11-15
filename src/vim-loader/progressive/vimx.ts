// loader
import { getFullSettings, VimSettings } from '../vimSettings'
import { Vim } from '../vim'
import { Scene } from '../../vim'
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
import { SignalDispatcher } from 'ste-signals'

export class VimX {
  settings: VimSettings
  bim: VimDocument | undefined
  scene: Scene
  vim: Vim

  renderer: IRenderer
  private _localVimx: LocalVimx
  private _instances = new Set<number>()

  private _activeRequests = new SignalSet<SubsetRequest>()
  get onLoadingUpdate () {
    return this._activeRequests.onUpdate
  }

  get isLoading () {
    return this._activeRequests.size > 0
  }

  constructor (
    settings: VimSettings,
    localVimx: LocalVimx,
    bim: VimDocument | undefined,
    scene: Scene,
    mapping: ElementMapping2 | ElementNoMapping
  ) {
    this.scene = scene
    this.settings = settings
    this.bim = bim
    this._localVimx = localVimx

    this.vim = new Vim(
      localVimx.header,
      bim,
      undefined,
      scene,
      settings,
      mapping
    )
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

    const vimx = new VimX(settings, localVimx, undefined, scene, mapping)
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
    const factory = new LegacyMeshFactory(g3d, materials, settings)
    const scene = factory.createScene()

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

    return vim
  }

  clear () {
    this._localVimx.abort()
    this.vim.clearObjectCache()
    this.renderer?.remove(this.scene)
    this.scene.dispose()
    this._activeRequests.forEach((s) => s.dispose())
    this._activeRequests.clear()

    // Create a new scene
    this.scene = new Scene(undefined, this.settings.matrix)
    this.scene.vim = this.vim
    this.vim.scene = this.scene
    this.renderer?.add(this.scene)
    this._instances.clear()
  }

  getSubset () {
    return new G3dSubset(this._localVimx.scene)
  }

  async loadAll (settings?: LoadPartialSettings) {
    return this.loadSubset(this.getSubset(), settings)
  }

  async loadSubset (subset: G3dSubset, settings?: LoadPartialSettings) {
    subset = subset.except('instance', this._instances)
    const count = subset.getInstanceCount()
    for (let i = 0; i < count; i++) {
      this._instances.add(subset.getVimInstance(i))
    }

    // Add box to rendering.
    const box = subset.getBoundingBox()
    this.scene.updateBox(box)

    if (subset.getInstanceCount() === 0) {
      console.log('Empty subset. Ignoring')
      return
    }
    // Launch loading
    const request = new SubsetRequest(this.scene, this._localVimx, subset)
    this._activeRequests.add(request)
    await request.start(settings)
    this._activeRequests.delete(request)
  }

  async loadFilter (
    filterMode: FilterMode,
    filter: number[],
    settings?: LoadPartialSettings
  ) {
    const subset = this.getSubset().filter(filterMode, filter)
    await this.loadSubset(subset, settings)
  }

  abort () {
    // TODO
  }

  dispose () {
    this._localVimx.abort()
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

export interface IRenderer {
  add(scene: Scene | THREE.Object3D)
  remove(scene: Scene)
  updateBox(box: THREE.Box3)
  notifySceneUpdate()
}

class SignalSet<T> {
  private _set = new Set<T>()
  private _signal = new SignalDispatcher()

  get onUpdate () {
    return this._signal.asEvent()
  }

  get size () {
    return this._set.size
  }

  add (value: T) {
    this._set.add(value)
    this._signal.dispatch()
  }

  delete (value: T) {
    this._set.delete(value)
    this._signal.dispatch()
  }

  clear () {
    this._set.clear()
    this._signal.dispatch()
  }

  forEach (action: (value: T) => void) {
    this._set.forEach(action)
  }
}
