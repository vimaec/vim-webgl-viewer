import * as THREE from 'three'
import { Vim } from './vim'
import { VimThree } from './vimThree'

export class VimScene {
  vim: Vim
  geometry: VimThree
  elementIndexToNodeIndices: Map<number, number[]>
  elementIdToIndex: Map<number, number>

  constructor (vim: Vim, geometry: VimThree) {
    this.vim = vim
    this.geometry = geometry
    this.elementIndexToNodeIndices = this.mapElementIndexToNodeIndices()
    this.elementIdToIndex = this.mapElementIdToIndex()
  }

  private mapElementIndexToNodeIndices (): Map<number, number[]> {
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

    for (let element = 0; element < elementIds.length; element++) {
      const id = elementIds[element]

      if (id < 0) {
        console.log('ignoring element with negative id')
        continue
      }
      if (map.has(id)) {
        console.error('duplicate id: ' + id)
        continue
      }

      map.set(id, element)
    }
    return map
  }

  getElementIndexFromElementId = (elementId: number): number | undefined =>
    this.elementIdToIndex.get(elementId)

  getStringColumn = (table: any, colNameNoPrefix: string): number[] =>
    table?.get('string:' + colNameNoPrefix)

  getIndexColumn = (table: any, tableName: string, fieldName: string) =>
    table?.get(`index:${tableName}:${fieldName}`)

  getDataColumn = (table: any, typePrefix, colNameNoPrefix) =>
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

  getElementIndices = (table: any) : number[] =>
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
    return this.elementIndexToNodeIndices.get(elementIndex)
  }

  /**
   * Get Node/Instance Indices for given element indices
   * @param elementIndex element indices for which to get node indices
   * @returns array of node indices, can be empty if no matching nodes
   */
  getNodeIndicesFromElementIndices (elementIndices: number[]): number[] {
    return elementIndices
      .flatMap((e) => this.getNodeIndicesFromElementIndex(e))
      .filter((n) => n)
  }

  /**
   * Get Node/Instance Indices for given element ids
   * Throws error if argument is undefined
   * @param elementIds element ids for which to get node indices
   * @returns array of node indices, can be empty if no matching nodes
   */
  getNodeIndicesFromElementIds (elementIds: number[]): number[] {
    if (!elementIds) throw new Error('undefined argument')

    // element ids -> element indices
    const elementIndices = elementIds
      .map((id) => this.getElementIndexFromElementId(id))
      .filter((i) => i)

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

  getMeshFromNodeIndex (nodeIndex: number): [THREE.Mesh, number] {
    if (nodeIndex < 0) throw new Error('Invalid negative index')
    return this.geometry.nodeIndexToMeshInstance.get(nodeIndex)
  }

  getNodeIndexFromMesh (mesh: THREE.Mesh, instance: number): number  {
    if (!mesh || instance < 0) return -1
    const nodes = this.geometry.meshIdToNodeIndex.get(mesh.id)
    if (!nodes) return -1
    return nodes[instance]
  }

  getElementIdFromMesh (mesh: THREE.Mesh, instance: number): number {
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

  getElementIdFromNodeIndex (nodeIndex: number): number  {
    if (nodeIndex < 0) return -1
    const elementIndex = this.getElementIndexFromNodeIndex(nodeIndex)
    if (elementIndex < 0) return -1
    const ids = this.getIntColumn(this.getElementTable(), 'Id')
    if (!ids) return -1
    return ids[elementIndex]
  }

  // TODO add better ways to access bim
  getElementName (elementIndex: number): string {
    if (elementIndex < 0) return ""
    const names = this.getStringColumn(this.getElementTable(), 'Name')
    if (!names) return ""
    const nameIndex = names[elementIndex] as number
    return this.getStringFromIndex(nameIndex)
  }

  getStringFromIndex (stringIndex: number): string {
    return stringIndex < 0 ? "" : this.vim.strings[stringIndex]  
  }
}
