'use strict'

var createScene = require('../scene')
var createScatter = require('gl-scatter-plot')
var bunny = require('bunny')
var fit = require('canvas-fit')

var canvas = document.createElement('canvas')
document.body.appendChild(canvas)
window.addEventListener('resize', fit(canvas))

var scene = createScene(canvas)

var scatter = createScatter(scene.gl, {
  position:     bunny.positions,
  size:         10,
  glyph:        '★',
  orthographic: true,
  lineColor:    [0,0,0],
  color:        [1,0,0],
  project:      [true, true, true]
})

scene.addObject(scatter)