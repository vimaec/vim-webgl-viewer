import * as THREE from 'three'
import { Vim } from './vim'
import { Model } from './model'

/**
 * Container for the built three meshes and the vim data from which it was built.
 * Maps between BIM data and Three objects
 * Provides an interface to access BIM data.
 */
export class BimModel {
  vim: Vim
  model: Model
  elementIndexToInstanceIndices: Map<number, number[]>
  elementIdToElementIndex: Map<number, number>

  constructor (vim: Vim, model: Model) {
    this.vim = vim
    this.model = model
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

  getElementIndexFromElementId = (elementId: number): number | undefined =>
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
    this.getIndexColumn(table, Vim.tableElement, 'Element') ??
    table?.get(Vim.tableElementLegacy) // Backwards compatible call with vim0.9

  getElementTable = () =>
    this.vim.entities?.get(Vim.tableElement) ??
    this.vim.entities?.get(Vim.tableElementLegacy)

  getNodeTable = () => this.vim.entities.get(Vim.tableNode)

  /**
   * Get Node/Instance Indices for given element index
   * @param elementIndex element index for which to get node indices
   * @returns array of node indices or undefined if no corresponding nodes
   */
  getNodeIndicesFromElementIndex (elementIndex: number): number[] | undefined {
    return this.elementIndexToInstanceIndices.get(elementIndex)
  }

  /**
   * Get Node/Instance Indices for given element indices
   * @param elementIndex element indices for which to get node indices
   * @returns array of node indices, can be empty if no matching nodes
   */
  getNodeIndicesFromElementIndices (elementIndices: number[]): number[] {
    return elementIndices
      .flatMap((e) => this.getNodeIndicesFromElementIndex(e))
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
      .map((id) => this.getElementIndexFromElementId(id))
      .filter((i): i is number => i !== undefined)

    // element indices -> nodes indices
    return this.getNodeIndicesFromElementIndices(elementIndices)
  }

  getMeshesFromElementIndex (
    elementIndex: number
  ): [THREE.Mesh, number][] | null {
    const nodeIndices = this.getNodeIndicesFromElementIndex(elementIndex)
    if (!nodeIndices || !nodeIndices.length) return null

    const result: [THREE.Mesh, number][] = []
    nodeIndices.forEach((i) => {
      const mesh = this.getMeshFromNodeIndex(i)
      if (mesh) result.push(mesh)
    })
    return result
  }

  getMeshFromNodeIndex (nodeIndex: number): [THREE.Mesh, number] | undefined {
    if (nodeIndex < 0) throw new Error('Invalid negative index')
    const array = this.model.InstanceIndexToThreeMesh.get(nodeIndex)
    return array ? array[0] : undefined
  }

  getNodeIndexFromMesh (mesh: THREE.Mesh, instance: number): number {
    if (!mesh || instance < 0) return -1
    const nodes = this.model.ThreeMeshIdToInstance.get(mesh.id)
    if (!nodes) return -1
    return nodes[instance]
  }

  getElementIndexFromMesh (mesh: THREE.Mesh, instance: number): number {
    if (!mesh || instance < 0) return -1
    const nodeIndex = this.getNodeIndexFromMesh(mesh, instance)
    return this.getElementIndexFromNodeIndex(nodeIndex)
  }

  getElementIndexFromNodeIndex (nodeIndex: number): number {
    if (nodeIndex < 0) return -1
    const node = this.getNodeTable()
    if (!node) return -1
    const elements = this.getElementIndices(node)
    if (!elements) return -1
    return elements[nodeIndex]
  }

  getElementIdFromNodeIndex (nodeIndex: number): number {
    if (nodeIndex < 0) return -1
    const elementIndex = this.getElementIndexFromNodeIndex(nodeIndex)
    if (elementIndex < 0) return -1
    const ids = this.getIntColumn(this.getElementTable(), 'Id')
    if (!ids) return -1
    return ids[elementIndex]
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
    return stringIndex < 0 ? '' : this.vim.strings[stringIndex]
  }
}
