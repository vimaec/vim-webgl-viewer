/**
 * Loader for the Vim File format.
 * See https://github.com/vimaec/vim
 * @module vim-loader
 * @author VIM / https://vimaec.com
 */

import * as THREE from 'three'

import { Vim } from './vim'
import { Document } from './document'
import { Scene } from './scene'
import { TransparencyMode } from './geometry'

export class VimLoader {
  loader: THREE.FileLoader
  loaded: Set<string> = new Set<string>()
  constructor () {
    this.loader = new THREE.FileLoader()
    THREE.Cache.enabled = true
  }

  count = 0
  // Loads the VIM from a URL
  // Download should be handled without three for Parser and Loader to be divided properly
  loadFromUrl (
    url: string,
    transparency: TransparencyMode = 'all',
    onLoad?: (response: Vim) => void,
    onProgress?: (progress: ProgressEvent | 'processing') => void,
    onError?: (event: ErrorEvent) => void
  ) {
    this.loader.setResponseType('arraybuffer')
    this.loader.setRequestHeader({
      'Content-Encoding': 'gzip'
    })
    this.loaded.add(url)
    this.loader.load(
      url,
      (data: string | ArrayBuffer) => {
        if (!data) {
          onError?.(new ErrorEvent('Failed to obtain file at ' + url))
          return
        }
        if (typeof data === 'string') {
          onError?.(new ErrorEvent('Unsupported string loader response'))
          return
        }
        onProgress?.('processing')
        if (this.loaded.has(url)) data = data.slice(0)
        const vim = Document.parseFromArrayBuffer(data)
        const scene = this.loadFromVim(vim, transparency)
        onLoad?.(scene)
      },
      onProgress,
      (error) => {
        onError?.(error)
      }
    )
  }

  loadFromArrayBuffer (
    data: ArrayBuffer,
    transparency: TransparencyMode,
    instances?: number[]
  ) {
    const vim = Document.parseFromArrayBuffer(data)
    return this.loadFromVim(vim, transparency, instances)
  }

  loadFromVim (
    vim: Document,
    transparency: TransparencyMode,
    instances?: number[]
  ): Vim {
    const scene = Scene.fromG3d(vim.g3d, transparency, instances)
    return new Vim(vim, scene)
  }
}
