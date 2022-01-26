/**
 @author VIM / https://vimaec.com
*/

import * as THREE from 'three'

import { BimModel } from './bimModel'
import { Vim } from './vim'
import { Model } from './model'
import { TransparencyMode } from './geometry'

export class VIMLoader {
  // Loads the VIM from a URL
  // Download should be handled without three for Parser and Loader to be divided properly
  loadFromUrl (
    url: string,
    transparency: TransparencyMode = 'all',
    onLoad?: (response: BimModel) => void,
    onProgress?: (progress: ProgressEvent | 'processing') => void,
    onError?: (event: ErrorEvent) => void
  ) {
    const loader = new THREE.FileLoader()
    loader.setResponseType('arraybuffer')
    loader.setRequestHeader({
      'Content-Encoding': 'gzip'
    })

    loader.load(
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
        const vim = Vim.parseFromArrayBuffer(data)
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
    const vim = Vim.parseFromArrayBuffer(data)
    this.loadFromVim(vim, transparency, instances)
  }

  loadFromVim (
    vim: Vim,
    transparency: TransparencyMode,
    instances?: number[]
  ): BimModel {
    const model = Model.fromG3d(vim.g3d, transparency, instances)
    return new BimModel(vim, model)
  }
}
