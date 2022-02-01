/**
 * Scene is the highest level organization of three geometry of the vim loader.
 * @module vim-loader
 */

import * as THREE from 'three'
import { G3d } from './g3d'
import * as vimGeometry from './geometry'
import { MeshBuilder } from './mesh'

/**
 * A Scene regroups many THREE.Meshes
 * It keep tracks of the global bounding box as Meshes are added
 * It keeps a map from g3d instance indices to THREE.Mesh and vice versa
 */
export class Scene {
  meshes: THREE.Mesh[] = []
  boundingBox: THREE.Box3 = new THREE.Box3()
  instanceToThreeMesh: Map<number, [THREE.Mesh, number][]> = new Map()
  threeMeshIdToInstance: Map<number, number[]> = new Map()

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
      this.instanceToThreeMesh.set(instances[i], [[mesh, i]])
    }

    mesh.geometry.computeBoundingBox()
    const box = mesh.geometry.boundingBox!
    this.boundingBox = this.boundingBox?.union(box) ?? box.clone()

    this.threeMeshIdToInstance.set(mesh.id, instances)
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
  static fromInstancedMeshes (meshes: THREE.InstancedMesh[]) {
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
      this.instanceToThreeMesh.set(instances[i], [[mesh, i]])
    }
    const box = this.computeIntancedMeshBoundingBox(mesh)!
    this.boundingBox = this.boundingBox?.union(box) ?? box.clone()
    this.threeMeshIdToInstance.set(mesh.id, instances)
  }

  /**
   * Adds the content of other Scene to this Scene and recomputes fields as needed.
   */
  merge (other: Scene) {
    other.meshes.forEach((mesh) => this.meshes.push(mesh))
    other.instanceToThreeMesh.forEach((value, key) => {
      const values = this.instanceToThreeMesh.get(key) ?? []
      value.forEach((pair) => values.push(pair))
      this.instanceToThreeMesh.set(key, value)
    })
    other.threeMeshIdToInstance.forEach((value, key) => {
      this.threeMeshIdToInstance.set(key, value)
    })
    this.boundingBox =
      this.boundingBox?.union(other.boundingBox) ?? other.boundingBox.clone()
    return this
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
  static fromG3d (
    g3d: G3d,
    transparency: vimGeometry.TransparencyMode = 'all',
    instances: number[] | undefined = undefined
  ): Scene {
    return createSceneFromG3d(g3d, transparency, instances)
  }
}

/**
 * Creates a new Scene from a g3d by merging mergeble meshes and instancing instantiable meshes
 * @param transparency Specify whether color is RBG or RGBA and whether material is opaque or transparent
 * @param instances g3d instance indices to be included in the Scene. All if undefined.
 */
export function createSceneFromG3d (
  g3d: G3d,
  transparency: vimGeometry.TransparencyMode = 'all',
  instances: number[] | undefined = undefined
): Scene {
  const scene = new Scene()
  const builder = new MeshBuilder()

  // Add shared geometry
  const shared = createSceneFromInstanciabledMeshes(
    g3d,
    transparency,
    instances,
    builder
  )
  scene.merge(shared)

  // Add opaque geometry
  if (transparency !== 'transparentOnly') {
    const opaque = createSceneFromMergeableMeshes(
      g3d,
      transparency === 'allAsOpaque' ? 'allAsOpaque' : 'opaqueOnly',
      instances,
      builder
    )
    scene.merge(opaque)
  }

  // Add transparent geometry
  if (vimGeometry.transparencyRequiresAlpha(transparency)) {
    const transparent = createSceneFromMergeableMeshes(
      g3d,
      'transparentOnly',
      instances,
      builder
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
export function createSceneFromInstanciabledMeshes (
  g3d: G3d,
  transparency: vimGeometry.TransparencyMode,
  instances: number[] | undefined = undefined,
  builder: MeshBuilder = new MeshBuilder()
) {
  const meshes = builder.createInstancedMeshes(g3d, transparency, instances)
  return Scene.fromInstancedMeshes(meshes)
}
// g3d instance indices to be included in the merged mesh. All mergeable meshes if undefined.
/**
 * Creates a Scene from mergeable meshes from the g3d
 * @param transparency Specify whether color is RBG or RGBA and whether material is opaque or transparent
 * @param instances g3d instance indices to be included in the Scene. All if undefined.
 * @param builder optional builder to reuse the same materials
 */
export function createSceneFromMergeableMeshes (
  g3d: G3d,
  transparency: vimGeometry.TransparencyMode,
  instances: number[] | undefined = undefined,
  builder: MeshBuilder = new MeshBuilder()
) {
  const mesh = builder.createMergedMesh(g3d, transparency, instances)
  return new Scene().addMergedMesh(mesh)
}
