import './index.css'
import { Viewer } from './viewer'

const viewer = new Viewer()
viewer.view({
  url: './residence.vim',
  object: {
    scale: 0.1,
    rotation: { x: 270 },
    position: { y: 0 }
  },
  plane: {
    show: false
  },
  showStats: true
})
