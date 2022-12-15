/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { SSAARenderPass } from 'three/examples/jsm/postprocessing/SSAARenderPass.js'
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

import { Viewport } from '../viewport'
import { RenderScene } from './renderScene'
import { VimMaterials } from '../../vim-loader/materials/materials'
import { OutlinePass } from './outlinePass'
import { MergePass } from './mergePass'
import { TransferPass } from './transferPass'
import { Camera } from '../camera'

/*
  *---------------------*
  | Regular/SSAA Render | ---------------------------------------
  *---------------------*                                       |
                                                                |
  *-----------------*     *----------*      *------*     *----------------*     *--------*
  |Render Selection | --- | Outlines | ---  | FXAA | --- | Merge/Transfer | --- | Screen |
  *-----------------*     *----------*      *------*     *----------------*     *--------*
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
  private _fxaaPass: ShaderPass
  private _mergePass: MergePass
  private _outlineTarget: THREE.WebGLRenderTarget
  private _sceneTarget: THREE.WebGLRenderTarget

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
    this.setupRendering()
    this.setupOutline()
  }

  private setupRendering () {
    // Create render texture
    this._sceneTarget = new THREE.WebGLRenderTarget(
      this._size.x,
      this._size.y,
      {
        samples: this._samples
      }
    )
    this._sceneTarget.texture.name = 'sceneTarget'

    // Render pass when camera is moving
    this._renderPass = new RenderPass(this._scene.scene, this._camera)
    this._renderPass.renderToScreen = false
    this._renderPass.clearColor = new THREE.Color(0, 0, 0)
    this._renderPass.clearAlpha = 0

    // SSAA Render pass when camera is idle
    this._ssaaRenderPass = new SSAARenderPass(
      this._scene.scene,
      this._camera,
      new THREE.Color(0, 0, 0),
      0
    )
    this._ssaaRenderPass.renderToScreen = false
    this._ssaaRenderPass.sampleRenderTarget = this._sceneTarget.clone()
    this._ssaaRenderPass.sampleLevel = 2
    this._ssaaRenderPass.unbiased = true
  }

  private setupOutline () {
    // Create textures
    this._outlineTarget = new THREE.WebGLRenderTarget(
      this._size.x,
      this._size.y,
      {
        depthTexture: new THREE.DepthTexture(this._size.x, this._size.y),
        samples: this._samples
      }
    )
    this._outlineTarget.texture.name = 'selectionTarget'
    this._composer = new EffectComposer(this._renderer, this._outlineTarget)

    // Render only selected objects
    this._selectionRenderPass = new RenderPass(
      this._scene.scene,
      this._camera,
      this._materials.mask
    )

    this._composer.addPass(this._selectionRenderPass)

    // Draw Outline
    this._outlinePass = new OutlinePass(
      this._sceneTarget.texture,
      this._materials.outline
    )
    this._composer.addPass(this._outlinePass)

    // Apply FXAA
    this._fxaaPass = new ShaderPass(FXAAShader)
    this._composer.addPass(this._fxaaPass)

    // Merge Outline with scene
    this._mergePass = new MergePass(this._sceneTarget.texture)
    this._mergePass.needsSwap = false
    this._composer.addPass(this._mergePass)

    // When no outlines, just copy the scene to screen.
    this._transferPass = new TransferPass(this._sceneTarget.texture)
    this._transferPass.needsSwap = false
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
    this._fxaaPass.enabled = this.outlines
    this._mergePass.enabled = this.outlines
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
    this._fxaaPass.uniforms.resolution.value.set(1 / width, 1 / height)
  }

  //
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

      this._renderPass.render(
        this._renderer,
        undefined,
        this._sceneTarget,
        this._clock.getDelta(),
        false
      )
    } else if (time > this._aaResumeTime) {
      this._ssaaRenderPass.render(
        this._renderer,
        this._sceneTarget,
        this._ssaaRenderPass.sampleRenderTarget,
        this._clock.getDelta(),
        false
      )
    }

    // Adds the outline to the rendered scene if needed.
    this._composer.render()
  }

  dispose () {
    this._sceneTarget.dispose()
    this._outlineTarget.dispose()
    this._outlinePass.dispose()
    this._ssaaRenderPass.dispose()
    this._fxaaPass.dispose()
  }
}
