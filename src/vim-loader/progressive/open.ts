// loader
import {
  getFullSettings,
  VimPartialSettings,
  VimSettings
} from '../vimSettings'

import { Vim } from '../vim'
import { Scene } from '../scene'
import { Vimx } from './vimx'

import { ElementMapping, ElementMapping2 } from '../elementMapping'
import {
  BFast,
  RemoteBuffer,
  RemoteVimx,
  requestHeader,
  IProgressLogs,
  VimDocument,
  G3d,
  G3dMaterial,
  BFastSource
} from 'vim-format'
import { VimSubsetBuilder, VimxSubsetBuilder } from './subsetBuilder'
import { VimMeshFactory } from './legacyMeshFactory'
import { DefaultLog } from 'vim-format/dist/logging'

type RequestOptions = {
  url?: string,
  buffer?: ArrayBuffer,
  headers?: Record<string, string>,
}

/**
 * Asynchronously opens a vim object from a given source with the provided settings.
 * @param {string | ArrayBuffer} source - The source of the vim object, either a string or an ArrayBuffer.
 * @param {VimPartialSettings} settings - The settings to configure the behavior of the vim object.
 * @param {(p: IProgressLogs) => void} [onProgress] - Optional callback function to track progress logs.
 * @returns {Promise<void>} A Promise that resolves when the vim object is successfully opened.
 */
export async function open (
  source: BFastSource | BFast,
  settings: VimPartialSettings,
  onProgress?: (p: IProgressLogs) => void
) {
  const bfast = source instanceof BFast ? source : new BFast(source)
  const fullSettings = getFullSettings(settings)
  const type = await determineFileType(bfast, fullSettings)!

  if (type === 'vim') {
    return loadFromVim(bfast, fullSettings, onProgress)
  }

  if (type === 'vimx') {
    return loadFromVimX(bfast, fullSettings, onProgress)
  }

  throw new Error('Cannot determine the appropriate loading strategy.')
}

async function determineFileType (
  bfast: BFast,
  settings: VimSettings
) {
  if (settings?.fileType === 'vim') return 'vim'
  if (settings?.fileType === 'vimx') return 'vimx'
  return requestFileType(bfast)
}

async function requestFileType (bfast: BFast) {
  if (bfast.url) {
    if (bfast.url.endsWith('vim')) return 'vim'
    if (bfast.url.endsWith('vimx')) return 'vimx'
  }

  const header = await requestHeader(bfast)
  if (header.vim !== undefined) return 'vim'
  if (header.vimx !== undefined) return 'vimx'

  throw new Error('Cannot determine file type from header.')
}

/**
   * Loads a Vimx file from source
   */
async function loadFromVimX (
  bfast: BFast,
  settings: VimSettings,
  onProgress: (p: IProgressLogs) => void
) {
  // Fetch geometry data
  const remoteVimx = new RemoteVimx(bfast)
  if (remoteVimx.bfast.source instanceof RemoteBuffer) {
    remoteVimx.bfast.source.onProgress = onProgress
  }

  console.log('Downloading Scene Index..')
  const vimx = await Vimx.fromRemote(remoteVimx, !settings.progressive)
  console.log('Scene Index Downloaded.')

  // Create scene
  const scene = new Scene(settings.matrix)
  const mapping = new ElementMapping2(vimx.scene)

  // wait for bim data.
  // const bim = bimPromise ? await bimPromise : undefined

  const builder = new VimxSubsetBuilder(vimx, scene)

  const vim = new Vim(
    vimx.header,
    undefined,
    undefined,
    scene,
    settings,
    mapping,
    builder,
    typeof bfast.source === 'string' ? bfast.source : undefined,
    'vimx'
  )

  if (remoteVimx.bfast.source instanceof RemoteBuffer) {
    remoteVimx.bfast.source.onProgress = undefined
  }

  return vim
}

/**
   * Loads a Vim file from source
   */
async function loadFromVim (
  bfast: BFast,
  settings: VimSettings,
  onProgress?: (p: IProgressLogs) => void
) {
  const fullSettings = getFullSettings(settings)

  if (bfast.source instanceof RemoteBuffer) {
    bfast.source.onProgress = onProgress
    if (settings.verboseHttp) {
      bfast.source.logs = new DefaultLog()
    }
  }

  // Fetch g3d data
  const geometry = await bfast.getBfast('geometry')
  const g3d = await G3d.createFromBfast(geometry)
  const materials = new G3dMaterial(g3d.materialColors)

  // Create scene
  const scene = new Scene(settings.matrix)
  const factory = new VimMeshFactory(g3d, materials, scene)

  // Create legacy mapping
  const doc = await VimDocument.createFromBfast(bfast, true)
  const mapping = await ElementMapping.fromG3d(g3d, doc)
  const header = await requestHeader(bfast)

  // Return legacy vim
  const builder = new VimSubsetBuilder(factory)
  const vim = new Vim(
    header,
    doc,
    g3d,
    scene,
    fullSettings,
    mapping,
    builder,
    typeof bfast.source === 'string' ? bfast.source : undefined,
    'vim'
  )

  if (bfast.source instanceof RemoteBuffer) {
    bfast.source.onProgress = undefined
  }

  return vim
}

export function request (options: RequestOptions, settings? : VimPartialSettings) {
  return new VimRequest(options, settings)
}

class SuccessResult<T> {
  result: T

  constructor (result: T) {
    this.result = result
  }

  isSuccess (): true {
    return true
  }

  isError (): false {
    return false
  }
}

class ErrorResult {
  error: string

  constructor (error: string) {
    this.error = error
  }

  isSuccess (): false {
    return false
  }

  isError (): this is ErrorResult {
    return true
  }
}

type RequestResult<T> = SuccessResult<T> | ErrorResult

class VimRequest {
  private _source: BFastSource
  private _settings : VimPartialSettings
  private _bfast : BFast

  // Result states
  private _isDone: boolean = false
  private _vimResult?: Vim
  private _error?: any

  // Promise to wait for the next progress update
  private _progressQueue: IProgressLogs[] = []
  private _progressPromise: Promise<void>
  private _progressResolve!: () => void

  // Promise to wait for the request to complete
  private _completionPromise: Promise<void>
  private _completionResolve!: () => void

  constructor (source: BFastSource, settings: VimPartialSettings) {
    this._source = source
    this._settings = settings

    // Initialize the progress promise
    this._progressPromise = new Promise<void>((resolve) => {
      this._progressResolve = resolve
    })

    // Initialize the completion promise
    this._completionPromise = new Promise<void>((resolve) => {
      this._completionResolve = resolve
    })

    this.startRequest()
  }

  async getResult (): Promise<RequestResult<Vim>> {
    await this._completionPromise
    return this._error ? new ErrorResult(this._error) : new SuccessResult(this._vimResult)
  }

  /**
   * Initiates the asynchronous request and handles progress updates.
   */
  private startRequest () {
    this._bfast = new BFast(this._source)
    open(this._bfast, this._settings, (progress: IProgressLogs) => {
      // Push progress updates to the queue
      this._progressQueue.push(progress)
      // Resolve the promise to notify the generator
      this._progressResolve()
      // Create a new promise for the next update
      this._progressPromise = new Promise<void>((resolve) => {
        this._progressResolve = resolve
      })
    })
      .then((vim: Vim) => {
        // Operation completed successfully
        this._vimResult = vim
        this._isDone = true
        this._progressResolve() // Resolve to unblock the generator
        this._completionResolve() // Resolve the completion promise
      })
      .catch((err: any) => {
        // An error occurred
        this._error = err
        this._isDone = true
        this._progressResolve() // Resolve to unblock the generator
        this._completionResolve() // Resolve the completion promise
      })
  }

  /**
   * Async generator that yields progress updates.
   * @returns An AsyncGenerator yielding IProgressLogs.
   */
  async * getProgress (): AsyncGenerator<IProgressLogs, void, void> {
    while (!this._isDone || this._progressQueue.length > 0) {
      // Wait for new progress updates or completion
      await this._progressPromise
      // Yield all progress updates in the queue
      while (this._progressQueue.length > 0) {
        const progress = this._progressQueue.shift()!
        yield progress // Yield progress update
      }
    }
  }

  abort () {
    this._bfast.abort()
    this._isDone = true
    this._error = 'Request aborted'
    this._progressResolve()
    this._completionResolve()
  }
}
