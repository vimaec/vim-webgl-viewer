/**
 * @module vim-loader
 */

import * as THREE from 'three'
import { G3d } from './g3d'
import * as vimGeometry from './geometry'
import { MaterialLibrary, getDefaultMaterialLibrary } from './materials'

/**
 * Builds meshes from the g3d and BufferGeometry
 * Allows to reuse the same material for all new built meshes
 */
export class MeshBuilder {
  materials: MaterialLibrary

  constructor (materials: MaterialLibrary = undefined) {
    this.materials = materials ?? getDefaultMaterialLibrary()
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
      const geometry = vimGeometry.createGeometryFromMesh(g3d, mesh, useAlpha)
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
    const material = useAlpha
      ? this.materials.transparent
      : this.materials.opaque

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
      ? vimGeometry.MeshMerger.createFromInstances(g3d, instances, transparency)
      : vimGeometry.MeshMerger.createFromUniqueMeshes(g3d, transparency)

    const geometry = merger.toBufferGeometry()
    const material = vimGeometry.transparencyRequiresAlpha(transparency)
      ? this.materials.transparent
      : this.materials.opaque

    const mesh = new THREE.Mesh(geometry, material)
    mesh.userData.merged = true
    mesh.userData.instances = merger.getInstances()
    mesh.userData.submeshes = merger.getSubmeshes()

    return mesh
  }

  /**
   * Create a wireframe mesh from g3d instance indices
   * @param instances g3d instance indices to be included in the merged mesh. All mergeable meshes if undefined.
   * @returns a THREE.Mesh
   */
  createWireframe (g3d: G3d, instances: number[]) {
    const geometry = vimGeometry.createGeometryFromInstances(g3d, instances)
    const wireframe = new THREE.WireframeGeometry(geometry)
    return new THREE.LineSegments(wireframe, this.materials.wireframe)
  }
}

let defaultBuilder: MeshBuilder
export function getDefaultBuilder () {
  return defaultBuilder ?? (defaultBuilder = new MeshBuilder())
}
