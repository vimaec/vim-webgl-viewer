/**
 * @module vim-loader
 */

import { SceneBuilder } from './sceneBuilder'
import {
  BFast,
  G3d,
  RemoteG3d,
  VimDocument,
  VimHeader,
  requestHeader,
  ignoreStrings
} from 'vim-format'
import { VimSettings } from './vimSettings'
import { VimMaterials } from './materials/materials'
import { MeshBuilder } from './meshBuilder'
import { Scene } from './scene'
import { ElementMapping } from './elementMapping'
import { Vim } from './vim'

/**
 * Loader for the Vim File format.
 * See https://github.com/vimaec/vim
 */
export class VimBuilder {
  readonly sceneBuilder: SceneBuilder
  readonly meshBuilder: MeshBuilder

  constructor () {
    this.meshBuilder = new MeshBuilder(VimMaterials.getInstance())
    this.sceneBuilder = new SceneBuilder(this.meshBuilder)
  }

  async load (bfast: BFast, settings: VimSettings) {
    if (!settings.streamBim && !settings.streamGeometry) {
      await bfast.forceDownload()
    }

    const doc = await VimDocument.createFromBfast(bfast)

    const [header, g3d, instanceToElement, elementIds] = await Promise.all([
      settings.noHeader ? undefined : VimBuilder.requestHeader(bfast),
      VimBuilder.requestG3d(bfast),
      settings.noMap ? undefined : doc.node.getAllElementIndex(),
      settings.noMap ? undefined : doc.element.getAllId()
    ])
    const scene = g3d
      ? this.sceneBuilder.createFromG3d(g3d, settings)
      : new Scene(this.sceneBuilder)

    const mapping = settings.noMap
      ? undefined
      : new ElementMapping(
        Array.from(g3d.instanceNodes),
          instanceToElement!,
          elementIds!
      )

    const vim = new Vim(header, doc, g3d, scene, settings, mapping)

    return vim
  }

  async loadRemote (bfast: BFast, settings: VimSettings) {
    ignoreStrings(settings.noStrings) // This should be per VIM-file. Requires objectmodel API update.
    const doc = await VimDocument.createFromBfast(bfast)
    const geometry = await bfast.getBfast('geometry')
    const remoteG3d: RemoteG3d = RemoteG3d.createFromBfast(geometry)

    const [header, instanceToElement, elementIds] = await Promise.all([
      settings.noHeader ? undefined : VimBuilder.requestHeader(bfast),
      settings.noMap ? undefined : doc.node.getAllElementIndex(),
      settings.noMap ? undefined : doc.element.getAllId()
    ])

    const g3d = settings.instances
      ? await remoteG3d?.filter(settings.instances)
      : await remoteG3d?.toG3d()

    // Filtering already occured so we don't pass it to the builder.
    const copy = { ...settings, instances: undefined } as VimSettings

    const scene = g3d
      ? this.sceneBuilder.createFromG3d(g3d, copy)
      : new Scene(this.sceneBuilder)

    const mapping = settings.noMap
      ? undefined
      : new ElementMapping(
        Array.from(g3d.instanceNodes),
          instanceToElement!,
          elementIds!
      )

    const vim = new Vim(header, doc, g3d, scene, settings, mapping)

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
}