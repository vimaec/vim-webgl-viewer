/**
 @author VIM / https://vimaec.com
*/

import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils'
import * as THREE from 'three'

import { VimScene } from './vimScene'
import { Vim } from './vim'
import { BFast } from './bfast'
import { VimParser } from './vimParser'
import { Logger } from './logger'
import { VimG3d } from './g3d'
import { VimThree } from './vimThree'

export type TransparencyMode = boolean | 'opaque'
type BuildMode = 'opaque' | 'transparent' | 'all'

export class VIMLoader {
  logger: Logger | undefined

  constructor () {
    this.logger = new Logger('VIM Loader')
  }

  // Loads the VIM from a URL
  // Download should be handled without three for Parser and Loader to be divided properly
  loadFromUrl (
    url: string,
    onLoad?: (response: VimScene) => void,
    onProgress?: (progress: ProgressEvent | 'processing') => void,
    onError?: (event: ErrorEvent) => void
  ) {
    const loader = new THREE.FileLoader()
    loader.setResponseType('arraybuffer')
    loader.setRequestHeader({
      'Content-Encoding': 'gzip'
    })

    this.logger?.logStart()
    loader.load(
      url,
      (data: string | ArrayBuffer) => {
        if (!data) {
          onError?.(new ErrorEvent('Failed to obtain file at ' + url))
          return
        }
        if (typeof data === 'string') {
          onError?.(new ErrorEvent('Unsupported string loader response'))
          return
        }
        onProgress?.('processing')

        // Try parse vim file
        let scene: VimScene
        try {
          const vim = this.parse(data)
          scene = this.loadFromVim(vim, true)
        } catch (exception) {
          onError?.(new ErrorEvent('Loading Error', exception as Error))
          return
        }

        this.logger?.logEnd()
        // Don't catch exceptions in callback.
        onLoad?.(scene)
      },
      onProgress,
      (error) => {
        this.logger?.logEnd()
        onError?.(error)
      }
    )
  }

  parse (data: ArrayBuffer): Vim {
    // Parse Bfast from Bytes
    const bfast = this.logger?.timeAction('Parsing BFast', () =>
      BFast.parseFromBuffer(data)
    )

    // Parse Vim from BFast
    const vimParser = new VimParser(this.logger)
    const vim = this.logger?.timeAction('Creating VIM', () =>
      vimParser.parseFromBFast(bfast)
    )

    return vim
  }

  loadFromVim (
    vim: Vim,
    transparency: TransparencyMode,
    instanceIndices?: number[]
  ): VimScene {
    const threeBuilder = new VimThreeBuilder(
      transparency,
      undefined,
      undefined,
      this.logger
    )
    const vimThree = threeBuilder.buildFromG3d(vim.g3d, instanceIndices)

    this.logger?.log('Loading Completed')
    return new VimScene(vim, vimThree)
  }
}

type Mesh = THREE.InstancedMesh<THREE.BufferGeometry, THREE.Material>
export class VimThreeBuilder {
  private logger: Logger | undefined
  private materialOpaque: THREE.Material
  private materialTransparent: THREE.Material
  private transparency: TransparencyMode

  constructor (
    transparency: TransparencyMode,
    materialOpaque?: THREE.Material,
    materialTransparent?: THREE.Material,
    logger?: Logger
  ) {
    this.transparency = transparency
    this.materialOpaque = materialOpaque ?? this.createDefaultOpaqueMaterial()
    this.materialTransparent =
      transparency === true
        ? materialTransparent ?? this.createDefaultTransparentMaterial()
        : undefined
    this.logger = logger
  }

  createDefaultOpaqueMaterial = () =>
    new THREE.MeshPhongMaterial({
      color: 0x999999,
      vertexColors: true,
      flatShading: true,
      // TODO: experiment without being double-sided
      side: THREE.DoubleSide,
      shininess: 70
    })

  createDefaultTransparentMaterial = () => {
    const material = this.createDefaultOpaqueMaterial()
    material.transparent = true
    material.depthTest = true
    material.depthWrite = true
    // material.opacity = 0.3
    return material
  }

  /**
   * Builds full or partial Three.js geometry from given g3d
   * @param g3d
   * @param instanceIndices instance indices to include in the scene or undefined to include all.
   */
  buildFromG3d (g3d: VimG3d, instanceIndices?: number[]): VimThree {
    const meshIndexToInstanceIndices = this.logger?.timeAction(
      'Counting references',
      () => g3d.buildMeshIndexToInstanceIndicesMap(instanceIndices)
    )

    // Allocate memory used for building scene
    const builder = new BufferGeometryBuilder(g3d, meshIndexToInstanceIndices)

    // Create opaque objects
    const opaque = this.buildByOpacity(
      g3d,
      builder,
      meshIndexToInstanceIndices
      // []
    )
    /*
    // Create transparent objects
    if (this.transparency === true) {
      const alpha = this.buildByOpacity(
        g3d,
        builder,
        'transparent',
        this.materialTransparent,
        meshIndexToInstanceIndices
      )
      opaque.merge(alpha)
    }
    */
    return opaque
  }

  /**
   * Core geometry building logic
   * @param g3d
   * @param mode
   * @param material
   * @param meshIndexToInstanceIndices Determines which instances will be built into the scene.
   * @returns
   */
  buildByOpacity (
    g3d: VimG3d,
    builder: BufferGeometryBuilder,
    meshIndexToInstanceIndices: number[][]
  ) {
    // Allocate all relevent buffer geometry
    const bufferGeometry = this.logger?.timeAction('Allocating Geometry', () =>
      builder.createBufferGeometry()
    )

    // Instantiate Three meshes for all shared geometry
    const meshes = this.logger?.timeAction('Allocating Meshes', () =>
      this.allocateSharedMeshes(bufferGeometry, meshIndexToInstanceIndices)
    )

    // Apply matrices and create instance maps for shared geometry
    const vimThree = this.logger?.timeAction(
      'Instantiating Shared Geometry',
      () => this.setupSharedMeshes(meshes, meshIndexToInstanceIndices, g3d)
    )
    /*
    // Create one big merged geometry for unique meshes
    const [mergedMesh, mergedInstances] = this.logger?.timeAction(
      'Merging Unique  Geometry',
      () =>
        this.mergeUniqueGeometry(
          g3d,
          bufferGeometry,
          meshIndexToInstanceIndices,
          material
        )
    )

    // Combine shared and merged meshes
    if (mergedMesh) {
      vimThree.addMesh(mergedMesh, mergedInstances)
    }
*/
    return vimThree
  }

  mergeUniqueGeometry (
    g3d: VimG3d,
    geometry: (THREE.BufferGeometry | undefined)[],
    meshIndexToInstanceIndices: number[][],
    material: THREE.Material
  ): [THREE.Mesh, number[]] | undefined {
    const [uniques, instances] = this.getTransformedUniqueGeometry(
      g3d,
      geometry,
      meshIndexToInstanceIndices
    )
    if (uniques.length === 0) return [undefined, undefined]

    const result = this.createMergedMesh(uniques, material)
    uniques.forEach((u) => u.dispose())

    return [result, instances]
  }

  getTransformedUniqueGeometry (
    g3d: VimG3d,
    geometry: (THREE.BufferGeometry | undefined)[],
    meshIndexToInstanceIndices: number[][]
  ): [THREE.BufferGeometry[], number[]] {
    const result: THREE.BufferGeometry[] = []
    const instances: number[] = []

    for (let i = 0; i < geometry.length; i++) {
      const bufferGeometry = geometry[i]
      if (!bufferGeometry) continue

      // only merge unique objects
      const instanceIndices = meshIndexToInstanceIndices[i]
      if (instanceIndices?.length === 1) {
        const instanceIndex = meshIndexToInstanceIndices[i][0]

        // apply instance matrix
        const matrix = getMatrixFromInstanceIndex(g3d, instanceIndex)
        bufferGeometry.applyMatrix4(matrix)

        // adding uvs for picking
        this.addUVs(bufferGeometry, instanceIndex)

        result.push(bufferGeometry)
        instances.push(instanceIndex)
      }
    }
    return [result, instances]
  }

  // TODO Use and support a simple THREE.Mesh
  createMergedMesh (
    bufferGeometry: THREE.BufferGeometry[],
    material: THREE.Material
  ): THREE.InstancedMesh {
    const mergedbufferGeometry: THREE.BufferGeometry =
      BufferGeometryUtils.mergeBufferGeometries(bufferGeometry)

    const mergedMesh = new THREE.InstancedMesh(
      mergedbufferGeometry,
      material,
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

  allocateSharedMeshes (
    geometries: (THREE.BufferGeometry | undefined)[],
    meshIndexToInstanceIndices: number[][]
  ): (Mesh | undefined)[] {
    const meshCount = geometries.length
    const meshes: (Mesh | undefined)[] = new Array(meshCount)

    for (let m = 0; m < meshIndexToInstanceIndices.length; ++m) {
      // Unique geometry are not allocated a mesh here.
      // They will all be merged later.
      const count = meshIndexToInstanceIndices[m]?.length ?? 0
      if (count <= 0) {
        continue
      }

      const geometry = geometries[m]
      if (!geometry) {
        continue
      }
      const material =
        geometry.getAttribute('color').itemSize === 4
          ? this.materialTransparent
          : this.materialOpaque
      meshes[m] = new THREE.InstancedMesh(geometry, material, count)
    }

    return meshes
  }

  setupSharedMeshes (
    meshes: (Mesh | undefined)[],
    meshIndexToInstanceIndices: number[][],
    g3d: VimG3d
  ): VimThree {
    let boundingBox: THREE.Box3 | undefined
    const instanceIndexToMeshInstance = new Map<number, [Mesh, number]>()
    const meshIdToInstanceIndex = new Map<number, number[]>()
    const resultMeshes: Mesh[] = []

    for (let m = 0; m < meshIndexToInstanceIndices.length; ++m) {
      const instanceIndices = meshIndexToInstanceIndices[m]
      if (!instanceIndices?.length) continue

      const mesh = meshes[m]
      if (!mesh) continue
      resultMeshes.push(mesh) // push mesh first time it is seen
      meshIdToInstanceIndex.set(mesh.id, instanceIndices)
      for (let i = 0; i < instanceIndices.length; i++) {
        const instanceIndex = instanceIndices[i]

        // Save Instance Index for picking
        instanceIndexToMeshInstance.set(instanceIndex, [mesh, i])

        // Set matrix
        const matrix = getMatrixFromInstanceIndex(g3d, instanceIndex)
        mesh.setMatrixAt(i, matrix)

        // Compute total bounding box
        const box = mesh.geometry.boundingBox!.clone()
        box.applyMatrix4(matrix)
        boundingBox = boundingBox ? boundingBox.union(box) : box
      }
    }
    return new VimThree(
      resultMeshes,
      boundingBox ?? new THREE.Box3(),
      instanceIndexToMeshInstance,
      meshIdToInstanceIndex
    )
  }
}

export class BufferGeometryBuilder {
  defaultColor = new THREE.Color(0.5, 0.5, 0.5)
  colorBuffer: Float32Array

  g3d: VimG3d
  meshIndexToInstanceIndices: number[][]

  constructor (g3d: VimG3d, meshIndexToInstanceIndices: number[][]) {
    this.colorBuffer = new Float32Array(g3d.getVertexCount() * 4)
    this.g3d = g3d
    this.meshIndexToInstanceIndices = meshIndexToInstanceIndices
  }

  /**
   * Concatenates all g3d.submeshes of each g3d.mesh into newly created Three.GeometryBuffers
   * @param meshIndexToInstanceIndices only meshes for which there are instances will be created
   * @returns an array where array[meshIndex] = BufferGeometry. Array can be undefined if empty. Values can be undefined
   */
  createBufferGeometry = (): (THREE.BufferGeometry | undefined)[] => {
    const meshCount = this.g3d.meshSubmeshes.length
    const resultMeshes: (THREE.BufferGeometry | undefined)[] = Array(meshCount)

    for (let m = 0; m < this.meshIndexToInstanceIndices.length; m++) {
      if (!this.meshIndexToInstanceIndices[m]) continue

      const result = this.createGeometryFromMeshIndex(m)
      if (result) {
        result?.computeBoundingBox()
        resultMeshes[m] = result
      }
    }

    return resultMeshes
  }

  createGeometryFromInstanceIndex (
    instanceIndex: number,
    buildMode: BuildMode
  ): THREE.BufferGeometry | undefined {
    if (instanceIndex < 0) throw new Error('Invalid negative index.')

    const meshIndex = this.g3d.instanceMeshes[instanceIndex]
    if (meshIndex < 0) return
    const geometry = this.createGeometryFromMeshIndex(meshIndex)
    if (!geometry) return
    const matrix = getMatrixFromInstanceIndex(this.g3d, instanceIndex)
    geometry.applyMatrix4(matrix)
    return geometry
  }

  createGeometryFromMeshIndex (
    meshIndex: number
  ): THREE.BufferGeometry | undefined {
    const [subStart, subEnd] = this.g3d.getMeshSubmeshRange(meshIndex)
    for (let submesh = subStart; submesh < subEnd; submesh++) {
      const [submeshColor, alpha] = this.getSubmeshColor(this.g3d, submesh)
      const [start, end] = this.g3d.getSubmeshIndexRange(submesh)
      for (let i = start; i < end; i++) {
        const v = this.g3d.indices[i]
        submeshColor.toArray(this.colorBuffer, v * 4)
        this.colorBuffer[v * 4 + 3] = alpha
      }
    }

    const [vertexStart, vertexEnd] = this.g3d.getMeshVertexRange(meshIndex)
    const [indexStart, indexEnd] = this.g3d.getMeshIndexRange(meshIndex)
    return createBufferGeometryFromArrays(
      new Float32Array(
        this.g3d.positions.subarray(vertexStart * 3, vertexEnd * 3)
      ),
      new Int32Array(this.g3d.indicesRelative.subarray(indexStart, indexEnd)),
      new Float32Array(
        this.colorBuffer.subarray(vertexStart * 4, vertexEnd * 4)
      )
    )
  }

  private getSubmeshColor (
    g3d: VimG3d,
    submesh: number
  ): [color: THREE.Color, alpha: number] {
    const material = g3d.submeshMaterial[submesh]
    if (material < 0) {
      return [this.defaultColor, 1]
    }

    const colorIndex = material * g3d.colorArity
    const alpha = g3d.materialColors[colorIndex + 3]
    const color = new THREE.Color().fromArray(g3d.materialColors, colorIndex)
    return [color, alpha]
  }
}

function getMatrixFromInstanceIndex (g3d: VimG3d, index: number): THREE.Matrix4 {
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

  // Colors with alp
  if (vertexColors) {
    geometry.setAttribute('color', new THREE.BufferAttribute(vertexColors, 4))
  }

  return geometry
}
