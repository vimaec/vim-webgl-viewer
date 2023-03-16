/**
 * @module vim-loader
 */

import { SceneBuilder } from './sceneBuilder'
import {
  BFast,
  G3d,
  RemoteG3d,
  VimDocument,
  setRemoteBufferMaxConcurency,
  VimHeader,
  requestHeader
} from 'vim-format'
import { VimConfig } from './vimSettings'
import { VimMaterials } from './materials/materials'
import { MeshBuilder } from './meshBuilder'
import { Scene } from './scene'
import { ElementMapping } from './elementMapping'
import { Vim } from './vim'

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

    const doc = await VimDocument.createFromBfast(bfast)

    const [header, g3d, strings, instanceToElement, elementIds] =
      await Promise.all([
        Loader.requestHeader(bfast),
        Loader.requestG3d(bfast),
        Loader.requestStrings(bfast),
        doc.node.getAllElementIndex(),
        doc.element.getAllId()
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

    const vim = new Vim(header, doc, g3d, scene, settings, strings, mapping)

    return vim
  }

  async loadRemote (bfast: BFast, settings: VimConfig) {
    const doc = await VimDocument.createFromBfast(bfast)
    const geometry = await bfast.getBfast('geometry')
    const remoteG3d: RemoteG3d = RemoteG3d.createFromBfast(geometry)

    const [header, strings, instanceToElement, elementIds] = await Promise.all([
      Loader.requestHeader(bfast),
      Loader.requestStrings(bfast),
      doc.node.getAllElementIndex(),
      doc.element.getAllId()
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

    const vim = new Vim(header, doc, g3d, scene, settings, strings, mapping)

    return vim
  }

  private static async requestHeader (bfast: BFast): Promise<VimHeader> {
    const header = await requestHeader(bfast)

    if (!header) {
      throw new Error('Could not get VIM file header.')
    }
    return header
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
