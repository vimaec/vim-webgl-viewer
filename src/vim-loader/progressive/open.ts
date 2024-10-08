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
  G3dMaterial
} from 'vim-format'
import { VimSubsetBuilder, VimxSubsetBuilder } from './subsetBuilder'
import { VimMeshFactory } from './legacyMeshFactory'
import { DefaultLog } from 'vim-format/dist/logging'

/**
 * Asynchronously opens a vim object from a given source with the provided settings.
 * @param {string | ArrayBuffer} source - The source of the vim object, either a string or an ArrayBuffer.
 * @param {VimPartialSettings} settings - The settings to configure the behavior of the vim object.
 * @param {(p: IProgressLogs) => void} [onProgress] - Optional callback function to track progress logs.
 * @returns {Promise<void>} A Promise that resolves when the vim object is successfully opened.
 */
export async function open (
  source: string | ArrayBuffer,
  settings: VimPartialSettings,
  onProgress?: (p: IProgressLogs) => void
) {
  const fullSettings = getFullSettings(settings)
  const type = await determineFileType(source, fullSettings)!

  if (type === 'vim') {
    return loadFromVim(source, fullSettings, onProgress)
  }

  if (type === 'vimx') {
    return loadFromVimX(source, fullSettings, onProgress)
  }

  throw new Error('Cannot determine the appropriate loading strategy.')
}

async function determineFileType (
  vimPath: string | ArrayBuffer,
  settings: VimSettings
) {
  if (settings?.fileType === 'vim') return 'vim'
  if (settings?.fileType === 'vimx') return 'vimx'
  return requestFileType(vimPath)
}

async function requestFileType (vimPath: string | ArrayBuffer) {
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

/**
   * Loads a Vimx file from source
   */
async function loadFromVimX (
  source: string | ArrayBuffer,
  settings: VimSettings,
  onProgress: (p: IProgressLogs) => void
) {
  // Fetch geometry data
  const remoteVimx = new RemoteVimx(source)
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
    typeof source === 'string' ? source : undefined,
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
  source: string | ArrayBuffer,
  settings: VimSettings,
  onProgress?: (p: IProgressLogs) => void
) {
  const fullSettings = getFullSettings(settings)
  const bfast = new BFast(source)
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
    typeof source === 'string' ? source : undefined,
    'vim'
  )

  if (bfast.source instanceof RemoteBuffer) {
    bfast.source.onProgress = undefined
  }

  return vim
}
