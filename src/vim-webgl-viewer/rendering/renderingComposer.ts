/**
 * @module viw-webgl-viewer
 */

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import * as THREE from 'three'
import { Viewport } from '../viewport'
import { RenderScene } from './renderScene'
import { VimMaterials } from '../../vim-loader/materials/materials'
import { OutlinePass } from './outlinePass'
import { TransferPass } from './transferPass'

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
export class RenderingComposer {
  private _renderer: THREE.WebGLRenderer
  private _scene: RenderScene
  private _materials: VimMaterials
  private _camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
  private _samples: number = 4
  private _size: THREE.Vector2

  private _selectionComposer: EffectComposer
  private _sceneComposer: EffectComposer
  private _renderPass: RenderPass
  private _selectionRenderPass: RenderPass
  private _transferPass: TransferPass
  private _outlines: boolean

  // Disposables
  private _outlinePass: OutlinePass
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
    this._samples = renderer.capabilities.isWebGL2
      ? renderer.capabilities.maxSamples
      : 0
    this._renderer = renderer
    this._scene = scene
    this._materials = materials
    this._camera = camera.camera
    this._size = viewport.getSize()
    this.setup()
  }

  private setup () {
    // Composer for regular scene rendering
    // 4 samples provides default browser antialiasing
    this._sceneTarget = new THREE.WebGLRenderTarget(
      this._size.x,
      this._size.y,
      { samples: this._samples }
    )

    this._sceneComposer = new EffectComposer(this._renderer, this._sceneTarget)
    this._sceneComposer.renderToScreen = false

    this._renderPass = new RenderPass(this._scene.scene, this._camera)
    this._sceneComposer.addPass(this._renderPass)

    // Composer for selection effect
    this._depthTexture = new THREE.DepthTexture(this._size.x, this._size.y)
    this._selectionTarget = new THREE.WebGLRenderTarget(
      this._size.x,
      this._size.y,
      {
        depthTexture: this._depthTexture,
        depthBuffer: true,
        samples: this._samples
      }
    )

    this._selectionComposer = new EffectComposer(
      this._renderer,
      this._selectionTarget
    )

    // Render only selected objects
    this._selectionRenderPass = new RenderPass(
      this._scene.scene,
      this._camera,
      this._materials.mask
    )

    this._selectionComposer.addPass(this._selectionRenderPass)

    // Render higlight from selected object on top of regular scene
    this._outlinePass = new OutlinePass(
      this._sceneComposer.readBuffer.texture,
      this._materials.outline
    )
    this._selectionComposer.addPass(this._outlinePass)

    // When no outlines, just copy the scene to screen.
    this._transferPass = new TransferPass(
      this._sceneComposer.readBuffer.texture
    )
    this._selectionComposer.addPass(this._transferPass)
  }

  get outlines () {
    return this._outlines
  }

  set outlines (value: boolean) {
    this._outlines = value
    this._selectionRenderPass.enabled = this.outlines
    this._outlinePass.enabled = this.outlines
    this._transferPass.enabled = !this.outlines
  }

  get camera () {
    return this._camera
  }

  set camera (value: THREE.PerspectiveCamera | THREE.OrthographicCamera) {
    this._renderPass.camera = value
    this._selectionRenderPass.camera = value
    this._outlinePass.material.camera = value
    this._camera = value
  }

  setSize (width: number, height: number) {
    this._size = new THREE.Vector2(width, height)
    this._sceneComposer.setSize(width, height)
    this._selectionComposer.setSize(width, height)
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
    this._selectionComposer.render()
  }

  dispose () {
    this._sceneTarget.dispose()
    this._selectionTarget.dispose()
    this._depthTexture.dispose()
    this._outlinePass.dispose()
  }
}
