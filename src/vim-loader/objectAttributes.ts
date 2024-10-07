/**
 * @module vim-loader
 */

import * as THREE from 'three'
import { MergedSubmesh, SimpleInstanceSubmesh, SimpleMesh, Submesh } from './mesh'

export type AttributeTarget = Submesh | SimpleInstanceSubmesh | SimpleMesh

export class ObjectAttribute<T> {
  readonly vertexAttribute: string
  readonly instanceAttribute: string
  readonly defaultValue: T
  readonly toNumber: (value: T) => number

  private _value: T
  private _meshes: AttributeTarget[] | undefined

  constructor (
    value: T,
    vertexAttribute: string,
    instanceAttribute: string,
    meshes: AttributeTarget[] | undefined,
    toNumber: (value: T) => number
  ) {
    this._value = value
    this.defaultValue = value
    this.vertexAttribute = vertexAttribute
    this.instanceAttribute = instanceAttribute
    this._meshes = meshes
    this.toNumber = toNumber
  }

  updateMeshes (meshes: AttributeTarget[] | undefined) {
    this._meshes = meshes
    const v = this._value
    this._value = this.defaultValue
    this.apply(v)
  }

  get value () {
    return this._value
  }

  apply (value: T) {
    if (this._value === value) return false
    this._value = value
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

  private applyInstanced (sub: AttributeTarget, number: number) {
    const mesh = sub.three as THREE.InstancedMesh
    const geometry = mesh.geometry
    let attribute = geometry.getAttribute(
      this.instanceAttribute
    ) as THREE.BufferAttribute

    if (!attribute || attribute.count < mesh.instanceMatrix.count) {
      // mesh.count is not always === to capacity so we use instanceMatrix.count
      const array = new Float32Array(mesh.instanceMatrix.count)
      attribute = new THREE.InstancedBufferAttribute(array, 1)
      geometry.setAttribute(this.instanceAttribute, attribute)
    }
    attribute.setX(sub.index, number)
    attribute.needsUpdate = true
    attribute.updateRange.offset = 0
    attribute.updateRange.count = -1
  }

  private applyMerged (sub: MergedSubmesh, number: number) {
    const geometry = sub.three.geometry
    const positions = geometry.getAttribute('position')

    let attribute = geometry.getAttribute(
      this.vertexAttribute
    ) as THREE.BufferAttribute

    if (!attribute) {
      // Computed count here is not the same as positions.count
      // Positions.count is used to tell the render up to where to render.
      const count = positions.array.length / positions.itemSize
      const array = new Float32Array(count)
      attribute = new THREE.Float32BufferAttribute(array, 1)
      geometry.setAttribute(this.vertexAttribute, attribute)
    }

    const start = sub.meshStart
    const end = sub.meshEnd
    const indices = sub.three.geometry.index!

    for (let i = start; i < end; i++) {
      const v = indices.getX(i)
      attribute.setX(v, number)
    }
    attribute.needsUpdate = true
    attribute.updateRange.offset = 0
    attribute.updateRange.count = -1
  }
}
