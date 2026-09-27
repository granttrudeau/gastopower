// Shared GLSL snippets. Everything visual in the film is generated from these functions.

export const NOISE = /* glsl */ `
// Hash functions after Dave Hoskins, "Hash without Sine" (MIT).
float hash11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
vec3 hash33(vec3 p3){ p3 = fract(p3 * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yxz+33.33); return fract((p3.xxy + p3.yxx)*p3.zyx); }

float vnoise2(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  float a = hash12(i), b = hash12(i+vec2(1,0)), c = hash12(i+vec2(0,1)), d = hash12(i+vec2(1,1));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float vnoise3(vec3 p){
  vec3 i = floor(p), f = fract(p);
  vec3 u = f*f*(3.0-2.0*f);
  float n000 = hash13(i), n100 = hash13(i+vec3(1,0,0)), n010 = hash13(i+vec3(0,1,0)), n110 = hash13(i+vec3(1,1,0));
  float n001 = hash13(i+vec3(0,0,1)), n101 = hash13(i+vec3(1,0,1)), n011 = hash13(i+vec3(0,1,1)), n111 = hash13(i+vec3(1,1,1));
  return mix(mix(mix(n000,n100,u.x), mix(n010,n110,u.x), u.y), mix(mix(n001,n101,u.x), mix(n011,n111,u.x), u.y), u.z);
}
// Gradient noise, roughly in [-1,1].
float gnoise3(vec3 p){
  vec3 i = floor(p), f = fract(p);
  vec3 u = f*f*f*(f*(f*6.0-15.0)+10.0);
  #define GR(o) dot(hash33(i+o)*2.0-1.0, f-o)
  float n = mix(mix(mix(GR(vec3(0,0,0)),GR(vec3(1,0,0)),u.x), mix(GR(vec3(0,1,0)),GR(vec3(1,1,0)),u.x),u.y),
                mix(mix(GR(vec3(0,0,1)),GR(vec3(1,0,1)),u.x), mix(GR(vec3(0,1,1)),GR(vec3(1,1,1)),u.x),u.y), u.z);
  #undef GR
  return n * 1.6;
}
float fbm2(vec2 p){ float v=0.0, a=0.5; mat2 m = mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<5;i++){ v += a*vnoise2(p); p = m*p; a *= 0.5; } return v; }
float fbm2hq(vec2 p){ float v=0.0, a=0.5; mat2 m = mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<7;i++){ v += a*vnoise2(p); p = m*p; a *= 0.5; } return v; }
float fbm3(vec3 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v += a*gnoise3(p); p = p*2.03 + vec3(1.7,9.2,3.1); a *= 0.5; } return v; }
float fbm3lo(vec3 p){ float v=0.0, a=0.5; for(int i=0;i<3;i++){ v += a*gnoise3(p); p = p*2.03 + vec3(1.7,9.2,3.1); a *= 0.5; } return v; }
// Cellular (Worley) distance for scrub / gravel speckle.
float worley2(vec2 p){
  vec2 i = floor(p), f = fract(p); float d = 8.0;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 o = vec2(x,y); vec2 r = o + hash22(i+o) - f; d = min(d, dot(r,r)); }
  return sqrt(d);
}
`;

// Height fog with sun in-scatter. Uniforms are shared by every material in the film.
export const ATMOS_PARS = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uFogColor;
uniform vec3 uSunFogColor;
uniform float uFogDensity;
uniform float uFogHeight;
uniform float uFogSunPow;
uniform float uFogMax;
vec3 applyAtmos(vec3 col, vec3 wpos, vec3 camPos){
  vec3 d = wpos - camPos; float dist = length(d); vec3 rd = d / max(dist, 1e-4);
  float b = 1.0 / uFogHeight;
  float k = rd.y * b * dist;
  float integral = abs(k) < 1e-3 ? dist : dist * (1.0 - exp(-k)) / k;
  float amt = uFogDensity * exp(-camPos.y * b) * integral;
  float fog = min(1.0 - exp(-amt), uFogMax);
  float s = pow(max(dot(rd, uSunDir), 0.0), uFogSunPow);
  vec3 fc = mix(uFogColor, uSunFogColor, s);
  return mix(col, fc, fog);
}
`;

export const TONEMAP = /* glsl */ `
// AgX, Rec.709 variant (after bwrensch / T. Sobotka).
vec3 agxContrast(vec3 x){ vec3 x2 = x*x; vec3 x4 = x2*x2;
  return 15.5*x4*x2 - 40.14*x4*x + 31.96*x4 - 6.868*x2*x + 0.4298*x2 + 0.1191*x - 0.00232; }
vec3 agx(vec3 c){
  const mat3 ins = mat3(0.842479062253094, 0.0423282422610123, 0.0423756549057051,
                        0.0784335999999992, 0.878468636469772, 0.0784336,
                        0.0792237451477643, 0.0791661274605434, 0.879142973793104);
  const float minEv = -12.47393, maxEv = 4.026069;
  c = ins * c;
  c = clamp(log2(max(c, 1e-10)), minEv, maxEv);
  c = (c - minEv) / (maxEv - minEv);
  return agxContrast(c);
}
vec3 agxEotf(vec3 c){
  const mat3 outs = mat3(1.19687900512017, -0.0528968517574562, -0.0529716355144438,
                         -0.0980208811401368, 1.15190312990417, -0.0980434501171241,
                         -0.0990297440797205, -0.0989611768448433, 1.15107367264116);
  c = outs * c;
  return pow(max(c, 0.0), vec3(2.2));
}
vec3 agxLook(vec3 c, float power, float sat){
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = pow(max(c, 0.0), vec3(power));
  return l + sat * (c - l);
}
vec3 linearToSRGB(vec3 c){
  return mix(c * 12.92, 1.055 * pow(max(c, 0.0), vec3(1.0/2.4)) - 0.055, step(0.0031308, c));
}
vec3 srgbToLinear(vec3 c){
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
`;

export const BLACKBODY = /* glsl */ `
// Planckian locus (Krystek 1985) -> normalized linear sRGB.
vec3 blackbody(float t){
  t = clamp(t, 800.0, 12000.0);
  float u = (0.860117757 + 1.54118254e-4*t + 1.28641212e-7*t*t) / (1.0 + 8.42420235e-4*t + 7.08145163e-7*t*t);
  float v = (0.317398726 + 4.22806245e-5*t + 4.20481691e-8*t*t) / (1.0 - 2.89741816e-5*t + 1.61456053e-7*t*t);
  float x = 3.0*u / (2.0*u - 8.0*v + 4.0);
  float y = 2.0*v / (2.0*u - 8.0*v + 4.0);
  vec3 XYZ = vec3(x/y, 1.0, (1.0 - x - y)/y);
  vec3 rgb = mat3(3.2404542, -0.9692660, 0.0556434, -1.5371385, 1.8760108, -0.2040259, -0.4985314, 0.0415560, 1.0572252) * XYZ;
  rgb = max(rgb, 0.0);
  return rgb / max(max(rgb.r, rgb.g), rgb.b);
}
`;
