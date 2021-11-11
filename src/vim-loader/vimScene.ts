import * as THREE from 'three'
import { BufferGeometryBuilder } from './VIMLoader'
import { Vim } from './vim'
import { VimSceneGeometry } from './vimSceneGeometry'

export class VimScene {
  vim: Vim
  geometry: VimSceneGeometry
  geometryBuilder: BufferGeometryBuilder
  elementToNodes: Map<number, number[]>

  constructor (
    vim: Vim,
    geometry: VimSceneGeometry,
    geometryBuilder: BufferGeometryBuilder
  ) {
    this.vim = vim
    this.geometry = geometry
    this.geometryBuilder = geometryBuilder
    this.elementToNodes = this.mapElements()
  }

  private mapElements (): Map<number, number[]> {
    const nodeCount = this.geometry.getNodeCount()
    const map = new Map<number, number[]>()
    for (let i = 0; i < nodeCount; i++) {
      const elementId = this.getElementIdFromNodeIndex(i)
      if (elementId === undefined) continue

      const nodes = map.get(elementId)
      if (nodes) {
        nodes.push(i)
      } else {
        map.set(elementId, [i])
      }
    }
    return map
  }

  getElementTable = (from: any = this.vim.bim) =>
    from.get(Vim.tableElement) ?? from.get(Vim.tableElementLegacy)

  getNodeTable = (from: any = this.vim.bim) => from.get(Vim.tableNode)

  getNodeIndicesFromElement (elementId: number): number[] | undefined {
    return this.elementToNodes.get(elementId)
  }

  getMeshesFromElement (elementId: number): [THREE.Mesh, number][] | undefined {
    const nodeIndices = this.getNodeIndicesFromElement(elementId)
    if (!nodeIndices || !nodeIndices.length) return

    const result: [THREE.Mesh, number][] = []
    nodeIndices.forEach((i) => {
      result.push(this.getMeshFromNodeIndex(i)!)
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

    const elements = this.getElementTable(node)
    if (!elements) return

    return elements[nodeIndex]
  }

  getElementIdFromNodeIndex (nodeIndex: number): number | undefined {
    if (nodeIndex < 0) throw new Error('Invalid negative node index')

    const elementIndex = this.getElementIndexFromNodeIndex(nodeIndex)
    if (elementIndex === undefined) return

    const ids = this.getElementTable()?.get('Id')
    if (!ids) return

    return ids[elementIndex]
  }

  // TODO add better ways to access bim
  getElementNameFromNodeIndex (nodeIndex: number): string | undefined {
    if (nodeIndex < 0) throw new Error('Invalid negative node index')

    const elementIndex = this.getElementIndexFromNodeIndex(nodeIndex)
    if (elementIndex === undefined) return

    const names = this.getElementTable().get('Name')
    if (!names) return

    const nameIndex = names[elementIndex] as number

    return this.getStringFromIndex(nameIndex)
  }

  getStringFromIndex (stringIndex: number): string | undefined {
    if (stringIndex < 0) throw new Error('Invalid negative string index')

    return this.vim.strings[stringIndex]
  }
}
