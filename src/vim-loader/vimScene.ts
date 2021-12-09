import * as THREE from 'three'
import { BufferGeometryBuilder } from './VIMLoader'
import { Vim } from './vim'
import { VimSceneGeometry } from './vimSceneGeometry'

export class VimScene {
  vim: Vim
  geometry: VimSceneGeometry
  geometryBuilder: BufferGeometryBuilder
  elementIndexToNodeIndices: Map<number, number[]>
  elementIdToIndex: Map<number, number>

  constructor (
    vim: Vim,
    geometry: VimSceneGeometry,
    geometryBuilder: BufferGeometryBuilder
  ) {
    this.vim = vim
    this.geometry = geometry
    this.geometryBuilder = geometryBuilder
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

  getElementIndexFromElementId = (elementId: number) =>
    this.elementIdToIndex.get(elementId)

  getStringColumn = (table: any, colNameNoPrefix: string) =>
    table?.get('string:' + colNameNoPrefix)

  getIndexColumn = (table: any, tableName: string, fieldName: string) =>
    table?.get(`index:${tableName}:${fieldName}`)

  getDataColumn = (table: any, typePrefix, colNameNoPrefix) =>
    table?.get(typePrefix + colNameNoPrefix) ?? table?.get('numeric:' + colNameNoPrefix) // Backwards compatible call with vim0.9

  getIntColumn = (table: any, colNameNoPrefix: string) =>
    this.getDataColumn(table, 'int:', colNameNoPrefix)

  getByteColumn = (table: any, colNameNoPrefix: string) =>
    this.getDataColumn(table, 'byte:', colNameNoPrefix)

  getFloatColumn = (table: any, colNameNoPrefix: string) =>
    this.getDataColumn(table, 'float:', colNameNoPrefix)

  getDoubleColumn = (table: any, colNameNoPrefix: string) =>
    this.getDataColumn(table, 'double:', colNameNoPrefix)

  getElementIndices = (table: any) =>
    this.getIndexColumn(table, Vim.tableElement, 'Element') ?? table?.get(Vim.tableElementLegacy) // Backwards compatible call with vim0.9

  getElementTable = () =>
    this.vim.bim?.get(Vim.tableElement) ?? this.vim.bim?.get(Vim.tableElementLegacy)

  getNodeTable = () => this.vim.bim.get(Vim.tableNode)

  getNodeIndicesFromElementIndex (elementIndex: number): number[] | undefined {
    return this.elementIndexToNodeIndices.get(elementIndex)
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

    return this.geometry.nodeIndexToMeshInstance.get(nodeIndex)
  }

  getNodeIndexFromMesh (mesh: THREE.Mesh, instance: number): number | undefined {
    if (instance < 0) throw new Error('Invalid negative index')
    if (!mesh) throw new Error('Invalid null mesh')

    const nodes = this.geometry.meshIdToNodeIndex.get(mesh.id)
    if (!nodes) return

    return nodes[instance]
  }

  getElementIdFromMesh (mesh: THREE.Mesh, instance: number): number | undefined {
    if (instance < 0) throw new Error('Invalid negative index')
    if (!mesh) throw new Error('Invalid null mesh')

    const nodeIndex = this.getNodeIndexFromMesh(mesh, instance)
    if (nodeIndex === undefined) return

    return this.getElementIndexFromNodeIndex(nodeIndex)
  }

  getElementIndexFromNodeIndex (nodeIndex: number): number | undefined {
    if (nodeIndex < 0) throw new Error('Invalid negative index')

    const node = this.getNodeTable()
    if (!node) return

    const elements = this.getElementIndices(node)
    if (!elements) return

    return elements[nodeIndex]
  }

  getElementIdFromNodeIndex (nodeIndex: number): number | undefined {
    if (nodeIndex < 0) throw new Error('Invalid negative node index')

    const elementIndex = this.getElementIndexFromNodeIndex(nodeIndex)
    if (elementIndex === undefined) return

    const ids = this.getIntColumn(this.getElementTable(), 'Id')
    if (!ids) return

    return ids[elementIndex]
  }

  // TODO add better ways to access bim
  getElementName (elementIndex: number): string | undefined {
    if (elementIndex < 0) throw new Error('Invalid negative index.')

    const names = this.getStringColumn(this.getElementTable(), 'Name')
    if (!names) return

    const nameIndex = names[elementIndex] as number

    return this.getStringFromIndex(nameIndex)
  }

  getStringFromIndex (stringIndex: number): string | undefined {
    if (stringIndex < 0) throw new Error('Invalid negative string index')

    return this.vim.strings[stringIndex]
  }
}
