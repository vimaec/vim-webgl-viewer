/**
 * @module viw-webgl-viewer
 */

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import * as THREE from 'three'
import { Viewport } from '../viewport'
import { RenderScene } from './renderScene'

import { Camera } from '../camera'

export class StandardRenderer {
  private _scene: RenderScene
  private _camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
  private _samples: number = 4
  private _renderer: THREE.WebGLRenderer

  private _sceneComposer: EffectComposer
  private _renderPass: RenderPass

  // Disposables
  private _sceneTarget: THREE.WebGLRenderTarget

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

  private setup (width: number, height: number) {
    // Composer for regular scene rendering
    // 4 samples provides default browser antialiasing
    this._sceneTarget = new THREE.WebGLRenderTarget(width, height)
    this._sceneTarget.samples = this._samples

    this._sceneComposer = new EffectComposer(this._renderer, this._sceneTarget)

    this._renderPass = new RenderPass(this._scene.scene, this._camera)
    this._sceneComposer.addPass(this._renderPass)
  }

  get camera () {
    return this._camera
  }

  set camera (value: THREE.PerspectiveCamera | THREE.OrthographicCamera) {
    this._renderPass.camera = value
  }

  setSize (width: number, height: number) {
    this._sceneComposer.setSize(width, height)
  }

  get samples () {
    return this._samples
  }

  set samples (value: number) {
    this._samples = value
    this._sceneTarget.samples = value
  }

  render () {
    this._sceneComposer.render()
  }

  dispose () {
    this._sceneTarget.dispose()
  }
}
