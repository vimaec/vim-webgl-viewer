/**
 * @module vim-loader
 */

import * as THREE from 'three'

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
  private _loader: THREE.FileLoader
  private _loaded: Set<string> = new Set<string>()
  // Idealy we would cancel the load request, but three doesn't currently support it.
  private _disposed: boolean
  constructor () {
    this._loader = new THREE.FileLoader()
    THREE.Cache.enabled = true
  }

  dispose () {
    THREE.Cache.clear()
    this._loaded.clear()
    this._disposed = true
  }

  async loadAsync (bfast: BFast, transparency: Transparency.Mode) {
    const geometry = await bfast.getBfast('geometry')
    const g3d = await G3d.createFromBfastAsync(geometry)
    const scene = Scene.createFromG3d(g3d, transparency)
    const document = await Document.createFromBfast(bfast)
    const vim = new Vim(document, scene)
    return vim
  }

  /**
   * Loads a vim from an array buffer of a vim file.
   * Useful if you download the file using a custom http request.
   * @param transparency defines how and if to render objects according to transparency.
   * @param instances defines which g3d instances to load. All loaded if none provided.
   * @returns a vim instance
   */
  loadFromArrayBuffer (
    data: ArrayBuffer,
    transparency: Transparency.Mode,
    instances?: number[]
  ) {
    // const vim = Document.createFromArrayBuffer(data)
    // return this.loadFromVim(vim, transparency, instances)
  }

  /**
   * Reloads a new vim from an existing vim
   * @param transparency defines how and if to render objects according to transparency.
   * @param instances defines which g3d instances to load. All loaded if none provided.
   * @returns a vim instance
   */
  loadFromVim (
    vim: Document,
    transparency: Transparency.Mode,
    instances?: number[]
  ): Vim {
    const scene = Scene.createFromG3d(vim.g3d, transparency, instances)
    return new Vim(vim, scene)
  }
}
