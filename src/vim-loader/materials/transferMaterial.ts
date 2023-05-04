/**
 * @module vim-loader/materials
 */

import * as THREE from 'three'

/**
 * This material simply sample and returns the value at each texel position of the texture.
 */
export function createTransferMaterial () {
  return new THREE.ShaderMaterial({
    uniforms: {
      source: { value: null }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
      `,
    fragmentShader: `
      uniform sampler2D source;
      varying vec2 vUv;
      
      void main() {
        gl_FragColor = texture2D(source, vUv);
      }
      `
  })
}
