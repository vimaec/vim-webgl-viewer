/**
 * @module vim-loader
 */

import { SceneBuilder } from './sceneBuilder'
import { BFast, G3d, VimDocument, VimHeader, requestHeader } from 'vim-format'
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

  async load (bfast: BFast, settings: VimSettings, source: string) {
    const getBim = async () => {
      const doc = await VimDocument.createFromBfast(bfast, true)
      const [instanceToElement, elementIds] = await Promise.all([
        settings.noMap ? undefined : doc.node.getAllElementIndex(),
        settings.noMap ? undefined : this.getElementIds(doc)
      ])
      return { doc, instanceToElement, elementIds }
    }

    const [header, g3d, bim] = await Promise.all([
      settings.noHeader ? undefined : VimBuilder.requestHeader(bfast),
      VimBuilder.requestG3d(bfast),
      getBim()
    ])

    const scene = g3d
      ? this.sceneBuilder.createFromG3d(g3d, settings)
      : new Scene(this.sceneBuilder, settings.matrix)

    const mapping = settings.noMap
      ? undefined
      : new ElementMapping(
        Array.from(g3d.instanceNodes),
          bim.instanceToElement!,
          bim.elementIds!
      )

    const vim = new Vim(
      header,
      bim.doc,
      g3d,
      scene,
      settings,
      mapping,
      undefined,
      source,
      'vim'
    )

    return vim
  }

  async loadRemote (bfast: BFast, settings: VimSettings, source: string) {
    const doc = await VimDocument.createFromBfast(bfast, settings.noStrings)
    const geometry = await bfast.getBfast('geometry')
    const g3d = await G3d.createFromBfast(geometry)

    const [header, instanceToElement, elementIds] = await Promise.all([
      settings.noHeader ? undefined : VimBuilder.requestHeader(bfast),
      settings.noMap ? undefined : doc.node.getAllElementIndex(),
      settings.noMap ? undefined : this.getElementIds(doc)
    ])

    // Filtering already occured so we don't pass it to the builder.
    const copy = { ...settings, instances: settings.instances } as VimSettings

    const scene = g3d
      ? this.sceneBuilder.createFromG3d(g3d, copy)
      : new Scene(this.sceneBuilder, copy.matrix)

    const mapping = settings.noMap
      ? undefined
      : new ElementMapping(
        Array.from(g3d.instanceNodes),
          instanceToElement!,
          elementIds!
      )

    const vim = new Vim(
      header,
      doc,
      g3d,
      scene,
      settings,
      mapping,
      undefined,
      source,
      'vim'
    )

    return vim
  }

  private async getElementIds (doc: VimDocument) {
    const ids = await doc.element.getAllId()
    if (ids !== undefined) {
      // Expected good path.
      return ids
    }
    const count = await doc.element.getCount()
    if (count === 0) {
      // No elements, can't use map.
      return undefined
    }
    // Return placeholder ids
    const fill = new BigInt64Array(count)
    fill.fill(BigInt(-1))
    return fill
  }

  public static async requestHeader (bfast: BFast): Promise<VimHeader> {
    const header = await requestHeader(bfast)

    if (!header) {
      throw new Error('Could not get VIM file header.')
    }
    return header
  }

  private static async requestG3d (bfast: BFast) {
    const geometry = await bfast.getBfast('geometry')

    if (!geometry) {
      throw new Error('Could not get G3d Data from VIM file.')
    }
    const g3d = await G3d.createFromBfast(geometry)

    return g3d
  }
}
