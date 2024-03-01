/**
 * @module vim-loader
 */

import { VimMeshFactory } from './legacyMeshFactory'
import { LoadPartialSettings, LoadSettings, SubsetRequest } from './subsetRequest'
import { G3dSubset } from './g3dSubset'
import { ISignal, ISignalHandler, SignalDispatcher } from 'ste-signals'
import { ISubscribable, SubscriptionChangeEventHandler } from 'ste-core'
import { Vimx } from './vimx'
import { Scene } from '../scene'

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
  factory: VimMeshFactory

  private _onUpdate = new SignalDispatcher()

  get onUpdate () {
    return this._onUpdate.asEvent()
  }

  get isLoading () {
    return false
  }

  constructor (factory: VimMeshFactory) {
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
  private _localVimx: Vimx
  private _scene: Scene
  private _set = new Set<SubsetRequest>()

  private _onUpdate = new SignalDispatcher()
  get onUpdate () {
    return this._onUpdate.asEvent()
  }

  get isLoading () {
    return this._set.size > 0
  }

  constructor (localVimx: Vimx, scene: Scene) {
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

export class DummySubsetBuilder implements SubsetBuilder {
  get onUpdate () {
    
    return new AlwaysTrueSignal()
  }
  get isLoading() {
    return false
  }

  getFullSet(): G3dSubset {
    throw new Error('Method not implemented.')
  }
  loadSubset(subset: G3dSubset, settings?: Partial<LoadSettings>) {}
  clear() {  }
  dispose() {  }
}

class AlwaysTrueSignal implements ISignal{
  count: number
  subscribe(fn: ISignalHandler): () => void {
    fn(null)
    return () =>{}
  }
  sub(fn: ISignalHandler): () => void {
    fn(null)
    return () =>{}
  }
  unsubscribe(fn: ISignalHandler): void {}
  unsub(fn: ISignalHandler): void {}
  one(fn: ISignalHandler): () => void {
    fn(null)
    return () =>{}
  }
  has(fn: ISignalHandler): boolean {
    return false
  }
  clear(): void {}
  onSubscriptionChange: ISubscribable<SubscriptionChangeEventHandler>
}