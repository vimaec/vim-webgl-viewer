/**
 * @module vim-loader/materials
 */

import * as THREE from 'three'

/**
 * Material for isolation mode
 * Non visible item appear as transparent.
 * Visible items are flat shaded with a basic pseudo lighting.
 * Supports object coloring for visible objects.
 * Non-visible objects use fillColor.
 */
export function createIsolationMaterial () {
  return new THREE.ShaderMaterial({
    uniforms: {
      opacity: { value: 0.1 },
      fillColor: { value: new THREE.Vector3(0, 0, 0) }
    },
    vertexColors: true,
    transparent: true,
    clipping: true,
    vertexShader: /* glsl */ `

      #include <common>
      #include <logdepthbuf_pars_vertex>
      #include <clipping_planes_pars_vertex>
        
      // VISIBILITY
      // Instance or vertex attribute to hide objects
      // Used as instance attribute for instanced mesh and as vertex attribute for merged meshes. 
      attribute float ignore;

      // Passed to fragment to discard them
      varying float vIgnore;
      varying vec3 vPosition;


      // COLORING
      varying vec3 vColor;

      // attribute for color override
      // merged meshes use it as vertex attribute
      // instanced meshes use it as an instance attribute
      attribute float colored;

      // There seems to be an issue where setting mehs.instanceColor
      // doesn't properly set USE_INSTANCING_COLOR
      // so we always use it as a fix
      #ifndef USE_INSTANCING_COLOR
        attribute vec3 instanceColor;
      #endif

      void main() {
        #include <begin_vertex>
        #include <project_vertex>
        #include <clipping_planes_vertex>
        #include <logdepthbuf_vertex>

        // VISIBILITY
        // Set frag ignore from instance or vertex attribute
        vIgnore = ignore;

        // COLORING
        vColor = color.xyz;

        // colored == 1 -> instance color
        // colored == 0 -> vertex color
        #ifdef USE_INSTANCING
          vColor.xyz = colored * instanceColor.xyz + (1.0f - colored) * color.xyz;
        #endif


        // ORDERING
        if(vIgnore > 0.0f){
          gl_Position.z = 1.0f;
        }else{
          gl_Position.z = -1.0f;
        }
        
        // LIGHTING
        vPosition = vec3(mvPosition ) / mvPosition .w;
      }
      `,
    fragmentShader: /* glsl */ `
      #include <clipping_planes_pars_fragment>
      varying float vIgnore;
      uniform float opacity;
      uniform vec3 fillColor;
      varying vec3 vPosition;
      varying vec3 vColor;

      void main() {
        #include <clipping_planes_fragment>

        if (vIgnore > 0.0f){
          gl_FragColor = vec4(fillColor, opacity);
        }
        else{ 
          gl_FragColor = vec4(vColor.x, vColor.y, vColor.z, 1.0f);

          // LIGHTING
          vec3 normal = normalize( cross(dFdx(vPosition), dFdy(vPosition)) );
          float light = dot(normal, normalize(vec3(1.4142f, 1.732f, 2.2360f)));
          light = 0.5 + (light *0.5);
          gl_FragColor.xyz *= light;
        }
      }
      `
  })
}
