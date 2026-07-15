/**
 * Sky dome: a camera-centered inward-facing sphere shaded with a vertical
 * gradient (horizon -> zenith), a sun disc + glow aligned with the light, and
 * drifting procedural (fbm) clouds whose coverage is controllable. The dome is
 * excluded from fog so the gradient stays crisp while terrain fades into haze.
 */
import {
  BackSide,
  Color,
  Mesh,
  type PerspectiveCamera,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import type { SceneParams } from '../state/SceneParams';

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec3 vDir;
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uCloudColor;
  uniform float uCloudCover;
  uniform float uTime;
  uniform float uStars;
  uniform float uClouds;
  uniform float uHorizonBand;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 dir = normalize(vDir);
    float up = clamp(dir.y, 0.0, 1.0);

    // Vertical gradient. The horizon band can be toggled off for a flat sky.
    vec3 sky = uHorizonBand > 0.5
      ? mix(uHorizon, uTop, pow(up, 0.55))
      : uTop;

    // Stars: sparse twinkling points in the upper hemisphere, brightened in
    // proportion to how dark the underlying sky is (so they show at dusk/night).
    if (uStars > 0.5 && dir.y > 0.02) {
      vec2 sc = dir.xz / (dir.y + 0.3);
      vec2 cell = floor(sc * 60.0);
      float h = hash(cell);
      if (h > 0.995) {
        float tw = 0.65 + 0.35 * sin(uTime * 3.0 + h * 100.0);
        float darkness = 1.0 - clamp(max(max(sky.r, sky.g), sky.b), 0.0, 1.0);
        sky += vec3(tw) * darkness * 0.9;
      }
    }

    // Sun disc + glow.
    float sd = max(dot(dir, normalize(uSunDir)), 0.0);
    float disc = smoothstep(0.9985, 0.9995, sd);
    float glow = pow(sd, 220.0) * 0.7 + pow(sd, 12.0) * 0.15;
    sky += uSunColor * (disc + glow);

    // Clouds: project the sky direction onto a plane overhead.
    if (uClouds > 0.5 && dir.y > 0.04 && uCloudCover > 0.001) {
      vec2 cuv = dir.xz / (dir.y + 0.15);
      cuv = cuv * 1.4 + vec2(uTime * 0.006, uTime * 0.004);
      float n = fbm(cuv);
      float edge = 1.0 - uCloudCover;
      float mask = smoothstep(edge, edge + 0.22, n);
      mask *= smoothstep(0.04, 0.22, dir.y);
      float shade = 0.75 + 0.25 * fbm(cuv * 2.0);
      sky = mix(sky, uCloudColor * shade, mask * 0.9);
    }

    gl_FragColor = vec4(sky, 1.0);
  }
`;

export class SkyDome {
  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;
  private readonly camera: PerspectiveCamera;
  private time = 0;

  constructor(camera: PerspectiveCamera) {
    this.camera = camera;
    this.material = new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new Color('#2b5c9c') },
        uHorizon: { value: new Color('#bcd0e6') },
        uSunDir: { value: new Vector3(0, 1, 0) },
        uSunColor: { value: new Color('#fff4e0') },
        uCloudColor: { value: new Color('#ffffff') },
        uCloudCover: { value: 0.4 },
        uTime: { value: 0 },
        uStars: { value: 0 },
        uClouds: { value: 1 },
        uHorizonBand: { value: 1 },
      },
      vertexShader,
      fragmentShader,
    });
    this.mesh = new Mesh(new SphereGeometry(6000, 32, 16), this.material);
    this.mesh.name = 'sky';
    this.mesh.renderOrder = -1;
    // Follow the camera so the dome always surrounds the viewer.
    camera.add(this.mesh);
  }

  /** Update sky colors, cloud cover, sun direction, and feature toggles. */
  apply(params: SceneParams, sunDir: Vector3): void {
    const u = this.material.uniforms;
    (u.uTop.value as Color).set(params.sky.topColor);
    (u.uHorizon.value as Color).set(params.sky.horizonColor);
    (u.uCloudColor.value as Color).set(params.sky.cloudColor);
    u.uCloudCover.value = params.sky.cloudCover;
    (u.uSunColor.value as Color).set(params.sun.color);
    (u.uSunDir.value as Vector3).copy(sunDir);
    u.uStars.value = params.features.starsEnabled ? 1 : 0;
    u.uClouds.value = params.features.cloudsEnabled ? 1 : 0;
    u.uHorizonBand.value = params.features.horizonEnabled ? 1 : 0;
    this.mesh.visible = params.features.skyEnabled;
  }

  /** Advance cloud drift. */
  update(dt: number): void {
    this.time += dt;
    this.material.uniforms.uTime.value = this.time;
  }

  dispose(): void {
    this.camera.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
