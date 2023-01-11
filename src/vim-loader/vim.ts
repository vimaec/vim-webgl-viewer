/**
 * @module vim-loader
 */

import * as THREE from 'three'
import { IDocument } from './document'
import { Scene } from './scene'
import { VimConfig } from './vimSettings'
import { Object } from './object'

/**
 * Container for the built three meshes and the vim data from which it was built.
 * Dispenses Objects for high level scene manipulation
 */
export class Vim {
  source: string | undefined
  readonly document: IDocument
  settings: VimConfig

  scene: Scene
  private _elementToObject: Map<number, Object> = new Map<number, Object>()

  constructor (vim: IDocument, scene: Scene, settings: VimConfig) {
    this.document = vim
    this.scene = scene
    this.scene.vim = this
    this.settings = settings
    this.scene.applyMatrix4(this.settings.matrix)
  }

  /**
   * Disposes of all resources.
   */
  dispose () {
    this.scene.dispose()
  }

  /**
   * Reloads the vim with only the instances provided
   * @param instances g3d instance indices to keep
   */
  filter (instances?: number[]) {
    if (!this.document.g3d) return
    const next = this.scene.builder.createFromG3d(
      this.document.g3d,
      this.settings.transparency,
      instances
    )
    this.scene.dispose()

    next.applyMatrix4(this.settings.matrix)
    next.vim = this
    this.scene = next
    for (const [element, object] of this._elementToObject.entries()) {
      object.updateMeshes(this.getMeshesFromElement(element))
    }
  }

  loadMore (flagTest: (flag: number) => boolean) {
    if (!this.document.g3d) return
    const more = this.scene.builder.createFromFlag(this.document.g3d, flagTest)
    more.vim = this
    more.applyMatrix4(this.settings.matrix)
    return more
  }

  /**
   * Applies new settings to the vim
   */
  applySettings (settings: VimConfig) {
    this.settings = settings
    this.scene.applyMatrix4(this.settings.matrix)
  }

  /**
   * Returns vim matrix
   */
  getMatrix () {
    return this.settings.matrix
  }

  /**
   * Returns vim object from given mesh and index
   * @param mesh three mesh
   * @param index instanced mesh index or merged mesh submesh index
   */
  getObjectFromMesh (mesh: THREE.Mesh, index: number) {
    const element = this.getElementFromMesh(mesh, index)
    if (!element) return
    return this.getObjectFromElement(element)
  }

  /**
   * Returns vim object from given instance
   * @param instance g3d instance index
   */
  getObjectFromInstance (instance: number) {
    const element = this.document.getElementFromInstance(instance)
    if (!element) return
    return this.getObjectFromElement(element)
  }

  /**
   * Returns an array of vim objects matching given vim element Id
   * @param id vim element Id
   */
  getObjectsFromElementId (id: number) {
    const elements = this.document.getElementsFromElementId(id)
    return elements
      ?.map((e) => this.getObjectFromElement(e))
      .filter((o): o is Object => o !== undefined)
  }

  /**
   * Returns vim object from given vim element index
   * @param element vim element index
   */
  getObjectFromElement (element: number): Object | undefined {
    if (!this.document.hasElement(element)) return

    if (this._elementToObject.has(element)) {
      return this._elementToObject.get(element)
    }

    const instances = this.document.getInstancesFromElement(element)
    const meshes = this.getMeshesFromInstances(instances)

    const result = new Object(this, element, instances, meshes)
    this._elementToObject.set(element, result)
    return result
  }

  /**
   * Returns an array with all vim objects strictly contained in given box.
   */
  getObjectsInBox (box: THREE.Box3) {
    const result: Object[] = []

    for (const obj of this.getAllObjects()) {
      const b = obj.getBoundingBox()
      if (!b) continue
      if (box.containsBox(b)) {
        result.push(obj)
      }
    }
    return result
  }

  /**
   * Enumerates all objects of the vim
   */
  * getAllObjects () {
    for (const e of this.document.getAllElements()) {
      const obj = this.getObjectFromElement(e)
      if (obj) yield obj
    }
  }

  private getMeshesFromElement (element: number) {
    const instances = this.document.getInstancesFromElement(element)
    if (!instances) return
    return this.getMeshesFromInstances(instances)
  }

  private getMeshesFromInstances (instances: number[] | undefined) {
    if (!instances?.length) return

    const meshes: [THREE.Mesh, number][] = []
    for (let i = 0; i < instances.length; i++) {
      const instance = instances[i]
      if (instance < 0) continue
      const pairs = this.scene.getMeshFromInstance(instance)
      pairs?.forEach((p) => meshes.push(p))
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
  private getElementFromMesh (mesh: THREE.Mesh, index: number) {
    if (!mesh || index < 0) return
    const instance = this.scene.getInstanceFromMesh(mesh, index)
    if (!instance) return
    return this.document.getElementFromInstance(instance)
  }
}
