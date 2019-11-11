precision mediump float;

uniform sampler2D accumBuffer;
varying vec2 uv;

const float n = 3.0;

float f(float x) {
  return pow(x, n);
}

void main() {
  vec4 accum = texture2D(accumBuffer, 0.5 * (uv + 1.0));
  float r = accum.r;
  float g = accum.g;
  float b = accum.b;
  float a = accum.a;

  float q = pow(1.0 - (f(r) + f(g) + f(b)) / 3.0, 1.0 / n);

  gl_FragColor = vec4(
    r * q,
    g * q,
    b * q,
    a
  );
}