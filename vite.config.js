import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      formats: ['iife', 'es'],
      entry: './src/viewer.ts',
      name: 'vim'
    },
    // Minify set to true will break the IIFE output
    minify: false,
    rollupOptions: {
      external: [
        'three'
        // 'dat.gui'
      ],
      output: {
        globals: {
          three: 'THREE'
          // 'dat.gui': 'dat'
        }
      }
    }
  }
})
