/**
 * @module viw-webgl-viewer/rendering
 */

import * as THREE from 'three'
import { Scene } from '../../vim-loader/scene'
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer'

/**
 * Wrapper around the THREE scene that tracks bounding box and other information.
 */
export class RenderScene {
  scene: THREE.Scene

  // state
  boxUpdated = false

  private _vimScenes: Scene[] = []
  private _boundingBox: THREE.Box3 | undefined
  private _memory = 0
  private _2dCount = 0

  constructor () {
    this.scene = new THREE.Scene()
  }

  get estimatedMemory () {
    return this._memory
  }

  has2dObjects () {
    return this._2dCount > 0
  }

  hasOutline () {
    for (const s of this._vimScenes) {
      if (s.hasOutline) return true
    }
    return false
  }

  /** Clears the scene updated flags */
  clearUpdateFlags () {
    this._vimScenes.forEach((s) => s.clearUpdateFlag())
  }

  /**
   * Returns the bounding box encompasing all rendererd objects.
   * @param target box in which to copy result, a new instance is created if undefined.
   */
  getBoundingBox (target: THREE.Box3 = new THREE.Box3()) {
    return this._boundingBox
      ? target.copy(this._boundingBox)
      : target.set(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1))
  }

  /**
   * Returns the bounding box of the average center of all meshes.
   * Less precise but is more stable against outliers.
   */
  getAverageBoundingBox () {
    if (this._vimScenes.length === 0) {
      return new THREE.Box3()
    }
    const result = new THREE.Box3()
    result.copy(this._vimScenes[0].getAverageBoundingBox())
    for (let i = 1; i < this._vimScenes.length; i++) {
      result.union(this._vimScenes[i].getAverageBoundingBox())
    }
    return result
  }

  /**
   * Add object to be rendered
   */
  add (target: Scene | THREE.Object3D) {
    if (target instanceof Scene) {
      this.addScene(target)
      return
    }

    this._2dCount += this.count2dObjects(target)
    this.scene.add(target)
  }

  private count2dObjects (target : THREE.Object3D) {
    if (target instanceof CSS2DObject) {
      return 1
    }
    if (target instanceof THREE.Group) {
      let result = 0
      for (const child of target.children) {
        if (child instanceof CSS2DObject) {
          result++
        }
      }
      return result
    }
    return 0
  }

  private unparent2dObjects (target : THREE.Object3D) {
    if (target instanceof THREE.Group) {
      for (const child of target.children) {
        if (child instanceof CSS2DObject) {
          target.remove(child)
        }
      }
    }
  }

  /**
   * Remove object from rendering
   */
  remove (target: Scene | THREE.Object3D) {
    if (target instanceof Scene) {
      this.removeScene(target)
      return
    }

    this._2dCount -= this.count2dObjects(target)
    this.unparent2dObjects(target)
    this.scene.remove(target)
  }

  /**
   * Removes all rendered objects
   */
  clear () {
    this.scene.clear()
    this._boundingBox = undefined
    this._memory = 0
  }

  private addScene (scene: Scene) {
    this._vimScenes.push(scene)
    scene.meshes.forEach((m) => {
      this.scene.add(m.mesh)
    })

    this.updateBox(scene.getBoundingBox())

    // Memory
    this._memory += scene.getMemory()
  }

  updateBox (box: THREE.Box3 | undefined) {
    if (!box) return
    this.boxUpdated = true
    this._boundingBox = this._boundingBox ? this._boundingBox.union(box) : box
  }

  private removeScene (scene: Scene) {
    // Remove from array
    this._vimScenes = this._vimScenes.filter((f) => f !== scene)

    // Remove all meshes from three scene
    for (let i = 0; i < scene.meshes.length; i++) {
      this.scene.remove(scene.meshes[i].mesh)
    }

    // Recompute bounding box
    this._boundingBox =
      this._vimScenes.length > 0
        ? this._vimScenes
          .map((s) => s.getBoundingBox())
          .reduce((b1, b2) => b1.union(b2))
        : undefined
    this._memory -= scene.getMemory()
  }
}
