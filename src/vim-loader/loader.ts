/**
 * @module vim-loader
 */

import { Document } from './document'
import { SceneBuilder } from './sceneBuilder'
import { BFast } from './bfast'
import { Vim } from './vim'
import { VimSettings } from './vimSettings'
import { IMaterialLibrary } from './materials'
import { MeshBuilder } from './mesh'

/**
 * Loader for the Vim File format.
 * See https://github.com/vimaec/vim
 */
export class Loader {
  readonly sceneBuilder: SceneBuilder
  readonly meshBuilder: MeshBuilder

  constructor (materials: IMaterialLibrary) {
    this.meshBuilder = new MeshBuilder(materials)
    this.sceneBuilder = new SceneBuilder(this.meshBuilder)
  }

  async load (bfast: BFast, settings: VimSettings) {
    let document: Document

    const mode = settings.getDownloadMode()
    if (mode === 'download') await bfast.forceDownload()

    await Document.createFromBfast(bfast, mode === 'stream').then(
      (d) => (document = d)
    )

    const scene = this.sceneBuilder.createFromG3d(
      document!.g3d,
      settings.getTransparency()
    )
    const vim = new Vim(document!, scene, settings)
    return vim
  }
}
