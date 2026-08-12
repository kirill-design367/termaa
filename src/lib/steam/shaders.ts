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
 * Поверх этого поле несёт постоянный восходящий снос: среда сама по себе
 * поднимается, и возмущение уезжает вверх вместе с ней, а не висит на
 * месте. Вихрей по бокам нет намеренно: именно они читались как дворник.
 *
 * rg — скорость, b — лёгкое разрежение.
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

  // Полулагранжева адвекция плюс собственный подъём среды: тексель берёт
  // значение оттуда, откуда его снесло, с поправкой на восходящий поток.
  vec2 back = uv - (here.rg + vec2(0.0, 0.34)) * uDt * 0.30;
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

  // Буквы — препятствие: поток не втекает в литеру, а обходит её по
  // контуру. В R лежит гало снаружи буквы, его градиент и отклоняет поток.
  float halo = texture(uWordField, uv).r;
  vec2 push = vec2(dFdx(halo), dFdy(halo));
  vel += vec2(push.x, -push.y) * 7.0 * uDt * 60.0;

  fragColor = vec4(clamp(vel, -2.0, 2.0), clamp(rare, 0.0, 1.0), 1.0);
}
`

/**
 * Марш по объёму: постоянный восходящий поток.
 *
 * Пар рождается из узкой полосы под нижней кромкой кадра — из-под слова —
 * и поднимается через весь кадр. Плотность максимальна у источника и
 * падает по мере подъёма, до полной прозрачности к верхней трети.
 *
 * Поток идёт не стеной, а отдельными клубами: шум режется высоким порогом,
 * между клубами кадр чистый. У каждого клуба своя глубина, и от неё
 * зависит всё остальное — ближние крупнее, быстрее и плотнее, дальние
 * мельче и медленнее. Именно разброс по глубине и даёт объём.
 *
 * Плоскость вордмарка стоит близко к камере, поэтому основная масса пара
 * идёт ЗА словом и слово читается целиком. Перед словом остаётся тонкий
 * ближний слой — редкие прозрачные клубы.
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
/** Прогресс сцены героя 0..1: поток усиливается и поднимается выше. */
uniform float uProgress;
/** Подъём и растворение слова по тому же прогрессу. */
uniform float uWordRise;
uniform float uWordA;

const float CAM_Z = 2.6;
const float FOCAL = 1.9;
const float Z_NEAR = 1.05;
const float Z_FAR  = -1.55;
/** Слово стоит близко к камере — почти весь объём идёт за ним. */
const float Z_WORD = 0.74;

/** Источник: узкая полоса ПОД нижней кромкой экрана. */
const float Y_SRC = -0.07;

/** Потолок непрозрачности: сквозь пар обязана читаться фотография. */
const float MAX_ALPHA = 0.42;

const vec3 LIGHT = vec3(-0.862, 0.318, 0.395);

/**
 * Проекция точки объёма на экран с учётом её глубины.
 *
 * Прежняя версия делила на постоянный масштаб и была точна только на
 * плоскости z = 0. Пока слово стояло там же, это сходило с рук; стоило
 * подвинуть его к камере — и вордмарк поехал увеличенным.
 */
vec2 toScreenAt(vec2 xy, float z) {
  float k = (CAM_Z - z) / FOCAL;
  return (xy / (vec2(uAspect, 1.0) * k)) * 0.5 + 0.5;
}

/** Глубина 0..1: 0 — дальний план, 1 — ближний. */
float depth01(float z) { return smoothstep(Z_FAR, Z_NEAR, z); }

/** Высота над источником: 0 у полосы рождения, 1 у верхней кромки. */
float height(float sy) {
  return (sy - Y_SRC) / (1.0 - Y_SRC);
}

/**
 * Координата выборки. Здесь и живёт весь характер потока: клубы поднимаются,
 * расходятся в стороны и на разной глубине идут с разной скоростью.
 */
vec3 warp(vec3 p, float dep, float h) {
  // Дальние клубы мельче, ближние крупнее.
  float sc = mix(1.62, 0.70, dep);
  // Ближние быстрее. Движение медленное и вязкое.
  float rate = mix(0.024, 0.072, dep);

  vec3 q = p * sc;
  // Клуб вытянут по вертикали: у восходящего пара языки выше, чем шире.
  q.y *= 0.54;
  // По мере подъёма фигуры расходятся в стороны и растягиваются.
  q.x /= (1.0 + 0.80 * h);
  q.y /= (1.0 + 0.30 * h);
  // Боковой снос, растущий с высотой: поток не идёт строго вертикально.
  q.x += sin(p.y * 1.28 + dep * 5.1) * 0.22 * h;
  // Рождение непрерывное: координата едет вниз, поэтому клубы идут вверх.
  q.y -= uTime * rate;
  // Разные глубины смотрят в разные слои куба, иначе планы повторяются.
  q.z = p.z * 0.55 + dep * 3.9;
  return q;
}

/**
 * Клубы. Порог высокий — между клубами кадр остаётся чистым, сплошной
 * стены нет ни в одной точке.
 */
float puffs(vec3 q, float h) {
  vec4 n = texture(uNoise, q);
  float v = n.r * 0.56 + n.g * 0.28 + n.b * 0.16;
  // Рваный край: червячный канал вычитает из клуба волокна.
  v -= n.a * 0.13;
  // Порог снят с реального распределения поля, а не назначен на глаз:
  // медиана смеси 0.445, 95-й перцентиль 0.608. Отсечка чуть выше
  // медианы оставляет между клубами чистый кадр, верхняя граница ниже
  // 95-го — иначе клуб никогда не набирает полную плотность.
  //
  // С высотой порог растёт: у источника клубы стоят плотно, выше
  // выживают только их плотные ядра — поток расходится на отдельные
  // языки, между которыми кадр чистый.
  float t0 = 0.448 + 0.085 * h;
  return smoothstep(t0, t0 + 0.135, v);
}

/**
 * Вертикальный профиль потока. Максимум у источника, ноль к верхней трети.
 * С прогрессом сцены поток поднимается выше и заполняет кадр.
 */
float riseProfile(float h) {
  float top = mix(0.60, 1.30, uProgress);
  return smoothstep(top, top * 0.02, h) * smoothstep(-0.10, 0.04, h);
}

/**
 * Плотность без учёта букв — для теневого марша.
 * Здесь точка лежит в стороне от луча, поэтому её экранную высоту
 * приходится считать проекцией, а не брать из vUv.
 */
float densBase(vec3 p) {
  float dep = depth01(p.z);
  float h = height(toScreenAt(p.xy, p.z).y);
  float d = puffs(warp(p, dep, h), h) * riseProfile(h);
  d *= mix(0.58, 1.0, dep) * mix(1.0, 1.75, uProgress);
  // Ближний слой перед словом — редкий и прозрачный.
  d *= p.z > Z_WORD ? 0.22 : 1.0;
  return clamp(d, 0.0, 1.0);
}

/**
 * Полная плотность: поток плюс реакция на курсор и обтекание букв.
 *
 * Точка лежит на луче этого пикселя, поэтому её экранная координата —
 * это ровно vUv, считать проекцию не нужно и незачем: заодно уходит
 * целый класс ошибок и по выборке на шаг.
 */
float dens(vec3 p, float prof, vec3 fl, float halo) {
  float dep = depth01(p.z);
  float h = height(vUv.y);

  vec3 q = warp(p, dep, h);
  // Курсор расталкивает среду, а не прочищает её.
  q.xy += fl.rg * 0.085;

  float d = puffs(q, h) * prof;
  d *= mix(0.58, 1.0, dep) * mix(1.0, 1.75, uProgress);
  d -= fl.b * 0.20;

  // Буквы как препятствие: у кромки поток прижимается к контуру.
  // Гало испечено снаружи литеры, поэтому между буквами проход свободный.
  float nearWord = smoothstep(Z_FAR, Z_WORD - 0.9, p.z);
  d += halo * 0.50 * nearWord;

  d *= p.z > Z_WORD ? 0.22 : 1.0;
  return clamp(d, 0.0, 1.0);
}

float shadow(vec3 p) {
  float s = 0.0;
  float t = 0.10;
  for (int i = 0; i < 3; i++) {
    s += densBase(p + LIGHT * t) * t;
    t *= 2.1;
  }
  return exp(-s * 2.4);
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

  // Всё, что постоянно вдоль луча, считается один раз, а не на каждом шаге.
  vec2 wuv = vUv - vec2(0.0, uWordRise);
  vec4 wordTex = texture(uWord, wuv);
  float prof = riseProfile(height(vUv.y));
  vec3 fl = texture(uFlow, vUv).rgb;
  float halo = texture(uWordField, wuv).r;

  vec3 col = vec3(0.0);
  float T = 1.0;
  bool wordDone = false;
  float wordAlpha = 0.0;

  const vec3 COLD = vec3(0.60, 0.66, 0.72);
  const vec3 WARM = vec3(1.08, 1.02, 0.94);

  for (int i = 0; i < 48; i++) {
    if (i >= steps || T < 0.03) break;

    // Слово встречается рано: перед ним успевает лечь только ближний слой.
    if (!wordDone && t >= tWord) {
      float a = wordTex.a * uWordA;
      col += T * wordTex.rgb * a;
      T *= (1.0 - a);
      wordAlpha += a;
      wordDone = true;
    }

    vec3 pos = ro + rd * t;
    float d = dens(pos, prof, fl, halo);

    if (d > 0.004) {
      float sh = shadow(pos);
      vec3 lit = mix(COLD, WARM, sh);
      float hg = 0.62 + 0.38 * pow(max(dot(rd, -LIGHT), 0.0), 3.0);
      float a = 1.0 - exp(-d * dt * 3.1);
      col += T * lit * a * (0.36 + 0.76 * sh) * hg;
      T *= 1.0 - a;
    }
    t += dt;
  }

  if (!wordDone) {
    float a = wordTex.a * uWordA;
    col += T * wordTex.rgb * a;
    T *= (1.0 - a);
    wordAlpha += a;
  }

  // Потолок непрозрачности пара. Буквы под него не попадают — иначе
  // вордмарк стал бы полупрозрачным, а он обязан читаться целиком.
  float total = 1.0 - T;
  float capped = min(total, MAX_ALPHA + clamp(wordAlpha, 0.0, 1.0) * (1.0 - MAX_ALPHA));
  if (total > 0.0001) col *= capped / total;

  fragColor = vec4(col, capped);
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
