import { Viewer, open, getViewerSettingsFromUrl } from '.'
import * as THREE from 'three'

// Parse URL for source file
const params = new URLSearchParams(window.location.search)
const url = params.has('vim')
  ? params.get('vim')
  : null

let time: number

const viewer = new Viewer({
  ...getViewerSettingsFromUrl(window.location.search)
})

load(url ?? 'https://vim02.azureedge.net/samples/residence.v1.2.75.vim')
// load(url ?? './F_A_X_X_0_001.vim')
// load(url ?? "https://vimdevelopment01storage.blob.core.windows.net/samples/TowerS-ARCHITECTURE-ALL.v1.2.50.vimx")
// load(url ?? "https://vimdevelopment01storage.blob.core.windows.net/samples/BIM1-AUTOP_ARC_2023.vimx")
// load('https://vim.azureedge.net/samples/TowerS-ARCHITECTURE.1.2.88-ALL.vim')

addLoadButton()

async function load (url: string | ArrayBuffer) {
  time = Date.now()
  viewer.gizmos.loading.visible = true

  const vim = await open(url,
    {
      rotation: new THREE.Vector3(270, 0, 0)
    }, (p) => console.log(`Downloading Vim (${(p.loaded / 1000).toFixed(0)} kb)`)
  )

  viewer.add(vim)
  await vim.loadAll()
  viewer.camera.snap(true).frame(vim)
  viewer.camera.save()
  viewer.gizmos.loading.visible = false

  const plan = await viewer.gizmos.plans.addPlan('https://vimdevelopment01storage.blob.core.windows.net/samples/floor_plan.png')
  const plan2 = await viewer.gizmos.plans.addPlan('https://vimdevelopment01storage.blob.core.windows.net/samples/floor_plan.pdf')
  plan.color = new THREE.Color(0x00ff00)

  // Useful for debuging in console.
  globalThis.THREE = THREE
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
