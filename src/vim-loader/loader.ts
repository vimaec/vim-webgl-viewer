/**
 * @module vim-loader
 */

import { Document } from './document'
import { Scene } from './scene'
import { Transparency } from './geometry'
import { BFast } from './bfast'
import { G3d } from './g3d'
import { Vim } from './vim'

/**
 * Loader for the Vim File format.
 * See https://github.com/vimaec/vim
 */
export class Loader {
  async load (bfast: BFast, transparency: Transparency.Mode) {
    let g3d: G3d
    let document: Document

    await Promise.all([
      bfast
        .getBfast('geometry')
        .then((g) => G3d.createFromBfast(g))
        .then((g) => (g3d = g)),
      Document.createFromBfast(bfast).then((d) => (document = d))
    ])

    const scene = Scene.createFromG3d(g3d, transparency)
    const vim = new Vim(document, scene)
    return vim
  }
}
