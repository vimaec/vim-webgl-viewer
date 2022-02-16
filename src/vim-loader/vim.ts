/**
 * Final result of loading a Vim.
 * @module vim-loader
 */

import * as THREE from 'three'
import { Document } from './document'
import { Scene } from './scene'
import { VimSettings } from './settings'
import { Object } from './object'

/**
 * Container for the built three meshes and the vim data from which it was built.
 * Dispenses Objects for high level scene manipulation
 */
export class Vim {
  document: Document
  scene: Scene
  settings: VimSettings
  private _index: number
  private elementToInstance: Map<number, number[]>
  private elementIdToElement: Map<number, number>
  private elementToObject: Map<number, Object> = new Map<number, Object>()

  constructor (vim: Document, scene: Scene) {
    this.document = vim
    this.scene = scene
    this.elementToInstance = this.mapElementIndexToInstanceIndices()
    this.elementIdToElement = this.mapElementIdToIndex()
  }

  private mapElementIndexToInstanceIndices (): Map<number, number[]> {
    const map = new Map<number, number[]>()
    const instanceElements = this.document.getInstanceToElementMap()
    const instanceCount = instanceElements.length

    for (let instance = 0; instance < instanceCount; instance++) {
      const element = instanceElements[instance]
      if (element === undefined) continue

      const instances = map.get(element)
      if (instances) {
        instances.push(instance)
      } else {
        map.set(element, [instance])
      }
    }
    return map
  }

  private mapElementIdToIndex (): Map<number, number> {
    const map = new Map<number, number>()
    const elementIds = this.document.getIntColumn(
      this.document.getElementTable(),
      'Id'
    )

    let negativeReported = false
    let duplicateReported = false
    for (let element = 0; element < elementIds.length; element++) {
      const id = elementIds[element]

      if (id < 0) {
        if (!negativeReported) {
          console.error('Ignoring negative element ids. Check source data.')
          negativeReported = true
        }

        continue
      }
      if (map.has(id)) {
        if (!duplicateReported) {
          console.error('Ignoring duplicate element ids. Check source data.')
          duplicateReported = true
          continue
        }
      }

      map.set(id, element)
    }
    return map
  }

  applySettings (settings: VimSettings) {
    this.settings = settings
    this.scene.applyMatrix4(this.settings.getMatrix())
  }

  get index () {
    return this._index
  }

  set index (index: number) {
    this._index = index
    this.scene.setIndex(index)
  }

  getMatrix () {
    return this.settings.getMatrix()
  }

  getObjectFromMesh (mesh: THREE.Mesh, index: number) {
    const element = this.getElementFromMesh(mesh, index)
    return this.getObjectFromElement(element)
  }

  getObjectFromInstance (instance: number) {
    const element = this.document.getElementFromInstance(instance)
    return this.getObjectFromElement(element)
  }

  getObjectFromElementId (id: number) {
    const element = this.elementIdToElement.get(id)
    return this.getObjectFromElement(element)
  }

  getObjectFromElement (index: number) {
    if (this.elementToObject.has(index)) {
      return this.elementToObject.get(index)
    }

    const instances = this.elementToInstance.get(index)
    const meshes = this.getMeshesFromInstances(instances)
    if (!meshes) return

    const result = new Object(this, index, instances, meshes)
    this.elementToObject.set(index, result)
    return result
  }

  private getMeshesFromInstances (instances: number[]) {
    if (!instances?.length) return

    const meshes: [THREE.Mesh, number][] = []
    for (let i = 0; i < instances.length; i++) {
      const instance = instances[i]
      if (instance < 0) continue
      const [mesh, index] = this.scene.instanceToThreeMesh.get(instance) ?? []
      if (!mesh) continue
      meshes.push([mesh, index])
    }
    if (meshes.length === 0) return
    return meshes
  }

  /**
   * Get the element index related to given mesh
   * @param mesh instanced mesh
   * @param index index into the instanced mesh
   * @returns index of element
   */
  private getElementFromMesh (mesh: THREE.Mesh, index: number): number {
    if (!mesh || index < 0) return -1
    const instance = this.scene.getInstanceFromMesh(mesh, index)
    return this.document.getElementFromInstance(instance)
  }
}
