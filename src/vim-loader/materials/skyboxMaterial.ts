/**
 * @module vim-loader/materials
 */

import * as THREE from 'three'

/**
 * Material for the skybox
 */
export class SkyboxMaterial extends THREE.ShaderMaterial {
  get skyColor (): THREE.Color {
    return this.uniforms.skyColor.value
  }

  set skyColor (value: THREE.Color) {
    this.uniforms.skyColor.value = value
    this.uniformsNeedUpdate = true
  }

  get groundColor () {
    return this.uniforms.groundColor.value
  }

  set groundColor (value: THREE.Color) {
    this.uniforms.groundColor.value = value
    this.uniformsNeedUpdate = true
  }

  get sharpness () {
    return this.uniforms.sharpness.value
  }

  set sharpness (value: number) {
    this.uniforms.sharpness.value = value
    this.uniformsNeedUpdate = true
  }

  constructor (
    skyColor: THREE.Color = new THREE.Color(0.68, 0.85, 0.9),
    groundColor: THREE.Color = new THREE.Color(0.8, 0.7, 0.5),
    sharpness: number = 2) {
    super({
      uniforms: {
        skyColor: { value: skyColor },
        groundColor: { value: groundColor },
        sharpness: { value: sharpness }
      },
      vertexShader: /* glsl */ `
        varying vec3 vPosition;
        varying vec3 vCameraPosition;

        void main() {
          // Compute vertex position
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0 );
          gl_Position = projectionMatrix * mvPosition;

          // Set z to camera.far so that the skybox is always rendered behind everything else
          gl_Position.z = gl_Position.w;

          // Pass the vertex world position to the fragment shader
          vPosition = (modelMatrix * vec4(position, 1.0)).xyz;

          // Pass the camera position to the fragment shader
          mat4 inverseViewMatrix = inverse(viewMatrix);
          vCameraPosition = (inverseViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        }
        `,
      fragmentShader: /* glsl */ `
        uniform vec3 skyColor;
        uniform vec3 groundColor;
        uniform float sharpness;

        varying vec3 vPosition;
        varying vec3 vCameraPosition;

        void main() {
          // Define the up vector
          vec3 up = vec3(0.0, 1.0, 0.0);

          // Calculate the direction from the pixel to the camera
          vec3 directionToCamera = normalize(vCameraPosition - vPosition);

          // Calculate the dot product between the normal and the up vector
          float dotProduct = dot(directionToCamera, up);

          // Normalize the dot product to be between 0 and 1
          float t = (dotProduct + 1.0) / 2.0;

          // Apply a power function to create a sharper transition
          t = pow(t, sharpness);

          // Interpolate between colors
          vec3 pastelSkyBlue = vec3(0.68, 0.85, 0.9); // Light sky blue pastel
          vec3 pastelEarthyBrown = vec3(0.8, 0.7, 0.5); // Light earthy brown pastel
          vec3 color = mix(skyColor, groundColor, t);

          // Output the final color
          gl_FragColor = vec4(color, 1.0);
        }
        `
    })
  }
}
