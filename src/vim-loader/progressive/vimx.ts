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
  RemoteGeometry,
  G3d
} from 'vim-format'
import { SceneManager } from './sceneManager'

export class VimX {
  settings: VimSettings
  geometry: RemoteGeometry
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
    geometry: RemoteGeometry,
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
    vimPath: string | ArrayBuffer,
    settings: VimPartialSettings
  ) {
    const fullSettings = getFullSettings(settings)
    if (settings.legacy || vimPath instanceof ArrayBuffer) {
      return new Loader().createRequest(vimPath, fullSettings)
    }
    if (settings.vimx) {
      return VimX.fromVimX(vimPath, fullSettings)
    } else {
      return VimX.fromVim(vimPath, fullSettings)
    }
  }

  /**
   * Creates a VimX object from given path to a vimx file
   */
  static async fromVimX (bimPath: string, settings: VimSettings) {
    // Fetch bim data
    const bim = await VimX.createBim(bimPath, settings)

    // Fetch geometry data
    const geometry = await RemoteGeometry.fromPath(settings.vimx)
    if (!settings.progressive) {
      await geometry.bfast.forceDownload()
    }

    const index = await geometry.getIndex()
    const materials = await geometry.getMaterials()

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

    return new VimX(settings, geometry, materials, bim, scene, mapping)
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
  static async fromVim (vimPath: string, settings: VimSettings) {
    const fullSettings = getFullSettings(settings)
    const buffer = new RemoteBuffer(vimPath)
    const bfast = new BFast(buffer)

    // Fetch g3d data
    const geometry = await bfast.getBfast('geometry')
    const g3d = await G3d.createFromBfast(geometry)
    const materials = new G3dMaterial(g3d.materialColors)

    // Create scene
    const factory = new LegacyMeshFactory(g3d, materials, settings)
    const scene = factory.createScene()

    // Create legacy mapping
    const doc = await VimDocument.createFromBfast(bfast)
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
