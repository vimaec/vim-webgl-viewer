/**
 * @module vim-loader/materials
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
    depthWrite: false,
    clipping: true,
    vertexShader: `
    #include <common>
    #include <logdepthbuf_pars_vertex>
    #include <clipping_planes_pars_vertex>

    varying vec4 vColor;
    void main() {
      #include <begin_vertex>
      #include <project_vertex>
      #include <logdepthbuf_vertex>
      #include <clipping_planes_vertex>

      vColor = color;
    }
    `,
    fragmentShader: `
    #include <common>
    #include <logdepthbuf_pars_fragment>
    #include <clipping_planes_pars_fragment>
    varying vec4 vColor;

    void main() {
      
      #include <clipping_planes_fragment>
      #include <logdepthbuf_fragment>

      gl_FragColor = vColor;
    }
    `
  })
}
