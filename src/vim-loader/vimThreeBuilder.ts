/*
import * as THREE from 'three'
import { VimG3d } from './g3d'
import { VimThree } from './vimThree'
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils'
import { Logger } from './logger'

type Mesh = THREE.InstancedMesh<THREE.BufferGeometry, THREE.Material>

export class VimThreeBuilder {
  private logger: Logger | undefined
  private material: THREE.Material

  constructor (material?: THREE.Material, logger?: Logger) {
    this.material = material ?? this.createDefaultMaterial()
    this.logger = logger
  }

  createDefaultMaterial = () =>
    new THREE.MeshPhongMaterial({
      color: 0x999999,
      vertexColors: true,
      flatShading: true,
      // TODO: experiment without being double-sided
      side: THREE.DoubleSide,
      shininess: 70
    })

  buildFromG3d (g3d: VimG3d): VimThree {
    const geometryBuilder = new BufferGeometryBuilder(g3d)
    const geometry = this.logger?.timeAction('Allocating Geometry', () =>
      geometryBuilder.createAllGeometry()
    )
    this.logger?.log('Found # meshes ' + geometry.length)

    const nodesByMeshes = this.logger?.timeAction('Counting references', () =>
      g3d.getNodesByMeshes()
    )

    const rawMeshes = this.logger?.timeAction('Allocating Meshes', () =>
      this.allocateMeshes(geometry, nodesByMeshes)
    )

    const vimThree = this.logger?.timeAction(
      'Instantiating Shared Geometry',
      () => this.instantiateSharedGeometry(rawMeshes, g3d)
    )

    const merge = this.logger?.timeAction('Merging Unique Geometry', () =>
      this.mergeUniqueGeometry(g3d, geometry, nodesByMeshes)
    )
    if (merge !== null) {
      const [mesh, nodes] = merge
      vimThree.addMesh(mesh, nodes)
    }
    return vimThree
  }

  mergeUniqueGeometry (
    g3d: VimG3d,
    geometry: (THREE.BufferGeometry | null)[],
    nodesByMesh: number[][]
  ): [THREE.Mesh, number[]] | null {
    const [uniques, nodes] = this.getTransformedUniqueGeometry(
      g3d,
      geometry,
      nodesByMesh
    )
    if (uniques.length === 0) return null

    const result = this.createMergedMesh(uniques)
    uniques.forEach((u) => u.dispose())
    return [result, nodes]
  }

  getTransformedUniqueGeometry (
    g3d: VimG3d,
    geometry: (THREE.BufferGeometry | null)[],
    nodesByMesh: number[][]
  ): [THREE.BufferGeometry[], number[]] {
    const result: THREE.BufferGeometry[] = []
    const nodes: number[] = []

    for (let i = 0; i < g3d.instanceMeshes.length; i++) {
      const meshIndex = g3d.instanceMeshes[i]
      if (meshIndex < 0) continue

      const bufferGeometry = geometry[meshIndex]
      if (!bufferGeometry) continue

      // only merge unique objects
      const meshNodes = nodesByMesh[meshIndex]
      if (meshNodes.length === 1) {
        // adding uvs for picking
        this.addUVs(bufferGeometry, i)
        const matrix = getMatrixFromNodeIndex(g3d, i)
        bufferGeometry.applyMatrix4(matrix)
        result.push(bufferGeometry)
        nodes.push(meshNodes[0])
      }
    }
    return [result, nodes]
  }

  // TODO Use and support a simple THREE.Mesh
  createMergedMesh (
    bufferGeometry: THREE.BufferGeometry[]
  ): THREE.InstancedMesh {
    const mergedbufferGeometry: THREE.BufferGeometry =
      BufferGeometryUtils.mergeBufferGeometries(bufferGeometry)

    const mergedMesh = new THREE.InstancedMesh(
      mergedbufferGeometry,
      this.material,
      1
    )
    mergedMesh.setMatrixAt(0, new THREE.Matrix4())
    mergedbufferGeometry.computeBoundingBox()
    // Used by picking to distinguish merged meshes
    mergedMesh.userData.merged = true
    return mergedMesh
  }

  addUVs (bufferGeometry: THREE.BufferGeometry, value: number) {
    const uvArity = 2
    const vertexCount = bufferGeometry.getAttribute('position').count
    const uvs = new Float32Array(vertexCount * uvArity)
    uvs.fill(value)
    bufferGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, uvArity))
  }

  allocateMeshes (
    geometries: (THREE.BufferGeometry | null)[],
    nodesByMesh: number[][]
  ): (Mesh | null)[] {
    const meshCount = geometries.length
    const meshes: (Mesh | null)[] = new Array(meshCount)

    for (let i = 0; i < meshCount; ++i) {
      const count = nodesByMesh[i]?.length ?? 0
      if (count <= 1) {
        continue
      }

      const geometry = geometries[i]
      if (geometry === null) {
        continue
      }

      meshes[i] = new THREE.InstancedMesh(geometry, this.material, count)
    }

    return meshes
  }

  instantiateSharedGeometry (meshes: (Mesh | null)[], g3d: VimG3d): VimThree {
    const instanceCounters = new Int32Array(meshes.length)
    let boundingBox: THREE.Box3 | null = null
    const nodeIndexToMeshInstance = new Map<number, [Mesh, number]>()
    const meshIdToNodeIndex = new Map<number, number[]>()
    const resultMeshes: Mesh[] = []

    for (let i = 0; i < g3d.getInstanceCount(); ++i) {
      const meshIndex = g3d.instanceMeshes[i]
      if (meshIndex < 0) continue

      const mesh = meshes[meshIndex]
      if (!mesh) continue

      const count = instanceCounters[meshIndex]++

      // Set Node-MeshMap
      const nodes = meshIdToNodeIndex.get(mesh.id)
      if (nodes) {
        nodes.push(i)
      } else {
        meshIdToNodeIndex.set(mesh.id, [i])
        resultMeshes.push(mesh) // push mesh first time it is seen
      }

      // Set Node ID for picking
      nodeIndexToMeshInstance.set(i, [mesh, count])

      // Set matrix
      const matrix = getMatrixFromNodeIndex(g3d, i)
      mesh.setMatrixAt(count, matrix)

      // Compute total bounding box
      const box = mesh.geometry.boundingBox!.clone()
      box.applyMatrix4(matrix)
      boundingBox = boundingBox ? boundingBox.union(box) : box
    }
    return new VimThree(
      resultMeshes,
      boundingBox ?? new THREE.Box3(),
      nodeIndexToMeshInstance,
      meshIdToNodeIndex
    )
  }
}

export class BufferGeometryBuilder {
  defaultColor = new THREE.Color(0.5, 0.5, 0.5)
  indexBuffer: Int32Array
  vertexBuffer: Float32Array
  colorBuffer: Float32Array

  g3d: VimG3d

  constructor (g3d: VimG3d) {
    this.vertexBuffer = Float32Array.from(g3d.positions)
    this.colorBuffer = new Float32Array(g3d.positions.length)
    this.indexBuffer = new Int32Array(g3d.indices.length)
    this.g3d = g3d
  }

  createAllGeometry = (): (THREE.BufferGeometry | null)[] => {
    const meshCount = this.g3d.meshSubmeshes.length
    const resultMeshes: (THREE.BufferGeometry | null)[] = []

    for (let mesh = 0; mesh < meshCount; mesh++) {
      const result = this.createBufferGeometryFromMeshIndex(mesh)
      result?.computeBoundingBox()
      resultMeshes.push(result)
    }

    return resultMeshes
  }

  createBufferGeometryFromInstanceIndex (
    instanceIndex: number
  ): THREE.BufferGeometry | null {
    if (instanceIndex < 0) throw new Error('Invalid negative index.')

    const meshIndex = this.g3d.instanceMeshes[instanceIndex]
    if (meshIndex < 0) return null
    const geometry = this.createBufferGeometryFromMeshIndex(meshIndex)
    if (!geometry) return null
    const matrix = getMatrixFromNodeIndex(this.g3d, instanceIndex)
    geometry.applyMatrix4(matrix)
    return geometry
  }

  createBufferGeometryFromMeshIndex (
    meshIndex: number
  ): THREE.BufferGeometry | null {
    // min and max indices accumulated to slice into the vertex buffer
    let min: number = Number.MAX_SAFE_INTEGER
    let max: number = 0
    let indexCount = 0

    const [meshStart, meshEnd] = this.g3d.getMeshSubmeshRange(meshIndex)
    for (let submesh = meshStart; submesh < meshEnd; submesh++) {
      // transparent submeshes are skipped
      const submeshColor = this.getSubmeshColor(this.g3d, submesh)
      if (!submeshColor) continue

      const [submeshStart, submeshEnd] = this.g3d.getSubmeshIndexRange(submesh)
      for (let index = submeshStart; index < submeshEnd; index++) {
        const vertex = this.g3d.indices[index]
        this.indexBuffer[indexCount++] = vertex
        min = Math.min(min, vertex)
        max = Math.max(max, vertex)
        submeshColor.toArray(this.colorBuffer, vertex * 3)
      }
    }

    // If all submesh are transparent, we push null to keep results aligned
    if (indexCount === 0) return null

    // 3 is both the arity of the vertex buffer and of THREE.color
    const sliceStart = min * 3
    const sliceEnd = (max + 1) * 3

    // Rebase indices in mesh space
    for (let i = 0; i < indexCount; i++) {
      this.indexBuffer[i] -= min
    }

    return createBufferGeometryFromArrays(
      this.vertexBuffer.subarray(sliceStart, sliceEnd),
      this.indexBuffer.subarray(0, indexCount),
      this.colorBuffer.subarray(sliceStart, sliceEnd)
    )
  }

  getSubmeshColor (g3d: VimG3d, submesh: number) {
    const material = g3d.submeshMaterial[submesh]
    if (material < 0) {
      return this.defaultColor
    }

    const colorIndex = material * g3d.colorArity
    const alpha = g3d.materialColors[colorIndex + 3]
    if (alpha < 0.9) {
      return // to skip transparent materials
    }

    return new THREE.Color().fromArray(g3d.materialColors, colorIndex)
  }
}

function getMatrixFromNodeIndex (g3d: VimG3d, index: number): THREE.Matrix4 {
  const matrixAsArray = g3d.getTransformMatrixAsArray(index)
  const matrix = new THREE.Matrix4()
  matrix.elements = Array.from(matrixAsArray)
  return matrix
}

function createBufferGeometryFromArrays (
  vertices: Float32Array,
  indices: Int32Array,
  vertexColors: Float32Array | undefined = undefined
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()

  // Vertices
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))

  // Indices
  geometry.setIndex(new THREE.Uint32BufferAttribute(indices, 1))

  // Colors
  if (vertexColors) {
    geometry.setAttribute('color', new THREE.BufferAttribute(vertexColors, 3))
  }

  return geometry
}
*/