/**
 * @module vim-loader
 */

import * as THREE from 'three'
import { SceneBuilder } from './sceneBuilder'
import { Vim } from './vim'

/**
 * A Scene regroups many THREE.Meshes
 * It keep tracks of the global bounding box as Meshes are added
 * It keeps a map from g3d instance indices to THREE.Mesh and vice versa
 */
export class Scene {
  // Dependencies
  readonly builder: SceneBuilder

  // State
  meshes: THREE.Mesh[] = []
  boundingBox: THREE.Box3 = new THREE.Box3()
  private _instanceToThreeMeshes: Map<number, [THREE.Mesh, number][]> =
    new Map()

  private _threeMeshIdToInstances: Map<number, number[]> = new Map()
  private _material: THREE.Material | undefined

  constructor (builder: SceneBuilder) {
    this.builder = builder
  }

  /**
   * Returns the THREE.Mesh in which this instance is represented along with index
   * For merged mesh, index refers to submesh index
   * For instanced mesh, index refers to instance index.
   */
  getMeshFromInstance (instance: number) {
    return this._instanceToThreeMeshes.get(instance)
  }

  /**
   * Returns the index of the g3d instance that from which this mesh instance was created
   * @param mesh a mesh created by the vim loader
   * @param index if merged mesh the index into the merged mesh, if instance mesh the instance index.
   * @returns a g3d instance index.
   */
  getInstanceFromMesh (mesh: THREE.Mesh, index: number) {
    if (!mesh || index < 0) return
    const instances = this._threeMeshIdToInstances.get(mesh.id)
    if (!instances) return
    return instances[index]
  }

  /**
   * Applies given transform matrix to all THREE.Meshes and bounding box.
   */
  applyMatrix4 (matrix: THREE.Matrix4) {
    for (let m = 0; m < this.meshes.length; m++) {
      this.meshes[m].matrixAutoUpdate = false
      this.meshes[m].matrix.copy(matrix)
    }
    this.boundingBox.applyMatrix4(matrix)
  }

  /**
   * Sets vim index for this scene and all its THREE.Meshes.
   */
  setVim (vim: Vim) {
    for (let m = 0; m < this.meshes.length; m++) {
      this.meshes[m].userData.vim = vim
    }
  }

  /**
   * Add an instanced mesh to the Scene and recomputes fields as needed.
   * @param mesh Is expected to have userData.instances = number[]
   * where numbers are the indices of the g3d instances that went into creating the mesh
   */
  addMergedMesh (mesh: THREE.Mesh) {
    if (!mesh) return this
    const instances = mesh.userData.instances
    if (!instances) {
      throw new Error('Expected mesh to have userdata instances : number[]')
    }

    for (let i = 0; i < instances.length; i++) {
      const set = this._instanceToThreeMeshes.get(instances[i]) ?? []
      set.push([mesh, i])
      this._instanceToThreeMeshes.set(instances[i], set)
    }

    mesh.geometry.computeBoundingBox()
    const box = mesh.geometry.boundingBox!
    this.boundingBox = this.boundingBox?.union(box) ?? box.clone()

    this._threeMeshIdToInstances.set(mesh.id, instances)
    this.meshes.push(mesh)
    return this
  }

  /**
   * Add an instanced mesh to the Scene and recomputes fields as needed.
   * @param mesh Is expected to have userData.instances = number[]
   * where numbers are the indices of the g3d instances that went into creating the mesh
   */
  addInstancedMesh (mesh: THREE.InstancedMesh) {
    this.registerInstancedMesh(mesh)
    this.meshes.push(mesh)
    return this
  }

  private registerInstancedMesh (mesh: THREE.InstancedMesh) {
    const instances = mesh.userData.instances as number[]
    if (!instances || instances.length === 0) {
      throw new Error(
        'Expected mesh to have userdata instances : number[] with at least one member'
      )
    }
    if (mesh.count === 0) {
      throw new Error('Expected mesh to have at least one instance')
    }

    for (let i = 0; i < instances.length; i++) {
      const set = this._instanceToThreeMeshes.get(instances[i]) ?? []
      set.push([mesh, i])
      this._instanceToThreeMeshes.set(instances[i], set)
    }
    const box = this.computeIntancedMeshBoundingBox(mesh)!
    this.boundingBox = this.boundingBox?.union(box) ?? box.clone()
    this._threeMeshIdToInstances.set(mesh.id, instances)
  }

  /**
   * Adds the content of other Scene to this Scene and recomputes fields as needed.
   */
  merge (other: Scene) {
    if (!other) return this
    other.meshes.forEach((mesh) => this.meshes.push(mesh))
    other._instanceToThreeMeshes.forEach((meshes, instance) => {
      const set = this._instanceToThreeMeshes.get(instance) ?? []
      meshes.forEach((m) => set.push(m))
      this._instanceToThreeMeshes.set(instance, set)
    })
    other._threeMeshIdToInstances.forEach((value, key) => {
      this._threeMeshIdToInstances.set(key, value)
    })
    this.boundingBox =
      this.boundingBox?.union(other.boundingBox) ?? other.boundingBox.clone()
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
    this._material = value
    if (value) {
      this.meshes.forEach((m) => {
        if (!m.userData.mat) {
          m.userData.mat = m.material
        }
        m.material = value
      })
    } else {
      this.meshes.forEach((m) => {
        if (m.userData.mat) {
          m.material = m.userData.mat
          m.userData.mat = undefined
        }
      })
    }
  }

  dispose () {
    for (let i = 0; i < this.meshes.length; i++) {
      this.meshes[i].geometry.dispose()
    }
    this.meshes.length = 0
    this._instanceToThreeMeshes.clear()
    this._threeMeshIdToInstances.clear()
  }

  /**
   * Computes the bounding box around all instances in world position of an InstancedMesh.
   */
  private computeIntancedMeshBoundingBox (mesh: THREE.InstancedMesh) {
    let result
    const matrix = new THREE.Matrix4()
    const box = new THREE.Box3()
    mesh.geometry.computeBoundingBox()
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix)
      box.copy(mesh.geometry.boundingBox!)
      box.applyMatrix4(matrix)
      result = result ? result.union(box) : box.clone()
    }
    return result
  }
}
