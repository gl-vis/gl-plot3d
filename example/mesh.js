'use strict'

var createScene = require('../scene')
var createMesh = require('gl-simplicial-complex')
var bunny = require('bunny')
var fit = require('canvas-fit')

var canvas = document.createElement('canvas')
document.body.appendChild(canvas)
window.addEventListener('resize', fit(canvas))

var scene = createScene(canvas)
var mesh = createMesh(scene.gl, {
  cells:      bunny.cells,
  positions:  bunny.positions,
  colormap:   'jet'
})

scene.addObject(mesh)