import * as THREE from 'three'
import { Vim } from '../../vim'
import { InstancedSubmesh } from './instancedSubmesh'

export class InstancedMesh {
  vim: Vim
  mesh: THREE.InstancedMesh

  // instances
  instances: ArrayLike<number>
  boundingBox: THREE.Box3
  boxes: THREE.Box3[]

  // State
  ignoreSceneMaterial: boolean
  private _material: THREE.Material | THREE.Material[] | undefined

  constructor (mesh: THREE.InstancedMesh, instances: ArrayLike<number>) {
    this.mesh = mesh
    this.mesh.userData.vim = this
    this.instances = instances
    this.boxes = this.computeBoundingBoxesFast()
    this.boundingBox = this.computeBoundingBox(this.boxes)
  }

  get merged () {
    return false
  }

  /**
   * Returns submesh for given index.
   */
  getSubMesh (index: number) {
    return new InstancedSubmesh(this, index)
  }

  /**
   * Returns all submeshes for given index.
   */
  getSubmeshes () {
    const submeshes = new Array<InstancedSubmesh>(this.instances.length)
    for (let i = 0; i < this.instances.length; i++) {
      submeshes[i] = new InstancedSubmesh(this, i)
    }
    return submeshes
  }

  setMaterial (value: THREE.Material) {
    if (this._material === value) return
    if (this.ignoreSceneMaterial) return

    if (value) {
      if (!this._material) {
        this._material = this.mesh.material
      }
      this.mesh.material = value
    } else {
      if (this._material) {
        this.mesh.material = this._material
        this._material = undefined
      }
    }
  }

  private computeBoundingBoxesFast () {
    this.mesh.geometry.computeBoundingBox()

    const boxes = new Array<THREE.Box3>(this.mesh.count)
    const matrix = new THREE.Matrix4()
    for (let i = 0; i < this.mesh.count; i++) {
      this.mesh.getMatrixAt(i, matrix)
      boxes[i] = this.mesh.geometry.boundingBox.clone().applyMatrix4(matrix)
    }

    return boxes
  }

  private computeBoundingBoxes () {
    const positions = this.mesh.geometry.getAttribute('position')

    const vector = new THREE.Vector3()
    const matrix = new THREE.Matrix4()

    const getPoint = (i: number, p: number) => {
      this.mesh.getMatrixAt(i, matrix)

      vector.fromArray(positions.array, p * 3)
      vector.applyMatrix4(matrix)

      return vector
    }

    const boxes = new Array<THREE.Box3>(this.mesh.count)

    for (let i = 0; i < this.mesh.count; i++) {
      // First point of instance box.
      const first = getPoint(i, 0)
      const box = new THREE.Box3(first, first)

      // Others points of instance box
      for (let p = 1; p < positions.count; p++) {
        box.expandByPoint(getPoint(i, p))
      }

      boxes[i] = box
      if (Number.isNaN(box.min.x)) {
        console.log('NAN')
      }
    }

    return boxes
  }

  computeBoundingBox (boxes: THREE.Box3[]) {
    const box = boxes[0].clone()
    for (let i = 1; i < boxes.length; i++) {
      box.union(boxes[i])
    }
    return box
  }
}
