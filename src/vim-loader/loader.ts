/**
 * @module vim-loader
 */

import { Document, IDocument } from './document'
import { SceneBuilder } from './sceneBuilder'
import { BFast } from './bfast'
import { Vim } from './vim'
import { VimSettings } from './vimSettings'
import { VimMaterials } from './materials/materials'
import { MeshBuilder } from './mesh'
import { Scene } from './scene'

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

  async load (bfast: BFast, settings: VimSettings) {
    let document: IDocument | undefined

    const mode = settings.getDownloadMode()
    if (mode === 'download') await bfast.forceDownload()

    await Document.createFromBfast(bfast, mode === 'stream').then(
      (d) => (document = d)
    )
    if (!document) {
      throw Error('Could not load parse document.')
    }

    const scene = document.g3d
      ? this.sceneBuilder.createFromG3d(
          document!.g3d,
          settings.getTransparency()
      )
      : new Scene(this.sceneBuilder)

    const vim = new Vim(document!, scene, settings)
    return vim
  }
}
