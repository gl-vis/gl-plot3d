'use strict'

module.exports = createScene

var createCamera = require('orbiter')
var createAxes   = require('gl-axes3d')
var axesRanges   = require('gl-axes3d/properties')
var createSpikes = require('gl-spikes3d')
var createSelect = require('gl-select-static')
var createFBO    = require('gl-fbo')
var drawTriangle = require('a-big-triangle')
var mouseChange  = require('mouse-change')
var perspective  = require('gl-mat4/perspective')
var createShader = require('./lib/shader')

function MouseSelect() {
  this.mouse          = [-1,-1]
  this.screen         = null
  this.distance       = Infinity
  this.index          = null
  this.dataCoordinate = null
  this.dataPosition   = null
  this.object         = null
  this.data           = null
}

function roundUpPow10(x) {
  var y = Math.round(Math.log(Math.abs(x)) / Math.log(10))
  if(y < 0) {
    var base = Math.round(Math.pow(10, -y))
    return Math.ceil(x*base) / base
  } else if(y > 0) {
    var base = Math.round(Math.pow(10, y))
    return Math.ceil(x/base) * base
  }
  return Math.ceil(x)
}

function defaultBool(x) {
  if(typeof x === 'boolean') {
    return x
  }
  return true
}

function createScene(options) {
  options = options || {}

  var stopped = false

  var canvas = options.canvas
  if(!canvas) {
    canvas = document.createElement('canvas')
    var container = (options.container || document.body)
    container.appendChild(canvas)
  }

  var gl = options.gl
  if(!gl) {
    var glOptions = options.glOptions || { premultipliedAlpha: true }
    gl = canvas.getContext('webgl', glOptions)
  }
  if(!gl) {
    throw new Error('webgl not supported')
  }

  var viewShape = [ gl.drawingBufferWidth, gl.drawingBufferHeight ]
  var pickShape = [ (gl.drawingBufferWidth/scene.pixelRatio)|0, (gl.drawingBufferHeight/scene.pixelRatio)|0 ]

  //Initial bounds
  var bounds = options.bounds || [[-10,-10,-10], [10,10,10]]

  //Create selection
  var selection = new MouseSelect()

  //Accumulation buffer
  var accumBuffer = createFBO(gl,
    [gl.drawingBufferWidth, gl.drawingBufferHeight], {
      preferFloat: true
    })

  var accumShader = createShader(gl)

  //Create a camera
  var cameraOptions = options.camera || {
    eye:    [0,0,2],
    center: [0,0,0],
    up:     [0,1,0],
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
  
  //Object list is empty initially
  var objects         = []
  var pickBufferIds   = []
  var pickBufferCount = []
  var pickBuffers     = []

  //Dirty flag, skip redraw if scene static
  var dirty       = true
  var pickDirty   = true
  
  var projection     = new Array(16)
  var model          = new Array(16)
  
  var cameraParams = {
    view:         camera.matrix,
    projection:   projection,
    model:        model
  }

  var pickDirty = true
  //Create scene object
  var scene = {
    gl:           gl,
    pixelRatio:   options.pixelRatio || parseFloat(window.devicePixelRatio),
    canvas:       canvas,
    selection:    selection,
    camera:       camera,
    axes:         axes,
    axesPixels:   null,
    spikes:       spikes,
    bounds:       bounds,
    objects:      objects,
    pickRadius:   options.pickRadius || 10,
    zNear:        options.zNear || 0.01,
    zFar:         options.zFar  || 1000,
    fovy:         options.fovy  || Math.PI/4,
    clearColor:   options.clearColor || [0,0,0,0],
    autoResize:   defaultBool(options.autoResize),
    autoBounds:   defaultBool(options.autoBounds),
    autoScale:    defaultBool(options.autoScale),
    autoCenter:   defaultBool(options.autoCenter),
    clipToBounds: defaultBool(options.clipToBounds),
    snapToData:   !!options.snapToData,
    onselect:     options.onselect || null,
    onrender:     options.onrender || null,
    onclick:      options.onclick  || null,
    shape:        viewShape,
    cameraParams: cameraParams
  }


  var fitFunc = fit(canvas, options.container, pixelRatio)
  function resizeListener() {
    if(!scene.autoResize) {
      return
    }
    var style = canvas.style
    style.position = style.position || 'absolute'
    style.left     = '0px'
    style.right    = '0px'
    var parent = canvas.parentNode
    var width = 0
    var height = 0
    if(p && p !== document.body) {
      width  = parent.clientWidth
      height = parent.clientHeight
    } else {
      width  = window.innerWidth
      height = window.innerHeight
    }
    canvas.width  = Math.ceil(width  * scene.devicePixelRatio)|0
    canvas.height = Math.ceil(height * scene.devicePixelRatio)|0
    style.width   = width  + 'px'
    style.height  = height + 'px'
  }
  if(scene.autoResize) {
    resizeListener()
  }

  window.addEventListener('resize', resizeListener)


  function reallocPickIds() {
    var numObjs = objects.length
    var numPick = pickBuffers.length
    for(var i=0; i<numPick; ++i) {
      pickBufferCount[i] = 0
    }
    obj_loop:
    for(var i=0; i<numObjs; ++i) {
      var obj = objects[i]
      var pickCount = obj.pickSlots
      if(!pickCount) {
        pickBufferIds[i] = -1
        continue
      }
      for(var j=0; j<numPick; ++j) {
        if(pickBufferCount[j] + pickCount < 255) {
          pickBufferIds[i] = j
          obj.setPickBase(pickBufferCount[j]+1)
          pickBufferCount[j] += pickCount
          continue obj_loop
        }
      }
      //Create new pick buffer
      var nbuffer = createSelect(gl, viewShape)
      pickBufferIds[i] = numPick
      pickBuffers.push(nbuffer)
      pickBufferCount.push(pickCount)
      obj.setPickBase(1)
      numPick += 1
    }
    while(numPick > 0 && pickBufferCount[numPick-1] === 0) {
      pickBufferCount.pop()
      pickBuffers.pop().dispose()
    }
  }

  scene.add = function(obj) {
    obj.axes = axes
    objects.push(obj)
    pickBufferIds.push(-1)
    dirty = true
    pickDirty = true
    reallocPickIds()
  }

  scene.remove = function(obj) {
    var idx = objects.indexOf(obj)
    if(idx < 0) {
      return
    }
    objects.splice(idx, 1)
    pickBufferIds.pop()
    dirty = true
    pickDirty = true
    reallocPickIds()
  }

  scene.dispose = function() {
    stopped = true
    window.removeEventListener('resize', resizeListener)
    axes.dispose()
    spikes.dispose()
    for(var i=0; i<objects.length; ++i) {
      objects[i].dispose()
    }
  }

  //Update mouse position
  var mouseRotating = false

  var prevButtons = 0

  mouseChange(canvas, function(buttons, x, y) {
    var numPick = pickBuffers.length
    var numObjs = objects.length
    var prevObj = selection.object
    selection.distance = Infinity
    selection.mouse[0] = x
    selection.mouse[1] = y
    selection.object = null
    selection.screen = null
    selection.dataCoordinate = selection.dataPosition = null

    var change = false

    if(buttons) {
      mouseRotating = true
    } else {
      if(mouseRotating) {
        pickDirty = true
      }
      mouseRotating = false

      for(var i=0; i<numPick; ++i) {
        var result = pickBuffers[i].query(x, gl.drawingBufferHeight - y - 1, scene.pickRadius)
        if(result) {
          if(result.distance > selection.distance) {
            continue
          }
          for(var j=0; j<numObjs; ++j) {
            var obj = objects[j]
            if(pickBufferIds[j] !== i) {
              continue
            }
            var objPick = obj.pick(result)
            if(objPick) {
              selection.screen         = result.coord
              selection.distance       = result.distance
              selection.object         = obj
              selection.index          = objPick.distance
              selection.dataPosition   = objPick.position
              selection.dataCoordinate = objPick.dataCoordinate
              selection.data           = objPick
              change = true
            }
          }
        }
      }
    }
    if(prevObj && prevObj !== selection.object) {
      if(prevObj.highlight) {
        prevObj.highlight(null)
      }
      dirty = true
    }
    if(selection.object) {
      if(selection.object.highlight) {
        selection.object.highlight(selection.data)
      }
      dirty = true
    }

    change = change || (selection.object !== prevObj)
    if(change && scene.onselect) {
      scene.onselect(selection)
    }

    if((buttons & 1) && !(prevButtons & 1) && scene.onclick) {
      scene.onclick(selection)
    }
    prevButtons = buttons
  })

  //Render the scene for mouse picking
  function renderPick() {

    gl.colorMask(true, true, true, true)
    gl.depthMask(true)
    gl.disable(gl.BLEND)
    gl.enable(gl.DEPTH_TEST)

    var numObjs = objects.length
    var numPick = pickBuffers.length
    for(var j=0; j<numPick; ++j) {
      var buf = pickBuffers[j]
      buf.shape = pickShape
      buf.begin()
      for(var i=0; i<numObjs; ++i) {
        if(pickBufferIds[i] !== j) {
          continue
        }
        var obj = objects[i]
        if(obj.drawPick) {
          obj.drawPick(cameraParams)
        }
      }
      buf.end()
    }
  }

  var nBounds = [
    [Infinity, Infinity, Infinity],
    [-Infinity,-Infinity,-Infinity]]

  //Draw the whole scene
  function render() {
    if(stopped) {
      return
    }

    requestAnimationFrame(render)

    //Tick camera
    var cameraMoved = camera.tick()
    dirty     = dirty || cameraMoved
    pickDirty = pickDirty || cameraMoved

    //Check if any objects changed, recalculate bounds
    var numObjs = objects.length
    var lo = nBounds[0]
    var hi = nBounds[1]
    lo[0] = lo[1] = lo[2] =  Infinity
    hi[0] = hi[1] = hi[2] = -Infinity
    for(var i=0; i<numObjs; ++i) {
      var obj = objects[i]
      dirty = dirty || !!obj.dirty
      pickDirty = pickDirty || !!obj.dirty
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
    pickDirty = pickDirty || boundsChanged
    dirty = dirty || boundsChanged

    //Get scene
    var width  = gl.drawingBufferWidth
    var height = gl.drawingBufferHeight
    viewShape[0] = width
    viewShape[1] = height
    pickShape[0] = (width/pixelRatio)|0
    pickShape[1] = (height/pixelRatio)|0

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

    //Set spike parameters
    if(selection.object) {
      if(scene.snapToData) {
        spikes.position = selection.dataCoordinate
      } else {
        spikes.position = selection.dataPosition
      }
      spikes.bounds = bounds
    }

    //If state changed, then redraw pick buffers
    if(pickDirty) {
      pickDirty = false
      renderPick()
    }

    if(!dirty) {
      return
    }

    //Recalculate pixel data
    scene.axesPixels = axesRanges(scene.axes, cameraParams, width, height)

    //Call render callback
    if(scene.onrender) {
      scene.onrender()
    }

    //Read value
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, width, height)

    //General strategy: 3 steps
    //  1. render non-transparent objects
    //  2. accumulate transparent objects into separate fbo
    //  3. composite final scene

    //Clear FBO
    var clearColor = scene.clearColor
    gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3])
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.depthMask(true)
    gl.colorMask(true, true, true, true)  
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.disable(gl.BLEND)
    gl.disable(gl.CULL_FACE)  //most visualization surfaces are 2 sided

    //Render opaque pass
    var hasTransparent = false
    if(axes.enable) {
      hasTransparent = hasTransparent || axes.isTransparent()
      axes.draw(cameraParams)
    }
    spikes.axes = axes
    if(selection.object) {
      spikes.draw(cameraParams)
    }

    gl.disable(gl.CULL_FACE)  //most visualization surfaces are 2 sided
    
    for(var i=0; i<numObjs; ++i) {
      var obj = objects[i]
      obj.axes = axes
      if(obj.isOpaque && obj.isOpaque()) {
        obj.draw(cameraParams)
      }
      if(obj.isTransparent && obj.isTransparent()) {
        hasTransparent = true
      }
    }

    if(hasTransparent) {
      //Render transparent pass
      accumBuffer.shape = viewShape
      accumBuffer.bind()
      gl.clear(gl.DEPTH_BUFFER_BIT)
      gl.colorMask(false, false, false, false)
      gl.depthMask(true)
      gl.depthFunc(gl.LESS)
      
      //Render forward facing objects
      if(axes.enable && axes.isTransparent()) {
        axes.drawTransparent(cameraParams)
      }
      for(var i=0; i<numObjs; ++i) {
        var obj = objects[i]
        if(obj.isOpaque && obj.isOpaque()) {
          obj.draw(cameraParams)
        }
      }

      //Render transparent pass
      gl.enable(gl.BLEND)
      gl.blendEquation(gl.FUNC_ADD)
      gl.blendFunc(gl.ONE, gl.ONE)
      gl.colorMask(true, true, true, true)
      gl.depthMask(false)
      gl.clearColor(0,0,0,0)
      gl.clear(gl.COLOR_BUFFER_BIT)

      if(axes.isTransparent()) {
        axes.drawTransparent(cameraParams)
      }

      for(var i=0; i<numObjs; ++i) {
        var obj = objects[i]
        if(obj.isTransparent && obj.isTransparent()) {
          obj.drawTransparent(cameraParams)
        }
      }

      //Unbind framebuffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)

      //Draw composite pass
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      gl.disable(gl.DEPTH_TEST)
      accumShader.bind()
      accumBuffer.color[0].bind(0)
      accumShader.uniforms.accumBuffer = 0
      drawTriangle(gl)

      //Turn off blending
      gl.disable(gl.BLEND)
    }

    //Clear dirty flags
    dirty = false
    for(var i=0; i<numObjs; ++i) {
      objects[i].dirty = false
    }
  }
  render()

  return scene
}