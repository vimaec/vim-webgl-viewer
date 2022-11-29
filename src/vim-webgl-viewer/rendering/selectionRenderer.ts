/**
 * @module viw-webgl-viewer
 */

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import * as THREE from 'three'
import { Viewport } from '../viewport'
import { RenderScene } from './renderScene'
import { VimMaterials } from '../../vim-loader/materials'
import { SelectionOutlinePass } from './selectionOutlinePass'

import { Camera } from '../camera'

/*
  *---------------*
  | Regular Scene | -----------
  *---------------*            |
                               |
  *-----------------*     *----------*      *--------*
  |Selected Objects | --- | Outlines | ---  | Screen |
  *-----------------*     *----------*      *--------*
*/

/**
 * Rendering for selection outline.
 */
export class SelectionRenderer {
  private _renderer: THREE.WebGLRenderer
  private _scene: RenderScene
  private _materials: VimMaterials
  private _camera: THREE.PerspectiveCamera | THREE.OrthographicCamera

  private _selectionComposer: EffectComposer
  private _sceneComposer: EffectComposer
  private _renderPass: RenderPass
  private _selectionRenderPass: RenderPass

  // Disposables
  private _outlinePass: SelectionOutlinePass
  private _selectionTarget: THREE.WebGLRenderTarget
  private _sceneTarget: THREE.WebGLRenderTarget
  private _depthTexture: THREE.DepthTexture

  constructor (
    renderer: THREE.WebGLRenderer,
    scene: RenderScene,
    viewport: Viewport,
    materials: VimMaterials,
    camera: Camera
  ) {
    this._renderer = renderer
    this._scene = scene
    this._materials = materials
    this._camera = camera.camera

    const size = viewport.getSize()
    this.setup(size.x, size.y)
  }

  setup (width: number, height: number) {
    // Composer for regular scene rendering
    // 4 samples provides default browser antialiasing
    this._sceneTarget = new THREE.WebGLRenderTarget(width, height)
    this._sceneTarget.samples = 4

    this._sceneComposer = new EffectComposer(this._renderer, this._sceneTarget)
    this._sceneComposer.renderToScreen = false

    this._renderPass = new RenderPass(this._scene.scene, this._camera)
    this._sceneComposer.addPass(this._renderPass)

    // Composer for selection effect
    this._depthTexture = new THREE.DepthTexture(width, height)
    this._selectionTarget = new THREE.WebGLRenderTarget(width, height, {
      depthTexture: this._depthTexture,
      depthBuffer: true
    })
    this._selectionComposer = new EffectComposer(
      this._renderer,
      this._selectionTarget
    )

    // Render only selected objects
    this._selectionRenderPass = new RenderPass(
      this._scene.scene,
      this._camera,
      this._materials.outline
    )
    this._selectionComposer.addPass(this._selectionRenderPass)

    // Render higlight from selected object on top of regular scene
    this._outlinePass = new SelectionOutlinePass(
      new THREE.Vector2(width, height),
      this._camera,
      this._sceneComposer.readBuffer.texture
    )
    this._selectionComposer.addPass(this._outlinePass)
  }

  get camera () {
    return this._camera
  }

  set camera (value: THREE.PerspectiveCamera | THREE.OrthographicCamera) {
    this._renderPass.camera = value
    this._selectionRenderPass.camera = value
    this._outlinePass.camera = value
    this._camera = value
  }

  setSize (width: number, height: number) {
    this._sceneComposer.setSize(width, height)
    this._selectionComposer.setSize(width, height)
  }

  render () {
    this._sceneComposer.render()
    this._selectionComposer.render()
  }

  dispose () {
    this._sceneTarget.dispose()
    this._selectionTarget.dispose()
    this._depthTexture.dispose()
    this._outlinePass.dispose()
  }
}
