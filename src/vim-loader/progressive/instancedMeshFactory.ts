import * as THREE from 'three'
import { G3d, G3dMesh, G3dMaterial, MeshSection } from 'vim-format'
import { Settings, Vim, VimMaterials, VimSettings } from '../../vim'
import { InstancedMesh } from './instancedMesh'

export class InstancedMeshFactory {
  settings: VimSettings
  materials: G3dMaterial

  constructor (settings: VimSettings, materials: G3dMaterial) {
    this.materials = materials
    this.settings = settings
  }

  createTransparent (mesh: G3dMesh, instances: number[]) {
    return this.create(mesh, instances, 'transparent', true)
  }

  createOpaque (mesh: G3dMesh, instances: number[]) {
    return this.create(mesh, instances, 'opaque', false)
  }

  create (
    mesh: G3dMesh,
    instances: number[] | undefined,
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
      ? VimMaterials.getInstance().transparent
      : VimMaterials.getInstance().opaque

    const threeMesh = new THREE.InstancedMesh(
      geometry,
      material.material,
      instances?.length ?? mesh.instanceNodes.length
    )

    this.setMatrices(threeMesh, mesh, instances)
    const result = new InstancedMesh(
      threeMesh,
      pick(mesh.instanceNodes, instances)
    )
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
      indices[i] = mesh.indices[indexStart + i] - vertexOffset
    }
    return new THREE.Uint32BufferAttribute(indices, 1)
  }

  private computeVertices (mesh: G3dMesh, section: MeshSection) {
    const vertexStart = mesh.getVertexStart(section)
    const vertexEnd = mesh.getVertexEnd(section)
    const vertices = mesh.positions.subarray(
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
      const mat = mesh.submeshMaterial[sub]
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

  private setMatrices (
    three: THREE.InstancedMesh,
    mesh: G3dMesh,
    instances: number[] | undefined
  ) {
    const matrix = new THREE.Matrix4()
    const addMesh = (instance: number, at: number) => {
      const array = mesh.getInstanceMatrix(instance)
      matrix.fromArray(array)
      three.setMatrixAt(at, matrix)
    }
    if (instances) {
      instances.forEach((instance, i) => addMesh(instance, i))
    } else {
      mesh.instanceNodes.forEach((n, i) => addMesh(i, i))
    }
  }
}

function pick (array: ArrayLike<number>, at: number[] | undefined) {
  return at?.map((i) => array[i]) ?? array
}