import { Viewer, request, THREE, getViewerSettingsFromUrl } from '.'

// Parse URL for source file
const params = new URLSearchParams(window.location.search)
const url = params.has('vim')
  ? params.get('vim')
  : null

const viewer = new Viewer({
  ...getViewerSettingsFromUrl(window.location.search)
})

load(url ?? 'https://vim02.azureedge.net/samples/residence.v1.2.75.vim')
addLoadButton()

async function load (url: string | ArrayBuffer) {
  viewer.gizmos.loading.visible = true

  const r = request({
    url: 'https://saas-api-dev.vimaec.com/api/public/8A12977A-E69B-42DC-D05B-08DCE88D23C7/2024.10.11',
    headers: {
      Authorization: 'yJSkyCvwpksvnajChA64ofKQS2KnB24ADHENUYKYTZFZc4SzcWa5WPwJNzTvrsZ8sv8SL8R69c92TUThFkLi1YsvpGxnZFExWs5mbQisuWyhBPAXosSEUhPXyUaXHHBJ'
    }
  },
  {
    rotation: new THREE.Vector3(270, 0, 0)
  })

  for await (const progress of r.getProgress()) {
    console.log(`Downloading Vim (${(progress.loaded / 1000).toFixed(0)} kb)`)
  }

  const result = await r.getResult()
  if (result.isError()) {
    console.error(result.error)
    return
  }

  const vim = result.result

  await vim.loadAll()
  viewer.add(vim)
  viewer.camera.snap(true).frame(vim)
  viewer.camera.save()
  viewer.gizmos.loading.visible = false

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
