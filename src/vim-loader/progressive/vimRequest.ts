// loader
import {
  VimPartialSettings
} from '../vimSettings'

import { Vim } from '../vim'
import { DeferredPromise } from '../../utils/deferredPromise'
import { RequestResult, ErrorResult, SuccessResult } from '../../utils/requestResult'
import { open } from './open'

import {
  BFast, IProgressLogs, VimSource
} from 'vim-format'

export type RequestOptions = {
  url?: string,
  buffer?: ArrayBuffer,
  headers?: Record<string, string>,
}

export function request (options: RequestOptions, settings? : VimPartialSettings) {
  return new VimRequest(options, settings)
}

export class VimRequest {
  private _source: VimSource
  private _settings : VimPartialSettings
  private _bfast : BFast

  // Result states
  private _isDone: boolean = false
  private _vimResult?: Vim
  private _error?: any

  // Promises to await progress updates and completion
  private _progress : IProgressLogs = { loaded: 0, total: 0, all: new Map() }
  private _progressPromise = new DeferredPromise<IProgressLogs>()
  private _completionPromise = new DeferredPromise<void>()

  constructor (source: VimSource, settings: VimPartialSettings) {
    this._source = source
    this._settings = settings

    this.startRequest()
  }

  /**
   * Initiates the asynchronous request and handles progress updates.
   */
  private async startRequest () {
    try {
      this._bfast = new BFast(this._source)

      const vim: Vim = await open(this._bfast, this._settings, (progress: IProgressLogs) => {
        this._progress = progress
        this._progressPromise.resolve(progress)
        this._progressPromise = new DeferredPromise<IProgressLogs>()
      })
      this._vimResult = vim
    } catch (err: any) {
      this._error = err
      console.error('Error loading VIM:', err)
    } finally {
      this.end()
    }
  }

  private end () {
    this._isDone = true
    this._progressPromise.resolve(this._progress)
    this._completionPromise.resolve()
  }

  async getResult (): Promise<RequestResult<Vim>> {
    await this._completionPromise
    return this._error ? new ErrorResult(this._error) : new SuccessResult(this._vimResult)
  }

  /**
   * Async generator that yields progress updates.
   * @returns An AsyncGenerator yielding IProgressLogs.
   */
  async * getProgress (): AsyncGenerator<IProgressLogs, void, void> {
    while (!this._isDone) {
      yield await this._progressPromise
    }
  }

  abort () {
    this._bfast.abort()
    this._error = 'Request aborted'
    this.end()
  }
}
