/*
    Updates the index.html and index-dev.html files.
    Only needs to be run when the index.mustache.html file is updated.
*/
const fs = require('fs');
const mustache = require('mustache');

function genDoc(templateFile, outputFile, inputData)
{
    const template = fs.readFileSync(templateFile, "utf-8");
    const output = mustache.render(template, inputData);
    fs.writeFileSync(outputFile, output);    
}

const templateFile = 'docs/index.mustache.html';
const prodFile = 'docs/index.html';
const devFile = 'docs/index-dev.html'; 
const distFile = 'dist/index.html'; 
const prodData = { viewerUrl: "https://unpkg.com/vim-webgl-viewer@latest" };
const devData = { viewerUrl: "https://unpkg.com/vim-webgl-viewer@dev" };
const distData = { viewerUrl: "vim-webgl-viewer.iife.js" };

genDoc(templateFile, prodFile, prodData);
genDoc(templateFile, devFile, devData);
genDoc(templateFile, distFile, distData);
