import { Viewer } from '../viewer'
import * as PDF from 'pdfjs-dist'
import { Plan2D } from './plan2D'

PDF.GlobalWorkerOptions.workerSrc = 'node_modules/pdfjs-dist/build/pdf.worker.mjs'

export class Plans2D {
  private _viewer: Viewer

  constructor (viewer: Viewer) {
    this._viewer = viewer
  }

  /**
   * Adds a plan to the viewer from a given URL, which can be a PDF or an image file.
   * @param url - The URL of the PDF or image file.
   * @returns A promise that resolves to the created Plan2D instance.
   */
  async addPlan (url: string): Promise<Plan2D> {
    let canvas: HTMLCanvasElement

    // Determine the file type based on the file extension
    const extension = url.split('.').pop()?.toLowerCase()
    if (extension === 'pdf') {
      canvas = await loadPdfAsImage(url)
    } else if (['png', 'jpg', 'jpeg', 'gif', 'bmp'].includes(extension!)) {
      canvas = await loadImageAsCanvas(url)
    } else {
      throw new Error('Unsupported file type')
    }

    const plan = new Plan2D(this._viewer, canvas)
    this._viewer.renderer.add(plan.mesh)
    return plan
  }
}

/**
 * Loads a PDF file from a URL and renders it onto a canvas.
 * @param pdfUrl - The URL of the PDF file.
 * @returns A promise that resolves to the canvas containing the rendered PDF page.
 */
async function loadPdfAsImage (pdfUrl: string): Promise<HTMLCanvasElement> {
  console.log('Loading PDF...')
  let page: PDF.PDFPageProxy
  try {
    const loadingTask = PDF.getDocument(pdfUrl)
    loadingTask.onProgress = (progress) => console.log('Progress:', progress)
    const doc = await loadingTask.promise
    console.log('Done loading PDF...')
    page = await doc.getPage(1) // Load the first page
  } catch (e) {
    console.log('Error loading PDF:', e)
    return Promise.reject(e)
  }

  const viewport = page.getViewport({ scale: 1.5 })

  // Create a canvas to render the PDF page
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')!
  canvas.width = viewport.width
  canvas.height = viewport.height

  const renderContext = {
    canvasContext: context,
    viewport
  }

  await page.render(renderContext).promise
  return canvas // Return the rendered canvas
}

/**
 * Loads an image from a URL and draws it onto a canvas.
 * @param imageUrl - The URL of the image file.
 * @returns A promise that resolves to the canvas containing the drawn image.
 */
async function loadImageAsCanvas (imageUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous' // Use this if loading images from a different origin
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const context = canvas.getContext('2d')!
      context.drawImage(image, 0, 0)
      resolve(canvas)
    }
    image.onerror = (e) => {
      console.log('Error loading image:', e)
      reject(e)
    }
    image.src = imageUrl
  })
}
