'use strict'

var createScene = require('../scene')
var createMesh = require('gl-mesh3d')
var bunny = require('bunny')
var fit = require('canvas-fit')

var canvas = document.createElement('canvas')
document.body.appendChild(canvas)
window.addEventListener('resize', fit(canvas))

var scene = createScene(canvas)
var mesh = createMesh({
  gl:         scene.gl,
  cells:      bunny.cells,
  positions:  bunny.positions,
  colormap:   'jet'
})

scene.addObject(mesh)