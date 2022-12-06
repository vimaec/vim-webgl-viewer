import * as VIM from './vim'
import * as THREE from 'three'
import { LoadingMode } from './vim'

// Parse URL
const params = new URLSearchParams(window.location.search)
const url = params.has('vim')
  ? params.get('vim')
  : 'https://vimdevelopment01storage.blob.core.windows.net/samples/residence_nozip.vim'

let transparency: VIM.Transparency.Mode = 'all'
if (params.has('transparency')) {
  const t = params.get('transparency')
  transparency = VIM.Transparency.isValid(t) ? t : 'all'
}

let download: LoadingMode = 'download'
if (params.has('download')) {
  const t = params.get('download')
  const valid = t === 'download' || t === 'stream' || t === 'geometry'
  download = valid ? t : 'download'
}

// Create Viewer
const viewer = new VIM.Viewer()

if (url) load2(url)

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
            rotation: new THREE.Vector3(270, 0, 0),
            position: new THREE.Vector3(i * 100, 0, j * 100),
            transparency,
            download
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
