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
  VimSource
} from 'vim-format'
import { VimSubsetBuilder, VimxSubsetBuilder } from './subsetBuilder'
import { VimMeshFactory } from './legacyMeshFactory'
import { DefaultLog } from 'vim-format/dist/logging'

/**
 * Asynchronously opens a vim object from a given source with the provided settings.
 * @param {string | BFast} source - The source of the vim object, either a string or a BFast.
 * @param {VimPartialSettings} settings - The settings to configure the behavior of the vim object.
 * @param {(p: IProgressLogs) => void} [onProgress] - Optional callback function to track progress logs.
 * @returns {Promise<void>} A Promise that resolves when the vim object is successfully opened.
 */
export async function open (
  source: VimSource | BFast,
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

  const vimx = await Vimx.fromRemote(remoteVimx, !settings.progressive)

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
