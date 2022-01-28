/**
 * G3D is a simple, efficient, generic binary format for storing and transmitting geometry.
 * The G3D format is designed to be used either as a serialization format or as an in-memory data structure.
 * See https://github.com/vimaec/g3d
 * @module vim-loader
 */

import { BFast } from './bfast'

class AttributeDescriptor {
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

  static fromString (descriptor: string): AttributeDescriptor {
    const desc = descriptor.split(':')

    if (desc.length !== 6) {
      throw new Error(`${descriptor}, must have 6 components delimited by ':'`)
    }

    return new this(descriptor, desc[1], desc[2], desc[3], desc[4], desc[5])
  }

  matches (other: AttributeDescriptor) {
    const match = (a: string, b: string) => a === '*' || b === '*' || a === b

    return (
      match(this.association, other.association) &&
      match(this.semantic, other.semantic) &&
      match(this.attributeTypeIndex, other.attributeTypeIndex) &&
      match(this.dataType, other.dataType)
    )
  }
}

class Attribute {
  descriptor: AttributeDescriptor
  bytes: Uint8Array
  data: Uint8Array | Int16Array | Int32Array | Float32Array | Float64Array

  constructor (descriptor: AttributeDescriptor, bytes: Uint8Array) {
    this.descriptor = descriptor
    this.bytes = bytes
    this.data = Attribute.castData(bytes, descriptor.dataType)
  }

  static fromString (descriptor: string, buffer: Uint8Array): Attribute {
    return new this(AttributeDescriptor.fromString(descriptor), buffer)
  }

  // Converts a VIM attribute into a typed array from its raw data
  static castData (
    bytes: Uint8Array,
    dataType: string
  ): Uint8Array | Int16Array | Int32Array | Float32Array | Float64Array {
    // This is a UInt8 array

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
      case 'int8':
        return bytes
      case 'int16':
        return new Int16Array(
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
      // case "int64": return new Int64Array(data.buffer, data.byteOffset, data.byteLength / 8);
      default:
        throw new Error('Unrecognized attribute data type ' + dataType)
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
  attributes: Attribute[]

  constructor (meta: string, attributes: Attribute[]) {
    this.meta = meta
    this.attributes = attributes
  }

  findAttribute (descriptor: string): Attribute | null {
    const filter = AttributeDescriptor.fromString(descriptor)
    for (let i = 0; i < this.attributes.length; ++i) {
      const attribute = this.attributes[i]
      if (attribute.descriptor.matches(filter)) return attribute
    }
    return null
  }

  // Given a BFAST container (header/names/buffers) constructs a G3D data structure
  static fromBfast (bfast: BFast): AbstractG3d {
    if (bfast.buffers.length < 2) {
      throw new Error('G3D requires at least two BFast buffers')
    }

    // Parse first buffer as Meta
    const metaBuffer = bfast.buffers[0]
    if (bfast.names[0] !== 'meta') {
      throw new Error(
        "First G3D buffer must be named 'meta', but was named: " +
          bfast.names[0]
      )
    }
    const meta = new TextDecoder('utf-8').decode(metaBuffer)

    // Parse remaining buffers as Attributes
    const attributes: Attribute[] = []
    const nDescriptors = bfast.buffers.length - 1
    for (let i = 0; i < nDescriptors; ++i) {
      const attribute = Attribute.fromString(
        bfast.names[i + 1],
        bfast.buffers[i + 1]
      )
      attributes.push(attribute)
    }

    return new AbstractG3d(meta, attributes)
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
  static meshSubmeshes = 'g3d:mesh:submeshoffset:0:int32:1'
  static submeshIndexOffsets = 'g3d:submesh:indexoffset:0:int32:1'
  static submeshMaterials = 'g3d:submesh:material:0:int32:1'
  static materialColors = 'g3d:material:color:0:float32:4'
}

/**
 * A G3d with specific attributes according to the VIM format specification.
 * See https://github.com/vimaec/vim#vim-geometry-attributes for the vim specification.
 * See https://github.com/vimaec/g3d for the g3d specification.
 */
export class G3d {
  positions: Float32Array
  indices: Uint32Array

  instanceMeshes: Int32Array
  instanceTransforms: Float32Array
  meshSubmeshes: Int32Array
  submeshIndexOffset: Int32Array
  submeshMaterial: Int32Array
  materialColors: Float32Array

  // computed fields
  meshVertexOffsets: Int32Array
  meshInstances: Array<Array<number>>
  meshTransparent: Array<boolean>

  rawG3d: AbstractG3d

  matrixArity = 16
  colorArity = 4
  positionArity = 3
  defaultColor = new Float32Array([1, 1, 1, 1])

  constructor (g3d: AbstractG3d) {
    this.rawG3d = g3d

    this.positions = g3d.findAttribute(VimAttributes.positions)
      ?.data as Float32Array

    const tmp = g3d.findAttribute(VimAttributes.indices)?.data
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

    this.meshVertexOffsets = this.computeMeshVertexOffsets()
    this.rebaseIndices()
    this.meshInstances = this.computeMeshInstances()
    this.meshTransparent = this.computeMeshIsTransparent()
  }

  private computeMeshVertexOffsets (): Int32Array {
    const result = new Int32Array(this.getMeshCount())
    for (let m = 0; m < result.length; m++) {
      let min = Number.MAX_SAFE_INTEGER
      const start = this.getMeshIndexStart(m)
      const end = this.getMeshIndexEnd(m)
      for (let i = start; i < end; i++) {
        min = Math.min(min, this.indices[i])
      }
      result[m] = min
    }
    return result
  }

  private rebaseIndices () {
    const count = this.getMeshCount()
    for (let m = 0; m < count; m++) {
      const offset = this.meshVertexOffsets[m]
      const start = this.getMeshIndexStart(m)
      const end = this.getMeshIndexEnd(m)
      for (let i = start; i < end; i++) {
        this.indices[i] -= offset
      }
    }
  }

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

  private computeMeshIsTransparent (): Array<boolean> {
    const result = new Array<boolean>(this.getMeshCount())
    for (let m = 0; m < result.length; m++) {
      const subStart = this.getMeshSubmeshStart(m)
      const subEnd = this.getMeshSubmeshEnd(m)
      // const [subStart, subEnd] = this.getMeshSubmeshRange(m)
      for (let s = subStart; s < subEnd; s++) {
        const material = this.submeshMaterial[s]
        const alpha =
          this.materialColors[material * this.colorArity + this.colorArity - 1]
        result[m] = result[m] || alpha < 1
      }
    }
    return result
  }

  // ------------- All -----------------
  getVertexCount = () => this.positions.length / this.positionArity

  // ------------- Meshes -----------------
  getMeshCount = () => this.meshSubmeshes.length

  getMeshIndexStart (mesh: number): number {
    const subStart = this.getMeshSubmeshStart(mesh)
    return this.getSubmeshIndexStart(subStart)
  }

  getMeshIndexEnd (mesh: number): number {
    const subEnd = this.getMeshSubmeshEnd(mesh)
    return this.getSubmeshIndexEnd(subEnd - 1)
  }

  getMeshIndexCount (mesh: number): number {
    return this.getMeshIndexEnd(mesh) - this.getMeshIndexStart(mesh)
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

  getMeshSubmeshStart (mesh: number): number {
    return this.meshSubmeshes[mesh]
  }

  getMeshSubmeshEnd (mesh: number): number {
    return mesh < this.meshSubmeshes.length - 1
      ? this.meshSubmeshes[mesh + 1]
      : this.submeshIndexOffset.length
  }

  getMeshSubmeshCount (mesh: number): number {
    return this.getMeshSubmeshEnd(mesh) - this.getMeshSubmeshStart(mesh)
  }

  // ------------- Submeshes -----------------

  getSubmeshIndexStart (submesh: number): number {
    return this.submeshIndexOffset[submesh]
  }

  getSubmeshIndexEnd (submesh: number): number {
    return submesh < this.submeshIndexOffset.length - 1
      ? this.submeshIndexOffset[submesh + 1]
      : this.indices.length
  }

  getSubmeshIndexCount (submesh: number): number {
    return this.getSubmeshIndexEnd(submesh) - this.getSubmeshIndexStart(submesh)
  }

  getSubmeshColor (submesh: number): Float32Array {
    return this.getMaterialColor(this.submeshMaterial[submesh])
  }

  // ------------- Instances -----------------
  getInstanceCount = () => this.instanceMeshes.length

  getInstanceTransform (instance: number): Float32Array {
    return this.instanceTransforms.subarray(
      instance * this.matrixArity,
      (instance + 1) * this.matrixArity
    )
  }

  // ------------- Material -----------------

  getMaterialCount = () => this.materialColors.length / this.colorArity

  getMaterialColor (material: number): Float32Array {
    if (material < 0) return this.defaultColor
    return this.materialColors.subarray(
      material * this.colorArity,
      (material + 1) * this.colorArity
    )
  }

  static fromBfast (bfast: BFast): G3d {
    const base = AbstractG3d.fromBfast(bfast)
    return new G3d(base)
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
    if (this.positions.length % this.positionArity !== 0) {
      throw new Error(
        'Invalid position buffer, must be divisible by ' + this.positionArity
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
      this.instanceTransforms.length / this.matrixArity
    ) {
      throw new Error('Instance buffers mismatched')
    }

    if (this.instanceTransforms.length % this.matrixArity !== 0) {
      throw new Error(
        'Invalid InstanceTransform buffer, must respect arity ' +
          this.matrixArity
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
    if (this.materialColors.length % this.colorArity !== 0) {
      throw new Error(
        'Invalid material color buffer, must be divisible by ' + this.colorArity
      )
    }
  }
}
