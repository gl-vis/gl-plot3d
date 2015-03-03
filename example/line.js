'use strict'

var createScene = require('../scene')
var createLine = require('gl-line-plot')
var fit = require('canvas-fit')

var canvas = document.createElement('canvas')
document.body.appendChild(canvas)
window.addEventListener('resize', fit(canvas))

var scene = createScene(canvas)

var points = []
for(var t = 0; t< 1000; ++t) {
  var theta = Math.PI * t / 200.0
  points.push([Math.cos(theta), 0.002 * t, Math.sin(theta)])
}

var linePlot = createLine(scene.gl, {
  position:  points,
  lineWidth: 5,
  color:     [1,0,0]
})

linePlot.opacity = 0.5

scene.addObject(linePlot)