/**
 * @module vim-loader/materials
 */

import * as THREE from 'three'

export class MergeMaterial {
  material: THREE.ShaderMaterial

  constructor () {
    this.material = createMergeMaterial()
  }

  get color () {
    return this.material.uniforms.color.value
  }

  set color (value: THREE.Color) {
    this.material.uniforms.color.value.copy(value)
    this.material.uniformsNeedUpdate = true
  }

  get sourceA () {
    return this.material.uniforms.sourceA.value
  }

  set sourceA (value: THREE.Texture) {
    this.material.uniforms.sourceA.value = value
    this.material.uniformsNeedUpdate = true
  }

  get sourceB () {
    return this.material.uniforms.sourceB.value
  }

  set sourceB (value: THREE.Texture) {
    this.material.uniforms.sourceB.value = value
    this.material.uniformsNeedUpdate = true
  }
}

/**
 * Material that Merges current fragment with a source texture.
 */
export function createMergeMaterial () {
  return new THREE.ShaderMaterial({
    uniforms: {
      sourceA: { value: null },
      sourceB: { value: null },
      color: { value: new THREE.Color(1, 1, 1) }
    },
    vertexShader: `
       varying vec2 vUv;
       void main() {
         vUv = uv;
         gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
       }
       `,
    fragmentShader: `
       uniform vec3 color;
       uniform sampler2D sourceA;
       uniform sampler2D sourceB;
       varying vec2 vUv;
       
       void main() {
        vec4 A = texture2D(sourceA, vUv);
        vec4 B = texture2D(sourceB, vUv);

        gl_FragColor = vec4(mix(A.xyz, color, B.x),1.0f);
       }
       `
  })
}
