import * as THREE from 'three'

export class VimSceneGeometry {
  meshes: THREE.Mesh[]
  boundingSphere: THREE.Sphere
  nodeIndexToMeshInstance: Map<number, [THREE.Mesh, number]>
  meshIdToNodeIndex: Map<number, number[]>

  constructor (
    meshes: THREE.Mesh[],
    boundingSphere: THREE.Sphere,
    nodeIndexToMeshInstance: Map<number, [THREE.Mesh, number]>,
    meshIdToNodeIndex: Map<number, number[]>
  ) {
    this.meshes = meshes
    this.boundingSphere = boundingSphere
    this.nodeIndexToMeshInstance = nodeIndexToMeshInstance
    this.meshIdToNodeIndex = meshIdToNodeIndex
  }

  getMeshCount (): number {
    return this.meshes.length
  }

  addMesh (mesh: THREE.Mesh, nodes: number[]) {
    this.meshes.push(mesh)
    nodes.forEach((node) => {
      this.nodeIndexToMeshInstance.set(node, [mesh, 0])
    })
    this.meshIdToNodeIndex.set(mesh.id, nodes)

    if (!mesh.geometry.boundingSphere) {
      console.log('Bounding sphere undefined.')
      return
    }

    this.boundingSphere =
      this.boundingSphere?.union(mesh.geometry.boundingSphere) ??
      mesh.geometry.boundingSphere
  }
}
