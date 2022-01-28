import * as geometry from './vim-loader/geometry'
import { Viewer } from './vim-webgl-viewer/viewer'

// Parse URL
const params = new URLSearchParams(window.location.search)
const url = params.has('vim')
  ? params.get('vim')
  : 'https://vim.azureedge.net/samples/residence.vim'

let transparency: geometry.TransparencyMode = 'all'
if (params.has('transparency')) {
  const t = params.get('transparency')
  transparency = geometry.transparencyIsValid(t) ? t : 'all'
}

// Create Viewer
const viewer = new Viewer({
  camera: { showGizmo: true },
  plane: {
    show: true,
    texture:
      'https://vimdevelopment01storage.blob.core.windows.net/textures/vim-floor-soft.png',
    opacity: 1,
    size: 5
  }
})

viewer.loadVim(
  {
    url: url,
    rotation: { x: 270, y: 0, z: 0 },
    transparency: transparency
  },
  (result) => {},
  (progress) => {
    if (progress === 'processing') console.log('Processing')
    else console.log(`Downloading: ${(progress.loaded as number) / 1000000} MB`)
  },
  (error) => console.error(`Failed to load vim: ${error}`)
)

globalThis.viewer = viewer
