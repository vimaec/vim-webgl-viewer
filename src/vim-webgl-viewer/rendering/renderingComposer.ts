/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { SSAARenderPass } from 'three/examples/jsm/postprocessing/SSAARenderPass.js'

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
  private _cam: Camera
  private _renderer: THREE.WebGLRenderer
  private _scene: RenderScene
  private _materials: VimMaterials
  private _camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
  private _samples: number = 4
  private _size: THREE.Vector2

  private _composer: EffectComposer
  private _renderPass: RenderPass
  private _ssaaRenderPass: SSAARenderPass
  private _selectionRenderPass: RenderPass
  private _transferPass: TransferPass
  private _outlines: boolean
  private _clock: THREE.Clock = new THREE.Clock()

  private _aaResumeTime

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
    this._cam = camera
    this._samples = renderer.capabilities.isWebGL2
      ? renderer.capabilities.maxSamples
      : 0
    this._renderer = renderer
    this._scene = scene
    this._materials = materials
    this._camera = camera.camera
    this._size = viewport.getSize()
    this.setup()

    this._clock = new THREE.Clock()
    this._scene.scene.background = new THREE.Color('#d8d8e6')
  }

  private setup () {
    // Composer for regular scene rendering
    this._sceneTarget = new THREE.WebGLRenderTarget(
      this._size.x,
      this._size.y,
      {
        samples: this._samples
        // type: THREE.HalfFloatType
      }
    )

    // Render pass for movement
    this._renderPass = new RenderPass(this._scene.scene, this._camera)
    this._renderPass.clearColor = new THREE.Color(0, 0, 0)
    this._renderPass.clearAlpha = 0

    // SSAA Render pass for idle
    this._ssaaRenderPass = new SSAARenderPass(
      this._scene.scene,
      this._camera,
      new THREE.Color(0, 0, 0),
      0
    )
    this._ssaaRenderPass.sampleRenderTarget = this._sceneTarget.clone()
    this._ssaaRenderPass.sampleLevel = 2
    this._ssaaRenderPass.unbiased = true

    // Composer for selection effect
    this._selectionTarget = new THREE.WebGLRenderTarget(
      this._size.x,
      this._size.y,
      {
        depthTexture: new THREE.DepthTexture(this._size.x, this._size.y),
        samples: this._samples
      }
    )

    this._composer = new EffectComposer(this._renderer, this._selectionTarget)

    // Render only selected objects
    this._selectionRenderPass = new RenderPass(
      this._scene.scene,
      this._camera,
      this._materials.mask
    )

    this._composer.addPass(this._selectionRenderPass)

    // Render higlight from selected object on top of regular scene
    this._outlinePass = new OutlinePass(
      this._sceneTarget.texture,
      this._materials.outline
    )
    this._composer.addPass(this._outlinePass)

    // When no outlines, just copy the scene to screen.
    this._transferPass = new TransferPass(this._sceneTarget.texture)
    this._transferPass.enabled = true
    this._composer.addPass(this._transferPass)
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
    this._sceneTarget.setSize(width, height)
    this._renderPass.setSize(width, height)
    this._ssaaRenderPass.setSize(width, height)
    this._composer.setSize(width, height)
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
    const time = new Date().getTime()
    if (this._cam.hasMoved) {
      this._aaResumeTime = time + 20

      this._renderPass.renderToScreen = false
      this._renderPass.render(
        this._renderer,
        undefined,
        this._sceneTarget,
        this._clock.getDelta(),
        false
      )
    } else if (time > this._aaResumeTime) {
      this._ssaaRenderPass.renderToScreen = false
      this._ssaaRenderPass.render(
        this._renderer,
        this._sceneTarget,
        this._ssaaRenderPass.sampleRenderTarget,
        this._clock.getDelta(),
        false
      )
    }

    this._composer.render()
  }

  dispose () {
    this._sceneTarget.dispose()
    this._selectionTarget.dispose()
    this._outlinePass.dispose()
    this._renderPass.dispose()
    this._ssaaRenderPass.dispose()
  }
}
