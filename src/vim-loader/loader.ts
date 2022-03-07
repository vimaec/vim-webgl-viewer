/**
 * @module vim-loader
 */

import * as THREE from 'three'

import { Vim } from './vim'
import { Document } from './document'
import { Scene } from './scene'
import { Transparency } from './geometry'

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

  /**
   * Load a vim from a remote or local url
   * @param transparency defines how and if to render objects according to transparency.
   * @param onLoad Callback on success, returns a Vim instance.
   * @param onProgress on progress callback with download info or 'processing'.
   * @param onError error callback with error info.
   */
  loadFromUrl (
    url: string,
    transparency: Transparency.Mode = 'all',
    onLoad?: (response: Vim) => void,
    onProgress?: (progress: ProgressEvent | 'processing') => void,
    onError?: (event: ErrorEvent) => void
  ) {
    this._loader.setResponseType('arraybuffer')
    this._loader.setRequestHeader({
      'Content-Encoding': 'gzip'
    })
    this._loaded.add(url)
    this._loader.load(
      url,
      (data: string | ArrayBuffer) => {
        if (this._disposed) return
        if (!data) {
          onError?.(new ErrorEvent('Failed to obtain file at ' + url))
          return
        }
        if (typeof data === 'string') {
          onError?.(new ErrorEvent('Unsupported string loader response'))
          return
        }
        onProgress?.('processing')
        // slight hack to avoid multiple load call to share the same data.
        if (this._loaded.has(url)) data = data.slice(0)
        const document = Document.createFromArrayBuffer(data)
        const vim = this.loadFromVim(document, transparency)
        onLoad?.(vim)
      },
      (progress) => {
        if (this._disposed) return
        onProgress(progress)
      },
      (error) => {
        if (this._disposed) return
        onError?.(error)
      }
    )
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
    const vim = Document.createFromArrayBuffer(data)
    return this.loadFromVim(vim, transparency, instances)
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
