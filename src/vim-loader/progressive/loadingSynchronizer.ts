/**
 * @module vim-loader
 */

import { G3dMesh } from 'vim-format'
import { G3dSubset } from './g3dSubset'

/**
 * Makes sure both instanced meshes and merged meshes are requested in the right order
 * Also decouples downloads and processing.
 */
export class LoadingSynchronizer {
  done = false
  uniques: G3dSubset
  nonUniques: G3dSubset
  getMesh: (mesh: number) => Promise<G3dMesh>
  mergeAction: (mesh: G3dMesh, index: number) => void
  instanceAction: (mesh: G3dMesh, index: number) => void

  mergeQueue: (() => void)[] = []
  instanceQueue: (() => void)[] = []

  constructor (
    uniques: G3dSubset,
    nonUniques: G3dSubset,
    getMesh: (mesh: number) => Promise<G3dMesh>,
    mergeAction: (mesh: G3dMesh, index: number) => void,
    instanceAction: (mesh: G3dMesh, index: number) => void
  ) {
    this.uniques = uniques
    this.nonUniques = nonUniques
    this.getMesh = getMesh
    this.mergeAction = mergeAction
    this.instanceAction = instanceAction
  }

  get isDone () {
    return this.done
  }

  abort () {
    this.done = true
    this.mergeQueue.length = 0
    this.instanceQueue.length = 0
  }

  // Loads batches until the all meshes are loaded
  async loadAll () {
    const promises = this.getSortedPromises()
    Promise.all(promises).then(() => (this.done = true))
    await this.consumeQueues()
  }

  private async consumeQueues () {
    while (
      !(
        this.done &&
        this.mergeQueue.length === 0 &&
        this.instanceQueue.length === 0
      )
    ) {
      while (this.mergeQueue.length > 0) {
        this.mergeQueue.pop()()
      }
      while (this.instanceQueue.length > 0) {
        this.instanceQueue.pop()()
      }

      // Resume on next frame
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  private getSortedPromises () {
    const promises: Promise<void>[] = []

    const uniqueCount = this.uniques.getMeshCount()
    const nonUniquesCount = this.nonUniques.getMeshCount()

    let uniqueIndex = 0
    let nonUniqueIndex = 0
    let uniqueMesh = 0
    let nonUniqueMesh = 0

    while (!this.isDone) {
      const mergeDone = uniqueIndex >= uniqueCount
      const instanceDone = nonUniqueIndex >= nonUniquesCount
      if (mergeDone && instanceDone) {
        break
      }

      if (!mergeDone && (uniqueMesh <= nonUniqueMesh || instanceDone)) {
        uniqueMesh = this.uniques.getSourceMesh(uniqueIndex)
        promises.push(this.merge(uniqueMesh, uniqueIndex++))
      }
      if (!instanceDone && (nonUniqueMesh <= uniqueMesh || mergeDone)) {
        nonUniqueMesh = this.nonUniques.getSourceMesh(nonUniqueIndex)
        promises.push(this.instance(nonUniqueMesh, nonUniqueIndex++))
      }
    }
    return promises
  }

  async merge (mesh: number, index: number) {
    const m = await this.getMesh(mesh)
    this.mergeQueue.push(() => this.mergeAction(m, index))
  }

  async instance (mesh: number, index: number) {
    const m = await this.getMesh(mesh)
    this.instanceQueue.push(() => this.instanceAction(m, index))
  }
}
