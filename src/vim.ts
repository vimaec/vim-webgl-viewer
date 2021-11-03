import * as THREE from 'three'
import { BFast } from './bfast'
import { VimG3d } from './g3d'
import { GeometryBufferBuilder } from './VIMLoader'

class Vim {
  static tableElement = 'Vim.Element'
  static tableNode = 'Vim.Node'

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
  meshes: THREE.Mesh[]
  boundingSphere: THREE.Sphere
  nodeIndexToMeshInstance: Map<number, [THREE.Mesh, number]>
  meshIdToNodeIndex: Map<number, [number]>

  constructor (
    meshes: THREE.Mesh[],
    boundingSphere: THREE.Sphere,
    nodeIndexToMeshInstance: Map<number, [THREE.Mesh, number]>,
    meshIdToNodeIndex: Map<number, [number]>
  ) {
    this.meshes = meshes
    this.boundingSphere = boundingSphere
    this.nodeIndexToMeshInstance = nodeIndexToMeshInstance
    this.meshIdToNodeIndex = meshIdToNodeIndex
  }

  getNodeCount (): number {
    return this.nodeIndexToMeshInstance.size
  }

  getMeshCount (): number {
    return this.meshes.length
  }
}

class VimScene {
  vim: Vim
  geometry: VimSceneGeometry
  geometryBuilder: GeometryBufferBuilder
  elementToNodes: Map<number, number[]>

  constructor (
    vim: Vim,
    geometry: VimSceneGeometry,
    geometryBuilder: GeometryBufferBuilder
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
      const elementId = this.getElementIdFromNodeIndex(i)!
      const nodes = map.get(elementId)
      if (nodes) {
        nodes.push(i)
      } else {
        map.set(elementId, [i])
      }
    }
    return map
  }

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

    return this.vim.bim.get(Vim.tableNode).get(Vim.tableElement)[nodeIndex]
  }

  getElementIdFromNodeIndex (nodeIndex: number): number | undefined {
    if (nodeIndex < 0) throw new Error('Invalid negative node index')

    const elementIndex = this.getElementIndexFromNodeIndex(nodeIndex)
    if (elementIndex === undefined) return

    return this.vim.bim.get(Vim.tableElement).get('Id')[elementIndex]
  }

  // TODO add better ways to access bim
  getElementNameFromNodeIndex (nodeIndex: number): string | undefined {
    if (nodeIndex < 0) throw new Error('Invalid negative node index')

    const elementIndex = this.getElementIndexFromNodeIndex(nodeIndex)
    if (elementIndex === undefined) return

    const nameIndex = this.vim.bim.get(Vim.tableElement).get('Name')[
      elementIndex
    ]

    return this.getStringFromIndex(nameIndex as number)
  }

  getStringFromIndex (stringIndex: number): string | undefined {
    if (stringIndex < 0) throw new Error('Invalid negative string index')

    return this.vim.strings[stringIndex]
  }
}

export { Vim, VimScene, VimSceneGeometry }
