/*
    Updates the index.html and index-dev.html files.
    Only needs to be run when the index.mustache.html file is updated.
*/
const fs = require('fs')
const mustache = require('mustache')

function genDoc (templateFile, outputFile, inputData) {
  const template = fs.readFileSync(templateFile, 'utf-8')
  const output = mustache.render(template, inputData)
  fs.writeFileSync(outputFile, output)
}

const templateFile = 'docs/index.mustache.html'
const prodFile = 'docs/index.html'
const devFile = 'docs/index-dev.html'
const distFile = 'dist/index.html'
const unpckg = 'https://unpkg.com/vim-webgl-viewer'
const prodData = {
  viewerUrl: unpckg,
  style: unpckg + '@latest/dist/style.css'
}
const devData = {
  viewerUrl: unpckg + '@dev',
  style: unpckg + '@dev/dist/style.css'
}
const distData = { viewerUrl: 'vim-webgl-viewer.iife.js', style: 'style.css' }

genDoc(templateFile, prodFile, prodData)
genDoc(templateFile, devFile, devData)
genDoc(templateFile, distFile, distData)
