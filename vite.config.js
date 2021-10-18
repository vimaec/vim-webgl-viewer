import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'docs',
    lib: {
      formats: ['iife', 'es'],
      entry: './src/viewer.ts',
      name: 'vim'
    },
    minify: true
  }
})
