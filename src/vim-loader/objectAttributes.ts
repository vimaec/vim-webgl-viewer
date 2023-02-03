/**
 * @module vim-loader
 */

// external
import * as THREE from 'three'
import { Mesh, Submesh } from './mesh'
import { Vim } from './vim'

export class ObjectAttribute<T> {
  value: T
  vertexAttribute: string
  instanceAttribute: string
  private _meshes: Submesh[] | undefined
  toNumber: (value: T) => number

  constructor (
    value: T,
    vertexAttribute: string,
    instanceAttribute: string,
    meshes: Submesh[] | undefined,
    toNumber: (value: T) => number
  ) {
    this.value = value
    this.vertexAttribute = vertexAttribute
    this.instanceAttribute = instanceAttribute
    this._meshes = meshes
    this.toNumber = toNumber
  }

  apply (value: T) {
    if (this.value === value) return false
    this.value = value
    if (!this._meshes) return false
    const number = this.toNumber(value)

    for (let m = 0; m < this._meshes.length; m++) {
      const sub = this._meshes[m]
      if (sub.merged) {
        this.applyMerged(sub, number)
      } else {
        this.applyInstanced(sub, number)
      }
    }
    return true
  }

  private applyInstanced (sub: Submesh, number: number) {
    const three = sub.three as THREE.InstancedMesh
    let attribute = three.geometry.getAttribute(this.instanceAttribute)
    if (!attribute) {
      attribute = new THREE.InstancedBufferAttribute(
        new Float32Array(three.count),
        1
      )
      three.geometry.setAttribute(this.instanceAttribute, attribute)
    }
    attribute.setX(sub.index, number)
    attribute.needsUpdate = true
  }

  private applyMerged (sub: Submesh, number: number) {
    const three = sub.three
    const positions = three.geometry.getAttribute('position')
    const attribute =
      three.geometry.getAttribute(this.vertexAttribute) ??
      new THREE.Float32BufferAttribute(new Float32Array(positions.count), 1)
    three.geometry.setAttribute(this.vertexAttribute, attribute)

    const start = sub.meshStart
    const end = sub.meshEnd
    const indices = sub.three.geometry.index!

    for (let i = start; i < end; i++) {
      const v = indices.getX(i)
      attribute.setX(v, number)
    }
    attribute.needsUpdate = true
  }
}

export class ColorAttribute {
  _meshes: Submesh[] | undefined
  value: THREE.Color | undefined
  vim: Vim
  constructor (
    meshes: Submesh[] | undefined,
    value: THREE.Color | undefined,
    vim: Vim
  ) {
    this._meshes = meshes
    this.value = value
    this.vim = vim
  }

  apply (color: THREE.Color | undefined) {
    if (!this._meshes) return

    for (let m = 0; m < this._meshes.length; m++) {
      const sub = this._meshes[m]
      if (sub.merged) {
        this.applyMergedColor(sub, color)
      } else {
        this.applyInstancedColor(sub, color)
      }
    }
  }

  /**
   * Writes new color to the appropriate section of merged mesh color buffer.
   * @param index index of the merged mesh instance
   * @param color rgb representation of the color to apply
   */
  private applyMergedColor (sub: Submesh, color: THREE.Color | undefined) {
    if (!color) {
      this.resetMergedColor(sub)
      return
    }

    const start = sub.meshStart
    const end = sub.meshEnd

    const colors = sub.three.geometry.getAttribute('color')
    const indices = sub.three.geometry.index!

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
  private resetMergedColor (sub: Submesh) {
    if (!this.vim) return
    const colors = sub.three.geometry.getAttribute('color')

    const indices = sub.three.geometry.index!
    let mergedIndex = sub.meshStart

    const g3d = this.vim.g3d
    const g3dMesh = g3d.instanceMeshes[sub.instance]
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
  private applyInstancedColor (sub: Submesh, color: THREE.Color | undefined) {
    const colors = this.getOrAddInstanceColorAttribute(
      sub.three as THREE.InstancedMesh
    )
    if (color) {
      // Set instance to use instance color provided
      colors.setXYZ(sub.index, color.r, color.g, color.b)
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
