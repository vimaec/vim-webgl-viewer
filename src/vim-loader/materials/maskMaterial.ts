/**
 * @module vim-loader/materials
 */

import * as THREE from 'three'

/**
 * Material used for selection outline it only renders selection in white and discards the rests.
 */
export function createMaskMaterial () {
  return new THREE.ShaderMaterial({
    uniforms: {},
    clipping: true,
    vertexShader: `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      #include <clipping_planes_pars_vertex>
      
      // Used as instance attribute for instanced mesh and as vertex attribute for merged meshes. 
      attribute float selected;

      varying float vKeep;

      void main() {
        #include <begin_vertex>
        #include <project_vertex>
        #include <clipping_planes_vertex>
        #include <logdepthbuf_vertex>

        // SELECTION
        // selected 
        vKeep = selected;
      }
    `,
    fragmentShader: `
      #include <clipping_planes_pars_fragment>
      varying float vKeep;

      void main() {
        #include <clipping_planes_fragment>
        if(vKeep == 0.0f) discard;

        gl_FragColor =  vec4(1.0f,1.0f,1.0f,1.0f);
      }
    `
  })
}
