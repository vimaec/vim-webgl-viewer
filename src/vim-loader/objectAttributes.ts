// external
import * as THREE from 'three'
import { Float32BufferAttribute, InstancedBufferAttribute } from 'three'
import { Vim } from './vim'

export class ObjectAttribute<T> {
  value: T
  vertexAttribute: string
  instanceAttribute: string
  private _meshes: [THREE.Mesh, number][] | undefined
  toNumber: (value: T) => number

  constructor (
    value: T,
    vertexAttribute: string,
    instanceAttribute: string,
    meshes: [THREE.Mesh, number][] | undefined,
    toNumber: (value: T) => number
  ) {
    this.value = value
    this.vertexAttribute = vertexAttribute
    this.instanceAttribute = instanceAttribute
    this._meshes = meshes
    this.toNumber = toNumber
  }

  apply (value: T) {
    if (this.value === value) return
    this.value = value
    if (!this._meshes) return
    const number = this.toNumber(value)

    for (let m = 0; m < this._meshes.length; m++) {
      const [mesh, index] = this._meshes[m]
      if (mesh.userData.merged) {
        this.applyMerged(mesh, index, number)
      } else {
        this.applyInstanced(mesh as THREE.InstancedMesh, index, number)
      }
    }
  }

  private applyInstanced (
    mesh: THREE.InstancedMesh<
      THREE.BufferGeometry,
      THREE.Material | THREE.Material[]
    >,
    index: number,
    number: number
  ) {
    let attribute = mesh.geometry.getAttribute(this.instanceAttribute)
    if (!attribute) {
      attribute = new InstancedBufferAttribute(new Float32Array(mesh.count), 1)
      mesh.geometry.setAttribute(this.instanceAttribute, attribute)
    }
    attribute.setX(index, number)
    attribute.needsUpdate = true
  }

  private applyMerged (
    mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>,
    index: number,
    number: number
  ) {
    const positions = mesh.geometry.getAttribute('position')
    const attribute =
      mesh.geometry.getAttribute(this.vertexAttribute) ??
      new Float32BufferAttribute(new Float32Array(positions.count), 1)
    mesh.geometry.setAttribute(this.vertexAttribute, attribute)

    const start = getMergedMeshStart(mesh, index)
    const end = getMergedMeshEnd(mesh, index)
    const indices = mesh.geometry.index!

    for (let i = start; i < end; i++) {
      const v = indices.getX(i)
      attribute.setX(v, number)
    }
    attribute.needsUpdate = true
  }
}

export class ColorAttribute {
  _meshes: [THREE.Mesh, number][] | undefined
  value: THREE.Color
  vim: Vim
  constructor (
    meshes: [THREE.Mesh, number][] | undefined,
    value: THREE.Color,
    vim: Vim
  ) {
    this._meshes = meshes
    this.value = value
    this.vim = vim
  }

  apply (color: THREE.Color | undefined) {
    if (!this._meshes) return

    for (let m = 0; m < this._meshes.length; m++) {
      const [mesh, index] = this._meshes[m]
      if (mesh.userData.merged) {
        this.applyMergedColor(mesh, index, color)
      } else {
        this.applyInstancedColor(mesh as THREE.InstancedMesh, index, color)
      }
    }
  }

  /**
   * Writes new color to the appropriate section of merged mesh color buffer.
   * @param index index of the merged mesh instance
   * @param color rgb representation of the color to apply
   */
  private applyMergedColor (
    mesh: THREE.Mesh,
    index: number,
    color: THREE.Color | undefined
  ) {
    if (!color) {
      this.resetMergedColor(mesh, index)
      return
    }

    const start = getMergedMeshStart(mesh, index)
    const end = getMergedMeshEnd(mesh, index)

    const colors = mesh.geometry.getAttribute('color')
    const indices = mesh.geometry.index!

    for (let i = start; i < end; i++) {
      const v = indices.getX(i)
      // alpha is left to its current value
      colors.setXYZ(v, color.r, color.g, color.b)
    }
    colors.needsUpdate = true
  }

  /**
   * Repopulates the color buffer of the merged mesh from original g3d data.
   * @param index index of the merged mesh instance
   */
  private resetMergedColor (mesh: THREE.Mesh, index: number) {
    if (!this.vim) return
    const colors = mesh.geometry.getAttribute('color')

    const indices = mesh.geometry.index!
    let mergedIndex = getMergedMeshStart(mesh, index)

    const instance = this.vim.scene.getInstanceFromMesh(mesh, index)
    if (!instance) throw new Error('Could not reset original color.')
    const g3d = this.vim.document.g3d!
    const g3dMesh = g3d.instanceMeshes[instance]
    const subStart = g3d.getMeshSubmeshStart(g3dMesh)
    const subEnd = g3d.getMeshSubmeshEnd(g3dMesh)

    for (let sub = subStart; sub < subEnd; sub++) {
      const start = g3d.getSubmeshIndexStart(sub)
      const end = g3d.getSubmeshIndexEnd(sub)
      const color = g3d.getSubmeshColor(sub)
      for (let i = start; i < end; i++) {
        const v = indices.getX(mergedIndex)
        colors.setXYZ(v, color[0], color[1], color[2])
        mergedIndex++
      }
    }
    colors.needsUpdate = true
  }

  /**
   * Adds an instanceColor buffer to the instanced mesh and sets new color for given instance
   * @param index index of the instanced instance
   * @param color rgb representation of the color to apply
   */
  private applyInstancedColor (
    mesh: THREE.InstancedMesh,
    index: number,
    color: THREE.Color | undefined
  ) {
    const colors = this.getOrAddInstanceColorAttribute(mesh)
    if (color) {
      // Set instance to use instance color provided
      colors.setXYZ(index, color.r, color.g, color.b)
      // Set attributes dirty
      colors.needsUpdate = true
    }
  }

  private getOrAddInstanceColorAttribute (mesh: THREE.InstancedMesh) {
    if (mesh.instanceColor) return mesh.instanceColor
    const count = mesh.instanceMatrix.count
    // Add color instance attribute
    const colors = new Float32Array(count * 3)
    const attribute = new THREE.InstancedBufferAttribute(colors, 3)
    mesh.instanceColor = attribute
    return attribute
  }
}

/**
 * @param index index of the merged mesh instance
 * @returns inclusive first index of the index buffer related to given merged mesh index
 */
function getMergedMeshStart (mesh: THREE.Mesh, index: number) {
  return mesh.userData.submeshes[index]
}

/**
 * @param index index of the merged mesh instance
 * @returns return the last+1 index of the index buffer related to given merged mesh index
 */
function getMergedMeshEnd (mesh: THREE.Mesh, index: number) {
  return index + 1 < mesh.userData.submeshes.length
    ? mesh.userData.submeshes[index + 1]
    : mesh.geometry.index!.count
}
