/**
 * @module vim-loader
 */

import * as THREE from 'three'

/**
 * Material that Merges current fragment with a source texture.
 */
export function createMergeMaterial () {
  return new THREE.ShaderMaterial({
    uniforms: {
      sourceA: { value: null },
      sourceB: { value: null },
      outlineColor: { value: new THREE.Color(1, 1, 1) }
    },
    vertexShader: `
       varying vec2 vUv;
       void main() {
         vUv = uv;
         gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
       }
       `,
    fragmentShader: `
       uniform vec3 outlineColor;
       uniform sampler2D sourceA;
       uniform sampler2D sourceB;
       varying vec2 vUv;
       
       void main() {
        vec4 A = texture2D(sourceA, vUv);
        vec4 B = texture2D(sourceB, vUv);

        gl_FragColor = vec4(mix(A.xyz, outlineColor, B.x),1.0f);
       }
       `
  })
}
