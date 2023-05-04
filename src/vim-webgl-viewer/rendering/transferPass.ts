/**
 * @module viw-webgl-viewer/rendering
 */

import THREE from 'three'
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass'
import { createTransferMaterial } from '../../vim-loader/materials/transferMaterial'

/**
 * Copies a source buffer to the current write buffer.
 */
export class TransferPass extends Pass {
  private _fsQuad: FullScreenQuad
  private _uniforms: { [uniform: string]: THREE.IUniform<any> }

  constructor (sceneTexture: THREE.Texture) {
    super()

    this._fsQuad = new FullScreenQuad()
    const mat = createTransferMaterial()
    this._fsQuad.material = mat
    this._uniforms = mat.uniforms
    this._uniforms.source.value = sceneTexture
  }

  dispose () {
    this._fsQuad.dispose()
  }

  render (
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget
  ) {
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
  }
}
