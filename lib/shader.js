var glslify      = require('glslify')
var createShader = require('gl-shader')

var compositeShader = glslify({
  vert: './vertex.glsl',
  frag: './composite.glsl',
  sourceOnly: true
})

module.exports = function(gl) {
  return createShader(gl, compositeShader)
}