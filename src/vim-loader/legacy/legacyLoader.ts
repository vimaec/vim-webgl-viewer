import { setRemoteBufferMaxConcurency } from 'vim-format'
import { getFullSettings, VimPartialSettings } from '../vimSettings'
import { VimRequest } from './vimRequest'
import { VimBuilder } from './vimBuilder'

setRemoteBufferMaxConcurency(20)

// The original VIM Loader.
// As of 2024 this is being phased out and replaced with the AdvancedLoader.
export class LegacyLoader {
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
