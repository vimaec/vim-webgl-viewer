import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      formats: ['iife', 'es'],
      entry: './src/viewer.ts',
      name: 'vim'
    },
    minify: true
  }
})
