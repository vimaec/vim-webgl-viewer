import * as VIM from './vim'
import * as THREE from 'three'

// Parse URL for source file
const params = new URLSearchParams(window.location.search)
// Edge server doesn't serve http ranges properly
const url = params.has('vim')
  ? params.get('vim') // : './test_vim.vim.gz'
  : 'https://vim02.azureedge.net/samples/residence.v1.2.75.vim'

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
test()
addLoadButton()

async function test () {
  const vim = await load(url)
}

async function load (url: string | ArrayBuffer) {
  time = Date.now()
  const vim = await VIM.VimxLoader.loadAny(url,
    {
      filter: [...new Array<number>(100).keys()], // .map((i) => i + 3500000),
      filterMode: 'instance',
      // legacy: true,
      // scale: 0.001,
      // legacy: true,
      progressive: true,
      refreshInterval: 400,
      loadRooms: true,
      rotation: new VIM.THREE.Vector3(270, 0, 0)
    }
  )

  await onVimLoaded(vim)
  return vim
}

async function onVimLoaded (vim: VIM.Vim) {
  viewer.add(vim)
  vim.onLoadingUpdate.sub(() => (viewer.gizmos.loading.visible = vim.isLoading))
  const load = vim.loadAll()
  viewer.camera.do().frame('all', new THREE.Vector3(1, -1, 1))

  await load

  console.log(`loaded in ${(Date.now() - time) / 1000} seconds`)

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
