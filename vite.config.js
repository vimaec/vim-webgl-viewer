import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    sourcemap: true,
    lib: {
      formats: ['iife', 'es'],
      entry: resolve(__dirname, './src/index.ts'),
      name: 'VIM'
    },
    // Minify set to true will break the IIFE output
    minify: false,
    rollupOptions: {
      external: ['three'],
      output: {
        globals: {
          three: 'THREE'
        }
      }
    }
  }
})
