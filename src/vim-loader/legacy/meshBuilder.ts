/**
 * @module vim-loader
 */

import * as THREE from 'three'
import { G3d, MeshSection } from 'vim-format'
import { Geometry, Transparency, MergeArgs } from '../geometry'
import { ViewerMaterials } from '../materials/viewerMaterials'
import { Mesh } from '../mesh'

export type InstancingArgs = {
  matrix: THREE.Matrix4
  legacyInstances: number[]
  legacyLoadRooms: boolean
  transparency: Transparency.Mode
}

/**
 * Builds meshes from the g3d and BufferGeometry
 * Allows to reuse the same material for all new built meshes
 */
export class MeshBuilder {
  readonly materials: ViewerMaterials

  constructor (materials?: ViewerMaterials) {
    this.materials = materials ?? new ViewerMaterials()
  }

  /**
   * Creates Instanced Meshes from the g3d data
   * @param transparency Specify wheter color is RBG or RGBA and whether material is opaque or transparent
   * @param instances instance indices from the g3d for which meshes will be created.
   *  If undefined, all multireferenced meshes will be created.
   * @returns an array of THREE.InstancedMesh
   */
  createInstancedMeshes (g3d: G3d, args: InstancingArgs) {
    const result: (Mesh | undefined)[] = []
    const set = args.legacyInstances ? new Set(args.legacyInstances) : undefined

    for (let mesh = 0; mesh < g3d.getMeshCount(); mesh++) {
      let meshInstances = g3d.meshInstances[mesh]
      if (!meshInstances?.length) continue

      if (set) {
        meshInstances = meshInstances.filter((i) => set.has(i))
      }
      if (!args.legacyLoadRooms) {
        meshInstances = meshInstances.filter(
          (i) => !g3d.getInstanceHasFlag(i, 1)
        )
      }

      if (meshInstances.length <= 1) continue

      const createMesh = (section: MeshSection, transparent: boolean) => {
        const count = g3d.getMeshSubmeshCount(mesh, section)
        if (count <= 0) return
        const geometry = Geometry.createGeometryFromMesh(
          g3d,
          mesh,
          section,
          transparent
        )
        return this.createInstancedMesh(
          geometry,
          g3d,
          meshInstances,
          transparent
        )
      }

      switch (args.transparency ?? 'all') {
        case 'all': {
          result.push(createMesh('opaque', false))
          result.push(createMesh('transparent', true))
          break
        }
        case 'allAsOpaque': {
          result.push(createMesh('all', false))
          break
        }
        case 'opaqueOnly': {
          result.push(createMesh('opaque', false))
          break
        }
        case 'transparentOnly': {
          result.push(createMesh('transparent', true))
          break
        }
      }
    }
    const filter = result.filter((m): m is Mesh => !!m)
    return filter
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

    const mesh = new THREE.InstancedMesh(
      geometry,
      material.material,
      instances.length
    )
    geometry.computeBoundingBox()

    const boxes: THREE.Box3[] = []
    for (let i = 0; i < instances.length; i++) {
      const matrix = Geometry.getInstanceMatrix(g3d, instances[i])
      mesh.setMatrixAt(i, matrix)
      boxes[i] = geometry.boundingBox!.clone().applyMatrix4(matrix)
    }
    const nodes = instances.map((i) => g3d.instanceNodes[i])
    const result = Mesh.createInstanced(mesh, nodes, boxes)
    return result
  }

  /**
   * Create a merged mesh from g3d instance indices
   * @param transparency Specify wheter color is RBG or RGBA and whether material is opaque or transparent
   * @param instances g3d instance indices to be included in the merged mesh. All mergeable meshes if undefined.
   * @returns a VIM.Mesh or undefined if the mesh would be empty
   */
  createMergedMesh (g3d: G3d, args: MergeArgs) {
    const merge = args.legacyInstances
      ? Geometry.mergeInstanceMeshes(g3d, args)
      : Geometry.mergeUniqueMeshes(g3d, args)
    if (!merge) return

    const material = args.transparent
      ? this.materials.transparent
      : this.materials.opaque

    const mesh = new THREE.Mesh(merge.geometry, material.material)
    const nodes = merge.instances.map((i) => g3d.instanceNodes[i])
    const result = Mesh.createMerged(mesh, nodes, merge.boxes, merge.submeshes)

    return result
  }

  /**
   * Create a wireframe mesh from g3d instance indices
   * @param instances g3d instance indices to be included in the merged mesh. All mergeable meshes if undefined.
   * @returns a THREE.Mesh
   */
  createWireframe (g3d: G3d, instances: number[]) {
    const geometry = Geometry.createGeometryFromInstances(g3d, {
      matrix: new THREE.Matrix4(),
      section: 'all',
      transparent: false,
      legacyInstances: instances,
      legacyLoadRooms: true
    })
    if (!geometry) return
    const wireframe = new THREE.WireframeGeometry(geometry)
    return new THREE.LineSegments(wireframe, this.materials.wireframe)
  }
}
