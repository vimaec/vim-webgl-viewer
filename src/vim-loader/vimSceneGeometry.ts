import * as THREE from 'three'

export class VimSceneGeometry {
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

  addMesh (mesh: THREE.Mesh) {
    this.meshes.push(mesh)

    if (!mesh.geometry.boundingSphere) {
      console.log('Bounding sphere undefined.')
      return
    }

    this.boundingSphere =
      this.boundingSphere?.union(mesh.geometry.boundingSphere) ??
      mesh.geometry.boundingSphere
  }
}
