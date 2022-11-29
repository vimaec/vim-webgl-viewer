/**
 * @module viw-webgl-viewer
 */

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

import * as THREE from 'three'
import { Viewport } from '../viewport'
import { RenderScene } from '../renderScene'
import { Camera } from '../camera'

/*
  *--------------*      *-------------*     * -------*
  |Regular Scene |  --- | Antialising | --- | Screen |
  *--------------*      *-------------*     *--------*
*/
/**
 * Rendering for regular situation.
 */
export class StandardRenderer {
  _renderer: THREE.WebGLRenderer
  _scene: RenderScene
  _viewport: Viewport
  _camera: THREE.Camera

  _renderPass: RenderPass
  _aaPass: ShaderPass
  _sceneComposer: EffectComposer

  constructor (
    renderer: THREE.WebGLRenderer,
    scene: RenderScene,
    viewport: Viewport,
    camera: Camera
  ) {
    this._renderer = renderer
    this._scene = scene
    this._camera = camera.camera
    const size = viewport.getSize()
    this.setup(size.x, size.y)
  }

  setup (width: number, height: number) {
    this._sceneComposer = new EffectComposer(this._renderer)
    this._sceneComposer.setSize(width, height)

    this._renderPass = new RenderPass(this._scene.scene, this._camera)
    this._sceneComposer.addPass(this._renderPass)
  }

  get camera () {
    return this._renderPass.camera
  }

  set camera (value: THREE.Camera) {
    this._renderPass.camera = value
  }

  setSize (width: number, height: number) {
    this._sceneComposer.setSize(width, height)
  }

  render () {
    this._sceneComposer.render()
  }

  dispose () {}
}
