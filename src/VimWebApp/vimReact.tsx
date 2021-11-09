// eslint-disable-next-line no-use-before-define
import React, { useState } from 'react'
import ReactDOM from 'react-dom'
import urlLogo from './assets/logo.png'
import { ViewerState } from '../VimWebViewer/viewer'
import './style.css'

const canvasId = 'vim-canvas'

export function buildUI (viewerEventName: string): string {
  // Create container for React
  const ui = document.createElement('div')
  ui.className = 'vim'
  document.body.append(ui)

  // Render
  ReactDOM.render(<VimUI eventName={viewerEventName} />, ui)
  return canvasId
}

function VimUI (props: { eventName: string }) {
  const [msg, setProgress] = useState('')

  addEventListener(props.eventName, (event: CustomEvent<ViewerState>) => {
    setProgress(FormatStateMessage(event.detail))
  })

  return (
    <>
      <canvas id={canvasId}> </canvas>
      <Logo />
      <VimLoadingBox msg={msg} />
    </>
  )
}

function Logo () {
  return (
    <div className="vim-logo">
      <a href="https://vimaec.com">
        <img src={urlLogo}></img>
      </a>
    </div>
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
