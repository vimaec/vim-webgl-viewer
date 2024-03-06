import {Viewer, open, THREE} from '.'


// Parse URL for source file
const params = new URLSearchParams(window.location.search)
const url = params.has('vim')
  ? params.get('vim')
  : null

let time: number
const viewer = new Viewer()

load(url ?? "https://vim02.azureedge.net/samples/residence.v1.2.75.vim")
// load(url ?? "https://vim02.azureedge.net/samples/residence.v1.2.75.vimx")
addLoadButton()


async function load (url: string | ArrayBuffer) {
  time = Date.now()
  viewer.gizmos.loading.visible = true

  const vim = await open(url,
    {
      legacy : true,
      rotation: new THREE.Vector3(270, 0, 0)
    }, (p) => console.log(`Downloading Vim (${(p.loaded / 1000).toFixed(0)} kb)`) 
  ) 
  viewer.add(vim)
  

  vim.loadAll().then(() =>{
    viewer.gizmos.loading.visible = false
    console.log(`loaded in ${(Date.now() - time) / 1000} seconds`)
  })
  
  viewer.camera.snap(true).frame(vim)

  // Useful for debuging in console.
  globalThis.vim = vim
  globalThis.viewer = viewer
}

function addLoadButton () {
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
}
