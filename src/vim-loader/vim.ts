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
  private _elementToObject: Map<number, Object> = new Map<number, Object>()

  constructor (vim: Document, scene: Scene) {
    this.document = vim
    this.scene = scene
    this.scene.setVim(this)
  }

  dispose () {
    this.scene.dispose()
    this.scene = undefined
  }

  /**
   * Reloads the vim with only the instances provided
   * @param instances g3d instance indices to keep
   */
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

  /**
   * Applies new settings to the vim
   */
  applySettings (settings: VimSettings) {
    this.settings = settings
    this.scene.applyMatrix4(this.settings.getMatrix())
  }

  /**
   * Returns vim matrix
   */
  getMatrix () {
    return this.settings.getMatrix()
  }

  /**
   * Returns vim object from given mesh and index
   * @param mesh three mesh
   * @param index instanced mesh index or merged mesh submesh index
   */
  getObjectFromMesh (mesh: THREE.Mesh, index: number) {
    const element = this.getElementFromMesh(mesh, index)
    return this.getObjectFromElement(element)
  }

  /**
   * Returns vim object from given instance
   * @param instance g3d instance index
   */
  getObjectFromInstance (instance: number) {
    const element = this.document.getElementFromInstance(instance)
    return this.getObjectFromElement(element)
  }

  /**
   * Returns vim object from given vim element Id
   * @param id vim element Id
   */
  getObjectsFromElementId (id: number) {
    const elements = this.document.getElementFromElementId(id)
    return elements?.map((e) => this.getObjectFromElement(e))
  }

  /**
   * Returns vim object from given vim element index
   * @param element vim element index
   */
  getObjectFromElement (element: number) {
    if (element === undefined) return

    if (this._elementToObject.has(element)) {
      return this._elementToObject.get(element)
    }

    const instances = this.document.getInstanceFromElement(element)
    const meshes = this.getMeshesFromInstances(instances)

    const result = new Object(this, element, instances, meshes)
    this._elementToObject.set(element, result)
    return result
  }

  /**
   * Enumerates all objects of the vim
   */
  * getAllObjects () {
    for (const e of this.document.getAllElements()) {
      yield this.getObjectFromElement(e)
    }
  }

  private getMeshesFromElement (index: number) {
    const instances = this.document.getInstanceFromElement(index)
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
