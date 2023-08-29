// loader
import {
  getFullSettings,
  VimPartialSettings,
  VimSettings
} from '../vimSettings'
import { Vim } from '../vim'
import { InsertableMesh } from './insertableMesh'
import { Loader, Scene } from '../../vim'

import {
  ElementMapping,
  ElementMapping2,
  ElementNoMapping
} from '../elementMapping'
import { Renderer } from '../../vim-webgl-viewer/rendering/renderer'
import {
  BFast,
  RemoteBuffer,
  VimDocument,
  G3dMaterial,
  RemoteGeometry,
  G3d
} from 'vim-format'
import { SignalDispatcher } from 'ste-signals'
import { SceneX } from './sceneX'

export class VimX {
  settings: VimSettings
  geometry: RemoteGeometry
  materials: G3dMaterial
  bim: VimDocument | undefined
  scene: SceneX
  sceneLegacy: Scene // TODO : Remove
  mapping: ElementMapping2 | ElementNoMapping

  // TODO Remove
  renderer: Renderer

  // TODO: Put these two meshes into a Scene class
  // synchronizer: LoadingSynchronizer
  // meshFactory: InstancedMeshFactory
  // meshQueue = new Array<InstancedMesh>()

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
    scene: SceneX,
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

  static async loadAny (vimPath: string, settings: VimPartialSettings) {
    const fullSettings = getFullSettings(settings)
    if (settings.legacy) {
      return new Loader().load(vimPath, fullSettings)
    }
    if (settings.vimx) {
      return VimX.fromVimx(vimPath, fullSettings)
    } else {
      return VimX.fromVim(vimPath, fullSettings)
    }
  }

  static async fromVimx (bimPath: string, settings: VimSettings) {
    const bim = await VimX.createBim(bimPath, settings)
    const geometry = await RemoteGeometry.fromPath(settings.vimx)
    if (!settings.progressive) {
      await geometry.bfast.forceDownload()
    }
    const index = await geometry.getIndex()
    const materials = await geometry.getMaterials()
    const scene = await SceneX.create(geometry, index, materials, settings)

    const mapping = settings.noMap
      ? new ElementNoMapping()
      : new ElementMapping2(index)

    return new VimX(settings, geometry, materials, bim, scene, mapping)
  }

  static async fromVim (vimPath: string, settings: VimSettings) {
    const fullSettings = getFullSettings(settings)
    const buffer = new RemoteBuffer(vimPath)
    const bfast = new BFast(buffer)
    const doc = await VimDocument.createFromBfast(bfast)
    const geo = await bfast.getBfast('geometry')
    const g3d = await G3d.createFromBfast(geo)

    const subset = g3d.filter(settings.filterMode, settings.filter)

    const offsetsOpaque = subset.getOffsets('opaque')
    const offsetTransparent = subset.getOffsets('transparent')

    const materials = new G3dMaterial(g3d.materialColors)
    const opaque = new InsertableMesh(offsetsOpaque, materials, false)
    const transparent = new InsertableMesh(offsetTransparent, materials, true)

    const count = subset.getMeshCount()
    for (let m = 0; m < count; m++) {
      opaque.insertFromVim(g3d, m)
      transparent.insertFromVim(g3d, m)
    }

    opaque.update()
    transparent.update()

    const scene = new Scene(undefined)
    scene.addMesh(opaque)
    scene.addMesh(transparent)

    const instanceToElement = await doc.node.getAllElementIndex()
    const elementIds = await doc.element.getAllId()

    const mapping = new ElementMapping(
      Array.from(g3d.instanceNodes),
      instanceToElement!,
      elementIds!
    )

    const vim = new Vim(undefined, doc, g3d, scene, fullSettings, mapping)
    opaque.vim = vim
    transparent.vim = vim
    return vim
  }

  private static async createBim (path: string, settings: VimSettings) {
    const buffer = new RemoteBuffer(path, settings.loghttp)
    const bfast = new BFast(buffer)
    return VimDocument.createFromBfast(bfast, settings.noStrings)
  }

  abort () {
    // TODO
  }

  dispose () {
    this.geometry.abort()
    this.scene.dispose()
  }
}
