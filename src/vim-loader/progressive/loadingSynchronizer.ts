// loader

import { G3dSubset, RemoteGeometry, G3dMesh } from 'vim-format'

/**
 * Makes sure merged and instanced meshes are loaded at the according to the same order.
 */
export class LoadingSynchronizer {
  private _merged: LoadingBatcher
  private _instanced: LoadingBatcher
  get isDone () {
    return this._merged.isDone && this._instanced.isDone
  }

  constructor (
    uniques: G3dSubset,
    nonUniques: G3dSubset,
    geometry: RemoteGeometry,
    mergeAction: (mesh: G3dMesh, index: number) => void,
    instanceAction: (mesh: G3dMesh, index: number) => void
  ) {
    this._merged = new LoadingBatcher(uniques, geometry, mergeAction)
    this._instanced = new LoadingBatcher(nonUniques, geometry, instanceAction)
  }

  // Loads batches until the all meshes are loaded
  async loadAll (batchSize: number) {
    while (!this._merged.isDone || !this._instanced.isDone) {
      await this.load(batchSize)
    }
  }

  // Loads up batchsize meshes from unique and non unique meshes.
  async load (batchSize: number) {
    await Promise.all([
      this._merged.load(batchSize),
      this._instanced.load(batchSize)
    ])
  }
}

class LoadingBatcher {
  private _subset: G3dSubset
  private _geometry: RemoteGeometry
  private _onLoad: (mesh: G3dMesh, index: number) => void

  private _index: number = 0
  private _maxMesh: number = 0

  constructor (
    subset: G3dSubset,
    geometry: RemoteGeometry,
    onLoad: (mesh: G3dMesh, index: number) => void
  ) {
    this._subset = subset
    this._geometry = geometry
    this._onLoad = onLoad
  }

  get isDone () {
    return this._index >= this._subset.getMeshCount()
  }

  async load (batch: number) {
    if (this.isDone) {
      return Promise.resolve()
    }

    const promises = new Array<Promise<void>>()
    this._maxMesh += batch
    const count = this._subset.getMeshCount()
    for (; this._index < count; this._index++) {
      const mesh = this._subset.getMesh(this._index)
      if (mesh >= this._maxMesh) break
      promises.push(this.fetch(mesh, this._index))
    }
    return Promise.all(promises)
  }

  private async fetch (mesh: number, index: number) {
    if (this._onLoad) {
      const g3dMesh = await this._geometry.getMesh(mesh)
      this._onLoad(g3dMesh, index)
    }
  }
}
