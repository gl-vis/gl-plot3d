precision mediump float;

uniform sampler2D accumBuffer;
varying vec2 uv;

void main() {
  vec4 accum = texture2D(accumBuffer, 0.5 * (uv + 1.0));
  float r = accum.r;
  float g = accum.g;
  float b = accum.b;
  float a = accum.a;

  float q = 1.0 - (r + g + b) / 3.0;

  gl_FragColor = vec4(
    r * q,
    g * q,
    b * q,
    a
  );
}