import urlLogo from './assets/logo.png'

export class ViewerDocument {
  canvas: HTMLCanvasElement
  logo: HTMLImageElement
  link: HTMLAnchorElement

  constructor (settings: any) {
    // Get or Add Canvas
    let canvas = document.getElementById(settings.canvasId)
    if (!canvas) {
      canvas = document.createElement('canvas')
      document.body.appendChild(canvas)
    }
    this.canvas = canvas as HTMLCanvasElement

    // Add Vim logo
    const logo = document.createElement('img')
    logo.src = urlLogo
    logo.style.position = 'fixed'
    logo.style.top = '16px'
    logo.style.left = '16px'
    logo.height = 48
    logo.width = 128
    this.logo = logo

    // Add logo as link
    const link = document.createElement('a')
    link.href = 'https://vimaec.com'
    link.appendChild(this.logo)
    document.body.prepend(link)
    this.link = link
  }
}
