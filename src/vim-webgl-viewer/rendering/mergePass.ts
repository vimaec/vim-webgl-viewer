/**
 * @module viw-webgl-viewer
 */

import THREE from 'three'
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass'
import { createMergeMaterial } from '../../vim-loader/materials/mergeMaterial'

/**
 * Merges a source buffer into the the current write buffer.
 */
export class MergePass extends Pass {
  private _fsQuad: FullScreenQuad
  private _uniforms: { [uniform: string]: THREE.IUniform<any> }

  constructor (texture: THREE.Texture) {
    super()

    this._fsQuad = new FullScreenQuad()
    const mat = createMergeMaterial()
    this._fsQuad.material = mat
    this._uniforms = mat.uniforms
    this._uniforms.sourceA.value = texture
  }

  dispose () {
    this._fsQuad.dispose()
  }

  render (
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget
  ) {
    this._uniforms.sourceB.value = readBuffer.texture
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
