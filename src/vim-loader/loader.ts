/**
 * @module vim-loader
 */

import { SceneBuilder } from './sceneBuilder'
import {
  BFast,
  G3d,
  RemoteG3d,
  VimDocument,
  setRemoteBufferMaxConcurency
} from 'vim-format'
import { Vim } from './vim'
import { VimConfig } from './vimSettings'
import { VimMaterials } from './materials/materials'
import { MeshBuilder } from './meshBuilder'
import { Scene } from './scene'
import { ElementMapping } from './elementMapping'

setRemoteBufferMaxConcurency(20)
/**
 * Loader for the Vim File format.
 * See https://github.com/vimaec/vim
 */
export class Loader {
  readonly sceneBuilder: SceneBuilder
  readonly meshBuilder: MeshBuilder

  constructor (materials: VimMaterials) {
    this.meshBuilder = new MeshBuilder(materials)
    this.sceneBuilder = new SceneBuilder(this.meshBuilder)
  }

  async load (bfast: BFast, settings: VimConfig) {
    if (!settings.streamBim && !settings.streamGeometry) {
      await bfast.forceDownload()
    }

    let g3d: G3d | undefined
    let strings: string[] | undefined

    let instanceToElement: number[] | undefined
    let elementIds: number[] | undefined

    const doc = await VimDocument.createFromBfast(bfast)

    await Promise.all([
      Loader.requestG3d(bfast).then((g) => (g3d = g)),
      Loader.requestStrings(bfast).then((s) => (strings = s)),
      doc.node
        .getAllElementIndex()
        .then((array) => (instanceToElement = array)),
      doc.element.getAllId().then((array) => (elementIds = array))
    ])

    const scene = g3d
      ? this.sceneBuilder.createFromG3d(
        g3d,
        settings.transparency,
        settings.instances
      )
      : new Scene(this.sceneBuilder)

    const mapping = new ElementMapping(
      Array.from(g3d.instanceNodes),
      instanceToElement!,
      elementIds!
    )

    const vim = new Vim(doc, g3d, scene, settings, strings, mapping)

    return vim
  }

  async loadRemote (bfast: BFast, settings: VimConfig) {
    let strings: string[] | undefined

    let instanceToElement: number[] | undefined
    let elementIds: number[] | undefined

    const doc = await VimDocument.createFromBfast(bfast)
    const geometry = await bfast.getBfast('geometry')
    const remoteG3d: RemoteG3d = RemoteG3d.createFromBfast(geometry)

    await Promise.all([
      Loader.requestStrings(bfast).then((s) => (strings = s)),
      doc.node
        .getAllElementIndex()
        .then((array) => (instanceToElement = array)),
      doc.element.getAllId().then((array) => (elementIds = array))
    ])

    const g3d = settings.instances
      ? await remoteG3d?.filter(settings.instances)
      : await remoteG3d?.toG3d()

    const scene = g3d
      ? this.sceneBuilder.createFromG3d(g3d, settings.transparency)
      : new Scene(this.sceneBuilder)

    const mapping = new ElementMapping(
      Array.from(g3d.instanceNodes),
      instanceToElement!,
      elementIds!
    )

    const vim = new Vim(doc, g3d, scene, settings, strings, mapping)

    return vim
  }

  private static async requestG3d (bfast: BFast) {
    const geometry = await bfast.getLocalBfast('geometry')

    if (!geometry) {
      throw new Error('Could not get G3d Data from VIM file.')
    }
    const g3d = await G3d.createFromBfast(geometry)

    return g3d
  }

  private static async requestStrings (bfast: BFast) {
    const buffer = await bfast.getBuffer('strings')
    if (!buffer) {
      console.error(
        'Could not get String Data from VIM file. Bim features will be disabled.'
      )
      return
    }
    const strings = new TextDecoder('utf-8').decode(buffer).split('\0')
    return strings
  }
}
