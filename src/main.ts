import { BFast, G3d } from 'vim-format'
import * as VIM from './vim'
import * as THREE from 'three'

// Parse URL for source file
const params = new URLSearchParams(window.location.search)
// Edge server doesn't serve http ranges properly
const url = params.has('vim') ? params.get('vim') : './residence_nozip.vim'
// : 'https://vimdevelopment01storage.blob.core.windows.net/samples/TowerS-ARCHITECTURE-ALL.v1.2.50.vim'

// Parse URL for transparency mode
let transparency: VIM.Transparency.Mode = 'all'
if (params.has('transparency')) {
  const t = params.get('transparency')
  transparency = VIM.Transparency.isValid(t) ? t : 'all'
}

// Parse URL for streaming method
let streamBim: boolean = false
let streamGeometry: boolean = false
if (params.has('download')) {
  const t = params.get('download')
  const [bim, geo] =
    t === 'geometry'
      ? [true, false]
      : t === 'stream'
        ? [true, true]
        : [false, false]
  streamBim = bim
  streamGeometry = geo
}

// Parse URL for initial selection
let selection: number[] = []
if (params.has('selection')) {
  const p = params.get('selection')!
  selection = p?.split('+').map((s) => Number.parseInt(s))
}

const viewer = new VIM.Viewer({
  camera: {}
})

async function load (source: string | ArrayBuffer) {
  const loader = new VIM.Loader()
  const settings = {
    noHeader: true,
    // noMap: true,
    noStrings: true,
    rotation: new THREE.Vector3(270, 0, 0),
    streamGeometry: true,
    streamBim: true,
    // instances: [...new Array<number>(100).keys()],
    // instances: airTerminals,
    loadRooms: true,
    // folder:
    // 'https://vimdevelopment01storage.blob.core.windows.net/split-mesh/residence/residence'
    // 'https://vimdevelopment01storage.blob.core.windows.net/split-mesh/tower/tower'
    folder: './residence/residence'
  } as Partial<VIM.VimSettings>
  let time: number
  const request = loader.createRequest(source, settings)
  globalThis.request = request
  request.onProgress.sub((progress) => {
    console.log(`Loading : ${progress.loaded} / ${progress.total}`)
  })
  request.onLoaded.sub(() => {
    console.log(
      `Finished Loading in ${((Date.now() - time) / 1000).toFixed(2)} seconds`
    )
  })

  time = Date.now()
  const vim = await request.send()

  time = Date.now()
  console.log(
    `Finished Filter in ${((Date.now() - time) / 1000).toFixed(2)} seconds`
  )

  viewer.add(vim)
}
/*
load(
  // './tower.vim'
  // 'https://vimdevelopment01storage.blob.core.windows.net/samples/TowerS-ARCHITECTURE-ALL.v1.2.50.vim'
  'https://vimdevelopment01storage.blob.core.windows.net/samples/residence_nozip.vim'
  // 'https://vimdevelopment01storage.blob.core.windows.net/samples/residence.vim'
  // './skanska.nozip.vim'
  // 'residence_nozip.vim'
)
*/

await viewer.createProgressiveVim3(
  // 'https://vimdevelopment01storage.blob.core.windows.net/samples/TowerS-ARCHITECTURE-ALL.v1.2.50.vim',
  // 'https://vimdevelopment01storage.blob.core.windows.net/split-mesh/tower/tower',

  'https://vimdevelopment01storage.blob.core.windows.net/samples/residence_nozip.vim',
  './residence/residence',
  // 'https://vimdevelopment01storage.blob.core.windows.net/split-mesh/residence/residence',
  {
    loadRooms: false,
    streamBim: true,
    noMap: true,
    rotation: new THREE.Vector3(270, 0, 0)
  }
)

const input = document.createElement('input')
input.type = 'file'
document.body.prepend(input)

input.onchange = (e: any) => {
  viewer.clear()
  // getting a hold of the file reference
  const file = e.target.files[0]

  // setting up the reader
  const reader = new FileReader()
  reader.readAsArrayBuffer(file)

  // here we tell the reader what to do when it's done reading...
  reader.onload = (readerEvent) => {
    const content = readerEvent?.target?.result // this is the content!
    if (content) load(content)
  }
}

globalThis.viewer = viewer
globalThis.THREE = THREE
