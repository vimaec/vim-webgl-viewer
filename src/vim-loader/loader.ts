/**
 * @module vim-loader
 */

import { Document } from './document'
import { Scene } from './scene'
import { BFast } from './bfast'
import { Vim } from './vim'
import { VimSettings } from './vimSettings'

/**
 * Loader for the Vim File format.
 * See https://github.com/vimaec/vim
 */
export class Loader {
  async load (bfast: BFast, settings: VimSettings) {
    let document: Document

    const mode = settings.getDownloadMode()
    if (mode === 'download') await bfast.forceDownload()

    await Document.createFromBfast(bfast, mode === 'stream').then(
      (d) => (document = d)
    )

    const scene = Scene.createFromG3d(document!.g3d, settings.getTransparency())
    const vim = new Vim(document!, scene, settings)
    return vim
  }
}
