// loader
import {
  getFullSettings,
  VimPartialSettings,
  VimSettings
} from '../vimSettings'
import { Vim } from '../vim'
import { Loader, Scene } from '../../vim'
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
  FilterMode
} from 'vim-format'
import { DynamicScene } from './dynamicScene'
import { G3dSubset } from './g3dSubset'

export class VimX {
  settings: VimSettings
  bim: VimDocument | undefined
  scene: DynamicScene
  mapping: ElementMapping2 | ElementNoMapping

  localVimx: LocalVimx
  scenes: DynamicScene[]
  renderer: IRenderer
  // Vim instance here is only for transition.
  vim: Vim

  get onUpdate () {
    return this.scene.onUpdate
  }

  get onCompleted () {
    return this.scene.onCompleted
  }

  constructor (
    settings: VimSettings,
    localVimx: LocalVimx,
    bim: VimDocument | undefined,
    scene: DynamicScene,
    mapping: ElementMapping2 | ElementNoMapping
  ) {
    this.scene = scene
    this.settings = getFullSettings(settings)
    this.bim = bim
    this.localVimx = localVimx
    this.mapping = mapping

    this.vim = new Vim(
      localVimx.header,
      bim,
      undefined,
      this.scene.scene,
      settings,
      mapping
    )
  }

  /**
   * Loads given vim or vimx file using progressive pipeline unless the legacy flag is true.
   */
  static async load (
    source: string | ArrayBuffer,
    settings: VimPartialSettings
  ) {
    const fullSettings = getFullSettings(settings)
    const type = this.determineFileType(source, fullSettings)

    if (fullSettings.legacy) {
      if (type === 'vimx') {
        throw new Error('Cannot open a vimx using legacy pipeline.')
      }

      return new Loader().load(source, fullSettings)
    }

    if (type === 'vim') {
      return VimX.fromVim(source, fullSettings)
    }

    if (type === 'vimx') {
      return VimX.fromVimX(source, fullSettings)
    }
  }

  static determineFileType (
    vimPath: string | ArrayBuffer,
    settings: VimSettings
  ) {
    if (settings.fileType === 'vim') return 'vim'
    if (settings.fileType === 'vimx') return 'vimx'
    if (vimPath instanceof ArrayBuffer) {
      throw new Error(
        'Cannot infer file type for ArrayBuffer. Please specify file type in options.'
      )
    }
    if (vimPath.endsWith('vim')) return 'vim'
    if (vimPath.endsWith('vimx')) return 'vimx'

    throw new Error(
      'Could not infer file type from extension. Please specify file type in options.'
    )
  }

  /**
   * Creates a VimX object from given path to a vimx file
   */
  static async fromVimX (source: string | ArrayBuffer, settings: VimSettings) {
    // Start fetch bim data
    // const bimPromise = vimPath ? VimX.createBim(vimPath, settings) : null

    // Fetch geometry data
    const remoteVimx =
      source instanceof ArrayBuffer
        ? new RemoteVimx(new BFast(source))
        : RemoteVimx.fromPath(source)

    console.log('Downloading Scene Index..')
    const localVimx = await LocalVimx.fromRemote(
      remoteVimx,
      !settings.progressive
    )
    console.log('Scene Index Downloaded.')

    // Create scene
    const subset = localVimx.getSubset(settings.filterMode, settings.filter)
    const scene = new DynamicScene(localVimx, subset)

    const mapping = settings.noMap
      ? new ElementNoMapping()
      : new ElementMapping2(localVimx.scene)

    // wait for bim data.
    // const bim = bimPromise ? await bimPromise : undefined

    const vimx = new VimX(settings, localVimx, undefined, scene, mapping)
    vimx.vim.source = typeof source === 'string' ? source : undefined

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
  static async fromVim (source: string | ArrayBuffer, settings: VimSettings) {
    const fullSettings = getFullSettings(settings)
    const buffer =
      source instanceof ArrayBuffer ? source : new RemoteBuffer(source)
    const bfast = new BFast(buffer)

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
    return vim
  }

  async add (filterMode: FilterMode, filter: number[]) {
    const subset = this.localVimx.getSubset(filterMode, filter)
    const scene = new DynamicScene(this.localVimx, subset)
    scene.scene.applyMatrix4(this.settings.matrix)
    this.renderer.add(scene.scene)
    await scene.start(this.settings.refreshInterval)
  }

  start (refreshInterval: number) {
    this.scene.start(refreshInterval)
  }

  abort () {
    // TODO
  }

  dispose () {
    this.localVimx.abort()
    this.scene.dispose()
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

  getSubset (mode: FilterMode, filter: number[]) {
    return new G3dSubset(this.scene).filter(mode, filter)
  }

  abort () {
    this.vimx.abort()
  }
}

export interface IRenderer {
  add(scene: Scene)
  remove(scene: Scene)
}
