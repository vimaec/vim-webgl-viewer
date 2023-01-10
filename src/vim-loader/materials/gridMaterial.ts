/**
 * @module vim-loader
 */

import * as THREE from 'three'

/**
 * Material for isolation mode
 * Non visible item appear as transparent.
 * Visible items are flat shaded with a basic pseudo lighting.
 * Supports object coloring but in which.
 */
export function createGridMaterial () {
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    vertexColors: true,
    vertexShader: `
    #include <common>
    #include <logdepthbuf_pars_vertex>

    varying vec3 vPosition;
    varying vec3 vColor;
    void main() {

      vec4 pos = modelMatrix * vec4(position, 1.0);
      vPosition = pos.xyz / pos.w;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      vColor = color;
      #include <logdepthbuf_vertex>
    }
    `,
    fragmentShader: `
    #include <common>
    #include <logdepthbuf_pars_fragment>
    varying vec3 vPosition;
    varying vec3 vColor;

    void main() {
      #include <logdepthbuf_fragment>
      float a = (2.0f*PI)/30.0f;
      float b = 10.0f;
      float x = sin(a* vPosition.x + b);
      x = x > 0.999f ? x : 0.0f;

      float y = sin(a * vPosition.y + b);
      y = y > 0.999f ? y : 0.0f;

      float z = sin(a*vPosition.z + b);
      z = z > 0.999f ? z : 0.0f;

      float p = min(x + y + z, 1.0f);

      gl_FragColor = vec4(vColor, 0.2f);
      //gl_FragDepthEXT = p > 0.0f ? gl_FragDepthEXT : 100.0f;
    }
    `
  })
}
