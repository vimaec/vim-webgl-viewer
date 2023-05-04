/**
 * @module viw-webgl-viewer/rendering
 */

import * as THREE from 'three'
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'
import { OutlineMaterial } from '../../vim-loader/materials/outlineMaterial'

// Follows the structure of
// https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/OutlinePass.js
// Based on https://github.com/OmarShehata/webgl-outlines/blob/cf81030d6f2bc20e6113fbf6cfd29170064dce48/threejs/src/CustomOutlinePass.js
/**
 * Edge detection pass on the current readbuffer depth texture.
 */
export class OutlinePass extends Pass {
  private _fsQuad: FullScreenQuad
  material: OutlineMaterial

  constructor (
    sceneBuffer: THREE.Texture,
    camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
    material?: OutlineMaterial
  ) {
    super()

    this.material = material ?? new OutlineMaterial()
    this.material.sceneBuffer = sceneBuffer
    this.material.camera = camera
    this._fsQuad = new FullScreenQuad(this.material.material)
  }

  setSize (width: number, height: number) {
    this.material.resolution = new THREE.Vector2(width, height)
  }

  get camera () {
    return this.material.camera
  }

  set camera (value: THREE.PerspectiveCamera | THREE.OrthographicCamera) {
    this.material.camera = value
  }

  dispose () {
    this._fsQuad.dispose()
    this.material.dispose()
  }

  render (
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget
  ) {
    // Turn off writing to the depth buffer
    // because we need to read from it in the subsequent passes.
    const depthBufferValue = writeBuffer.depthBuffer
    writeBuffer.depthBuffer = false
    this.material.depthBuffer = readBuffer.depthTexture

    // 2. Draw the outlines using the depth texture and normal texture
    // and combine it with the scene color
    if (this.renderToScreen) {
      // If this is the last effect, then renderToScreen is true.
      // So we should render to the screen by setting target null
      // Otherwise, just render into the writeBuffer that the next effect will use as its read buffer.
      renderer.setRenderTarget(null)
      this._fsQuad.render(renderer)
    } else {
      renderer.setRenderTarget(writeBuffer)
      this._fsQuad.render(renderer)
    }

    // Reset the depthBuffer value so we continue writing to it in the next render.
    writeBuffer.depthBuffer = depthBufferValue
  }
}
