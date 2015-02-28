'use strict'

var createScene = require('../scene')
var createLine = require('gl-line-plot')
var bunny = require('bunny')
var fit = require('canvas-fit')

var canvas = document.createElement('canvas')
document.body.appendChild(canvas)
window.addEventListener('resize', fit(canvas))

var scene = createScene(canvas)

var linePlot = createLine(scene.gl, {
  position:  bunny.positions
})

scene.addObject(linePlot)