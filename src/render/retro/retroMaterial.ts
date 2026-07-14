/**
 * Retro terrain material — the "hybrid" toggle. Recreates the original VistaPro
 * look with faceted flat shading (per-triangle normals via screen-space
 * derivatives), banded/posterized diffuse lighting, an ordered (Bayer) dither,
 * and a quantized color palette. Reuses the same vertex colors and scene fog as
 * the modern material so switching modes is seamless.
 */
import {
  Color,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from 'three';
import type { SunParams } from '../../state/SceneParams';

const vertexShader = /* glsl */ `
  #include <common>
  #include <color_pars_vertex>
  #include <fog_pars_vertex>
  varying vec3 vWorldPos;

  void main() {
    #include <color_vertex>
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vec4 mvPosition = viewMatrix * worldPos;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  #include <common>
  #include <color_pars_fragment>
  #include <fog_pars_fragment>
  varying vec3 vWorldPos;

  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uAmbient;
  uniform float uShadeLevels;
  uniform float uColorLevels;
  uniform float uDither;

  // Array-free ordered (Bayer) dither, built recursively from a 2x2 pattern
  // so it compiles as GLSL ES 1.00 (which lacks array constructors / bit ops).
  float bayer2(vec2 a) {
    a = floor(a);
    return fract(a.x * 0.5 + a.y * a.y * 0.75);
  }
  float bayer4(vec2 a) {
    return bayer2(0.5 * a) * 0.25 + bayer2(a);
  }

  void main() {
    // Per-face normal from screen-space derivatives -> faceted shading.
    vec3 n = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
    if (n.y < 0.0) n = -n;

    float diff = max(dot(n, normalize(uSunDir)), 0.0);
    float shade = floor(diff * uShadeLevels + 0.5) / uShadeLevels;
    float light = uAmbient + (1.0 - uAmbient) * shade;

    vec3 lit = vColor.rgb * uSunColor * light;
    gl_FragColor = vec4(lit, 1.0);
    #include <fog_fragment>

    // Posterize + dither in display space for the period-accurate banding.
    vec3 c = pow(max(gl_FragColor.rgb, 0.0), vec3(1.0 / 2.2));
    c += (bayer4(gl_FragCoord.xy) - 0.5) * uDither;
    c = floor(c * uColorLevels + 0.5) / uColorLevels;
    gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
  }
`;

export class RetroTerrainMaterial extends ShaderMaterial {
  constructor() {
    super({
      vertexColors: true,
      fog: true,
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          uSunDir: { value: new Vector3(0, 1, 0) },
          uSunColor: { value: new Color('#fff4e0') },
          uAmbient: { value: 0.35 },
          uShadeLevels: { value: 4.0 },
          uColorLevels: { value: 6.0 },
          uDither: { value: 0.06 },
        },
      ]),
      vertexShader,
      fragmentShader,
    });
  }

  /** Follow the sun so retro shading matches the modern lighting. */
  apply(sun: SunParams, sunDir: Vector3): void {
    (this.uniforms.uSunColor.value as Color).set(sun.color);
    (this.uniforms.uSunDir.value as Vector3).copy(sunDir);
  }
}
