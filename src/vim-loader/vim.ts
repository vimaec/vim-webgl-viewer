/**
 * Final result of loading a Vim.
 * @module vim-loader
 */

import * as THREE from 'three'
import { Document } from './document'
import { Scene } from './scene'
import { VimObject } from './vimObject'

/**
 * Container for the built three meshes and the vim data from which it was built.
 * Maps between BIM data and Three objects
 * Provides an interface to access BIM data.
 */
export class Vim {
  document: Document
  scene: Scene
  matrix: THREE.Matrix4 = new THREE.Matrix4()
  index: number
  elementIndexToInstanceIndices: Map<number, number[]>
  elementIdToElementIndex: Map<number, number>
  elementToObjects: Map<number, VimObject> = new Map<number, VimObject>()

  constructor (vim: Document, scene: Scene) {
    this.document = vim
    this.scene = scene
    this.elementIndexToInstanceIndices = this.mapElementIndexToInstanceIndices()
    this.elementIdToElementIndex = this.mapElementIdToIndex()
  }

  private mapElementIndexToInstanceIndices (): Map<number, number[]> {
    const map = new Map<number, number[]>()
    const nodeElements = this.getElementIndices(this.getNodeTable())
    const nodeCount = nodeElements.length

    for (let node = 0; node < nodeCount; node++) {
      const element = nodeElements[node]
      if (element === undefined) continue

      const nodes = map.get(element)
      if (nodes) {
        nodes.push(node)
      } else {
        map.set(element, [node])
      }
    }
    return map
  }

  private mapElementIdToIndex (): Map<number, number> {
    const map = new Map<number, number>()
    const elementIds = this.getIntColumn(this.getElementTable(), 'Id')

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

  applyMatrix4 (matrix: THREE.Matrix4) {
    this.matrix = matrix
    this.scene.applyMatrix4(matrix)
  }

  setIndex (index: number) {
    this.index = index
    this.scene.setIndex(index)
  }

  getObjectFromMesh (mesh: THREE.Mesh, index: number) {
    const element = this.getElementFromMesh(mesh, index)
    return this.getObjectFromElement(element)
  }

  getObjectFromInstance (instance: number) {
    const element = this.getElemenFromInstance(instance)
    return this.getObjectFromElement(element)
  }

  getObjectFromElementId (id: number) {
    const element = this.getElementFromId(id)
    return this.getObjectFromElement(element)
  }

  getObjectFromElement (index: number) {
    if (this.elementToObjects.has(index)) {
      return this.elementToObjects.get(index)
    }

    const instances = this.getInstanceIndicesFromElementIndex(index)
    const meshes = this.getMeshesFromInstances(instances)
    if (!meshes) return

    const result = new VimObject(this, index, instances, meshes)
    this.elementToObjects.set(index, result)
    return result
  }

  getMeshesFromInstances (instances: number[]) {
    if (!instances?.length) return

    const meshes: [THREE.Mesh, number][] = []
    for (let i = 0; i < instances.length; i++) {
      const instance = instances[i]
      if (instance < 0) continue
      const [mesh, index] = this.getMeshFromInstanceIndex(instance)
      if (!mesh) continue
      meshes.push([mesh, index])
    }
    if (meshes.length === 0) return
    return meshes
  }

  getElementFromId = (elementId: number): number | undefined =>
    this.elementIdToElementIndex.get(elementId)

  getStringColumn = (table: any, colNameNoPrefix: string): number[] =>
    table?.get('string:' + colNameNoPrefix)

  getIndexColumn = (table: any, tableName: string, fieldName: string) =>
    table?.get(`index:${tableName}:${fieldName}`)

  getDataColumn = (table: any, typePrefix: any, colNameNoPrefix: any) =>
    table?.get(typePrefix + colNameNoPrefix) ??
    table?.get('numeric:' + colNameNoPrefix) // Backwards compatible call with vim0.9

  getIntColumn = (table: any, colNameNoPrefix: string) =>
    this.getDataColumn(table, 'int:', colNameNoPrefix)

  getByteColumn = (table: any, colNameNoPrefix: string) =>
    this.getDataColumn(table, 'byte:', colNameNoPrefix)

  getFloatColumn = (table: any, colNameNoPrefix: string) =>
    this.getDataColumn(table, 'float:', colNameNoPrefix)

  getDoubleColumn = (table: any, colNameNoPrefix: string) =>
    this.getDataColumn(table, 'double:', colNameNoPrefix)

  getElementIndices = (table: any): number[] =>
    this.getIndexColumn(table, Document.tableElement, 'Element') ??
    table?.get(Document.tableElementLegacy) // Backwards compatible call with vim0.9

  getElementTable = () =>
    this.document.entities?.get(Document.tableElement) ??
    this.document.entities?.get(Document.tableElementLegacy)

  getNodeTable = () => this.document.entities.get(Document.tableNode)

  /**
   * Get Node/Instance Indices for given element index
   * @param elementIndex element index for which to get node indices
   * @returns array of node indices or undefined if no corresponding nodes
   */
  getInstanceIndicesFromElementIndex (
    elementIndex: number
  ): number[] | undefined {
    return this.elementIndexToInstanceIndices.get(elementIndex)
  }

  /**
   * Get Node/Instance Indices for given element indices
   * @param elementIndex element indices for which to get node indices
   * @returns array of node indices, can be empty if no matching nodes
   */
  getNodeIndicesFromElementIndices (elementIndices: number[]): number[] {
    return elementIndices
      .flatMap((e) => this.getInstanceIndicesFromElementIndex(e))
      .filter((n): n is number => n !== undefined)
  }

  /**
   * Get Instance Indices for given element ids
   * Throws error if argument is undefined
   * @param elementIds element ids for which to get node indices
   * @returns array of node indices, can be empty if no matching nodes
   */
  getInstanceIndicesFromElementIds (elementIds: number[]): number[] {
    if (!elementIds) throw new Error('undefined argument')

    // element ids -> element indices
    const elementIndices = elementIds
      .map((id) => this.getElementFromId(id))
      .filter((i): i is number => i !== undefined)

    // element indices -> nodes indices
    return this.getNodeIndicesFromElementIndices(elementIndices)
  }

  getMeshFromInstanceIndex (nodeIndex: number): [THREE.Mesh, number] | [] {
    if (nodeIndex < 0) throw new Error('Invalid negative index')
    const array = this.scene.instanceToThreeMesh.get(nodeIndex)
    return array ?? []
  }

  /**
   * Returns the index of the g3d instance that from which this mesh instance was created
   * @param mesh a mesh created by the vim loader
   * @param index if merged mesh the index into the merged mesh, if instance mesh the instance index.
   * @returns a g3d instance index.
   */
  getInstanceFromMesh (mesh: THREE.Mesh, index: number): number {
    if (!mesh || index < 0) return -1
    const nodes = this.scene.threeMeshIdToInstances.get(mesh.id)
    if (!nodes) return -1
    return nodes[index]
  }

  /**
   * Get the element index related to given mesh
   * @param mesh instanced mesh
   * @param index index into the instanced mesh
   * @returns index of element
   */
  getElementFromMesh (mesh: THREE.Mesh, instance: number): number {
    if (!mesh || instance < 0) return -1
    const nodeIndex = this.getInstanceFromMesh(mesh, instance)
    return this.getElemenFromInstance(nodeIndex)
  }

  /**
   * Returns the element index associated with the g3d instance index.
   * @param instance g3d instance index
   * @returns element index or -1 if not found
   */
  getElemenFromInstance (instance: number): number {
    if (instance < 0) return -1
    const node = this.getNodeTable()
    if (!node) return -1
    const elements = this.getElementIndices(node)
    if (!elements) return -1
    return elements[instance]
  }

  // TODO add better ways to access bim
  getElementName (elementIndex: number): string {
    if (elementIndex < 0) return ''
    const names = this.getStringColumn(this.getElementTable(), 'Name')
    if (!names) return ''
    const nameIndex = names[elementIndex] as number
    return this.getStringFromIndex(nameIndex)
  }

  getStringFromIndex (stringIndex: number): string {
    return stringIndex < 0 ? '' : this.document.strings[stringIndex]
  }
}
