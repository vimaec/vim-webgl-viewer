/**
 * @module vim-loader
 */

import * as THREE from 'three'
import { Document } from './document'
import { Scene } from './scene'
import { VimSettings } from './vimSettings'
import { Object } from './object'

/**
 * Container for the built three meshes and the vim data from which it was built.
 * Dispenses Objects for high level scene manipulation
 */
export class Vim {
  document: Document
  scene: Scene
  settings: VimSettings
  index: number
  private _elementToInstance: Map<number, number[]>
  private _elementIdToElement: Map<number, number>
  private _elementToObject: Map<number, Object> = new Map<number, Object>()

  constructor (vim: Document, scene: Scene) {
    this.document = vim
    this.scene = scene
    this.scene.setVim(this)
    this._elementToInstance = this.mapElementToInstance()
    this._elementIdToElement = this.mapElementIdToElement()
  }

  dispose () {
    this.scene.dispose()
    this._elementIdToElement.clear()
    this._elementIdToElement.clear()
    this._elementToObject.clear()
  }

  filter (instances?: number[]) {
    this.scene.dispose()
    this.scene = Scene.createFromG3d(
      this.document.g3d,
      this.settings.getTransparency(),
      instances
    )
    this.scene.applyMatrix4(this.settings.getMatrix())
    this.scene.setVim(this)
    for (const [element, object] of this._elementToObject.entries()) {
      object.updateMeshes(this.getMeshesFromElement(element))
    }
  }

  private mapElementToInstance (): Map<number, number[]> {
    const map = new Map<number, number[]>()
    const instanceCount = this.document.getInstanceCount()

    for (let instance = 0; instance < instanceCount; instance++) {
      const element = this.document.getElementFromInstance(instance)
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

  private mapElementIdToElement (): Map<number, number> {
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
    const element = this._elementIdToElement.get(id)
    return this.getObjectFromElement(element)
  }

  getObjectFromElement (index: number) {
    if (this._elementToObject.has(index)) {
      return this._elementToObject.get(index)
    }

    const instances = this._elementToInstance.get(index)
    const meshes = this.getMeshesFromInstances(instances)

    const result = new Object(this, index, instances, meshes)
    this._elementToObject.set(index, result)
    return result
  }

  * getAllObjects () {
    const [first] = this.document.entities.get('Vim.Element')
    const elementCount = first[1].length
    for (let i = 0; i < elementCount; i++) {
      yield this.getObjectFromElement(i)
    }
  }

  private getMeshesFromElement (index: number) {
    const instances = this._elementToInstance.get(index)
    return this.getMeshesFromInstances(instances)
  }

  private getMeshesFromInstances (instances: number[]) {
    if (!instances?.length) return

    const meshes: [THREE.Mesh, number][] = []
    for (let i = 0; i < instances.length; i++) {
      const instance = instances[i]
      if (instance < 0) continue
      const [mesh, index] = this.scene.getMeshFromInstance(instance)
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
