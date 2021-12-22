import { Viewer, ViewerState } from './vim-webgl-viewer/viewer'

const params = new URLSearchParams(window.location.search)
const url = params.has('model')
  ? params.get('model')
  : 'https://vim.azureedge.net/samples/residence.vim'

const viewer = new Viewer({
  plane: {
    show: true,
    texture:
      'https://vimdevelopment01storage.blob.core.windows.net/textures/vim-floor-soft.png',
    opacity: 1,
    size: 5
  }
})

viewer.loadModel(
  {
    url: url,
    rotation: { x: 270, y: 0, z: 0 }
  },
  (vim) => console.log('Callback: Viewer Ready!'),
  (progress) => {
    if (progress === 'processing') console.log('Callback: Processing')
    else {
      console.log(`Callback: Downloading: ${progress.loaded / 1000000} MB`)
    }
  },
  (error) => console.error('Callback: Error: ' + error.message)
)

addEventListener(Viewer.stateChangeEvent, (event: CustomEvent<ViewerState>) => {
  const state = event.detail
  if (state[0] === 'Downloading') {
    console.log(`Event: Downloading: ${(state[1] as number) / 1000000} MB`)
  }
  if (state[0] === 'Error') {
    console.log('Event: Error : ' + (state[1] as ErrorEvent).message)
  }
  if (state === 'Processing') console.log('Event: Processing')
  if (state === 'Ready') console.log('Event: Viewer Ready')
})

globalThis.viewer = viewer
