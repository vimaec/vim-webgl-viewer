/**
 * @module vim-loader
 */

import * as THREE from 'three'
import { G3d, G3dMesh, G3dMaterial, MeshSection, G3dScene } from 'vim-format'
import { InstancedMesh } from './instancedMesh'
import { ViewerMaterials } from '../materials/viewerMaterials'
import { Geometry } from '../geometry'

export class InstancedMeshFactory {
  materials: G3dMaterial

  constructor (materials: G3dMaterial) {
    this.materials = materials
  }

  createTransparent (mesh: G3dMesh, instances: number[]) {
    return this.createFromVimx(mesh, instances, 'transparent', true)
  }

  createOpaque (mesh: G3dMesh, instances: number[]) {
    return this.createFromVimx(mesh, instances, 'opaque', false)
  }

  createOpaqueFromVim (g3d: G3d, mesh: number, instances: number[]) {
    return this.createFromVim(g3d, mesh, instances, 'opaque', false)
  }

  createTransparentFromVim (g3d: G3d, mesh: number, instances: number[]) {
    return this.createFromVim(g3d, mesh, instances, 'transparent', true)
  }

  createFromVimx (
    mesh: G3dMesh,
    instances: number[],
    section: MeshSection,
    transparent: boolean
  ) {
    if (mesh.getIndexCount(section) <= 1) {
      return undefined
    }

    const geometry = this.createGeometry(
      this.computeIndices(mesh, section),
      this.computeVertices(mesh, section),
      this.computeColors(mesh, section, transparent ? 4 : 3)
    )

    const material = transparent
      ? ViewerMaterials.getInstance().transparent
      : ViewerMaterials.getInstance().opaque

    const threeMesh = new THREE.InstancedMesh(
      geometry,
      material.material,
      instances.length
    )

    this.setMatricesFromVimx(threeMesh, mesh.scene, instances)
    const result = new InstancedMesh(mesh, threeMesh, instances)
    return result
  }

  createFromVim (
    g3d: G3d,
    mesh: number,
    instances: number[] | undefined,
    section: MeshSection,
    transparent: boolean
  ) {
    const geometry = Geometry.createGeometryFromMesh(
      g3d,
      mesh,
      section,
      transparent
    )
    const material = transparent
      ? ViewerMaterials.getInstance().transparent
      : ViewerMaterials.getInstance().opaque

    const threeMesh = new THREE.InstancedMesh(
      geometry,
      material.material,
      instances?.length ?? g3d.getMeshInstanceCount(mesh)
    )

    this.setMatricesFromVimx(threeMesh, g3d, instances)
    const result = new InstancedMesh(g3d, threeMesh, instances)
    return result
  }

  private createGeometry (
    indices: THREE.Uint32BufferAttribute,
    positions: THREE.Float32BufferAttribute,
    colors: THREE.Float32BufferAttribute
  ) {
    const geometry = new THREE.BufferGeometry()
    geometry.setIndex(indices)
    geometry.setAttribute('position', positions)
    geometry.setAttribute('color', colors)
    return geometry
  }

  private computeIndices (mesh: G3dMesh, section: MeshSection) {
    const indexStart = mesh.getIndexStart(section)
    const indexCount = mesh.getIndexCount(section)
    const vertexOffset = mesh.getVertexStart(section)
    const indices = new Uint32Array(indexCount)
    for (let i = 0; i < indexCount; i++) {
      indices[i] = mesh.chunk.indices[indexStart + i] - vertexOffset
    }
    return new THREE.Uint32BufferAttribute(indices, 1)
  }

  private computeVertices (mesh: G3dMesh, section: MeshSection) {
    const vertexStart = mesh.getVertexStart(section)
    const vertexEnd = mesh.getVertexEnd(section)
    const vertices = mesh.chunk.positions.subarray(
      vertexStart * G3d.POSITION_SIZE,
      vertexEnd * G3d.POSITION_SIZE
    )
    return new THREE.Float32BufferAttribute(vertices, G3d.POSITION_SIZE)
  }

  private computeColors (
    mesh: G3dMesh,
    section: MeshSection,
    colorSize: number
  ) {
    const colors = new Float32Array(mesh.getVertexCount(section) * colorSize)

    let c = 0
    const submeshStart = mesh.getSubmeshStart(section)
    const submeshEnd = mesh.getSubmeshEnd(section)
    for (let sub = submeshStart; sub < submeshEnd; sub++) {
      const mat = mesh.chunk.submeshMaterial[sub]
      const color = this.materials.getMaterialColor(mat)
      const subVertexCount = mesh.getSubmeshVertexCount(sub)

      for (let i = 0; i < subVertexCount; i++) {
        colors[c] = color[0]
        colors[c + 1] = color[1]
        colors[c + 2] = color[2]
        if (colorSize > 3) {
          colors[c + 3] = color[3]
        }
        c += colorSize
      }
    }
    return new THREE.Float32BufferAttribute(colors, colorSize)
  }

  private setMatricesFromVimx (
    three: THREE.InstancedMesh,
    source: G3dScene | G3d,
    instances: number[]
  ) {
    const matrix = new THREE.Matrix4()
    for (let i = 0; i < instances.length; i++) {
      const array = source.getInstanceMatrix(instances[i])
      matrix.fromArray(array)
      three.setMatrixAt(i, matrix)
    }
  }
}
