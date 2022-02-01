/**
 * Provides methods to create Three.Mesh from BufferGeometry and g3d geometry data.
 * @module vim-loader
 */

import * as THREE from 'three'
import { G3d } from './g3d'
import * as vimGeometry from './geometry'

/**
 * Builds meshes from the g3d and BufferGeometry
 * Allows to reuse the same material for all new built meshes
 */
export class MeshBuilder {
  private materialOpaque: THREE.Material
  private materialTransparent: THREE.Material | undefined

  constructor (
    materialOpaque?: THREE.Material,
    materialTransparent?: THREE.Material
  ) {
    this.materialOpaque = materialOpaque ?? this.createDefaultOpaqueMaterial()
    this.materialTransparent =
      materialTransparent ?? this.createDefaultTransparentMaterial()
  }

  /**
   * Creates a new instance of the default loader opaque material
   * @returns a THREE.MeshPhongMaterial
   */
  createDefaultOpaqueMaterial () {
    return new THREE.MeshPhongMaterial({
      color: 0x999999,
      vertexColors: true,
      flatShading: true,
      // TODO: experiment without being double-sided
      side: THREE.DoubleSide,
      shininess: 70
    })
  }

  /**
   * Creates a new instance of the default loader transparent material
   * @returns a THREE.MeshPhongMaterial
   */
  createDefaultTransparentMaterial () {
    const material = this.createDefaultOpaqueMaterial()
    material.transparent = true
    material.depthWrite = true
    // material.opacity = 0.3
    return material
  }

  /**
   * Creates Instanced Meshes from the g3d data
   * @param transparency Specify wheter color is RBG or RGBA and whether material is opaque or transparent
   * @param instances instance indices from the g3d for which meshes will be created.
   *  If undefined, all multireferenced meshes will be created.
   * @returns an array of THREE.InstancedMesh
   */
  createInstancedMeshes (
    g3d: G3d,
    transparency: vimGeometry.TransparencyMode,
    instances?: number[]
  ): THREE.InstancedMesh[] {
    const result: THREE.InstancedMesh[] = []
    const set = instances ? new Set(instances) : undefined
    for (let mesh = 0; mesh < g3d.getMeshCount(); mesh++) {
      let meshInstances = g3d.meshInstances[mesh]
      if (!meshInstances) continue
      meshInstances = set
        ? meshInstances.filter((i) => set.has(i))
        : meshInstances
      if (meshInstances.length <= 1) continue
      if (
        !vimGeometry.transparencyMatches(
          transparency,
          g3d.meshTransparent[mesh]
        )
      ) {
        continue
      }

      const useAlpha =
        vimGeometry.transparencyRequiresAlpha(transparency) &&
        g3d.meshTransparent[mesh]
      const geometry = vimGeometry.createFromMesh(g3d, mesh, useAlpha)
      const resultMesh = this.createInstancedMesh(
        geometry,
        g3d,
        meshInstances,
        useAlpha
      )

      result.push(resultMesh)
    }

    return result
  }

  /**
   * Creates a InstancedMesh from g3d data and given instance indices
   * @param geometry Geometry to use in the mesh
   * @param instances Instance indices for which matrices will be applied to the mesh
   * @param useAlpha Specify whether to use RGB or RGBA
   * @returns a THREE.InstancedMesh
   */
  createInstancedMesh (
    geometry: THREE.BufferGeometry,
    g3d: G3d,
    instances: number[],
    useAlpha: boolean
  ) {
    const material = useAlpha ? this.materialTransparent : this.materialOpaque

    const result = new THREE.InstancedMesh(geometry, material, instances.length)

    for (let i = 0; i < instances.length; i++) {
      const matrix = vimGeometry.getInstanceMatrix(g3d, instances[i])
      result.setMatrixAt(i, matrix)
    }
    result.userData.instances = instances
    return result
  }

  /**
   * Create a merged mesh from g3d instance indices
   * @param transparency Specify wheter color is RBG or RGBA and whether material is opaque or transparent
   * @param instances g3d instance indices to be included in the merged mesh. All mergeable meshes if undefined.
   * @returns a THREE.Mesh
   */
  createMergedMesh (
    g3d: G3d,
    transparency: vimGeometry.TransparencyMode,
    instances?: number[]
  ): THREE.Mesh {
    const merger = instances
      ? vimGeometry.MeshMerger.MergeInstances(g3d, instances, transparency)
      : vimGeometry.MeshMerger.MergeUniqueMeshes(g3d, transparency)

    const geometry = merger.toBufferGeometry()
    const material = vimGeometry.transparencyRequiresAlpha(transparency)
      ? this.materialTransparent
      : this.materialOpaque

    const mesh = new THREE.Mesh(geometry, material)
    mesh.userData.merged = true
    mesh.userData.instances = merger.instances
    mesh.userData.submeshes = merger.submeshes

    return mesh
  }
}
