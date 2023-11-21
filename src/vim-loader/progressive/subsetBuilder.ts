import { getFullSettings, VimSettings } from '../vimSettings'
import { Vim } from '../vim'
import { LocalVimx, Scene, VimBuilder } from '../../vim'
import { LegacyMeshFactory } from './legacyMeshFactory'

import {
  ElementMapping,
  ElementMapping2,
  ElementNoMapping
} from '../elementMapping'
import {
  BFast,
  RemoteBuffer,
  VimDocument,
  G3dMaterial,
  RemoteVimx,
  G3d,
  requestHeader,
  VimHeader,
  G3dScene,
  FilterMode,
  IProgressLogs
} from 'vim-format'
import { LoadPartialSettings, SubsetRequest } from './subsetRequest'
import { G3dSubset } from './g3dSubset'
import { SignalDispatcher } from 'ste-signals'
import { Renderer } from '../../vim-webgl-viewer/rendering/renderer'

export class VimSubsetBuilder {
  factory: LegacyMeshFactory

  private _onLoading = new SignalDispatcher()
  get onUpdate () {
    return this._onLoading.asEvent()
  }

  get isLoading () {
    return false
  }

  constructor (factory: LegacyMeshFactory) {
    this.factory = factory
  }

  getSubset () {
    return new G3dSubset(this.factory.g3d)
  }

  loadSubset (subset: G3dSubset, settings?: LoadPartialSettings) {
    this.factory.add(subset)
    this._onLoading.dispatch()
  }

  updateScene (scene: Scene) {
    this.factory.scene = scene
  }

  clear () {}

  dispose () {}
}

export class VimxSubsetBuilder {
  private _localVimx: LocalVimx
  private scene: Scene
  private set = new Set<SubsetRequest>()

  private _activeRequests = new SignalDispatcher()
  get onUpdate () {
    return this._activeRequests.asEvent()
  }

  get isLoading () {
    return this.set.size > 0
  }

  constructor (localVimx: LocalVimx, scene: Scene) {
    this._localVimx = localVimx
    this.scene = scene
  }

  getSubset () {
    return new G3dSubset(this._localVimx.scene)
  }

  async loadSubset (subset: G3dSubset, settings?: LoadPartialSettings) {
    const request = new SubsetRequest(this.scene, this._localVimx, subset)
    this.set.add(request)
    await request.start(settings)
    this.set.delete(request)
  }

  updateScene (scene: Scene) {
    this.scene = scene
  }

  clear () {
    this._localVimx.abort()
  }

  dispose () {
    this.set.forEach((s) => s.dispose())
    this.set.clear()
  }
}
