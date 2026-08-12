/** Общая вершинная программа: полноэкранный квад. */
export const VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

/**
 * Поле возмущения среды.
 *
 * Курсор не прочищает коридор и не оставляет следа вдоль траектории —
 * он толкает воздух локально, вокруг себя. Импульс вносится в текущей
 * точке с длинным мягким градиентом, расходится и сразу начинает
 * возвращаться: жизнь возмущения около 0.5 с.
 *
 * rg — скорость (по ней среда расходится), b — лёгкое разрежение.
 * Вихрей по бокам нет намеренно: именно они читались как дворник.
 */
export const FLOW_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uPrev;
uniform sampler2D uWordField;
uniform vec2 uP1;
uniform float uDt;
uniform float uActive;
uniform float uAspect;

vec2 asp(vec2 v) { return vec2(v.x * uAspect, v.y); }

void main() {
  vec2 uv = vUv;
  vec4 here = texture(uPrev, uv);

  // Полулагранжева адвекция: тексель берёт значение оттуда, откуда его снесло.
  vec2 back = uv - here.rg * uDt * 0.30;
  vec4 s = texture(uPrev, clamp(back, 0.001, 0.999));

  // Затухание по времени, а не по кадру. 0.5 с жизни возмущения.
  float k = uDt * 60.0;
  vec2 vel = s.rg * pow(0.885, k);
  float rare = s.b * pow(0.905, k);

  if (uActive > 0.5) {
    // Реакция строго локальная и с длинным градиентом: жёсткой границы
    // у пятна нет, на расстоянии оно гаснет полностью.
    vec2 r = asp(uv - uP1);
    float d = length(r);
    float w = exp(-d * d / 0.0042);
    vec2 dir = d > 1e-4 ? r / d : vec2(0.0);

    // Пар раздвигается в стороны от курсора, а не выдувается вперёд.
    vel += dir * w * 0.42;
    rare += w * 0.30 * uDt * 6.0;
  }

  // Буквы — препятствие: среда не втекает внутрь литеры, а обходит её.
  // Поле хранит в G градиент близости, по нему и отклоняем скорость.
  vec3 wf = texture(uWordField, uv).rgb;
  vec2 push = vec2(dFdx(wf.r), dFdy(wf.r));
  vel += vec2(push.x, -push.y) * 6.0 * uDt * 60.0;

  fragColor = vec4(clamp(vel, -2.0, 2.0), clamp(rare, 0.0, 1.0), 1.0);
}
`

/**
 * Марш по объёму.
 *
 * Пар над горячей водой стелется пластами: шум растянут по горизонтали
 * втрое против вертикали, поверх наложена слоистость, дрейф почти
 * незаметен. Накопленная непрозрачность жёстко ограничена половиной —
 * фотография обязана читаться в любой точке кадра.
 *
 * Плоскость вордмарка стоит ВНУТРИ объёма, и слово работает не только
 * как изображение, но и как препятствие: у кромки литеры плотность
 * растёт, по верхним кромкам оседает конденсат, за буквой остаётся
 * разрежение, а вверх отрываются редкие волокна.
 */
export const VOLUME_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform highp sampler3D uNoise;
uniform sampler2D uFlow;
uniform sampler2D uWord;
uniform sampler2D uWordField;
uniform vec2 uCam;
uniform float uTime;
uniform float uAspect;
uniform float uFrame;
uniform float uSteps;
uniform float uHeroFrac;
uniform float uTailFrac;

const float CAM_Z = 2.6;
const float FOCAL = 1.9;
const float Z_NEAR = 1.05;
const float Z_FAR  = -1.55;
const float Z_WORD = -0.06;

/** Потолок непрозрачности: сквозь пар обязана читаться фотография. */
const float MAX_ALPHA = 0.5;

const vec3 LIGHT = vec3(-0.862, 0.318, 0.395);

vec2 toScreen(vec2 xy) {
  float k = CAM_Z / FOCAL;
  return (xy / (vec2(uAspect, 1.0) * k)) * 0.5 + 0.5;
}

/**
 * Покрытие. Объём по-прежнему доходит до всех четырёх краёв, но у краёв
 * и вверху истончается до почти прозрачного, а не обрывается.
 */
float coverage(vec2 xy) {
  vec2 s = toScreen(xy);
  // Координата, нормированная по высоте героя: 1 — верх кадра, 0 — нижняя
  // кромка экрана, отрицательные значения — хвост в следующий блок.
  float hy = (s.y - uTailFrac) / max(uHeroFrac, 1e-4);
  float lower = smoothstep(1.02, 0.02, hy);
  float right = mix(0.52, 1.0, smoothstep(0.10, 0.80, s.x));
  // Мягкое истончение по краям и растворение хвоста в следующем блоке.
  float edge = smoothstep(0.0, 0.16, s.x) * smoothstep(1.0, 0.84, s.x)
             * smoothstep(1.06, 0.80, hy);
  // Хвост обязан прийти в ноль ровно на нижней кромке холста, иначе
  // объём кончается горизонтальной чертой — тем самым швом.
  float hyEnd = -uTailFrac / max(uHeroFrac, 1e-4);
  float tail = smoothstep(hyEnd, hyEnd * 0.06, hy);
  return clamp((0.30 + 0.92 * lower) * right * (0.34 + 0.66 * edge) * tail, 0.0, 1.05);
}

/** Общая часть плотности: пласты, растянутые по горизонтали. */
float shape(vec3 q, vec4 n) {
  // Слоистость: горизонтальные пласты с рваным по шуму краем.
  float strat = 0.34 + 0.66 * smoothstep(-0.45, 0.62, sin(q.y * 34.0 + n.g * 6.0));
  float d = n.r * 0.62 + n.g * 0.24 + n.b * 0.14;
  d = d * 2.30 - 0.98;
  d += n.a * 0.16 - 0.09;
  return d * strat;
}

/** Координата выборки: по X втрое крупнее, чем по Y; дрейф почти стоит. */
vec3 warp(vec3 p) {
  vec3 q = p * vec3(0.145, 0.44, 0.44);
  q.y -= uTime * 0.0022;
  q.x -= uTime * 0.0026;
  return q;
}

float densBase(vec3 p) {
  vec3 q = warp(p);
  return clamp(shape(q, texture(uNoise, q)) * coverage(p.xy), 0.0, 1.0);
}

/**
 * Полная плотность.
 * out wf — поле вордмарка в этой точке: R близость, G верхняя кромка,
 * B разрежение за буквой.
 */
float dens(vec3 p, out vec3 wf) {
  vec2 suv = toScreen(p.xy);
  vec3 fl = texture(uFlow, clamp(suv, 0.0, 1.0)).rgb;

  vec3 q = warp(p);
  // Курсор именно расталкивает среду, а не прочищает её.
  q.xy += fl.rg * 0.085;

  float cov = coverage(p.xy);
  float d = shape(q, texture(uNoise, q)) * cov;
  d -= fl.b * 0.22;

  // ── Буквы как препятствие ────────────────────────────────────────
  // Вклад препятствия тоже идёт через покрытие: иначе объём у краёв и
  // в хвосте не истончается, а обрывается ровной чертой.
  wf = texture(uWordField, suv).rgb;
  float near = smoothstep(Z_FAR, Z_WORD - 0.5, p.z) * smoothstep(Z_NEAR, Z_WORD + 0.5, p.z)
             * cov;

  // У кромки литеры пар прижимается к контуру.
  d += wf.r * 0.62 * near;
  // По верхней кромке оседает конденсат — тонкая плотная полоса.
  d += wf.g * 1.05 * near;
  // За буквой остаётся разрежённая тень.
  d -= wf.b * 0.62 * near;
  // Вверх от букв отрываются редкие волокна.
  d += wf.g * smoothstep(0.34, 0.72, texture(uNoise, q * 2.6).b) * 0.55 * near;

  return clamp(d, 0.0, 1.0);
}

float shadow(vec3 p) {
  float s = 0.0;
  float t = 0.085;
  for (int i = 0; i < 3; i++) {
    s += densBase(p + LIGHT * t) * t;
    t *= 2.1;
  }
  return exp(-s * 2.6);
}

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

  const vec3 COLD = vec3(0.55, 0.62, 0.69);
  const vec3 WARM = vec3(1.06, 1.00, 0.92);

  for (int i = 0; i < 48; i++) {
    if (i >= steps || T < 0.03) break;

    if (!wordDone && t >= tWord) {
      vec3 wp = ro + rd * tWord;
      vec4 w = texture(uWord, toScreen(wp.xy));
      col += T * w.rgb * w.a;
      T *= (1.0 - w.a);
      wordDone = true;
    }

    vec3 pos = ro + rd * t;
    vec3 wf;
    float d = dens(pos, wf);

    if (d > 0.004) {
      float sh = shadow(pos);
      vec3 lit = mix(COLD, WARM, sh);
      float hg = 0.60 + 0.40 * pow(max(dot(rd, -LIGHT), 0.0), 3.0);
      float a = 1.0 - exp(-d * dt * 3.4);
      col += T * lit * a * (0.34 + 0.78 * sh) * hg;
      T *= 1.0 - a;
    }
    t += dt;
  }

  if (!wordDone) {
    vec3 wp = ro + rd * tWord;
    vec4 w = texture(uWord, toScreen(wp.xy));
    col += T * w.rgb * w.a;
    T *= (1.0 - w.a);
  }

  // Потолок непрозрачности пара. Буквы под него не попадают —
  // иначе вордмарк стал бы полупрозрачным.
  float steamA = 1.0 - T;
  vec4 wHere = texture(uWord, vUv);
  float capped = min(steamA, MAX_ALPHA + wHere.a * (1.0 - MAX_ALPHA));
  if (steamA > 0.0001) col *= capped / steamA;

  // Хвост в следующий блок: у нижней кромки объём не обрывается,
  // а вытягивается за экран и растворяется.
  //
  // Считается по vUv, а не по coverage(): toScreen() точна только на
  // плоскости z = 0, и выборки с других глубин мимо экранного затухания
  // проходят. Из-за этого объём кончался ровной чертой по краю холста.
  float hyF = (vUv.y - uTailFrac) / max(uHeroFrac, 1e-4);
  float hyEnd = -uTailFrac / max(uHeroFrac, 1e-4);
  float fade = smoothstep(hyEnd, hyEnd * 0.10, hyF);
  fragColor = vec4(col * fade, capped * fade);
}
`

/** Композит: половинное разрешение и смешение с прошлым кадром. */
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
