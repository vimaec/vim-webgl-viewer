import { Viewer } from './vim-webgl-viewer/viewer'

const params = new URLSearchParams(window.location.search)
const url = params.has('model')
  ? params.get('model')
  : 'https://vim.azureedge.net/samples/residence.vim'

const viewer = new Viewer({
  mouseOrbit: false,
  url: url,
  object: {
    scale: 0.1,
    rotation: { x: 270 },
    position: { y: 0 }
  },
  plane: {
    show: true,
    texture:
      'https://vimdevelopment01storage.blob.core.windows.net/samples/grid.png'
  }
})

globalThis.viewer = viewer
