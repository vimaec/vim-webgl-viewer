import { Viewer } from './vim-webgl-viewer/viewer'

const params = new URLSearchParams(window.location.search)
const url = params.has('model')
  ? params.get('model')
  : 'https://vim.azureedge.net/samples/residence.vim'

const viewer = new Viewer({
  mouseOrbit: false,
  url: url,
  object: {
    rotation: { x: 270 }
  },
  plane: {
    show: true,
    texture:
      'https://vimdevelopment01storage.blob.core.windows.net/textures/vim-floor-soft.png',
    opacity: 1,
    size: 5
  }
})

globalThis.viewer = viewer
