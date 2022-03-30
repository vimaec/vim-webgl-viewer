import * as VIM from './vim'
import * as THREE from 'three'

// Parse URL
const params = new URLSearchParams(window.location.search)
const url = params.has('vim')
  ? params.get('vim')
  : 'https://vim.azureedge.net/samples/residence.vim'

let transparency: VIM.Transparency.Mode = 'all'
if (params.has('transparency')) {
  const t = params.get('transparency')
  transparency = VIM.Transparency.isValid(t) ? t : 'all'
}

// Create Viewer
const viewer = new VIM.Viewer({
  groundPlane: {
    show: true,
    texture:
      'https://vimdevelopment01storage.blob.core.windows.net/textures/vim-floor-soft.png',
    opacity: 1,
    size: 5
  }
})

const res = 'https://vim.azureedge.net/samples/residence.vim'

const zip =
  'https://vimdevelopment01storage.blob.core.windows.net/samples/residence.vim'

const wtf =
  'https://vimdevelopment01storage.blob.core.windows.net/samples/Residence.v1.vim'
const url2 =
  'https://vimdevelopment01storage.blob.core.windows.net/samples/residence_nozip.vim'
const url3 = 'http://localhost/hxgn_nozip.vim'
const url4 =
  'https://vimdevelopment01storage.blob.core.windows.net/samples/_WHITELEYS-VIM-MAIN_detached.v1.2.13.S.O.nozip.vim'
const url5 =
  'https://vimdevelopment01storage.blob.core.windows.net/samples/GAMMON_kowloon_project.ALL.O.nozip.vim'
const url6 =
  'https://vimdevelopment01storage.blob.core.windows.net/samples/3508-ALL-ARC-ST-MEP-ROOF.nozip.vim'
// const url2 = url

// new VIM.BFastAsync(url2, 0, 'vim').expand()

/*
const xhr = new XMLHttpRequest()
xhr.open('GET', res)
xhr.responseType = 'arraybuffer'
xhr.setRequestHeader('Range', `bytes=${0}-${31}`)
xhr.send()

xhr.onload = () => {
  console.log(xhr.status)
  console.log(xhr.statusText)
  console.log(xhr.getAllResponseHeaders())
  console.log(xhr.response)
}
/*

const xhr2 = new XMLHttpRequest()
xhr2.open('GET', zip)
xhr2.responseType = 'arraybuffer'
xhr2.setRequestHeader('Range', `bytes=${0}-${31}`)
xhr2.send()
xhr2.onload = () => {
  console.log(xhr2.status)
  console.log(xhr2.statusText)
  console.log(xhr2.getAllResponseHeaders())
  console.log(xhr2.response)
}

const xhr3 = new XMLHttpRequest()
xhr3.open('GET', url4)
xhr3.responseType = 'arraybuffer'
xhr3.setRequestHeader('Range', `bytes=${0}-${31}`)
xhr3.send()
xhr3.onload = () => {
  console.log(xhr3.status)
  console.log(xhr3.statusText)
  console.log(xhr3.getAllResponseHeaders())
  console.log(xhr3.response)
}
*/
/*
const xhr = new XMLHttpRequest()
xhr.responseType = 'arraybuffer'
xhr.open('GET', this.url)
xhr.setRequestHeader('Range', `bytes=${start}-${end - 1}`)
xhr.send()
*/
/*
const bfast = new VIM.BFastAsync(url2, 0, 'vim')

bfast
  .getBuffer('geometry')
  .then((g3d) => G3d.createFromBfast(BFast.createFromArrayBuffer(g3d)))
  .then((g3d) => console.log(g3d))

bfast
  .getBFast('entities')
  .then((entities) => entities.getBFast('Vim.Element'))
  .then((elements) => elements.getRow(10))
  .then((value) => console.log(value))
*/

viewer.loadAsync(url2, {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 270, y: 0, z: 0 },
  scale: 0.01
})

/*
viewer.loadVim(url2, undefined, (vim) => {
  console.log(vim.document.getEntity('Vim.Element', 10).get('Id'))
  console.log(vim.document)
})
*/

// load2('hxgn.vim')
/*
viewer.loadVim(
  'residence.vim',
  {
    // position: { x: 3, y: 0, z: 0 },
    rotation: { x: 270, y: 0, z: 0 },
    transparency: transparency
  },
  (result) => {
    onLoaded()
    // load2()
  },
  (progress) => {
    if (progress === 'processing') console.log('Processing')
    else console.log(`Downloading: ${(progress.loaded as number) / 1000000} MB`)
  },
  (error) => console.error(`Failed to load vim: ${error}`)
) */
const input = document.createElement('input')
input.type = 'file'
document.body.prepend(input)
// input.click()

input.onchange = (e: any) => {
  viewer.clear()
  // getting a hold of the file reference
  const file = e.target.files[0]

  // setting up the reader
  const reader = new FileReader()
  reader.readAsArrayBuffer(file)

  // here we tell the reader what to do when it's done reading...
  reader.onload = (readerEvent) => {
    const content = readerEvent.target.result // this is the content!
    // load2(content)
  }
}
/*
function load2 (vim: string | ArrayBuffer) {
  const COUNT = 1
  for (let i = 0; i < COUNT; i++) {
    for (let j = 0; j < COUNT; j++) {
      viewer.loadVim(
        vim instanceof ArrayBuffer ? vim.slice(0) : vim,
        {
          // position: { x: 1, y: 10.6, z: 0 },
          position: { x: i, y: 0, z: j },
          rotation: { x: 270, y: 0, z: 0 },
          transparency: transparency
        },
        (result) => {
          console.log(result)
        },
        (progress) => {
          if (progress === 'processing') console.log('Processing')
          else {
            console.log(
              `Downloading: ${(progress.loaded as number) / 1000000} MB`
            )
          }
        },
        (error) => console.error(`Failed to load vim: ${error}`)
      )
    }
  }
} */

globalThis.viewer = viewer
globalThis.VIM = VIM
globalThis.THREE = THREE
