import { Viewer } from '../VimWebViewer/viewer'
import { buildUI } from './vimReact'
import { ViewerGui } from './viewerGui'
import Stats from 'stats.js'

// Parse URL
const params = new URLSearchParams(window.location.search)
const url = params.has('model')
  ? params.get('model')
  : 'https://vim.azureedge.net/samples/residence.vim'

const canvasId = buildUI(Viewer.stateChangeEventName)

const viewer = new Viewer({
  canvasId: canvasId,
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

// Add a new DAT.gui controller
if (viewer.settings.showGui) {
  ViewerGui.bind(viewer.settings, (settings) => {
    viewer.settings = settings
    viewer.ApplySettings()
  })
}

// Add Stats display
if (viewer.settings.showStats) {
  const stats = new Stats()
  stats.dom.style.top = '84px'
  stats.dom.style.left = '16px'
  document.body.appendChild(stats.dom)
}

// Make viewer accessible in console
globalThis.viewer = viewer
