/** The open sea and the sky over it, as shaders: waves, sun glints, fresnel and haze. */
import {
  BackSide,
  Color,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  Vector4,
} from 'three';

export const SKY = {
  zenith: new Color('#2f6aa6'),
  horizon: new Color('#f2c79a'),
  haze: new Color('#b7c6cf'),
  sun: new Color('#ffe2b0'),
  deep: new Color('#0d4763'),
  shallow: new Color('#2a8ea0'),
};

/** Where the sun is (a unit vector towards it): low, behind and to the left of the camera. */
export const SUN = new Vector3(-0.55, 0.32, -0.77).normalize();

const WAVES = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  uniform vec4 uCalm[2];
  float calmAt(vec2 p) {
    float c = 1.0;
    for (int i = 0; i < 2; i++) {
      vec2 d = abs(p - uCalm[i].xy) - vec2(uCalm[i].z);
      float out_ = length(max(d, 0.0));
      c = min(c, smoothstep(0.0, 3.0, out_));
    }
    return mix(0.15, 1.0, c);
  }
  // Sum of directional waves: height in .x, slope in .yz.
  vec3 waves(vec2 p, float t) {
    vec3 sum = vec3(0.0);
    vec4 W[4];
    W[0] = vec4(0.8, 0.6, 0.55, 0.10);
    W[1] = vec4(-0.4, 0.92, 0.9, 0.06);
    W[2] = vec4(0.97, -0.24, 1.6, 0.03);
    W[3] = vec4(-0.7, -0.7, 2.3, 0.02);
    for (int i = 0; i < 4; i++) {
      vec2 dir = normalize(W[i].xy);
      float k = W[i].z;
      float a = W[i].w;
      float ph = dot(dir, p) * k + t * sqrt(9.8 * k) * 0.55;
      sum.x += a * sin(ph);
      sum.yz += a * k * cos(ph) * dir;
    }
    return sum;
  }
`;

const WATER_VERTEX = /* glsl */ `
  ${WAVES}
  varying vec3 vWorld;
  varying float vCalm;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    float calm = calmAt(w.xz);
    vec3 h = waves(w.xz, uTime) * uAmp * calm;
    w.y += h.x;
    vWorld = w.xyz;
    vCalm = calm;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const WATER_FRAGMENT = /* glsl */ `
  ${WAVES}
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uHaze;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  uniform float uFog;
  uniform float uDetail;
  varying vec3 vWorld;
  varying float vCalm;
  void main() {
    vec3 h = waves(vWorld.xz, uTime) * uAmp * vCalm;
    vec2 slope = h.yz;
    if (uDetail > 0.5) {
      vec2 p = vWorld.xz;
      float t = uTime;
      slope += 0.05 * vec2(cos(p.x * 4.1 + t * 2.1), cos(p.y * 3.7 - t * 1.7));
      slope += 0.035 * vec2(cos((p.x + p.y) * 6.3 + t * 2.9), cos((p.x - p.y) * 5.9 - t * 2.3));
      slope += 0.02 * vec2(cos(p.y * 11.0 + t * 4.0), cos(p.x * 12.0 - t * 3.6));
    }
    vec3 n = normalize(vec3(-slope.x, 1.0, -slope.y));
    vec3 v = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
    vec3 r = reflect(-v, n);
    vec3 sky = mix(uHorizon, uZenith, smoothstep(-0.05, 0.6, r.y));
    vec3 body = mix(uDeep, uShallow, clamp(0.35 + h.x * 2.5 + n.x * 0.5, 0.0, 1.0));
    vec3 col = mix(body, sky, 0.18 + fres * 0.7);
    float s = max(dot(r, uSunDir), 0.0);
    col += uSunColor * (pow(s, 350.0) * 4.0 + pow(s, 24.0) * 0.18);
    float d = length(vWorld.xz - cameraPosition.xz);
    float fog = 1.0 - exp(-pow(d * uFog, 1.8));
    col = mix(col, uHaze, fog);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const SKY_VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;

const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uHaze;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float up = clamp(d.y, -0.2, 1.0);
    vec3 col = mix(mix(uHaze, uHorizon, smoothstep(-0.02, 0.04, up)), uZenith, smoothstep(0.04, 0.6, up));
    float s = max(dot(d, uSunDir), 0.0);
    col += uSunColor * (pow(s, 900.0) * 6.0 + pow(s, 12.0) * 0.35 + pow(s, 3.0) * 0.12);
    col = mix(col, uHaze, smoothstep(0.0, -0.1, d.y));
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** The water plane: call `tick` every frame. */
export class Water {
  readonly mesh: Mesh;
  readonly sky: Mesh;
  private readonly material: ShaderMaterial;

  constructor(low: boolean, calm: [Vector4, Vector4]) {
    const segments = low ? 90 : 220;
    const geometry = new PlaneGeometry(160, 160, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    this.material = new ShaderMaterial({
      vertexShader: WATER_VERTEX,
      fragmentShader: WATER_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uAmp: { value: 1 },
        uCalm: { value: calm },
        uDeep: { value: SKY.deep },
        uShallow: { value: SKY.shallow },
        uZenith: { value: SKY.zenith },
        uHorizon: { value: SKY.horizon },
        uHaze: { value: SKY.haze },
        uSunColor: { value: SKY.sun },
        uSunDir: { value: SUN },
        uFog: { value: 0.011 },
        uDetail: { value: low ? 0 : 1 },
      },
    });
    this.mesh = new Mesh(geometry, this.material);
    this.mesh.renderOrder = -1;

    this.sky = new Mesh(
      new SphereGeometry(300, 32, 16),
      new ShaderMaterial({
        vertexShader: SKY_VERTEX,
        fragmentShader: SKY_FRAGMENT,
        side: BackSide,
        depthWrite: false,
        uniforms: {
          uZenith: { value: SKY.zenith },
          uHorizon: { value: SKY.horizon },
          uHaze: { value: SKY.haze },
          uSunColor: { value: SKY.sun },
          uSunDir: { value: SUN },
        },
      }),
    );
    this.sky.renderOrder = -2;
  }

  /** Low graphics: no fine ripples. */
  setDetail(high: boolean) {
    (this.material.uniforms.uDetail as { value: number }).value = high ? 1 : 0;
  }

  tick(seconds: number) {
    (this.material.uniforms.uTime as { value: number }).value = seconds;
  }

  /** The height and slope of the water at a point, as the shader moves it (for floating things). */
  static heightAt(x: number, z: number, t: number, calm: readonly Vector4[]): number {
    let c = 1;
    for (const v of calm) {
      const dx = Math.max(Math.abs(x - v.x) - v.z, 0);
      const dz = Math.max(Math.abs(z - v.y) - v.z, 0);
      const out = Math.hypot(dx, dz);
      const s = Math.min(1, Math.max(0, out / 3));
      c = Math.min(c, s * s * (3 - 2 * s));
    }
    const calmness = 0.15 + 0.85 * c;
    let h = 0;
    for (const [dx, dz, k, a] of [
      [0.8, 0.6, 0.55, 0.1],
      [-0.4, 0.92, 0.9, 0.06],
      [0.97, -0.24, 1.6, 0.03],
      [-0.7, -0.7, 2.3, 0.02],
    ] as const) {
      const len = Math.hypot(dx, dz);
      const ph = ((dx / len) * x + (dz / len) * z) * k + t * Math.sqrt(9.8 * k) * 0.55;
      h += a * Math.sin(ph);
    }
    return h * calmness;
  }
}
