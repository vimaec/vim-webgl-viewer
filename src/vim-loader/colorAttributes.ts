/**
 * @module vim-loader
 */

import * as THREE from 'three'
import { MergedSubmesh, SimpleMesh } from './mesh'
import { Vim } from './vim'
import { InsertableSubmesh } from './progressive/insertableSubmesh'
import { AttributeTarget } from './objectAttributes'

export class ColorAttribute {
  readonly vim: Vim
  private _meshes: AttributeTarget[] | undefined
  private _value: THREE.Color | undefined

  constructor (
    meshes: AttributeTarget[] | undefined,
    value: THREE.Color | undefined,
    vim: Vim | undefined
  ) {
    this._meshes = meshes
    this._value = value
    this.vim = vim
  }

  updateMeshes (meshes: AttributeTarget[] | undefined) {
    this._meshes = meshes
    if (this._value !== undefined) {
      this.apply(this._value)
    }
  }

  get value () {
    return this._value
  }

  apply (color: THREE.Color | undefined) {
    this._value = color
    if (!this._meshes) return

    for (let m = 0; m < this._meshes.length; m++) {
      const sub = this._meshes[m]
      if (sub.merged) {
        this.applyMergedColor(sub as MergedSubmesh, color)
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
  private applyMergedColor (sub: MergedSubmesh, color: THREE.Color | undefined) {
    if (!color) {
      this.resetMergedColor(sub)
      return
    }

    const start = sub.meshStart
    const end = sub.meshEnd

    const colors = sub.three.geometry.getAttribute(
      'color'
    ) as THREE.BufferAttribute

    const indices = sub.three.geometry.index!

    // Save colors to be able to reset.
    if (sub instanceof InsertableSubmesh) {
      let c = 0
      const previous = new Float32Array((end - start) * 3)
      for (let i = start; i < end; i++) {
        const v = indices.getX(i)
        previous[c++] = colors.getX(v)
        previous[c++] = colors.getY(v)
        previous[c++] = colors.getZ(v)
      }
      sub.saveColors(previous)
    }

    for (let i = start; i < end; i++) {
      const v = indices.getX(i)
      // alpha is left to its current value
      colors.setXYZ(v, color.r, color.g, color.b)
    }
    colors.needsUpdate = true
    colors.updateRange.offset = 0
    colors.updateRange.count = -1
  }

  /**
   * Repopulates the color buffer of the merged mesh from original g3d data.
   * @param index index of the merged mesh instance
   */
  private resetMergedColor (sub: MergedSubmesh) {
    if (!this.vim) return
    if (sub instanceof InsertableSubmesh) {
      this.resetMergedInsertableColor(sub)
      return
    }
    if (sub instanceof SimpleMesh) {
      return
    }

    const colors = sub.three.geometry.getAttribute(
      'color'
    ) as THREE.BufferAttribute

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
    colors.updateRange.offset = 0
    colors.updateRange.count = -1
  }

  private resetMergedInsertableColor (sub: InsertableSubmesh) {
    const previous = sub.popColors()
    if (previous === undefined) return

    const indices = sub.three.geometry.index!
    const colors = sub.three.geometry.getAttribute(
      'color'
    ) as THREE.BufferAttribute

    let c = 0
    for (let i = sub.meshStart; i < sub.meshEnd; i++) {
      const v = indices.getX(i)
      colors.setXYZ(v, previous[c], previous[c + 1], previous[c + 2])
      c += 3
    }

    colors.needsUpdate = true
    colors.updateRange.offset = 0
    colors.updateRange.count = -1
  }

  /**
   * Adds an instanceColor buffer to the instanced mesh and sets new color for given instance
   * @param index index of the instanced instance
   * @param color rgb representation of the color to apply
   */
  private applyInstancedColor (sub: AttributeTarget, color: THREE.Color | undefined) {
    const colors = this.getOrAddInstanceColorAttribute(
      sub.three as THREE.InstancedMesh
    )
    if (color) {
      // Set instance to use instance color provided
      colors.setXYZ(sub.index, color.r, color.g, color.b)
      // Set attributes dirty
      colors.needsUpdate = true
      colors.updateRange.offset = 0
      colors.updateRange.count = -1
    }
  }

  private getOrAddInstanceColorAttribute (mesh: THREE.InstancedMesh) {
    if (mesh.instanceColor &&
      mesh.instanceColor.count <= mesh.instanceMatrix.count
    ) {
      return mesh.instanceColor
    }

    // mesh.count is not always === to capacity so we use instanceMatrix.count
    const count = mesh.instanceMatrix.count
    // Add color instance attribute
    const colors = new Float32Array(count * 3)
    const attribute = new THREE.InstancedBufferAttribute(colors, 3)
    mesh.instanceColor = attribute
    return attribute
  }
}
