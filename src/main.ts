import { RemoteGeometry } from 'vim-format'
import * as VIM from './vim'
import * as THREE from 'three'

// Parse URL for source file
const params = new URLSearchParams(window.location.search)
// Edge server doesn't serve http ranges properly
const url = params.has('vim')
  ? params.get('vim') // : './test_vim.vim.gz'
  : 'https://vim.azureedge.net/samples/residence.vim'
// 'https://vim.azureedge.net/samples/test_vim.vim.gz'
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

let time: number
const viewer = new VIM.Viewer()
let request: VIM.VimRequest
load(url!)
addLoadButton()

async function load (url: string | ArrayBuffer) {
  time = Date.now()
  const vim = await VIM.VimX.load(
    url,
    // 'https://vimdevelopment01storage.blob.core.windows.net/split-mesh/tower/tower',
    // 'https://vimdevelopment01storage.blob.core.windows.net/split-mesh/residence_test.vim',
    // 'https://vimdevelopment01storage.blob.core.windows.net/split-mesh/residence_test_sort.zg3d',
    // './residence_test_sort.zg3d',
    // './kahua_test.vim',
    // './kahua_test.vim',
    // './skanska.nozip_test.vim',
    // './tower/tower',
    // './tower.vim',
    // 'https://vimdevelopment01storage.blob.core.windows.net/samples/_MAIN-AEI_HSIB-R20.v1.2.73.vim',
    // ' ./residence.vim',
    // 'https://vim.azureedge.net/samples/residence.v1.2.75.vim',
    // './residence.vim',
    {
      legacy: true,
      // filter: [...new Array(1000).keys()], // .map((i) => i + 3500000),
      // filter: [1],
      // filter: [363],
      // filterMode: 'instance',
      // progressive: true,
      // vimx: './residence.vimx',
      // vimx: './skanska12_test.vim',
      // vimx: 'https://vimdevelopment01storage.blob.core.windows.net/samples/skanska12_test.vim',
      // vimx: 'https://vimdevelopment01storage.blob.core.windows.net/split-mesh/residence_test.vim',
      batchSize: 100,
      refreshInterval: 1000,
      loadRooms: true,
      rotation: new VIM.THREE.Vector3(270, 0, 0),
      streamBim: true,
      noStrings: true,
      noHeader: true
    }
  )
  onVimLoaded(vim)
}

async function onVimLoaded (vim: VIM.VimRequest | VIM.Vim | VIM.VimX) {
  if (vim instanceof VIM.VimRequest) {
    request = vim
    await request.send()
    viewer.add(request.vim)
  }
  if (vim instanceof VIM.Vim) {
    viewer.add(request.vim)
  }
  if (vim instanceof VIM.VimX) {
    viewer.add(vim)
    vim.onCompleted.subscribe(() =>
      console.log(`loaded in ${(Date.now() - time) / 1000} seconds`)
    )

    const connection = vim.onUpdate.subscribe(() => {
      console.log(vim.sceneLegacy.getBoundingBox())
      viewer.camera.lerp(1).frame(vim.sceneLegacy.getBoundingBox())
      connection()
    })
    vim.scene.start()
  }

  globalThis.vim = vim
  globalThis.viewer = viewer
  globalThis.THREE = THREE
}

function addLoadButton () {
  const input = document.createElement('input')
  input.type = 'file'
  document.body.prepend(input)

  input.onchange = (e: any) => {
    viewer.clear()
    request?.abort()
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
}
