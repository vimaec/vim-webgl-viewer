/**
 * @module vim-loader
 */

import { Document, IDocument } from './document'
import { SceneBuilder } from './sceneBuilder'
import { BFast } from './../../node_modules/vim-ts/src/bfast'
import { Vim } from './vim'
import { VimConfig } from './vimSettings'
import { VimMaterials } from './materials/materials'
import { MeshBuilder } from './mesh'
import { Scene } from './scene'
import { G3d } from './../../node_modules/vim-ts/src/g3d'
import { VimDocument } from './../../node_modules/vim-ts/src/objectModel'

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
    // let document: IDocument | undefined

    const mode = settings.download
    if (mode === 'download') await bfast.forceDownload()

    // await Document.createFromBfast(bfast, mode === 'stream').then(
    //   (d) => (document = d)
    // )
    // if (!document) {
    //   throw Error('Could not load parse document.')
    // }

    let g3d: G3d | undefined

    let instanceToElement: number[] | undefined
    let elementIds: number[] | undefined

    const doc = await VimDocument.createFromBfast(bfast)

    await Promise.all([
      Loader.requestG3d(bfast, mode === 'stream').then((g) => (g3d = g)),
      doc.node.getAllElementIndex().then(
        (array) => (instanceToElement = array)
      ),
      doc.element.getAllId().then((array) => (elementIds = array))
    ])

    const scene = g3d
      ? this.sceneBuilder.createFromG3d(g3d, settings.transparency)
      : new Scene(this.sceneBuilder)

    const elementToInstance = Loader.invert(instanceToElement!)
    const elementIdToElements = Loader.invert(elementIds!)

    const vim = new Vim(
      doc,
      g3d,
      scene,
      settings,
      instanceToElement!,
      elementToInstance,
      elementIds!,
      elementIdToElements)

    return vim
  }

  private static async requestG3d (bfast: BFast, streamG3d: boolean) {
    const geometry = streamG3d
      ? await bfast.getBfast('geometry')
      : await bfast.getLocalBfast('geometry')

    if (!geometry) {
      throw new Error('Could not get G3d Data from VIM file.')
    }
    const g3d = await G3d.createFromBfast(geometry)
    return g3d
  }

  /**
   * Returns a map where data[i] -> i
   */
  private static invert (data: number[]) {
    const result = new Map<number, number[]>()
    for (let i = 0; i < data.length; i++) {
      const value = data[i]
      const list = result.get(value)
      if (list) {
        list.push(i)
      } else {
        result.set(value, [i])
      }
    }
    return result
  }
}
