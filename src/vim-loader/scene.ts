/**
 * @module vim-loader
 */

import * as THREE from 'three'
import { Mesh, StandardSubmesh, Submesh } from './mesh'
import { SceneBuilder } from './sceneBuilder'
import { Vim } from './vim'
import { estimateBytesUsed } from 'three/examples/jsm/utils/BufferGeometryUtils'
import { InsertableMesh } from './progressive/insertableMesh'
import { InsertableSubmesh } from './progressive/insertableSubmesh'
import { SignalDispatcher } from 'ste-signals'
import { InstancedMesh } from './progressive/instancedMesh'
import { Renderer } from '../vim-webgl-viewer/rendering/renderer'
import { IRenderer } from '../vim'

/**
 * A Scene regroups many Meshes
 * It keep tracks of the global bounding box as Meshes are added
 * It keeps a map from g3d instance indices to Meshes and vice versa
 */
export class Scene {
  // Dependencies
  readonly builder: SceneBuilder
  private _renderer: IRenderer
  private _vim: Vim | undefined
  private _matrix = new THREE.Matrix4()

  // State
  insertables = new Array<InsertableMesh>()
  meshes: (Mesh | InsertableMesh | InstancedMesh)[] = []

  private _outlineCount: number = 0
  private _boundingBox: THREE.Box3

  private _instanceToMeshes: Map<number, Submesh[]> = new Map()
  private _material: THREE.Material | undefined

  constructor (builder: SceneBuilder | undefined, matrix: THREE.Matrix4) {
    this._matrix = matrix
    this.builder = builder
  }

  setDirty () {
    this.renderer?.notifySceneUpdate()
  }

  hasOutline () {
    return this._outlineCount > 0
  }

  addOutline () {
    this._outlineCount++
    this.setDirty()
  }

  removeOutline () {
    this._outlineCount--
    this.setDirty()
  }

  clearUpdateFlag () {
    this.insertables.forEach((mesh) => mesh.clearUpdate())
  }

  /**
   * Returns the scene bounding box. Returns undefined if scene is empty.
   */
  getBoundingBox (target: THREE.Box3 = new THREE.Box3()) {
    return this._boundingBox ? target.copy(this._boundingBox) : undefined
  }

  updateBox (box: THREE.Box3) {
    if (box !== undefined) {
      const b = box.clone().applyMatrix4(this._matrix)
      this._boundingBox = this._boundingBox?.union(b) ?? b
      this.renderer?.updateBox(this._boundingBox)
    }
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
    return this._instanceToMeshes.get(instance)
  }

  getMeshesFromInstances (instances: number[] | undefined) {
    if (!instances?.length) return

    const meshes: Submesh[] = []
    for (let i = 0; i < instances.length; i++) {
      const instance = instances[i]
      if (instance < 0) continue
      const submeshes = this.getMeshFromInstance(instance)
      submeshes?.forEach((s) => meshes.push(s))
    }
    if (meshes.length === 0) return
    return meshes
  }

  get renderer () {
    return this._renderer
  }

  set renderer (value: IRenderer) {
    this._renderer = value
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

  addSubmesh (submesh: Submesh) {
    const meshes = this._instanceToMeshes.get(submesh.instance) ?? []
    meshes.push(submesh)
    this._instanceToMeshes.set(submesh.instance, meshes)
    this.setDirty()
    if (this.vim) {
      const obj = this.vim.getObjectFromInstance(submesh.instance)
      obj.addMesh(submesh)
    }
  }

  /**
   * Add an instanced mesh to the Scene and recomputes fields as needed.
   * @param mesh Is expected to have:
   * userData.instances = number[] (indices of the g3d instances that went into creating the mesh)
   * userData.boxes = THREE.Box3[] (bounding box of each instance)
   */
  addMesh (mesh: Mesh | InsertableMesh | InstancedMesh) {
    this.renderer?.add(mesh.mesh)
    mesh.vim = this.vim

    mesh.mesh.matrixAutoUpdate = false
    mesh.mesh.matrix.copy(this._matrix)
    this.updateBox(mesh.boundingBox)

    mesh.getSubmeshes().forEach((s) => this.addSubmesh(s))
    mesh.setMaterial(this.material)

    this.meshes.push(mesh)
    this.setDirty()
    return this
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

    if (other._boundingBox) {
      this._boundingBox =
        this._boundingBox?.union(other._boundingBox) ??
        other._boundingBox.clone()
    }

    this.setDirty()
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
    this.setDirty()
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
