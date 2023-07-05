/**
 * @module viw-webgl-viewer/rendering
 */

import * as THREE from 'three'
import { Scene } from '../../vim-loader/scene'

/**
 * Wrapper around the THREE scene that tracks bounding box and other information.
 */
export class RenderScene {
  scene: THREE.Scene

  // state
  private _scenes: Scene[] = []
  private _boundingBox: THREE.Box3 | undefined
  private _memory: number = 0

  constructor () {
    this.scene = new THREE.Scene()
  }

  get estimatedMemory () {
    return this._memory
  }

  /** Returns an array of all the scenes that were updated since last clearUpdateFlags */
  getUpdatedScenes () {
    const result: Scene[] = []
    for (const s of this._scenes) {
      if (s.updated) result.push(s)
    }
    return result
  }

  hasOutline () {
    for (const s of this._scenes) {
      if (s.hasOutline) return true
    }
    return false
  }

  /** Clears the scene updated flags */
  clearUpdateFlags () {
    this._scenes.forEach((s) => s.clearUpdateFlag())
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
   * Add object to be rendered
   */
  add (target: Scene | THREE.Object3D) {
    if (target instanceof Scene) {
      this.addScene(target)
    } else {
      this.scene.add(target)
    }
  }

  /**
   * Remove object from rendering
   */
  remove (target: Scene | THREE.Object3D) {
    if (target instanceof Scene) {
      this.removeScene(target)
    } else {
      this.scene.remove(target)
    }
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
    this._scenes.push(scene)
    scene.meshes.forEach((m) => {
      this.scene.add(m.mesh)
    })

    this.updateBox(scene.getBoundingBox())
    scene.onUpdate.sub(() => this.updateBox(scene.getBoundingBox()))

    // Memory
    this._memory += scene.getMemory()
  }

  private updateBox (box: THREE.Box3) {
    this._boundingBox = this._boundingBox ? this._boundingBox.union(box) : box
  }

  private removeScene (scene: Scene) {
    // Remove from array
    this._scenes = this._scenes.filter((f) => f !== scene)

    // Remove all meshes from three scene
    for (let i = 0; i < scene.meshes.length; i++) {
      this.scene.remove(scene.meshes[i].mesh)
    }

    // Recompute bounding box
    this._boundingBox =
      this._scenes.length > 0
        ? this._scenes
          .map((s) => s.getBoundingBox())
          .reduce((b1, b2) => b1.union(b2))
        : undefined
    this._memory -= scene.getMemory()
  }
}
