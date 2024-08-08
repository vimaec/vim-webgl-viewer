export class AxesSettings {
  size: number = 84
  padding: number = 4
  bubbleSizePrimary: number = 8
  bubbleSizeSecondary: number = 6
  lineWidth: number = 2
  fontPxSize: number = 12
  fontFamily: string = 'arial'
  fontWeight: string = 'bold'
  fontColor: string = '#222222'
  className: string = 'gizmo-axis-canvas'

  colorX: string = '#f73c3c'
  colorY: string = '#6ccb26'
  colorZ: string = '#178cf0'
  colorXSub: string = '#942424'
  colorYSub: string = '#417a17'
  colorZSub: string = '#0e5490'

  constructor (init?: Partial<AxesSettings>) {
    this.size = init?.size ?? this.size
    this.padding = init?.padding ?? this.padding
    this.bubbleSizePrimary = init?.bubbleSizePrimary ?? this.bubbleSizePrimary
    this.bubbleSizeSecondary =
      init?.bubbleSizeSecondary ?? this.bubbleSizeSecondary
    this.lineWidth = init?.lineWidth ?? this.lineWidth
    this.fontPxSize = init?.fontPxSize ?? this.fontPxSize
    this.fontFamily = init?.fontFamily ?? this.fontFamily
    this.fontWeight = init?.fontWeight ?? this.fontWeight
    this.fontColor = init?.fontColor ?? this.fontColor
    this.className = init?.className ?? this.className
    this.colorX = init?.colorX ?? this.colorX
    this.colorY = init?.colorY ?? this.colorY
    this.colorZ = init?.colorZ ?? this.colorZ
    this.colorXSub = init?.colorXSub ?? this.colorXSub
    this.colorYSub = init?.colorYSub ?? this.colorYSub
    this.colorZSub = init?.colorZSub ?? this.colorZSub
  }
}
