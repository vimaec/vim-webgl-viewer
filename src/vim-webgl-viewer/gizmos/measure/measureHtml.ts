/**
 @module viw-webgl-viewer/gizmos/measure
*/

/**
 * Different styles of measure display.
 */
export type MeasureStyle = 'all' | 'Dist' | 'X' | 'Y' | 'Z'

/**
 * Structure of the html element used for measure.
 */
export type MeasureElement = {
  div: HTMLElement
  value: HTMLTableCellElement | undefined
  values: {
    dist: HTMLTableCellElement | undefined
    x: HTMLTableCellElement | undefined
    y: HTMLTableCellElement | undefined
    z: HTMLTableCellElement | undefined
  }
}

/**
 * Creates a html structure for measure value overlays
 * It either creates a single rows or all rows depending on style
 * Structure is a Table of Label:Value
 */
export function createMeasureElement (style: MeasureStyle): MeasureElement {
  const div = document.createElement('div')
  div.className = 'vim-measure'

  const table = document.createElement('table')
  div.appendChild(table)

  let distValue: HTMLTableCellElement | undefined
  let xValue: HTMLTableCellElement | undefined
  let yValue: HTMLTableCellElement | undefined
  let zValue: HTMLTableCellElement | undefined

  if (style === 'all' || style === 'Dist') {
    const trDist = document.createElement('tr')
    const tdDistLabel = document.createElement('td')
    const tdDistValue = document.createElement('td')

    table.appendChild(trDist)
    trDist.appendChild(tdDistLabel)
    trDist.appendChild(tdDistValue)

    tdDistLabel.className = 'vim-measure-label-d'
    tdDistValue.className = 'vim-measure-value-d'

    tdDistLabel.textContent = 'Dist'
    distValue = tdDistValue
  }

  if (style === 'all' || style === 'X') {
    const trX = document.createElement('tr')
    const tdXLabel = document.createElement('td')
    const tdXValue = document.createElement('td')

    table.appendChild(trX)
    trX.appendChild(tdXLabel)
    trX.appendChild(tdXValue)

    tdXLabel.className = 'vim-measure-label-x'
    tdXValue.className = 'vim-measure-value-x'

    tdXLabel.textContent = 'X'
    xValue = tdXValue
  }

  if (style === 'all' || style === 'Y') {
    const trY = document.createElement('tr')
    const tdYLabel = document.createElement('td')
    const tdYValue = document.createElement('td')

    table.appendChild(trY)
    trY.appendChild(tdYLabel)
    trY.appendChild(tdYValue)

    tdYLabel.className = 'vim-measure-label-y'
    tdYValue.className = 'vim-measure-value-y'

    tdYLabel.textContent = 'Y'
    yValue = tdYValue
  }

  if (style === 'all' || style === 'Z') {
    const trZ = document.createElement('tr')
    const tdZLabel = document.createElement('td')
    const tdZValue = document.createElement('td')

    table.appendChild(trZ)
    trZ.appendChild(tdZLabel)
    trZ.appendChild(tdZValue)

    tdZLabel.className = 'vim-measure-label-z'
    tdZValue.className = 'vim-measure-value-z'
    tdZLabel.textContent = 'Z'
    zValue = tdZValue
  }

  return {
    div,
    value:
      style === 'Dist'
        ? distValue
        : style === 'X'
          ? xValue
          : style === 'Y'
            ? yValue
            : style === 'Z'
              ? zValue
              : undefined,
    values: { dist: distValue, x: xValue, y: yValue, z: zValue }
  }
}
