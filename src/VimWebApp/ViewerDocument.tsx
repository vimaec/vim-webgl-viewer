// eslint-disable-next-line no-use-before-define
import React, { useState } from 'react'
import ReactDOM from 'react-dom'
import urlLogo from './assets/logo.png'
import { ViewerState } from '../viewer'
import './style.css'

export class ViewerDocument {
  canvas: HTMLCanvasElement
  logo: HTMLImageElement
  link: HTMLAnchorElement
  ui: HTMLDivElement
  onProgress: (state: ViewerState) => void

  constructor (settings: any, stateChangeEventName: string) {
    const ui = document.createElement('div')
    ui.className = 'vim-ui'
    ui.style.position = 'fixed'
    ui.style.width = '100%'
    ui.style.height = '100%'
    ui.style.pointerEvents = 'none'
    document.body.prepend(ui)
    this.ui = ui

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

    ReactDOM.render(<VimUI eventName={stateChangeEventName} />, this.ui)
  }
}

function VimUI (props: { eventName: string }) {
  const [msg, setProgress] = useState('')

  addEventListener(props.eventName, (event: CustomEvent<ViewerState>) => {
    setProgress(FormatStateMessage(event.detail))
  })

  return (
    <>
      <VimLoadingBox msg={msg} />
    </>
  )
}

function FormatStateMessage (state: ViewerState): string {
  return state === 'Default'
    ? ''
    : state === 'Processing'
      ? 'Processing'
      : `Downloading: ${Math.round(state[1] / 1000000)} MB`
}

function VimLoadingBox (prop: { msg: string }) {
  if (prop.msg === '') return null
  return (
    <div className="vim-loading-box">
      <h1> {prop.msg} </h1>
    </div>
  )
}
