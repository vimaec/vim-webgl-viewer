/**
 * @module vim-loader
 */

import { BFast } from './bfast'

class G3dAttributeDescriptor {
  // original descriptor string
  description: string
  // Indicates the part of the geometry that this attribute is associated with
  association: string
  // the role of the attribute
  semantic: string
  // each attribute type should have it's own index ( you can have uv0, uv1, etc. )
  attributeTypeIndex: string
  // the type of individual values (e.g. int32, float64)
  dataType: string
  // how many values associated with each element (e.g. UVs might be 2, geometry might be 3, quaternions 4, matrices 9 or 16)
  dataArity: number

  constructor (
    description: string,
    association: string,
    semantic: string,
    attributeTypeIndex: string,
    dataType: string,
    dataArity: string
  ) {
    if (!description.startsWith('g3d:')) {
      throw new Error(`${description} must start with 'g3d'`)
    }

    this.description = description
    this.association = association
    this.semantic = semantic
    this.attributeTypeIndex = attributeTypeIndex
    this.dataType = dataType
    this.dataArity = parseInt(dataArity)
  }

  static fromString (descriptor: string): G3dAttributeDescriptor {
    const desc = descriptor.split(':')

    if (desc.length !== 6) {
      throw new Error(`${descriptor}, must have 6 components delimited by ':'`)
    }

    return new this(descriptor, desc[1], desc[2], desc[3], desc[4], desc[5])
  }

  matches (other: G3dAttributeDescriptor) {
    const match = (a: string, b: string) => a === '*' || b === '*' || a === b

    return (
      match(this.association, other.association) &&
      match(this.semantic, other.semantic) &&
      match(this.attributeTypeIndex, other.attributeTypeIndex) &&
      match(this.dataType, other.dataType)
    )
  }
}

export type MeshSection = 'opaque' | 'transparent' | 'all'

type TypedArray =
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Uint32Array
  | Float64Array

class G3dAttribute {
  descriptor: G3dAttributeDescriptor
  bytes: Uint8Array
  data: TypedArray

  constructor (descriptor: G3dAttributeDescriptor, bytes: Uint8Array) {
    this.descriptor = descriptor
    this.bytes = bytes
    this.data = G3dAttribute.castData(bytes, descriptor.dataType)
  }

  static fromString (descriptor: string, buffer: Uint8Array): G3dAttribute {
    return new this(G3dAttributeDescriptor.fromString(descriptor), buffer)
  }

  // Converts a VIM attribute into a typed array from its raw data
  static castData (bytes: Uint8Array, dataType: string): TypedArray {
    switch (dataType) {
      case 'float32':
        return new Float32Array(
          bytes.buffer,
          bytes.byteOffset,
          bytes.byteLength / 4
        )
      case 'float64':
        throw new Float64Array(
          bytes.buffer,
          bytes.byteOffset,
          bytes.byteLength / 8
        )
      case 'uint8':
      case 'int8':
        return bytes
      case 'int16':
        return new Int16Array(
          bytes.buffer,
          bytes.byteOffset,
          bytes.byteLength / 2
        )
      case 'uint16':
        return new Uint16Array(
          bytes.buffer,
          bytes.byteOffset,
          bytes.byteLength / 2
        )
      case 'int32':
        return new Int32Array(
          bytes.buffer,
          bytes.byteOffset,
          bytes.byteLength / 4
        )
      case 'uint32':
        return new Uint32Array(
          bytes.buffer,
          bytes.byteOffset,
          bytes.byteLength / 4
        )

      case 'int64':
      case 'uint64':
        console.error('G3d: 64-bit buffers unsuported')
        return
      default:
        console.error('Unrecognized attribute data type ' + dataType)
    }
  }
}

/**
 * G3D is a simple, efficient, generic binary format for storing and transmitting geometry.
 * The G3D format is designed to be used either as a serialization format or as an in-memory data structure.
 * See https://github.com/vimaec/g3d
 */
class AbstractG3d {
  meta: string
  attributes: G3dAttribute[]

  constructor (meta: string, attributes: G3dAttribute[]) {
    this.meta = meta
    this.attributes = attributes
  }

  findAttribute (descriptor: string): G3dAttribute | undefined {
    const filter = G3dAttributeDescriptor.fromString(descriptor)
    for (let i = 0; i < this.attributes.length; ++i) {
      const attribute = this.attributes[i]
      if (attribute.descriptor.matches(filter)) return attribute
    }
  }

  /**
   * Create g3d from bfast by requesting all necessary buffers individually.
   */
  static createFromBfast (bfast: BFast) {
    const promises = VimAttributes.all.map((a) =>
      bfast
        .getBytes(a)
        .then((bytes) =>
          bytes
            ? new G3dAttribute(G3dAttributeDescriptor.fromString(a), bytes)
            : undefined
        )
    )
    return Promise.all(promises).then(
      (attributes) =>
        new AbstractG3d(
          'meta',
          attributes.filter((a): a is G3dAttribute => a !== undefined)
        )
    )
  }
}
/**
 * See https://github.com/vimaec/vim#vim-geometry-attributes
 */
class VimAttributes {
  static positions = 'g3d:vertex:position:0:float32:3'
  static indices = 'g3d:corner:index:0:int32:1'
  static instanceMeshes = 'g3d:instance:mesh:0:int32:1'
  static instanceTransforms = 'g3d:instance:transform:0:float32:16'
  static instanceFlags = 'g3d:instance:flags:0:uint16:1'
  static meshSubmeshes = 'g3d:mesh:submeshoffset:0:int32:1'
  static submeshIndexOffsets = 'g3d:submesh:indexoffset:0:int32:1'
  static submeshMaterials = 'g3d:submesh:material:0:int32:1'
  static materialColors = 'g3d:material:color:0:float32:4'

  static all = [
    VimAttributes.positions,
    VimAttributes.indices,
    VimAttributes.instanceMeshes,
    VimAttributes.instanceTransforms,
    VimAttributes.instanceFlags,
    VimAttributes.meshSubmeshes,
    VimAttributes.submeshIndexOffsets,
    VimAttributes.submeshMaterials,
    VimAttributes.materialColors
  ]
}

/**
 * G3D is a simple, efficient, generic binary format for storing and transmitting geometry.
 * The G3D format is designed to be used either as a serialization format or as an in-memory data structure.
 * A G3d with specific attributes according to the VIM format specification.
 * See https://github.com/vimaec/vim#vim-geometry-attributes for the vim specification.
 * See https://github.com/vimaec/g3d for the g3d specification.
 */
export class G3d {
  positions: Float32Array
  indices: Uint32Array

  instanceMeshes: Int32Array
  instanceTransforms: Float32Array
  instanceFlags: Uint16Array
  meshSubmeshes: Int32Array
  submeshIndexOffset: Int32Array
  submeshMaterial: Int32Array
  materialColors: Float32Array

  // computed fields
  meshVertexOffsets: Int32Array
  meshInstances: Array<Array<number>>
  meshOpaqueCount: Array<number>

  rawG3d: AbstractG3d

  MATRIX_SIZE = 16
  COLOR_SIZE = 4
  POSITION_SIZE = 3
  /**
   * Opaque white
   */
  DEFAULT_COLOR = new Float32Array([1, 1, 1, 1])

  constructor (g3d: AbstractG3d) {
    this.rawG3d = g3d

    this.positions = g3d.findAttribute(VimAttributes.positions)
      ?.data as Float32Array

    const tmp = g3d.findAttribute(VimAttributes.indices)?.data
    if (!tmp) throw new Error('No Index Buffer Found')
    this.indices = new Uint32Array(tmp.buffer, tmp.byteOffset, tmp.length)

    this.meshSubmeshes = g3d.findAttribute(VimAttributes.meshSubmeshes)
      ?.data as Int32Array

    this.submeshIndexOffset = g3d.findAttribute(
      VimAttributes.submeshIndexOffsets
    )?.data as Int32Array

    this.submeshMaterial = g3d.findAttribute(VimAttributes.submeshMaterials)
      ?.data as Int32Array

    this.materialColors = g3d.findAttribute(VimAttributes.materialColors)
      ?.data as Float32Array

    this.instanceMeshes = g3d.findAttribute(VimAttributes.instanceMeshes)
      ?.data as Int32Array

    this.instanceTransforms = g3d.findAttribute(
      VimAttributes.instanceTransforms
    )?.data as Float32Array

    this.instanceFlags =
      (g3d.findAttribute(VimAttributes.instanceFlags)?.data as Uint16Array) ??
      new Uint16Array(this.instanceMeshes.length)

    this.meshVertexOffsets = this.computeMeshVertexOffsets()
    this.rebaseIndices()
    this.meshInstances = this.computeMeshInstances()
    this.meshOpaqueCount = this.computeMeshOpaqueCount()
    this.sortSubmeshes()
  }

  /**
   * Computes the index of the first vertex of each mesh
   */
  private computeMeshVertexOffsets (): Int32Array {
    const result = new Int32Array(this.getMeshCount())
    for (let m = 0; m < result.length; m++) {
      let min = Number.MAX_SAFE_INTEGER
      const start = this.getMeshIndexStart(m, 'all')
      const end = this.getMeshIndexEnd(m, 'all')
      for (let i = start; i < end; i++) {
        min = Math.min(min, this.indices[i])
      }
      result[m] = min
    }
    return result
  }

  /**
   * Computes all instances pointing to each mesh.
   */
  private computeMeshInstances = (): number[][] => {
    const result: number[][] = []

    for (let i = 0; i < this.instanceMeshes.length; i++) {
      const mesh = this.instanceMeshes[i]
      if (mesh < 0) continue
      const instanceIndices = result[mesh]
      if (instanceIndices) instanceIndices.push(i)
      else result[mesh] = [i]
    }

    return result
  }

  /**
   * Reorders submeshIndexOffset, submeshMaterials and indices
   * such that for each mesh, submeshes are sorted according to material alpha.
   * This enables efficient splitting of arrays into opaque and transparent continuous ranges.
   */
  private sortSubmeshes () {
    // We need to compute where submeshes end before we can reorder them.
    const submeshEnd = this.computeSubmeshEnd()
    // We need to compute mesh index offsets from before we swap thins around to recompute new submesh offsets.
    const meshIndexOffsets = this.computeMeshIndexOffsets()

    const meshCount = this.getMeshCount()
    const meshReordered = new Array<boolean>(meshCount)

    const submeshArrays = [
      this.submeshIndexOffset,
      this.submeshMaterial,
      submeshEnd
    ]
    // Largest mesh size thus minimum buffer size to use to reorder indices.
    const largestMesh = this.reorderSubmeshes(submeshArrays, meshReordered)
    this.reorderIndices(
      meshIndexOffsets,
      submeshEnd,
      meshReordered,
      largestMesh
    )
  }

  /**
   * Stores result of getSubmeshIndexEnd for each submesh in an array
   */
  private computeSubmeshEnd () {
    const submeshCount = this.getSubmeshCount()
    const result = new Int32Array(submeshCount)
    for (let s = 0; s < submeshCount; s++) {
      result[s] = this.getSubmeshIndexEnd(s)
    }
    return result
  }

  /**
   * Stores result of getMeshIndexStart for each mesh in an array
   */
  private computeMeshIndexOffsets () {
    const meshCount = this.getMeshCount()
    const result = new Int32Array(meshCount)
    for (let m = 0; m < meshCount; m++) {
      result[m] = this.getMeshIndexStart(m, 'all')
    }
    return result
  }

  /**
   * Reorder submesh arrays and returns size of largest reordered mesh
   */
  private reorderSubmeshes (submeshArrays: Int32Array[], reordered: boolean[]) {
    const meshCount = this.getMeshCount()
    let largestMesh = 0
    for (let m = 0; m < meshCount; m++) {
      const subStart = this.getMeshSubmeshStart(m, 'all')
      const subEnd = this.getMeshSubmeshEnd(m, 'all')

      if (subEnd - subStart <= 1) {
        continue
      }

      largestMesh = Math.max(largestMesh, this.getMeshIndexCount(m, 'all'))

      reordered[m] = this.Sort(
        subStart,
        subEnd,
        (i) => this.getSubmeshAlpha(i),
        submeshArrays
      )
    }
    return largestMesh
  }

  /**
   * Sorts the range from start to end in every array provided in arrays in increasing criterion order.
   * Using a simple bubble sort, there is a limited number of submeshes per mesh.
   */
  private Sort (
    start: number,
    end: number,
    criterion: (i: number) => number,
    arrays: Int32Array[]
  ) {
    let swapped = false
    while (true) {
      let loop = false
      for (let i = start; i < end - 1; i++) {
        if (criterion(i) < criterion(i + 1)) {
          loop = true
          swapped = true
          for (let j = 0; j < arrays.length; j++) {
            const array = arrays[j]
            const t = array[i]
            array[i] = array[i + 1]
            array[i + 1] = t
          }
        }
      }
      if (!loop) {
        break
      }
    }
    return swapped
  }

  /**
   * Reorders the index buffer to match the new order of the submesh arrays.
   */
  private reorderIndices (
    meshIndexOffsets: Int32Array,
    submeshEnd: Int32Array,
    meshReordered: boolean[],
    bufferSize: number
  ) {
    const meshCount = this.getMeshCount()
    const buffer = new Float32Array(bufferSize)

    for (let m = 0; m < meshCount; m++) {
      if (!meshReordered[m]) continue

      const meshOffset = meshIndexOffsets[m]
      const subStart = this.getMeshSubmeshStart(m, 'all')
      const subEnd = this.getMeshSubmeshEnd(m, 'all')
      let index = 0

      // Copy indices -> buffer, in sorted order.
      for (let s = subStart; s < subEnd; s++) {
        const start = this.submeshIndexOffset[s]
        const end = submeshEnd[s]

        // Change submesh offset to match new ordering
        this.submeshIndexOffset[s] = meshOffset + index
        for (let i = start; i < end; i++) {
          buffer[index++] = this.indices[i]
        }
      }

      // Copy buffer -> indices
      for (let i = 0; i < index; i++) {
        this.indices[meshOffset + i] = buffer[i]
      }
    }
  }

  /**
   * Rebase indices to be relative to its own mesh instead of to the whole g3d
   */
  private rebaseIndices () {
    const count = this.getMeshCount()
    for (let m = 0; m < count; m++) {
      const offset = this.meshVertexOffsets[m]
      const start = this.getMeshIndexStart(m, 'all')
      const end = this.getMeshIndexEnd(m, 'all')
      for (let i = start; i < end; i++) {
        this.indices[i] -= offset
      }
    }
  }

  /**
   * Computes an array where true if any of the materials used by a mesh has transparency.
   */
  private computeMeshOpaqueCount () {
    const result = new Array<number>(this.getMeshCount()).fill(0)
    for (let m = 0; m < result.length; m++) {
      const subStart = this.getMeshSubmeshStart(m, 'all')
      const subEnd = this.getMeshSubmeshEnd(m, 'all')
      for (let s = subStart; s < subEnd; s++) {
        const alpha = this.getSubmeshAlpha(s)
        result[m] += alpha === 1 ? 1 : 0
      }
    }
    return result
  }

  // ------------- All -----------------
  getVertexCount = () => this.positions.length / this.POSITION_SIZE

  // ------------- Meshes -----------------
  getMeshCount = () => this.meshSubmeshes.length

  getMeshIndexStart (mesh: number, section: MeshSection = 'all'): number {
    const sub = this.getMeshSubmeshStart(mesh, section)
    return this.getSubmeshIndexStart(sub)
  }

  getMeshIndexEnd (mesh: number, section: MeshSection = 'all'): number {
    const sub = this.getMeshSubmeshEnd(mesh, section)
    return this.getSubmeshIndexEnd(sub - 1)
  }

  getMeshIndexCount (mesh: number, section: MeshSection = 'all'): number {
    return (
      this.getMeshIndexEnd(mesh, section) -
      this.getMeshIndexStart(mesh, section)
    )
  }

  getMeshVertexStart (mesh: number): number {
    return this.meshVertexOffsets[mesh]
  }

  getMeshVertexEnd (mesh: number): number {
    return mesh < this.meshVertexOffsets.length - 1
      ? this.meshVertexOffsets[mesh + 1]
      : this.getVertexCount()
  }

  getMeshVertexCount (mesh: number): number {
    return this.getMeshVertexEnd(mesh) - this.getMeshVertexStart(mesh)
  }

  getMeshSubmeshStart (mesh: number, section: MeshSection = 'all'): number {
    if (section === 'transparent') {
      return this.getMeshSubmeshEnd(mesh, 'opaque')
    }

    return this.meshSubmeshes[mesh]
  }

  getMeshSubmeshEnd (mesh: number, section: MeshSection = 'all'): number {
    if (section === 'opaque') {
      return this.meshSubmeshes[mesh] + this.meshOpaqueCount[mesh]
    }

    return mesh < this.meshSubmeshes.length - 1
      ? this.meshSubmeshes[mesh + 1]
      : this.submeshIndexOffset.length
  }

  getMeshSubmeshCount (mesh: number, section: MeshSection = 'all'): number {
    const end = this.getMeshSubmeshEnd(mesh, section)
    const start = this.getMeshSubmeshStart(mesh, section)
    return end - start
  }

  getMeshHasTransparency (mesh: number) {
    return this.getMeshSubmeshCount(mesh, 'transparent') > 0
  }

  // ------------- Submeshes -----------------

  getSubmeshIndexStart (submesh: number): number {
    return submesh < this.submeshIndexOffset.length
      ? this.submeshIndexOffset[submesh]
      : this.indices.length
  }

  getSubmeshIndexEnd (submesh: number): number {
    return submesh < this.submeshIndexOffset.length - 1
      ? this.submeshIndexOffset[submesh + 1]
      : this.indices.length
  }

  getSubmeshIndexCount (submesh: number): number {
    return this.getSubmeshIndexEnd(submesh) - this.getSubmeshIndexStart(submesh)
  }

  /**
   * Returns color of given submesh as a 4-number array (RGBA)
   * @param submesh g3d submesh index
   */
  getSubmeshColor (submesh: number): Float32Array {
    return this.getMaterialColor(this.submeshMaterial[submesh])
  }

  /**
   * Returns color of given submesh as a 4-number array (RGBA)
   * @param submesh g3d submesh index
   */
  getSubmeshAlpha (submesh: number): number {
    return this.getMaterialAlpha(this.submeshMaterial[submesh])
  }

  /**
   * Returns true if submesh is transparent.
   * @param submesh g3d submesh index
   */
  getSubmeshIsTransparent (submesh: number): boolean {
    return this.getSubmeshAlpha(submesh) < 1
  }

  /**
   * Returns the total number of mesh in the g3d
   */
  getSubmeshCount (): number {
    return this.submeshMaterial.length
  }

  // ------------- Instances -----------------
  getInstanceCount = () => this.instanceMeshes.length

  /**
   * Returns mesh index of given instance
   * @param instance g3d instance index
   */
  getInstanceMesh (instance: number): number {
    return this.instanceMeshes[instance]
  }

  /**
   * Returns an 16 number array representation of the matrix for given instance
   * @param instance g3d instance index
   */
  getInstanceMatrix (instance: number): Float32Array {
    return this.instanceTransforms.subarray(
      instance * this.MATRIX_SIZE,
      (instance + 1) * this.MATRIX_SIZE
    )
  }

  // ------------- Material -----------------

  getMaterialCount = () => this.materialColors.length / this.COLOR_SIZE

  /**
   * Returns color of given material as a 4-number array (RGBA)
   * @param material g3d material index
   */
  getMaterialColor (material: number): Float32Array {
    if (material < 0) return this.DEFAULT_COLOR
    return this.materialColors.subarray(
      material * this.COLOR_SIZE,
      (material + 1) * this.COLOR_SIZE
    )
  }

  getMaterialAlpha (material: number): number {
    if (material < 0) return 1
    const index = material * this.COLOR_SIZE + this.COLOR_SIZE - 1
    const result = this.materialColors[index]
    return result
  }

  static async createFromBfast (bfast: BFast) {
    return AbstractG3d.createFromBfast(bfast).then((g3d) => new G3d(g3d))
  }

  validate () {
    const isPresent = (attribute: any, label: string) => {
      if (!attribute) {
        throw new Error(`Missing Attribute Buffer: ${label}`)
      }
    }
    isPresent(this.positions, 'position')
    isPresent(this.indices, 'indices')
    isPresent(this.instanceMeshes, 'instanceMeshes')
    isPresent(this.instanceTransforms, 'instanceTransforms')
    isPresent(this.meshSubmeshes, 'meshSubmeshes')
    isPresent(this.submeshIndexOffset, 'submeshIndexOffset')
    isPresent(this.submeshMaterial, 'submeshMaterial')
    isPresent(this.materialColors, 'materialColors')

    // Basic
    if (this.positions.length % this.POSITION_SIZE !== 0) {
      throw new Error(
        'Invalid position buffer, must be divisible by ' + this.POSITION_SIZE
      )
    }

    if (this.indices.length % 3 !== 0) {
      throw new Error('Invalid Index Count, must be divisible by 3')
    }

    for (let i = 0; i < this.indices.length; i++) {
      if (this.indices[i] < 0 || this.indices[i] >= this.positions.length) {
        throw new Error('Vertex index out of bound')
      }
    }

    // Instances
    if (
      this.instanceMeshes.length !==
      this.instanceTransforms.length / this.MATRIX_SIZE
    ) {
      throw new Error('Instance buffers mismatched')
    }

    if (this.instanceTransforms.length % this.MATRIX_SIZE !== 0) {
      throw new Error(
        'Invalid InstanceTransform buffer, must respect arity ' +
          this.MATRIX_SIZE
      )
    }

    for (let i = 0; i < this.instanceMeshes.length; i++) {
      if (this.instanceMeshes[i] >= this.meshSubmeshes.length) {
        throw new Error('Instance Mesh Out of range.')
      }
    }

    // Meshes
    for (let i = 0; i < this.meshSubmeshes.length; i++) {
      if (
        this.meshSubmeshes[i] < 0 ||
        this.meshSubmeshes[i] >= this.submeshIndexOffset.length
      ) {
        throw new Error('MeshSubmeshOffset out of bound at')
      }
    }

    for (let i = 0; i < this.meshSubmeshes.length - 1; i++) {
      if (this.meshSubmeshes[i] >= this.meshSubmeshes[i + 1]) {
        throw new Error('MeshSubmesh out of sequence.')
      }
    }

    // Submeshes
    if (this.submeshIndexOffset.length !== this.submeshMaterial.length) {
      throw new Error('Mismatched submesh buffers')
    }

    for (let i = 0; i < this.submeshIndexOffset.length; i++) {
      if (
        this.submeshIndexOffset[i] < 0 ||
        this.submeshIndexOffset[i] >= this.indices.length
      ) {
        throw new Error('SubmeshIndexOffset out of bound')
      }
    }

    for (let i = 0; i < this.submeshIndexOffset.length; i++) {
      if (this.submeshIndexOffset[i] % 3 !== 0) {
        throw new Error('Invalid SubmeshIndexOffset, must be divisible by 3')
      }
    }

    for (let i = 0; i < this.submeshIndexOffset.length - 1; i++) {
      if (this.submeshIndexOffset[i] >= this.submeshIndexOffset[i + 1]) {
        throw new Error('SubmeshIndexOffset out of sequence.')
      }
    }

    for (let i = 0; i < this.submeshMaterial.length; i++) {
      if (this.submeshMaterial[i] >= this.materialColors.length) {
        throw new Error('submeshMaterial out of bound')
      }
    }

    // Materials
    if (this.materialColors.length % this.COLOR_SIZE !== 0) {
      throw new Error(
        'Invalid material color buffer, must be divisible by ' + this.COLOR_SIZE
      )
    }
    console.assert(this.meshInstances.length === this.getMeshCount())
    console.assert(this.meshOpaqueCount.length === this.getMeshCount())
    console.assert(this.meshSubmeshes.length === this.getMeshCount())
    console.assert(this.meshVertexOffsets.length === this.getMeshCount())

    for (let m = 0; m < this.getMeshCount(); m++) {
      console.assert(
        this.getMeshSubmeshCount(m, 'opaque') +
          this.getMeshSubmeshCount(m, 'transparent') ===
          this.getMeshSubmeshCount(m, 'all')
      )

      console.assert(
        this.getMeshIndexCount(m, 'opaque') +
          this.getMeshIndexCount(m, 'transparent') ===
          this.getMeshIndexCount(m, 'all')
      )
    }
  }
}
