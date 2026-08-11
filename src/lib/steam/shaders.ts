/** Общая вершинная программа: полноэкранный треугольник. */
export const VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

/**
 * Поле скоростей. Полулагранжева адвекция: каждый тексель смотрит,
 * откуда его снесло, и берёт значение оттуда. Курсор вносит импульс
 * вдоль отрезка своего перемещения — поэтому среда расходится ВПЕРЁД
 * по вектору движения, а не ровно во все стороны.
 *
 * rg — скорость, b — «прочищенность» (сколько пара выдавило).
 * След живёт дольше импульса: скорость гаснет за доли секунды,
 * коридор затягивается около 1.2 с.
 */
export const FLOW_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uPrev;
uniform vec2 uP0;
uniform vec2 uP1;
uniform float uDt;
uniform float uActive;
uniform float uAspect;

vec2 asp(vec2 v) { return vec2(v.x * uAspect, v.y); }

void main() {
  vec2 uv = vUv;
  vec4 here = texture(uPrev, uv);

  // Идём назад по полю — так перенос не «размазывает», а сносит.
  vec2 back = uv - here.rg * uDt * 0.42;
  vec4 s = texture(uPrev, clamp(back, 0.001, 0.999));

  // Затухание по времени, а не по кадру: иначе на медленной машине
  // след живёт десятки секунд, а на быстрой исчезает мгновенно.
  // Показатель приведён к 60 кадрам в секунду.
  float k = uDt * 60.0;
  vec2 vel = s.rg * pow(0.955, k);
  float clr = s.b * pow(0.9835, k);

  if (uActive > 0.5) {
    vec2 ba = uP1 - uP0;
    float sp = length(asp(ba));
    vec2 dir = sp > 1e-5 ? ba / max(length(ba), 1e-5) : vec2(0.0);

    vec2 pa = uv - uP0;
    float t = clamp(dot(asp(pa), asp(ba)) / max(dot(asp(ba), asp(ba)), 1e-6), 0.0, 1.0);
    vec2 onSeg = uP0 + ba * t;
    float d = length(asp(uv - onSeg));

    // Быстрее движение — шире и дальше уход.
    float R = 0.052 + min(sp * 2.6, 0.085);
    float w = smoothstep(R, 0.0, d);

    vel += dir * w * (0.30 + sp * 11.0);
    clr += w * (0.9 + sp * 7.0) * uDt * 3.4;

    // Два встречно закрученных вихря позади курсора — как за веслом.
    vec2 perp = vec2(-dir.y, dir.x);
    vec2 tail = uP1 - dir * 0.035;
    float k = 0.0022;
    vec2 c1 = tail + perp * 0.042;
    vec2 c2 = tail - perp * 0.042;
    vec2 r1 = asp(uv - c1);
    vec2 r2 = asp(uv - c2);
    float g1 = exp(-dot(r1, r1) / k);
    float g2 = exp(-dot(r2, r2) / k);
    vel += vec2(-r1.y, r1.x) * g1 * sp * 26.0;
    vel += vec2(r2.y, -r2.x) * g2 * sp * 26.0;
    clr += (g1 + g2) * sp * 1.6;
  }

  fragColor = vec4(clamp(vel, -3.0, 3.0), clamp(clr, 0.0, 1.0), 1.0);
}
`

/**
 * Марш по объёму.
 *
 * Луч идёт из камеры сквозь трёхмерное тело и набирает плотность по пути;
 * поглощение — по Бугеру-Ламберту, рассеяние считается в сторону света.
 * Свет слева, как на фотографии: обращённые к нему клубы светятся,
 * дальние уходят в тень.
 *
 * Плоскость вордмарка стоит ВНУТРИ объёма. Марш идёт спереди назад, и
 * когда луч пересекает плоскость, буквы домножаются на текущую
 * прозрачность: то, что ближе камеры, их перекрывает, то, что дальше, —
 * ложится за ними. Никаких двух слоёв с подобранной непрозрачностью.
 */
export const VOLUME_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform highp sampler3D uNoise;
uniform sampler2D uFlow;
uniform sampler2D uWord;
uniform vec2 uCam;
uniform float uTime;
uniform float uAspect;
uniform float uFrame;
uniform float uSteps;
uniform float uReveal;

const float CAM_Z = 2.6;
const float FOCAL = 1.9;
const float Z_NEAR = 1.05;   // ближняя грань объёма
const float Z_FAR  = -1.55;  // дальняя
const float Z_WORD = -0.06;  // глубина плоскости со словом

const vec3 LIGHT = vec3(-0.862, 0.318, 0.395);

/** Мировые xy на глубине плоскости → экранные 0..1 (та же проекция). */
vec2 toScreen(vec2 xy) {
  float k = CAM_Z / FOCAL;
  return (xy / (vec2(uAspect, 1.0) * k)) * 0.5 + 0.5;
}

/**
 * Покрытие. Объём заполняет весь кадр до всех четырёх краёв;
 * плотность неравномерная: гуще над водой и в правой половине,
 * реже в левой трети под заголовком — но нигде не ноль.
 */
float coverage(vec2 xy) {
  vec2 s = toScreen(xy);
  float lower = smoothstep(0.98, 0.04, s.y);
  float right = mix(0.46, 1.08, smoothstep(0.10, 0.80, s.x));
  return clamp((0.26 + 0.74 * lower) * right, 0.17, 1.15);
}

/** Плотность без учёта потока — для марша к свету, он и так дорогой. */
float densBase(vec3 p) {
  vec3 q = p * 0.42;
  q.z += uTime * 0.0075;
  q.x -= uTime * 0.0052;
  vec4 n = texture(uNoise, q);
  float d = n.r * 0.58 + n.g * 0.26 + n.b * 0.16;
  d = d * 2.35 - 1.06;
  d += n.a * 0.30 - 0.13;
  return clamp(d * coverage(p.xy), 0.0, 1.0);
}

/** Полная плотность: среда снесена потоком и прочищена следом курсора. */
float dens(vec3 p, out float clr) {
  vec2 fuv = toScreen(p.xy);
  vec3 fl = texture(uFlow, clamp(fuv, 0.0, 1.0)).rgb;
  clr = fl.b;

  vec3 q = p * 0.42;
  q.xy += fl.rg * 0.062;
  q.z += uTime * 0.0075;
  q.x -= uTime * 0.0052;

  vec4 n = texture(uNoise, q);
  float d = n.r * 0.58 + n.g * 0.26 + n.b * 0.16;
  d = d * 2.35 - 1.06;
  d += n.a * 0.30 - 0.13;
  d *= coverage(p.xy);

  // Коридор режет объём по всей глубине, но сильнее в середине тела.
  float depthK = smoothstep(Z_FAR, -0.25, p.z) * smoothstep(Z_NEAR, 0.05, p.z);
  d -= clr * (0.62 + 0.5 * depthK) * 1.5;
  return clamp(d, 0.0, 1.0);
}

float shadow(vec3 p) {
  float s = 0.0;
  float t = 0.075;
  for (int i = 0; i < 3; i++) {
    s += densBase(p + LIGHT * t) * t;
    t *= 2.1;
  }
  return exp(-s * 3.1);
}

/** Дизеринг шага: без него марш кладёт кольцевые полосы. */
float dither(vec2 px) {
  return fract(52.9829189 * fract(dot(px, vec2(0.06711056, 0.00583715)) + uFrame * 0.618034));
}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  vec3 ro = vec3(uCam, CAM_Z);
  vec3 rd = normalize(vec3(p.x * uAspect, p.y, -FOCAL));

  float t0 = (CAM_Z - Z_NEAR) / -rd.z;
  float t1 = (CAM_Z - Z_FAR) / -rd.z;
  float tWord = (CAM_Z - Z_WORD) / -rd.z;

  int steps = int(uSteps);
  float dt = (t1 - t0) / float(steps);
  float t = t0 + dt * dither(gl_FragCoord.xy);

  vec3 col = vec3(0.0);
  float T = 1.0;
  bool wordDone = false;

  // Подцветка из палитры кадра: холод в тенях, тепло на светах.
  const vec3 COLD = vec3(0.50, 0.58, 0.66);
  const vec3 WARM = vec3(1.08, 1.00, 0.89);

  for (int i = 0; i < 48; i++) {
    if (i >= steps || T < 0.025) break;

    // Плоскость со словом пересекается ровно один раз, на своей глубине.
    if (!wordDone && t >= tWord) {
      vec3 wp = ro + rd * tWord;
      vec4 w = texture(uWord, toScreen(wp.xy));
      float a = w.a * uReveal;
      col += T * w.rgb * a;
      T *= (1.0 - a);
      wordDone = true;
    }

    vec3 pos = ro + rd * t;
    float clr;
    float d = dens(pos, clr);

    if (d > 0.004) {
      float sh = shadow(pos);
      vec3 lit = mix(COLD, WARM, sh);
      // Прямое рассеяние вперёд: клубы против света ярче по кромке.
      float hg = 0.55 + 0.45 * pow(max(dot(rd, -LIGHT), 0.0), 3.0);
      float a = 1.0 - exp(-d * dt * 3.1);
      col += T * lit * a * (0.30 + 0.85 * sh) * hg;
      T *= 1.0 - a;
    }
    t += dt;
  }

  // Слово могло остаться непройденным, если марш оборвался раньше.
  if (!wordDone) {
    vec3 wp = ro + rd * tWord;
    vec4 w = texture(uWord, toScreen(wp.xy));
    col += T * w.rgb * w.a * uReveal;
    T *= (1.0 - w.a * uReveal);
  }

  fragColor = vec4(col, 1.0 - T);
}
`

/** Композит: половинное разрешение растягивается и мешается с прошлым кадром. */
export const BLEND_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uCur;
uniform sampler2D uPrev;
uniform float uMix;
void main() {
  vec4 c = texture(uCur, vUv);
  vec4 p = texture(uPrev, vUv);
  fragColor = mix(c, p, uMix);
}
`
