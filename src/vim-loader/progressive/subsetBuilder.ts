import { LocalVimx, Scene } from '../../vim'
import { LegacyMeshFactory } from './legacyMeshFactory'
import { LoadPartialSettings, SubsetRequest } from './subsetRequest'
import { G3dSubset } from './g3dSubset'
import { ISignal, SignalDispatcher } from 'ste-signals'

export interface SubsetBuilder {
  /** Dispatched whenever a subset begins or finishes loading. */
  onUpdate: ISignal

  /** Returns true when some subset is being loaded. */
  isLoading: boolean

  /** Returns all instances as a subset */
  getFullSet(): G3dSubset

  /** Loads given subset with given options */
  loadSubset(subset: G3dSubset, settings?: LoadPartialSettings)

  /** Stops and clears all loading processes */
  clear()

  dispose()
}

/**
 * Loads and builds subsets from a Vim file.
 */
export class VimSubsetBuilder implements SubsetBuilder {
  factory: LegacyMeshFactory

  private _onUpdate = new SignalDispatcher()

  get onUpdate () {
    return this._onUpdate.asEvent()
  }

  get isLoading () {
    return false
  }

  constructor (factory: LegacyMeshFactory) {
    this.factory = factory
  }

  getFullSet () {
    return new G3dSubset(this.factory.g3d)
  }

  loadSubset (subset: G3dSubset, settings?: LoadPartialSettings) {
    this.factory.add(subset)
    this._onUpdate.dispatch()
  }

  clear () {}

  dispose () {}
}

/**
 * Loads and builds subsets from a VimX file.
 */
export class VimxSubsetBuilder {
  private _localVimx: LocalVimx
  private _scene: Scene
  private _set = new Set<SubsetRequest>()

  private _onUpdate = new SignalDispatcher()
  get onUpdate () {
    return this._onUpdate.asEvent()
  }

  get isLoading () {
    return this._set.size > 0
  }

  constructor (localVimx: LocalVimx, scene: Scene) {
    this._localVimx = localVimx
    this._scene = scene
  }

  getFullSet () {
    return new G3dSubset(this._localVimx.scene)
  }

  async loadSubset (subset: G3dSubset, settings?: LoadPartialSettings) {
    const request = new SubsetRequest(this._scene, this._localVimx, subset)
    this._set.add(request)
    this._onUpdate.dispatch()
    await request.start(settings)
    this._set.delete(request)
    this._onUpdate.dispatch()
  }

  clear () {
    this._localVimx.abort()
    this._set.forEach((s) => s.dispose())
    this._set.clear()
  }

  dispose () {
    this.clear()
  }
}
