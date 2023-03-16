import * as VIM from './vim'
import * as THREE from 'three'

// Parse URL for source file
const params = new URLSearchParams(window.location.search)
const url = params.has('vim')
  ? params.get('vim')
  : 'https://vimdevelopment01storage.blob.core.windows.net/samples/residence_nozip.vim'

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

// Create Viewer
const viewer = new VIM.Viewer()

if (url) load2(url)

const input = document.createElement('input')
input.type = 'file'
document.body.prepend(input)

input.onchange = (e: any) => {
  viewer.clearVims()
  // getting a hold of the file reference
  const file = e.target.files[0]

  // setting up the reader
  const reader = new FileReader()
  reader.readAsArrayBuffer(file)

  // here we tell the reader what to do when it's done reading...
  reader.onload = (readerEvent) => {
    const content = readerEvent?.target?.result // this is the content!
    if (content) load2(content)
  }
}

function load2 (vim: string | ArrayBuffer) {
  const COUNT = 1
  for (let i = 0; i < COUNT; i++) {
    for (let j = 0; j < COUNT; j++) {
      const start = new Date().getTime()
      viewer
        .loadVim(
          vim,
          {
            // instances: [1, 2, 3, 4],
            rotation: new THREE.Vector3(270, 0, 0),
            position: new THREE.Vector3(i * 100, 0, j * 100),
            transparency,
            streamBim,
            streamGeometry
          },
          (progress) => {
            console.log(`Loading : ${progress.loaded} / ${progress.total}`)
          }
        )
        .then((v) => {
          console.log(
            'Loaded in ' + (new Date().getTime() - start) / 1000 + ' seconds'
          )
        })
    }
  }
}

globalThis.viewer = viewer
globalThis.VIM = VIM
globalThis.THREE = THREE
