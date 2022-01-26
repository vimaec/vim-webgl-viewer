import * as THREE from 'three'
import { G3d } from './g3d'
import * as vimGeometry from './geometry'
import { MeshBuilder } from './mesh'

/**
 * A model regroups many THREE.Meshes
 * It keep tracks of the global bounding box as Meshes are added
 * It keeps a map from g3d instance indices to THREE.Mesh and vice versa
 */
export class Model {
  meshes: THREE.Mesh[] = []
  boundingBox: THREE.Box3 = new THREE.Box3()
  InstanceIndexToThreeMesh: Map<number, [THREE.Mesh, number][]> = new Map()
  ThreeMeshIdToInstance: Map<number, number[]> = new Map()

  /**
   * Add an instanced mesh to the model and recomputes fields as needed.
   * @param mesh Is expected to have userData.instances = number[]
   * where numbers are the indices of the g3d instances that went into creating the mesh
   */
  addMergedMesh (mesh: THREE.Mesh) {
    const instances = mesh.userData.instances
    if (!instances) {
      throw new Error('Expected mesh to have userdata instances : number[]')
    }

    for (let i = 0; i < instances.length; i++) {
      this.InstanceIndexToThreeMesh.set(instances[i], [[mesh, 0]])
    }

    mesh.geometry.computeBoundingBox()
    const box = mesh.geometry.boundingBox!
    this.boundingBox = this.boundingBox?.union(box) ?? box.clone()

    this.ThreeMeshIdToInstance.set(mesh.id, instances)
    this.meshes.push(mesh)
    return this
  }

  /**
   * Add an instanced mesh to the model and recomputes fields as needed.
   * @param mesh Is expected to have userData.instances = number[]
   * where numbers are the indices of the g3d instances that went into creating the mesh
   */
  addInstancedMesh (mesh: THREE.InstancedMesh) {
    this.registerInstancedMesh(mesh)
    this.meshes.push(mesh)
    return this
  }

  /**
   * Creates a model from given mesh array. Keeps a reference to the array.
   * @param meshes members are expected to have userData.instances = number[]
   * where numbers are the indices of the g3d instances that went into creating each mesh
   */
  static fromInstancedMeshes (meshes: THREE.InstancedMesh[]) {
    const model = new Model()

    for (let m = 0; m < meshes.length; m++) {
      model.registerInstancedMesh(meshes[m])
    }
    model.meshes = meshes
    return model
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
      this.InstanceIndexToThreeMesh.set(instances[i], [[mesh, i]])
    }
    const box = this.computeIntancedMeshBoundingBox(mesh)!
    this.boundingBox = this.boundingBox?.union(box) ?? box.clone()
    this.ThreeMeshIdToInstance.set(mesh.id, instances)
  }

  /**
   * Adds the content of other model to this model and recomputes fields as needed.
   */
  merge (other: Model) {
    other.meshes.forEach((mesh) => this.meshes.push(mesh))
    other.InstanceIndexToThreeMesh.forEach((value, key) => {
      const values = this.InstanceIndexToThreeMesh.get(key) ?? []
      value.forEach((pair) => values.push(pair))
      this.InstanceIndexToThreeMesh.set(key, value)
    })
    other.ThreeMeshIdToInstance.forEach((value, key) => {
      this.ThreeMeshIdToInstance.set(key, value)
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
   * Creates a new Model from a g3d by merging mergeble meshes and instancing instantiable meshes
   * @param transparency Specify whether color is RBG or RGBA and whether material is opaque or transparent
   * @param instances g3d instance indices to be included in the model. All if undefined.
   */
  static fromG3d (
    g3d: G3d,
    transparency: vimGeometry.TransparencyMode = 'all',
    instances: number[] | undefined = undefined
  ): Model {
    return createModelFromG3d(g3d, transparency, instances)
  }
}

/**
 * Creates a new Model from a g3d by merging mergeble meshes and instancing instantiable meshes
 * @param transparency Specify whether color is RBG or RGBA and whether material is opaque or transparent
 * @param instances g3d instance indices to be included in the model. All if undefined.
 */
export function createModelFromG3d (
  g3d: G3d,
  transparency: vimGeometry.TransparencyMode = 'all',
  instances: number[] | undefined = undefined
): Model {
  const model = new Model()
  const builder = new MeshBuilder()

  // Add shared geometry
  const shared = createModelFromInstanciabledMeshes(
    g3d,
    transparency,
    instances,
    builder
  )
  model.merge(shared)

  // Add opaque geometry
  if (transparency !== 'transparentOnly') {
    const opaque = createModelFromMergeableMeshes(
      g3d,
      transparency === 'allAsOpaque' ? 'allAsOpaque' : 'opaqueOnly',
      instances,
      builder
    )
    model.merge(opaque)
  }

  // Add transparent geometry
  if (vimGeometry.transparencyRequiresAlpha(transparency)) {
    const transparent = createModelFromMergeableMeshes(
      g3d,
      'transparentOnly',
      instances,
      builder
    )
    model.merge(transparent)
  }

  return model
}
/**
 * Creates a Model from instantiable meshes from the g3d
 * @param transparency Specify whether color is RBG or RGBA and whether material is opaque or transparent
 * @param instances g3d instance indices to be included in the model. All if undefined.
 * @param builder optional builder to reuse the same materials
 */
export function createModelFromInstanciabledMeshes (
  g3d: G3d,
  transparency: vimGeometry.TransparencyMode,
  instances: number[] | undefined = undefined,
  builder: MeshBuilder = new MeshBuilder()
) {
  const meshes = builder.createInstancedMeshes(g3d, transparency, instances)
  return Model.fromInstancedMeshes(meshes)
}
// g3d instance indices to be included in the merged mesh. All mergeable meshes if undefined.
/**
 * Creates a Model from mergeable meshes from the g3d
 * @param transparency Specify whether color is RBG or RGBA and whether material is opaque or transparent
 * @param instances g3d instance indices to be included in the model. All if undefined.
 * @param builder optional builder to reuse the same materials
 */
export function createModelFromMergeableMeshes (
  g3d: G3d,
  transparency: vimGeometry.TransparencyMode,
  instances: number[] | undefined = undefined,
  builder: MeshBuilder = new MeshBuilder()
) {
  const mesh = builder.createMergedMesh(g3d, transparency, instances)
  return new Model().addMergedMesh(mesh)
}
