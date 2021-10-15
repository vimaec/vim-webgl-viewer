import './index.css'
import { Viewer } from './viewer'

// set as global to be able to access viewer from command line

const params = new URLSearchParams(window.location.search)
const url = params.has('model') ? params.get('model') : './models/residence.vim'

declare let viewer: Viewer
globalThis.viewer = new Viewer()
viewer.view({
  url: url,
  object: {
    scale: 0.1,
    rotation: { x: 270 },
    position: { y: 0 }
  },
  plane: {
    show: false
  },
  showStats: true
})
