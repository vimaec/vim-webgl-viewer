import {
  getFullSettings,
  VimPartialSettings,
  VimSettings
} from '../vimSettings'
import { Loader, VimX } from '../../vim'

import { BFast, requestHeader, IProgressLogs } from 'vim-format'

export class VimxLoader {
  /**
   * Loads given vim or vimx file using progressive pipeline unless the legacy flag is true.
   */
  static async loadAny (
    source: string | ArrayBuffer,
    settings: VimPartialSettings,
    onProgress?: () => IProgressLogs
  ) {
    const fullSettings = getFullSettings(settings)
    const type = await this.determineFileType(source, fullSettings)

    if (fullSettings.legacy) {
      if (type === 'vimx') {
        throw new Error('Cannot open a vimx using legacy pipeline.')
      }

      const request = new Loader().createRequest(source, settings)
      request.onProgress.subscribe(onProgress)
      return request.send()
    }

    if (type === 'vim') {
      return VimX.fromVim(source, fullSettings, onProgress)
    }

    if (type === 'vimx') {
      return VimX.fromVimX(source, fullSettings, onProgress)
    }
  }

  private static async determineFileType (
    vimPath: string | ArrayBuffer,
    settings: VimSettings
  ) {
    if (settings?.fileType === 'vim') return 'vim'
    if (settings?.fileType === 'vimx') return 'vimx'
    return this.requestFileType(vimPath)
  }

  static async requestFileType (vimPath: string | ArrayBuffer) {
    if (typeof vimPath === 'string') {
      if (vimPath.endsWith('vim')) return 'vim'
      if (vimPath.endsWith('vimx')) return 'vimx'
    }

    const bfast = new BFast(vimPath)
    const header = await requestHeader(bfast)

    if (header.vim !== undefined) return 'vim'
    if (header.vimx !== undefined) return 'vimx'

    throw new Error('Cannot determine file type from header.')
  }
}
