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

  private _renderer: THREE.WebGLRenderer

  private _samples: number = 1
  private _size: THREE.Vector2

  private _sceneComposer: EffectComposer
  private _renderPass: RenderPass

  // Disposables
  private _sceneTarget: THREE.WebGLRenderTarget
  private _depthTexture: THREE.DepthTexture

  constructor (
    renderer: THREE.WebGLRenderer,
    scene: RenderScene,
    viewport: Viewport,
    camera: Camera
  ) {
    this._renderer = renderer
    this._scene = scene
    this._camera = camera.camera

    this._size = viewport.getSize()
    this.setup()
  }

  private setup () {
    this._sceneComposer = new EffectComposer(this._renderer)

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
    this._size = new THREE.Vector2(width, height)
    this._sceneComposer.setSize(width, height)
  }

  get samples () {
    return this._samples
  }

  set samples (value: number) {
    this.dispose()
    this._samples = value
    this.setup()
  }

  render () {
    this._sceneComposer.render()
  }

  dispose () {
    this._sceneTarget.dispose()
  }
}
