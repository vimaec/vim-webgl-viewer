// external
import * as THREE from 'three'

export class VimObject {
  element: number
  instances: number[]
  mergedMeshes: [THREE.Mesh, number, number][]
  instancedMeshes: [THREE.InstancedMesh, number][]
  overrides: THREE.Mesh[] = []

  constructor (
    element: number,
    instances: number[],
    mergedMeshes: [THREE.Mesh, number, number][],
    instancedMeshes: [THREE.InstancedMesh, number][]
  ) {
    this.element = element
    this.instances = instances
    this.mergedMeshes = mergedMeshes
    this.instancedMeshes = instancedMeshes
  }

  changeColor () {
    this.changeColorMerged()
    this.changeColorInstanced()
  }

  changeColorMerged () {
    for (let m = 0; m < this.mergedMeshes.length; m++) {
      const [mesh, start, end] = this.mergedMeshes[m]
      const colors = mesh.geometry.getAttribute('color')
      const indices = mesh.geometry.getIndex()
      for (let i = start; i < end; i++) {
        const v = indices.getX(i)
        colors.setXYZ(v, 1, 0, 0)
      }
      colors.needsUpdate = true
    }
  }

  changeColorInstanced () {
    for (let m = 0; m < this.instancedMeshes.length; m++) {
      const [mesh, index] = this.instancedMeshes[m]
      const result = new THREE.Mesh()
      result.geometry = mesh.geometry
      mesh.getMatrixAt(index, result.matrix)

      const material = (mesh.material as THREE.MeshPhongMaterial).clone()
      material.vertexColors = false
      material.opacity = 0.5
      material.color.setRGB(1, 0, 0)
      result.material = material
      this.overrides.push(result)
    }
    this.hideInstanced()
  }

  hide () {}
  hideMerged () {}
  hideInstanced () {
    for (let m = 0; m < this.instancedMeshes.length; m++) {
      const matrix = new THREE.Matrix4()
      const [mesh, index] = this.instancedMeshes[m]
      mesh.getMatrixAt(index, matrix)
      matrix.setPosition(100000, 100000, 100000)
      mesh.setMatrixAt(index, matrix)
      mesh.instanceMatrix.needsUpdate = true
      // mesh.ma()
    }
  }
}
