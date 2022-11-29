/**
 * @module viw-webgl-viewer
 */

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js'
import * as THREE from 'three'
import { Viewport } from '../viewport'
import { RenderScene } from '../renderScene'
import { VimMaterials } from '../../vim-loader/materials'
import { CustomOutlinePass } from '../selectionOutlinePass'

import { Camera } from '../camera'

/*
  *---------------*
  | Regular Scene | -----------
  *---------------*            |
                               |
  *-----------------*     *----------*     *--------------*     *--------*
  |Selected Objects | --- | Outlines | --- | Antialiasing | --- | Screen |
  *-----------------*     *----------*     *--------------*     *--------*
*/

/**
 * Rendering for selection outline.
 */
export class SelectionRenderer {
  private _renderer: THREE.WebGLRenderer
  private _scene: RenderScene
  private _materials: VimMaterials
  private _camera: THREE.Camera

  private _selectionComposer: EffectComposer
  private _sceneComposer: EffectComposer
  private _aaPass: ShaderPass

  // Disposables
  private _outlinePass: any
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
    this._sceneComposer.addPass(new RenderPass(this._scene.scene, this._camera))

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
    this._selectionComposer.addPass(
      new RenderPass(this._scene.scene, this._camera, this._materials.outline)
    )

    // Render higlight from selected object on top of regular scene
    this._outlinePass = new CustomOutlinePass(
      new THREE.Vector2(width, height),
      this._scene.scene,
      this._camera
    )
    this._selectionComposer.addPass(this._outlinePass)

    // Insert the result of scene composer into the outline composer
    const uniforms = this._outlinePass.fsQuad.material.uniforms
    uniforms.sceneColorBuffer.value = this._sceneComposer.readBuffer.texture

    // Lastly a antialiasing pass to replace browser AA.
    this._aaPass = new ShaderPass(FXAAShader)
    this._aaPass.uniforms.resolution.value.set(1 / width, 1 / height)
    // this._selectionComposer.addPass(this._aaPass)
  }

  get camera () {
    return this._camera
  }

  set camera (value: THREE.Camera) {
    this._camera = value
  }

  setSize (width: number, height: number) {
    this._sceneComposer.setSize(width, height)
    this._selectionComposer.setSize(width, height)
    this._aaPass.uniforms.resolution.value.set(1 / width, 1 / height)
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
