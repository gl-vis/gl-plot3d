'use strict'

var createScene = require('../scene')
var createSurface = require('gl-surface-plot')
var fit = require('canvas-fit')
var ndarray = require('ndarray')

var canvas = document.createElement('canvas')
document.body.appendChild(canvas)
window.addEventListener('resize', fit(canvas))

var scene = createScene(canvas)

var size = 64

var coords = [
  ndarray(new Float32Array(4*(size+1)*(size+1)), [2*size+1,2*size+1]),
  ndarray(new Float32Array(4*(size+1)*(size+1)), [2*size+1,2*size+1]),
  ndarray(new Float32Array(4*(size+1)*(size+1)), [2*size+1,2*size+1])
]

for(var i=0; i<=2*size; ++i) {
  var theta = Math.PI * (i - size) / size
  for(var j=0; j<=2*size; ++j) {
    var phi = Math.PI * (j - size) / size

    coords[0].set(i, j, (50.0 + 20.0 * Math.cos(theta)) * Math.cos(phi))
    coords[1].set(i, j, (50.0 + 20.0 * Math.cos(theta)) * Math.sin(phi))
    coords[2].set(i, j, 20.0 * Math.sin(theta))
  }
}

var contourLevels = []
for(var i=-5; i<=5; ++i) {
  contourLevels.push(20*(i+0.3)/6.0)
}

var surface = createSurface(scene.gl,  coords[2], {
  levels: [ contourLevels, contourLevels, contourLevels ],
  lineWidth: 3,
  contourTint: 1,
  coords: coords.slice(0,2),
  contourProject: [
    [true,false,false], 
    [false,true,false], 
    [false,false,true] ],
  showContour: true
})

scene.addObject(surface)