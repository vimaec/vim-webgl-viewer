/**
 * @module vim-loader/materials
 */

import * as THREE from 'three'

/** Outline Material based on edge detection. */
export class OutlineMaterial {
  material: THREE.ShaderMaterial
  private _camera:
    | THREE.PerspectiveCamera
    | THREE.OrthographicCamera
    | undefined

  private _resolution: THREE.Vector2

  constructor (
    options?: Partial<{
      sceneBuffer: THREE.Texture
      resolution: THREE.Vector2
      camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
    }>
  ) {
    this.material = createOutlineMaterial()
    this._resolution = options?.resolution ?? new THREE.Vector2(1, 1)
    this.resolution = this._resolution
    if (options?.sceneBuffer) {
      this.sceneBuffer = options.sceneBuffer
    }
    this.camera = options?.camera
  }

  get resolution () {
    return this._resolution
  }

  set resolution (value: THREE.Vector2) {
    this.material.uniforms.screenSize.value.set(
      value?.x ?? 1,
      value?.y ?? 1,
      1 / value?.x ?? 1,
      1 / value?.y ?? 1
    )

    this._resolution = value
  }

  get camera () {
    return this._camera
  }

  set camera (
    value: THREE.PerspectiveCamera | THREE.OrthographicCamera | undefined
  ) {
    this.material.uniforms.cameraNear.value = value?.near ?? 1
    this.material.uniforms.cameraFar.value = value?.far ?? 1000
    this._camera = value
  }

  get strokeBlur () {
    return this.material.uniforms.strokeBlur.value
  }

  set strokeBlur (value: number) {
    this.material.uniforms.strokeBlur.value = value
  }

  get strokeBias () {
    return this.material.uniforms.strokeBias.value
  }

  set strokeBias (value: number) {
    this.material.uniforms.strokeBias.value = value
  }

  get strokeMultiplier () {
    return this.material.uniforms.strokeMultiplier.value
  }

  set strokeMultiplier (value: number) {
    this.material.uniforms.strokeMultiplier.value = value
  }

  get color () {
    return this.material.uniforms.outlineColor.value
  }

  set color (value: THREE.Color) {
    this.material.uniforms.outlineColor.value.set(value)
  }

  get sceneBuffer () {
    return this.material.uniforms.sceneBuffer.value
  }

  set sceneBuffer (value: THREE.Texture) {
    this.material.uniforms.sceneBuffer.value = value
  }

  get depthBuffer () {
    return this.material.uniforms.depthBuffer.value
  }

  set depthBuffer (value: THREE.Texture) {
    this.material.uniforms.depthBuffer.value = value
  }

  dispose () {
    this.material.dispose()
  }
}

/**
 * This material =computes outline using the depth buffer and combines it with the scene buffer to create a final scene.
 */
export function createOutlineMaterial () {
  return new THREE.ShaderMaterial({
    uniforms: {
      // Input buffers
      sceneBuffer: { value: null },
      depthBuffer: { value: null },

      // Input parameters
      cameraNear: { value: 1 },
      cameraFar: { value: 1000 },
      screenSize: {
        value: new THREE.Vector4(1, 1, 1, 1)
      },

      // Options
      outlineColor: { value: new THREE.Color(0xffffff) },
      strokeMultiplier: { value: 2 },
      strokeBias: { value: 2 },
      strokeBlur: { value: 3 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
      `,
    fragmentShader: `
      #include <packing>
      // The above include imports "perspectiveDepthToViewZ"
      // and other GLSL functions from ThreeJS we need for reading depth.
      uniform sampler2D depthBuffer;
      uniform float cameraNear;
      uniform float cameraFar;
      uniform vec4 screenSize;
      uniform vec3 outlineColor;
      uniform float strokeMultiplier;
      uniform float strokeBias;
      uniform int strokeBlur;
  
      varying vec2 vUv;
  
      // Helper functions for reading from depth buffer.
      float readDepth (sampler2D depthSampler, vec2 coord) {
        float fragCoordZ = texture2D(depthSampler, coord).x;
        float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
        return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );
      }
      float getLinearDepth(vec3 pos) {
        return -(viewMatrix * vec4(pos, 1.0)).z;
      }
  
      float getLinearScreenDepth(sampler2D map) {
          vec2 uv = gl_FragCoord.xy * screenSize.zw;
          return readDepth(map,uv);
      }
      // Helper functions for reading normals and depth of neighboring pixels.
      float getPixelDepth(int x, int y) {
        // screenSize.zw is pixel size 
        // vUv is current position
        return readDepth(depthBuffer, vUv + screenSize.zw * vec2(x, y));
      }
  
      float saturate(float num) {
        return clamp(num, 0.0, 1.0);
      }
  
      void main() {
        float depth = getPixelDepth(0, 0);
  
        // Get the difference between depth of neighboring pixels and current.
        float depthDiff = 0.0;
        int start = -strokeBlur / 2;
        for(int i=0; i < strokeBlur; i ++){
          for(int j=0; j < strokeBlur; j ++){
            depthDiff += abs(depth - getPixelDepth(start +i, start + j));
          }
        }
  
        depthDiff = depthDiff / (float(strokeBlur*strokeBlur) -1.0); 
        
        depthDiff = depthDiff * strokeMultiplier;
        depthDiff = saturate(depthDiff);
        depthDiff = pow(depthDiff, strokeBias);
  
        float outline = depthDiff;
  
        // Combine outline with scene color.
        vec4 outlineColor = vec4(outlineColor, 1.0f);
        gl_FragColor = vec4(mix(vec4(0.0,0.0,0.0,0.0), outlineColor, outline));
      }
      `
  })
}
