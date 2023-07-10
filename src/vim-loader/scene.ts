/**
 * @module vim-loader
 */

import * as THREE from 'three'
import { Mesh, Submesh } from './mesh'
import { SceneBuilder } from './sceneBuilder'
import { Vim } from './vim'
import { estimateBytesUsed } from 'three/examples/jsm/utils/BufferGeometryUtils'
import { InsertableMesh, InsertableSubmesh } from './insertableMesh'
import { SignalDispatcher } from 'ste-signals'

/**
 * A Scene regroups many Meshes
 * It keep tracks of the global bounding box as Meshes are added
 * It keeps a map from g3d instance indices to Meshes and vice versa
 */
export class Scene {
  // Dependencies
  readonly builder: SceneBuilder

  // State
  meshes: (Mesh | InsertableMesh)[] = []
  private _vim: Vim | undefined
  private _matrix = new THREE.Matrix4()
  private _updated: boolean = false
  private _outlineCount: number = 0

  private _boundingBox: THREE.Box3
  private _instanceToMeshes: Map<number, Submesh[]> = new Map()
  private _material: THREE.Material | undefined

  private _onUpdate = new SignalDispatcher()
  get onUpdate () {
    return this._onUpdate.asEvent()
  }

  constructor (builder: SceneBuilder | undefined) {
    this.builder = builder
  }

  get updated () {
    return this._updated
  }

  set updated (value: boolean) {
    this._updated = this._updated || value
  }

  hasOutline () {
    return this._outlineCount > 0
  }

  addOutline () {
    this._outlineCount++
    this.updated = true
  }

  removeOutline () {
    this._outlineCount--
    this.updated = true
  }

  clearUpdateFlag () {
    this._updated = false
  }

  /**
   * Returns the scene bounding box. Returns undefined if scene is empty.
   */
  getBoundingBox (target: THREE.Box3 = new THREE.Box3()) {
    return this._boundingBox ? target.copy(this._boundingBox) : undefined
  }

  getMemory () {
    return this.meshes
      .map((m) => estimateBytesUsed(m.mesh.geometry))
      .reduce((n1, n2) => n1 + n2, 0)
  }

  /**
   * Returns the THREE.Mesh in which this instance is represented along with index
   * For merged mesh, index refers to submesh index
   * For instanced mesh, index refers to instance index.
   */
  getMeshFromInstance (instance: number) {
    // TODO: Clean up this path fork.
    const result = new Array<Submesh>()
    for (const mesh of this.meshes) {
      if (mesh instanceof InsertableMesh) {
        const s = mesh.geometry.submeshes.get(instance)
        if (s !== undefined) {
          result.push(new InsertableSubmesh(mesh, s.instance))
        }
      }
    }
    if (result.length > 0) {
      return result
    }

    return this._instanceToMeshes.get(instance)
  }

  /**
   * Applies given transform matrix to all Meshes and bounding box.
   */
  applyMatrix4 (matrix: THREE.Matrix4) {
    for (let m = 0; m < this.meshes.length; m++) {
      this.meshes[m].mesh.matrixAutoUpdate = false
      this.meshes[m].mesh.matrix.copy(matrix)
    }

    // Revert previous matrix
    this._boundingBox?.applyMatrix4(this._matrix.invert())
    this._matrix.copy(matrix)
    this._boundingBox?.applyMatrix4(this._matrix)
  }

  get vim () {
    return this._vim
  }

  /**
   * Sets vim index for this scene and all its THREE.Meshes.
   */
  set vim (value: Vim) {
    this._vim = value
    this.meshes.forEach((m) => (m.vim = value))
  }

  /**
   * Add an instanced mesh to the Scene and recomputes fields as needed.
   * @param mesh Is expected to have:
   * userData.instances = number[] (indices of the g3d instances that went into creating the mesh)
   * userData.boxes = THREE.Box3[] (bounding box of each instance)
   */
  addMesh (mesh: Mesh | InsertableMesh) {
    const subs = mesh.getSubmeshes()
    subs.forEach((s) => {
      const set = this._instanceToMeshes.get(s.instance) ?? []
      set.push(s)
      this._instanceToMeshes.set(s.instance, set)
    })

    this.updateBox(mesh.boundingBox)
    if (mesh instanceof InsertableMesh) {
      mesh.onUpdate.sub(() => this.updateBox(mesh.boundingBox))
    }

    this.meshes.push(mesh)
    this.updated = true
    return this
  }

  private updateBox (box: THREE.Box3) {
    if (box !== undefined) {
      const b = box.clone().applyMatrix4(this._matrix)
      this._boundingBox = this._boundingBox?.union(b) ?? b
    }
    this._onUpdate.dispatch()
  }

  /**
   * Adds the content of other Scene to this Scene and recomputes fields as needed.
   */
  merge (other: Scene) {
    if (!other) return this
    other.meshes.forEach((mesh) => this.meshes.push(mesh))
    other._instanceToMeshes.forEach((meshes, instance) => {
      const set = this._instanceToMeshes.get(instance) ?? []
      meshes.forEach((m) => set.push(m))
      this._instanceToMeshes.set(instance, set)
    })

    this._boundingBox =
      this._boundingBox?.union(other._boundingBox) ?? other._boundingBox.clone()
    this.updated = true
    return this
  }

  /**
   * Gets the current material override or undefined if none.
   */
  get material () {
    return this._material
  }

  /**
   * Sets and apply a material override to the scene, set to undefined to remove override.
   */
  set material (value: THREE.Material | undefined) {
    if (this._material === value) return
    this.updated = true
    this._material = value
    this.meshes.forEach((m) => m.setMaterial(value))
  }

  /**
   * Disposes of all resources.
   */
  dispose () {
    for (let i = 0; i < this.meshes.length; i++) {
      this.meshes[i].mesh.geometry.dispose()
    }
    this.meshes.length = 0
    this._instanceToMeshes.clear()
  }
}
