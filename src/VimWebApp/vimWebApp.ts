import { Viewer } from '../viewer'
import { ViewerDocument } from './ViewerDocument'

const params = new URLSearchParams(window.location.search)
const url = params.has('model')
  ? params.get('model')
  : 'https://vim.azureedge.net/samples/residence.vim'

const viewer = new Viewer({
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

// eslint-disable-next-line no-unused-vars
const ui = new ViewerDocument(viewer.settings, viewer.stateChangeEventName)

globalThis.viewer = viewer
