gl-plot3d
==========
A highly opinionated wrapper module which handles camera set up, picking, axes and rendering order.  Meant to be used with the following visualization modules:

* [gl-simplicial-complex](https://github.com/mikolalysenko/gl-simplicial-complex)
* [gl-surface-plot](https://github.com/mikolalysenko/gl-surface-plot)
* [gl-scatter](https://github.com/mikolalysenko/gl-scatter-plot)
* [gl-line-plot](https://github.com/mikolalysenko/gl-line-plot)
* [gl-error-bars](https://github.com/mikolalysenko/gl-error-bars)

Lots of options, but reasonable defaults which should make it suitable for small projects like mesh viewers or quick data visualization.

# Example

```javascript
var createScene = require('gl-plot3d')
var createMesh = require('gl-simplicial-complex')
var bunny = require('bunny')
var fit = require('canvas-fit')

var canvas = document.createElement('canvas')
document.body.appendChild(canvas)
window.addEventListener('resize', fit(canvas))

var scene = createScene(canvas, {
  autoBounds: true
})

var mesh = createMesh(scene.gl, {
  cells:      bunny.cells,
  positions:  bunny.positions,
  colormap:   'jet'
})

scene.addObject(mesh)
```

# Install

```
npm i gl-plot3d
```

# API

## Constructor

#### `var scene = require('gl-plot3d')(canvas[, options])`

## Properties



## Methods

