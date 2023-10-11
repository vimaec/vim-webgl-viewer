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
  G3d
} from 'vim-format'
import { SceneManager } from './sceneManager'

export class VimX {
  settings: VimSettings
  geometry: RemoteVimx
  materials: G3dMaterial
  bim: VimDocument | undefined
  scene: SceneManager
  sceneLegacy: Scene // TODO : Remove
  mapping: ElementMapping2 | ElementNoMapping

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
    geometry: RemoteVimx,
    materials: G3dMaterial,
    bim: VimDocument | undefined,
    scene: SceneManager,
    mapping: ElementMapping2 | ElementNoMapping
  ) {
    this.scene = scene
    this.sceneLegacy = this.scene.scene
    this.settings = getFullSettings(settings)
    this.geometry = geometry
    this.bim = bim
    this.materials = materials

    this.mapping = mapping

    this.vim = new Vim(
      undefined,
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

      return new Loader().createRequest(source, fullSettings)
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
    console.log('REMOTE')
    const geometry =
      source instanceof ArrayBuffer
        ? new RemoteVimx(new BFast(source))
        : RemoteVimx.fromPath(source)

    console.log(geometry)
    if (!settings.progressive) {
      await geometry.bfast.forceDownload()
    }

    console.log('Downloading Scene Index..')
    const [index, materials] = await Promise.all([
      geometry.getScene(),
      geometry.getMaterials()
    ])
    console.log('Scene Index Downloaded.')

    // Create scene
    const scene = await SceneManager.create(
      geometry,
      index,
      materials,
      settings
    )

    const mapping = settings.noMap
      ? new ElementNoMapping()
      : new ElementMapping2(index)
    console.log(mapping)
    // wait for bim data.
    // const bim = bimPromise ? await bimPromise : undefined

    return new VimX(settings, geometry, materials, undefined, scene, mapping)
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

    // Return legacy vim
    const vim = new Vim(undefined, doc, g3d, scene, fullSettings, mapping)
    return vim
  }

  abort () {
    // TODO
  }

  dispose () {
    this.geometry.abort()
    this.scene.dispose()
  }
}
