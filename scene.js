'use strict'

module.exports = createScene

var createCamera = require('3d-view-controls')
var createAxes   = require('gl-axes')
var createSpikes = require('gl-spikes')
var createSelect = require('gl-select-static')
var mouseChange  = require('mouse-change')
var perspective  = require('gl-mat4/perspective')

function MouseSelect() {
  this.mousePosition  = [-1,-1]
  this.screenPosition = [-1,-1]
  this.rayOrigin      = [0,0,0]
  this.rayDirection   = [0,0,0]
  this.object         = null
  this.data           = null
}

function roundDownPow10(x) {
  var base = Math.pow(10, Math.round(Math.log(Math.abs(x)) / Math.log(10)))
  return Math.floor(x / base) * base
}

function roundUpPow10(x) {
  var base = Math.pow(10, Math.round(Math.log(Math.abs(x)) / Math.log(10)))
  return Math.ceil(x / base) * base 
}

function defaultBool(x) {
  if(typeof x === 'boolean') {
    return x
  }
  return true
}

function createScene(canvas, options) {
  options = options || {}

  //Create WebGL context
  var glOptions = options.gl || { premultipliedAlpha: true }
  var gl = canvas.getContext('webgl', glOptions)
  var premultipliedAlpha = glOptions.premultipliedAlpha

  //Initial bounds
  var bounds = options.bounds || [[-10,-10,-10], [10,10,10]]

  //Create selection
  var selection = new MouseSelect()

  //Create a camera
  var cameraOptions = options.camera || {
    eye:    [0,0,2],
    center: [0,0,0],
    up:     [0,0,0],
    mode:   'orbit',
    zoomMin: 0.1,
    zoomMax: 100
  }
  var camera = createCamera(canvas, cameraOptions)

  //Create axes
  var axesOptions = options.axes || {}
  var axes = createAxes(gl, axesOptions)
  axes.enable = !axesOptions.disable

  //Create spikes
  var spikeOptions = options.spikes || {}
  var spikes = createSpikes(gl, spikeOptions)
  spikes.enable = !spikeOptions.disable

  //Object list is empty initially
  var objects = []

  //Dirty flag, skip redraw if scene static
  var dirty = true

  //Create scene object
  var scene = {
    gl:           gl,
    canvas:       canvas,
    selection:    selection,
    camera:       camera,
    axes:         axes,
    bounds:       bounds,
    zNear:        options.zNear || 0.01,
    zFar:         options.zFar  || 1000,
    fovy:         options.fovy  || Math.PI/4,
    clearColor:   options.clearColor || [0,0,0,0],
    autoBounds:   defaultBool(options.autoBounds),
    autoScale:    defaultBool(options.autoScale),
    autoCenter:   defaultBool(options.autoCenter),
    clipToBounds: defaultBool(options.clipToBounds)
  }

  var projection     = new Array(16)
  var prevProjection = new Array(16)
  var model          = new Array(16)
  var prevModel      = new Array(16)

  var cameraParams = {
    view:         camera.matrix,
    projection:   projection,
    model:        model
  }

  var pickChanged = false

  scene.update = function(options) {
  }

  scene.addObject = function(obj) {
    objects.push(obj)
    dirty = true
  }

  scene.removeObject = function(obj) {
    var idx = objects.indexOf(obj)
    if(idx < 0) {
      return
    }
    objects.splice(idx, 1)
    dirty = true
  }

  scene.dispose = function() {
    axes.dispose()
    spikes.dispose()
    for(var i=0; i<objects.length; ++i) {
      objects[i].dispose()
    }
  }

  //Update mouse position
  mouseChange(canvas, function(buttons, x, y) {
  })

  //Render the scene for mouse picking
  function renderPick() {
    var numObjs = objects.length
    for(var i=0; i<numObjs; ++i) {
      var obj = objects[i]
      if(obj.drawPick) {
        //Render to pick buffer
      }
    }
  }

  var nBounds = [
    [Infinity, Infinity, Infinity],
    [-Infinity,-Infinity,-Infinity]]

  var prevClearColor = [0,0,0,0]

  //Draw the whole scene
  function render() {
    requestAnimationFrame(render)

    //Tick camera
    dirty = camera.tick() || dirty

    //Check if any objects changed, recalculate bounds
    var numObjs = objects.length
    var lo = nBounds[0]
    var hi = nBounds[1]
    lo[0] = lo[1] = lo[2] =  Infinity
    hi[0] = hi[1] = hi[2] = -Infinity
    for(var i=0; i<numObjs; ++i) {
      var obj = objects[i]
      dirty = dirty || !!obj.dirty
      var obb = obj.bounds
      if(obb) {
        var olo = obb[0]
        var ohi = obb[1]
        for(var j=0; j<3; ++j) {
          lo[j] = Math.min(lo[j], olo[j])
          hi[j] = Math.max(hi[j], ohi[j])
        }
      }
    }

    //Recalculate bounds
    var bounds = scene.bounds
    if(scene.autoBounds) {
      var boundsChanged = false
      for(var j=0; j<3; ++j) {
        if(lo[j] === Infinity || hi[j] === -Infinity) {
          lo[j] = -1
          hi[j] = 1
        } else {
          var padding = 0.05 * (hi[j] - lo[j])
          lo[j] = lo[j] - padding
          hi[j] = hi[j] + padding
        }
        boundsChanged = boundsChanged ||
            (lo[j] !== bounds[0][j])  ||
            (hi[j] !== bounds[1][j])
      }
      if(boundsChanged) {
        var tickSpacing = [0,0,0]
        for(var i=0; i<3; ++i) {
          bounds[0][i] = lo[i]
          bounds[1][i] = hi[i]
          tickSpacing[i] = roundUpPow10((hi[i]-lo[i]) / 10.0)
        }
        if(axes.autoTicks) {
          axes.update({
            bounds: bounds,
            tickSpacing: tickSpacing
          })
        } else {
          axes.update({
            bounds: bounds
          })
        }
      }
    }

    //Recalculate bounds
    dirty = dirty || boundsChanged

    //Get scene
    var width  = gl.drawingBufferWidth
    var height = gl.drawingBufferHeight

    //Compute camera parameters
    perspective(projection,
      scene.fovy,
      width/height,
      scene.zNear,
      scene.zFar)

    //Compute model matrix
    for(var i=0; i<16; ++i) {
      model[i] = 0
    }
    model[15] = 1
    var diameter = 0
    for(var i=0; i<3; ++i) {
      diameter = Math.max(bounds[1][i] - bounds[0][i])
    }
    for(var i=0; i<3; ++i) {
      if(scene.autoScale) {
        model[5*i] = 0.5 / diameter
      } else {
        model[5*i] = 1
      }
      if(scene.autoCenter) {
        model[12+i] = -model[5*i] * 0.5 * (bounds[0][i] + bounds[1][i])
      }
    }

    //Check if matrices changed
    for(var i=0; i<16; ++i) {
      dirty = dirty || 
        (prevModel[i] !== model[i]) || 
        (prevProjection !== projection[i])
      prevModel[i] = model[i]
      prevProjection[i] = projection[i]
    }

    //Check if clear color changed
    var clearColor = prevClearColor
    for(var i=0; i<4; ++i) {
      var c = +scene.clearColor[i] || 0.0
      pickChanged = pickChanged || (clearColor[i] !== c)
      clearColor[i] = c
    }

    //Check dirty flag
    if(!dirty && !pickChanged) {
      return
    }

    //Apply axes/clip bounds
    for(var i=0; i<numObjs; ++i) {
      var obj = objects[i]

      //Set axes bounds
      obj.axesBounds = bounds

      //Set clip bounds
      if(scene.clipToBounds) {
        obj.clipBounds = bounds
      }
    }

    //If state changed, then redraw pick buffers
    if(dirty) {
      renderPick()
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, width, height)

    //General strategy: 3 steps
    //  1. render non-transparent objects
    //  2. accumulate transparent objects into separate fbo
    //  3. composite final scene

    //Clear FBO
    gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3])
    gl.clear(gl.COLOR_BUFFER_BIT || gl.DEPTH_BUFFER_BIT)
    gl.enable(gl.DEPTH_TEST)

    //Render forward pass
    if(axes.enable) {
      axes.draw(cameraParams)
    }
    for(var i=0; i<numObjs; ++i) {
      var obj = objects[i]
      obj.draw(cameraParams)
    }

    //Render transparent pass

    //Clear dirty flags
    pickChanged = false
    scene.dirty = false
    for(var i=0; i<numObjs; ++i) {
      objects[i].dirty = false
    }
    axes.dirty = false
  }
  render()

  return scene
}