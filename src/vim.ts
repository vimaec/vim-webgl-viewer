import * as THREE from 'three'
import { BFast } from './bfast'
import { VimG3d } from './g3d'

type Mesh = THREE.InstancedMesh<THREE.BufferGeometry, THREE.Material>

class Vim {
  header: string
  assets: BFast
  g3d: VimG3d
  bim: any
  strings: string[]

  constructor (
    header: string,
    assets: BFast,
    g3d: VimG3d,
    entities: any,
    strings: string[]
  ) {
    this.header = header
    this.assets = assets
    this.g3d = g3d
    this.bim = entities
    this.strings = strings
  }
}

class VimSceneGeometry {
  meshes: Mesh[]
  boundingSphere: THREE.Sphere
  nodeIndexToMeshInstance: Map<number, [Mesh, number]>
  meshIdToNodeIndex: Map<number, [number]>

  constructor (
    meshes: Mesh[],
    boundingSphere: THREE.Sphere,
    nodeIndexToMeshInstance: Map<number, [Mesh, number]>,
    meshIdToNodeIndex: Map<number, [number]>
  ) {
    this.meshes = meshes
    this.boundingSphere = boundingSphere
    this.nodeIndexToMeshInstance = nodeIndexToMeshInstance
    this.meshIdToNodeIndex = meshIdToNodeIndex
  }
}

class VimScene {
  vim: Vim
  geometry: VimSceneGeometry
  elementToNodes: Map<number, number[]>

  constructor (vim: Vim, geometry: VimSceneGeometry) {
    this.vim = vim
    this.geometry = geometry
    this.elementToNodes = this.mapElements()
  }

  private mapElements (): Map<number, number[]> {
    const nodeCount = this.getNodeCount()
    if (nodeCount <= 0) return null

    const map = new Map<number, number[]>()
    for (let i = 0; i < nodeCount; i++) {
      const elementId = this.getElementIdFromNodeIndex(i)
      if (map.has(elementId)) {
        map.get(elementId).push(i)
      } else {
        map.set(elementId, [i])
      }
    }
    return map
  }

  getNodeCount (): number {
    return this.geometry.nodeIndexToMeshInstance.size
  }

  getNodeIndicesFromElement (elementId: number): number[] | null {
    return this.elementToNodes?.has(elementId)
      ? this.elementToNodes.get(elementId)
      : null
  }

  getMeshesFromElement (elementId: number): number[] | [Mesh, number][] {
    const result: [Mesh, number][] = []
    const nodeIndices = this.getNodeIndicesFromElement(elementId)
    nodeIndices.forEach((i) => {
      result.push(this.getMeshFromNodeIndex(i))
    })
    return result
  }

  getMeshFromNodeIndex (nodeIndex: number): [Mesh, number] {
    return this.geometry.nodeIndexToMeshInstance.get(nodeIndex)
  }

  getNodeIndexFromMesh (mesh: THREE.Mesh, instance: number): number | null {
    return this.geometry.meshIdToNodeIndex.get(mesh.id)[instance]
  }

  getElementIdFromMesh (mesh: THREE.Mesh, instance: number): number | null {
    const nodeIndex = this.getNodeIndexFromMesh(mesh, instance)
    return nodeIndex ? this.getElementIndexFromNodeIndex(nodeIndex) : null
  }

  getElementIndexFromNodeIndex (nodeIndex: number) {
    return this.vim.bim.get('Vim.Node').get('Rvt.Element')[nodeIndex]
  }

  getElementIdFromNodeIndex (nodeIndex: number) {
    const elementIndex = this.getElementIndexFromNodeIndex(nodeIndex)
    const elementId = this.vim.bim.get('Rvt.Element').get('Id')[elementIndex]
    return elementId
  }

  // TODO add better ways to access bim
  getElementNameFromNodeIndex (nodeIndex: number) {
    const elementIndex = this.getElementIndexFromNodeIndex(nodeIndex)
    const nameIndex = this.vim.bim.get('Rvt.Element').get('Name')[elementIndex]
    return this.getStringFromIndex(nameIndex)
  }

  getStringFromIndex (stringIndex: number) {
    return this.vim.strings[stringIndex]
  }
}

export { Vim, VimScene, VimSceneGeometry }
