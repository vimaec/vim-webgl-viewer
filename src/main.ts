import { Vim } from './vim-loader/vim'
import { TransparencyMode } from './vim-webgl-viewer'
import { HitTestResult } from './vim-webgl-viewer/hitTester'
import { Viewer, ViewerState } from './vim-webgl-viewer/viewer'

// Parse URL
const params = new URLSearchParams(window.location.search)
const url = params.has('model')
  ? params.get('model')
  : 'https://vim.azureedge.net/samples/residence.vim'

let transparency: TransparencyMode = true
if (params.has('transparency')) {
  const t = params.get('transparency')
  if (t === 'true') transparency = true
  if (t === 'opaque') transparency = 'opaque'
  if (t === 'false') transparency = false
  throw new Error('transparency argument must be one of {true, opaque, false}')
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
  },
  onClick: (viewer: Viewer, hit: HitTestResult) => {
    console.log(hit)
    viewer.selectByElementIndex(hit.elementIndex)
    const entity = viewer.vimScene.vim.getEntity(
      Vim.tableElement,
      hit.elementIndex
    )
    if (hit.doubleClick) viewer.lookAtSelection()
    console.log(entity)
  }
})

// Load Model
viewer.loadModel(
  {
    url: 'residence.vim',
    rotation: { x: 270, y: 0, z: 0 },
    transparency: transparency
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
