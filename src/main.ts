import { Viewer, ViewerState } from './vim-webgl-viewer/viewer'

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

addEventListener(Viewer.stateChangeEvent, (event: CustomEvent<ViewerState>) => {
  const state = event.detail
  if (state[0] === 'Downloading') console.log('Downloading : ' + state[1])
  if (state[0] === 'Error') {
    console.log('Error : ' + (state[1] as ErrorEvent).message)
  }
  if (state === 'Ready') console.log('Viewer Ready')
})

globalThis.viewer = viewer
