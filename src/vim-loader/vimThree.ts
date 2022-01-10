import * as THREE from 'three'

export class VimThree {
  meshes: THREE.Mesh[]
  boundingBox: THREE.Box3
  nodeIndexToMeshInstance: Map<number, [THREE.Mesh, number][]>
  meshIdToNodeIndex: Map<number, number[]>

  constructor (
    meshes: THREE.Mesh[],
    boundingBox: THREE.Box3,
    nodeIndexToMeshInstance: Map<number, [THREE.Mesh, number]>,
    meshIdToNodeIndex: Map<number, number[]>
  ) {
    this.meshes = meshes
    this.boundingBox = boundingBox
    this.nodeIndexToMeshInstance = new Map<number, [THREE.Mesh, number][]>()
    nodeIndexToMeshInstance.forEach((value, key) => {
      const values: [THREE.Mesh, number][] = []
      values.push(value)
      this.nodeIndexToMeshInstance.set(key, values)
    })

    this.meshIdToNodeIndex = meshIdToNodeIndex
  }

  addMesh (mesh: THREE.Mesh, nodes: number[]) {
    this.meshes.push(mesh)
    nodes.forEach((node) => {
      const values: [THREE.Mesh, number][] = []
      values.push([mesh, 0])
      this.nodeIndexToMeshInstance.set(node, values)
    })
    this.meshIdToNodeIndex.set(mesh.id, nodes)

    if (!mesh.geometry.boundingBox) {
      console.error('Bounding box undefined.')
      return
    }

    // update the scene bounding box to include this mesh
    this.boundingBox =
      this.boundingBox?.union(mesh.geometry.boundingBox) ??
      mesh.geometry.boundingBox.clone()
  }

  merge (other: VimThree) {
    other.meshes.forEach((mesh) => this.meshes.push(mesh))
    other.nodeIndexToMeshInstance.forEach((value, key) => {
      const values = this.nodeIndexToMeshInstance.get(key) ?? []
      value.forEach((pair) => values.push(pair))
      this.nodeIndexToMeshInstance.set(key, value)
    })
    other.meshIdToNodeIndex.forEach((value, key) => {
      this.meshIdToNodeIndex.set(key, value)
    })
    this.boundingBox =
      this.boundingBox?.union(other.boundingBox) ?? other.boundingBox.clone()
  }
}
