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
import { LoadPartialSettings, DynamicScene, LoadSettings } from './dynamicScene'
import { G3dSubset } from './g3dSubset'
import { Console } from 'console'

export class VimX {
  settings: VimSettings
  bim: VimDocument | undefined
  mapping: ElementMapping2 | ElementNoMapping

  scene: Scene
  localVimx: LocalVimx
  scenes = new Array<DynamicScene>()
  renderer: IRenderer
  // Vim instance here is only for transition.
  vim: Vim

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
    this.localVimx = localVimx
    this.mapping = mapping

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
    const scene = new Scene(undefined, settings.matrix)
    const mapping = new ElementMapping2(localVimx.scene)

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

  clear () {
    this.localVimx.abort()
    this.vim.clearObjectCache()
    this.renderer?.remove(this.scene)
    this.scene.dispose()
    this.scenes.forEach((s) => s.dispose())
    this.scenes.length = 0

    // Create a new scene
    this.scene = new Scene(undefined, this.settings.matrix)
    this.scene.vim = this.vim
    this.vim.scene = this.scene
    this.renderer?.add(this.scene)
  }

  getSubset () {
    return new G3dSubset(this.localVimx.scene)
  }

  async loadAll (settings?: LoadPartialSettings) {
    return this.loadFilter(undefined, undefined, settings)
  }

  async loadSubset (subset: G3dSubset, settings?: LoadPartialSettings) {
    // Add box to rendering.
    const box = subset.getBoundingBox()
    this.scene.updateBox(box)

    // Launch loading
    const dynamicScene = new DynamicScene(this.scene, this.localVimx, subset)
    this.scenes.push(dynamicScene)
    await dynamicScene.start(settings)
  }

  async loadFilter (
    filterMode: FilterMode,
    filter: number[],
    settings?: LoadPartialSettings
  ) {
    const subset = this.localVimx.getSubset(filterMode, filter)
    await this.loadSubset(subset, settings)
  }

  abort () {
    // TODO
  }

  dispose () {
    this.localVimx.abort()
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
  add(scene: Scene | THREE.Object3D)
  remove(scene: Scene)
  updateBox(box: THREE.Box3)
  notifySceneUpdate()
}
