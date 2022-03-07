/**
 * @module vim-loader
 */

import * as THREE from 'three'
import { G3d } from './g3d'
import { Transparency } from './geometry'
import { Mesh } from './mesh'

/**
 * A Scene regroups many THREE.Meshes
 * It keep tracks of the global bounding box as Meshes are added
 * It keeps a map from g3d instance indices to THREE.Mesh and vice versa
 */
export class Scene {
  meshes: THREE.Mesh[] = []
  boundingBox: THREE.Box3 = new THREE.Box3()
  private _instanceToThreeMesh: Map<number, [THREE.Mesh, number]> = new Map()
  private _threeMeshIdToInstances: Map<number, number[]> = new Map()

  /**
   * Returns the THREE.Mesh in which this instance is represented along with index
   * For merged mesh, index refers to submesh index
   * For instanced mesh, index refers to instance index.
   */
  getMeshFromInstance (instance: number) {
    return this._instanceToThreeMesh.has(instance)
      ? this._instanceToThreeMesh.get(instance)
      : []
  }

  /**
   * Returns the index of the g3d instance that from which this mesh instance was created
   * @param mesh a mesh created by the vim loader
   * @param index if merged mesh the index into the merged mesh, if instance mesh the instance index.
   * @returns a g3d instance index.
   */
  getInstanceFromMesh (mesh: THREE.Mesh, index: number): number {
    if (!mesh || index < 0) return -1
    const instances = this._threeMeshIdToInstances.get(mesh.id)
    if (!instances) return -1
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
  setIndex (index: number) {
    for (let m = 0; m < this.meshes.length; m++) {
      this.meshes[m].userData.index = index
    }
  }

  swapInstances (mesh: THREE.InstancedMesh, indexA: number, indexB: number) {
    const array = this._threeMeshIdToInstances.get(mesh.id)
    if (!array) throw new Error('Could not find mesh with id : ' + mesh.id)
    if (indexA === indexB) return

    const matrixA = new THREE.Matrix4()
    const matrixB = new THREE.Matrix4()
    mesh.getMatrixAt(indexA, matrixA)
    mesh.getMatrixAt(indexB, matrixB)
    mesh.setMatrixAt(indexA, matrixB)
    mesh.setMatrixAt(indexB, matrixA)

    const instanceA = array[indexA]
    const instanceB = array[indexB]

    this._instanceToThreeMesh.get(instanceA)[1] = indexB
    this._instanceToThreeMesh.get(instanceB)[1] = indexA
    array[indexA] = instanceB
    array[indexB] = instanceA
    mesh.instanceMatrix.needsUpdate = true
  }

  /**
   * Add an instanced mesh to the Scene and recomputes fields as needed.
   * @param mesh Is expected to have userData.instances = number[]
   * where numbers are the indices of the g3d instances that went into creating the mesh
   */
  addMergedMesh (mesh: THREE.Mesh) {
    const instances = mesh.userData.instances
    if (!instances) {
      throw new Error('Expected mesh to have userdata instances : number[]')
    }

    for (let i = 0; i < instances.length; i++) {
      this._instanceToThreeMesh.set(instances[i], [mesh, i])
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

  /**
   * Creates a Scene from given mesh array. Keeps a reference to the array.
   * @param meshes members are expected to have userData.instances = number[]
   * where numbers are the indices of the g3d instances that went into creating each mesh
   */
  static createFromInstancedMeshes (meshes: THREE.InstancedMesh[]) {
    const scene = new Scene()

    for (let m = 0; m < meshes.length; m++) {
      scene.registerInstancedMesh(meshes[m])
    }
    scene.meshes = meshes
    return scene
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
      this._instanceToThreeMesh.set(instances[i], [mesh, i])
    }
    const box = this.computeIntancedMeshBoundingBox(mesh)!
    this.boundingBox = this.boundingBox?.union(box) ?? box.clone()
    this._threeMeshIdToInstances.set(mesh.id, instances)
  }

  /**
   * Adds the content of other Scene to this Scene and recomputes fields as needed.
   */
  merge (other: Scene) {
    other.meshes.forEach((mesh) => this.meshes.push(mesh))
    other._instanceToThreeMesh.forEach((value, key) => {
      this._instanceToThreeMesh.set(key, value)
    })
    other._threeMeshIdToInstances.forEach((value, key) => {
      this._threeMeshIdToInstances.set(key, value)
    })
    this.boundingBox =
      this.boundingBox?.union(other.boundingBox) ?? other.boundingBox.clone()
    return this
  }

  dispose () {
    for (let i = 0; i < this.meshes.length; i++) {
      this.meshes[i].geometry.dispose()
    }
    this.meshes.length = 0
    this._instanceToThreeMesh.clear()
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

  /**
   * Creates a new Scene from a g3d by merging mergeble meshes and instancing instantiable meshes
   * @param transparency Specify whether color is RBG or RGBA and whether material is opaque or transparent
   * @param instances g3d instance indices to be included in the Scene. All if undefined.
   */
  static createFromG3d (
    g3d: G3d,
    transparency: Transparency.Mode = 'all',
    instances: number[] | undefined = undefined
  ): Scene {
    const scene = new Scene()

    // Add shared geometry
    const shared = Scene.createFromInstanciableMeshes(
      g3d,
      transparency,
      instances
    )
    scene.merge(shared)

    // Add opaque geometry
    if (transparency !== 'transparentOnly') {
      const opaque = Scene.createFromMergeableMeshes(
        g3d,
        transparency === 'allAsOpaque' ? 'allAsOpaque' : 'opaqueOnly',
        instances
      )
      scene.merge(opaque)
    }

    // Add transparent geometry
    if (Transparency.requiresAlpha(transparency)) {
      const transparent = Scene.createFromMergeableMeshes(
        g3d,
        'transparentOnly',
        instances
      )
      scene.merge(transparent)
    }

    return scene
  }

  /**
   * Creates a Scene from instantiable meshes from the g3d
   * @param transparency Specify whether color is RBG or RGBA and whether material is opaque or transparent
   * @param instances g3d instance indices to be included in the Scene. All if undefined.
   * @param builder optional builder to reuse the same materials
   */
  static createFromInstanciableMeshes (
    g3d: G3d,
    transparency: Transparency.Mode,
    instances: number[] | undefined = undefined,
    builder: Mesh.Builder = Mesh.getDefaultBuilder()
  ) {
    const meshes = builder.createInstancedMeshes(g3d, transparency, instances)
    return Scene.createFromInstancedMeshes(meshes)
  }

  // g3d instance indices to be included in the merged mesh. All mergeable meshes if undefined.
  /**
   * Creates a Scene from mergeable meshes from the g3d
   * @param transparency Specify whether color is RBG or RGBA and whether material is opaque or transparent
   * @param instances g3d instance indices to be included in the Scene. All if undefined.
   * @param builder optional builder to reuse the same materials
   */
  static createFromMergeableMeshes (
    g3d: G3d,
    transparency: Transparency.Mode,
    instances: number[] | undefined = undefined,
    builder: Mesh.Builder = Mesh.getDefaultBuilder()
  ) {
    const mesh = builder.createMergedMesh(g3d, transparency, instances)
    return new Scene().addMergedMesh(mesh)
  }
}
