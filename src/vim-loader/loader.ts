import { setRemoteBufferMaxConcurency } from 'vim-format'
import { VimSettings, getFullSettings, VimPartialSettings } from './vimSettings'
import { VimRequest } from './vimRequest'
import { VimBuilder } from './vimBuilder'
import { VimX } from './progressive/vimx'

setRemoteBufferMaxConcurency(20)

export class Loader {
  private _builder: VimBuilder = new VimBuilder()

  /**
   * Loads a vim into the viewer from local or remote location
   * @param source if string downloads the vim from url then loads it, if ArrayBuffer directly loads the vim
   * @param options vim options
   */
  createRequest (source: string | ArrayBuffer, settings: VimPartialSettings) {
    const fullSettings = getFullSettings(settings)
    return new VimRequest(this._builder, source, fullSettings)
  }

  async load (source: string | ArrayBuffer, settings: VimPartialSettings) {
    return await this.createRequest(source, settings).send()
  }
}
