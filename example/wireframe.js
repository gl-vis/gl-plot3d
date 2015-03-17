'use strict'

var createScene = require('../scene')
var createMesh = require('gl-simplicial-complex')
var bunny = require('bunny')
var sc = require('simplicial-complex')

var scene = createScene()
var mesh = createMesh(scene.gl, {
  cells:      sc.skeleton(bunny.cells, 1),
  positions:  bunny.positions,
  colormap:   'jet'
})

scene.addObject(mesh)