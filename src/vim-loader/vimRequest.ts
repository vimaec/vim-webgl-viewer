import { ISimpleEvent, SimpleEventDispatcher } from 'ste-simple-events'
import { BFast, IProgressLogs, RemoteBuffer, Requester } from 'vim-format'
import { VimBuilder, Vim, VimSettings } from '../vim'

export class VimRequest {
  loader: VimBuilder
  url: string | undefined
  settings: VimSettings
  buffer: RemoteBuffer | ArrayBuffer
  requester: Requester
  bfast: BFast
  vim: Vim

  private _onProgress = new SimpleEventDispatcher<IProgressLogs>()
  get onProgress () {
    return this._onProgress as ISimpleEvent<IProgressLogs>
  }

  private _onLoaded = new SimpleEventDispatcher<Vim>()
  get onLoaded () {
    return this._onLoaded as ISimpleEvent<Vim>
  }

  constructor (
    loader: VimBuilder,
    source: string | ArrayBuffer,
    settings: VimSettings
  ) {
    this.loader = loader
    this.settings = settings
    if (typeof source === 'string') {
      this.url = source
      this.buffer = new RemoteBuffer(source, settings.loghttp)
      this.buffer.onProgress = (log) => this._onProgress.dispatch(log)
    } else this.buffer = source
    this.bfast = new BFast(this.buffer, 0, 'vim')
    this.requester = new Requester()
  }

  async send () {
    this.vim = this.settings.streamGeometry
      ? await this.loader.loadRemote(this.bfast, this.settings)
      : await this.loader.load(this.bfast, this.settings)
    this.vim.source = this.url
    this.vim.onDispose.sub(() => this.abort())
    this._onLoaded.dispatch(this.vim)
    return this.vim
  }

  abort () {
    if (this.buffer instanceof RemoteBuffer) {
      this.buffer.abort()
    }
    this.requester?.abort()
  }
}
