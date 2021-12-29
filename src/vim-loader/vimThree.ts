import * as THREE from 'three'

export class VimThree {
  meshes: THREE.Mesh[]
  boundingBox: THREE.Box3
  nodeIndexToMeshInstance: Map<number, [THREE.Mesh, number]>
  meshIdToNodeIndex: Map<number, number[]>

  constructor (
    meshes: THREE.Mesh[],
    boundingBox: THREE.Box3,
    nodeIndexToMeshInstance: Map<number, [THREE.Mesh, number]>,
    meshIdToNodeIndex: Map<number, number[]>
  ) {
    this.meshes = meshes
    this.boundingBox = boundingBox
    this.nodeIndexToMeshInstance = nodeIndexToMeshInstance
    this.meshIdToNodeIndex = meshIdToNodeIndex
  }

  addMesh (mesh: THREE.Mesh, nodes: number[]) {
    this.meshes.push(mesh)
    nodes.forEach((node) => {
      this.nodeIndexToMeshInstance.set(node, [mesh, 0])
    })
    this.meshIdToNodeIndex.set(mesh.id, nodes)

    if (!mesh.geometry.boundingBox) {
      console.error('Bounding box undefined.')
      return
    }

    // update the scene bounding box to include this mesh
    this.boundingBox =
      this.boundingBox?.union(mesh.geometry.boundingBox) ??
      mesh.geometry.boundingBox
  }
}
