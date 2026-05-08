import { ImageResponse } from '@vercel/og';
import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS = path.join(__dirname, 'fonts');

// Module-level font cache (shared across warm Lambda invocations)
let fontPretendard: Buffer | null = null;
let fontArchivo: Buffer | null = null;
let fontNanumLatin: Buffer | null = null;
let fontNanumKorean: Buffer | null = null;

function loadFonts() {
  if (!fontPretendard)
    fontPretendard = fs.readFileSync(path.join(FONTS, 'Pretendard-Bold.woff'));
  if (!fontArchivo)
    fontArchivo = fs.readFileSync(path.join(FONTS, 'ArchivoBlack.woff'));
  if (!fontNanumLatin)
    fontNanumLatin = fs.readFileSync(path.join(FONTS, 'NanumPenLatin.woff'));
  if (!fontNanumKorean)
    fontNanumKorean = fs.readFileSync(path.join(FONTS, 'NanumPenKorean.woff'));
  return {
    pretendard: fontPretendard!,
    archivo: fontArchivo!,
    nanumLatin: fontNanumLatin!,
    nanumKorean: fontNanumKorean!,
  };
}

function clamp(val: string | null): number {
  const n = parseInt(val ?? '0');
  return Math.min(100, Math.max(0, isNaN(n) ? 0 : n));
}

// ── Design Tokens (StyleTokensCard.jsx 기준) ─────────────────────────
const TOKENS = {
  paper: '#F5EFE0', paperDeep: '#EDE3CB', paperShade: '#E2D6B8',
  red: '#C0392B', redDeep: '#8E2A1F', ink: '#1A1A1A', inkSoft: '#2A2522',
  noteBrown: '#5C4A3A', highlighter: 'rgba(255,225,90,0.55)',
  study: '#D9534F', power: '#E67E22', art: '#8E44AD', social: '#27AE60', craft: '#2980B9',
  heart: '#E63946', fire: '#F37121',
  // Archivo Black italic → English/numbers display font
  display: '"ArchivoBlack","Pretendard",sans-serif',
  // Pretendard 900 → Korean labels
  sansKR: '"Pretendard","Noto Sans KR",sans-serif',
  // NanumPenScript → 속마음 handwriting
  hand: '"NanumPenScript","Pretendard",cursive',
};

const EMOTIONS: Record<string, { label: string; kr: string; color: string }> = {
  depressed: { label: 'DEPRESSED', kr: '우울', color: '#5D6D7E' },
  anxious:   { label: 'ANXIOUS',   kr: '불안', color: '#7D6B8A' },
  shocked:   { label: 'SHOCKED',   kr: '충격', color: '#F1C40F' },
  happy:     { label: 'HAPPY',     kr: '행복', color: '#F39C12' },
  joy:       { label: 'JOY',       kr: '환희', color: '#E74C3C' },
  expect:    { label: 'EXPECT',    kr: '기대', color: '#E67E22' },
  moved:     { label: 'MOVED',     kr: '감동', color: '#3498DB' },
  flutter:   { label: 'SETTLE',    kr: '설렘', color: '#EC7AA0' },
  love:      { label: 'LOVE',      kr: '사랑', color: '#E63946' },
};

const STAT_META = [
  { key: 'study',  emoji: '📚', kr: '학업', color: TOKENS.study  },
  { key: 'power',  emoji: '💪', kr: '체력', color: TOKENS.power  },
  { key: 'art',    emoji: '🎨', kr: '예술', color: TOKENS.art    },
  { key: 'social', emoji: '💬', kr: '사교', color: TOKENS.social },
  { key: 'craft',  emoji: '🛠', kr: '재주', color: TOKENS.craft  },
];

const RANK_NAMES: Record<string, string[]> = {
  study:  ['바부', '평균이하', '평균이상', '박학다식', '지식의 요람', '만물박사'],
  power:  ['저질', '달팽이', '토끼', '라이징스타', '마라토너', '올림푸스'],
  art:    ['무미건조', '정취', '운치', '풍류', '거장', '신필'],
  social: ['외톨이', '듣기만점', '스피처', '두터운교우관계', '인싸', '카리스마'],
  craft:  ['마이너스의손', '잔고장전문가', '야무짐', '독보적', '미다스의 손', '헤파이스토스'],
};

function rankOf(pt: number) {
  if (pt >= 100) return { n: 6, max: true };
  if (pt >= 80)  return { n: 5, max: false };
  if (pt >= 60)  return { n: 4, max: false };
  if (pt >= 40)  return { n: 3, max: false };
  if (pt >= 20)  return { n: 2, max: false };
  return { n: 1, max: false };
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try { return await _handler(req, res); }
  catch (e: any) { res.statusCode = 500; res.end('ERROR: ' + String(e?.message || e)); }
}

async function _handler(req: IncomingMessage, res: ServerResponse) {
  const { searchParams } = new URL(req.url!, 'http://localhost');

  const char      = searchParams.get('char')    || '캐릭터';
  const study     = clamp(searchParams.get('study'));
  const power     = clamp(searchParams.get('power'));
  const art       = clamp(searchParams.get('art'));
  const social    = clamp(searchParams.get('social'));
  const craft     = clamp(searchParams.get('craft'));
  const affection = clamp(searchParams.get('affection'));
  const stress    = clamp(searchParams.get('stress'));
  const emotion   = searchParams.get('emotion')  || 'flutter';
  const event     = searchParams.get('event')    || '미정';
  const dday      = searchParams.get('dday')     || '?';
  const thought   = searchParams.get('thought')  || '...';

  const emo = EMOTIONS[emotion] || EMOTIONS.flutter;
  const fonts = loadFonts();

  // ── Pentagon radar geometry ────────────────────────────────────────
  const cx = 235, cy = 240, R = 175, N = 5;
  const statVals = [study, power, art, social, craft];
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI / N);
  const points = STAT_META.map((s, i) => {
    const v = Math.min(100, statVals[i] ?? 0);
    const r = (v / 100) * R;
    return {
      x: cx + r * Math.cos(angle(i)), y: cy + r * Math.sin(angle(i)),
      ax: cx + R * Math.cos(angle(i)), ay: cy + R * Math.sin(angle(i)),
      lx: cx + (R + 38) * Math.cos(angle(i)), ly: cy + (R + 38) * Math.sin(angle(i)),
      v, color: s.color, key: s.key, kr: s.kr, emoji: s.emoji,
      isMax: v >= 100,
    };
  });
  const polyData = points.map(p => `${p.x},${p.y}`).join(' ');

  const imageResponse = new ImageResponse(
    (
      <div style={{
        position: 'relative', width: 1200, height: 600, overflow: 'hidden',
        background: TOKENS.paper, color: TOKENS.ink,
        display: 'flex', flexDirection: 'column', fontFamily: TOKENS.sansKR,
      }}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div style={{
          height: 70, background: TOKENS.ink, color: '#fff', display: 'flex',
          alignItems: 'center', padding: '0 26px', position: 'relative', overflow: 'hidden',
        }}>
          {/* STATUS label */}
          <div style={{
            fontFamily: TOKENS.display, fontStyle: 'italic', fontSize: 13,
            letterSpacing: 4, color: TOKENS.red, marginRight: 14, display: 'flex',
          }}>STATUS</div>

          {/* Character name */}
          <div style={{
            fontFamily: TOKENS.sansKR, fontWeight: 900, fontSize: 42,
            color: '#fff', letterSpacing: -1.5, lineHeight: 1, display: 'flex',
            textShadow: `4px 4px 0 ${TOKENS.red}`,
          }}>{char}</div>

          <div style={{ flex: 1 }} />

          {/* NEXT EVENT badge — skewX replaces clipPath(calc) for Satori compat */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: TOKENS.red, color: '#fff',
            paddingLeft: 16, paddingRight: 26, paddingTop: 8, paddingBottom: 8,
            boxShadow: `3px 3px 0 ${TOKENS.paper}`,
            transform: 'skewX(-10deg)',
          }}>
            <span style={{
              fontFamily: TOKENS.display, fontStyle: 'italic', fontSize: 11,
              letterSpacing: 2, opacity: 0.85, display: 'flex', transform: 'skewX(10deg)',
            }}>NEXT EVENT</span>
            <span style={{
              fontFamily: TOKENS.display, fontStyle: 'italic', fontSize: 16,
              fontWeight: 900, display: 'flex', transform: 'skewX(10deg)',
            }}>{event}</span>
            <span style={{ opacity: 0.5, display: 'flex', transform: 'skewX(10deg)' }}>·</span>
            <span style={{
              fontFamily: TOKENS.display, fontStyle: 'italic', fontSize: 18,
              fontWeight: 900, display: 'flex', transform: 'skewX(10deg)',
            }}>{dday}일 남음</span>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', position: 'relative' }}>

          {/* Left: Pentagon radar chart */}
          <div style={{
            width: 540, position: 'relative', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            borderRight: `3px solid ${TOKENS.ink}`,
          }}>
            <svg width={500} height={500} viewBox="0 0 500 500"
                 style={{ position: 'absolute', top: 10, left: 20 }}>
              {/* Grid polygons — 5 levels, outermost solid, inner dashed */}
              {[0.2, 0.4, 0.6, 0.8, 1].map((s, idx) => {
                const pts = Array.from({ length: N }).map((_, i) => {
                  const gr = R * s;
                  return `${cx + gr * Math.cos(angle(i))},${cy + gr * Math.sin(angle(i))}`;
                }).join(' ');
                return (
                  <polygon key={idx} points={pts} fill="none"
                    stroke={TOKENS.paperShade}
                    strokeWidth={s === 1 ? 2 : 1.2}
                    strokeDasharray={idx < 4 ? '3 4' : 'none'} />
                );
              })}
              {/* Axis lines */}
              {points.map((p, i) => (
                <line key={i} x1={cx} y1={cy} x2={p.ax} y2={p.ay}
                  stroke={TOKENS.paperShade} strokeWidth={1.2} />
              ))}
              {/* Data fill */}
              <polygon points={polyData}
                fill={TOKENS.red} fillOpacity={0.18}
                stroke={TOKENS.red} strokeWidth={2.5} />
              {/* Data points — MAX gets gold ring */}
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={p.isMax ? 9 : 6}
                  fill={p.color}
                  stroke={p.isMax ? '#FFD700' : TOKENS.ink}
                  strokeWidth={p.isMax ? 4 : 2} />
              ))}
            </svg>

            {/* Stat labels — HTML divs (SVG <text> unsupported in Satori) */}
            {points.map((p, i) => {
              const rk = rankOf(p.v);
              const rName = p.isMax ? RANK_NAMES[p.key][5] : RANK_NAMES[p.key][rk.n - 1];
              return (
                <div key={i} style={{
                  position: 'absolute',
                  left: 20 + p.lx, top: 10 + p.ly,
                  transform: 'translate(-50%, -50%)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                }}>
                  <div style={{
                    fontFamily: TOKENS.display, fontStyle: 'italic', fontWeight: 800,
                    fontSize: 13, letterSpacing: 2, color: p.color, display: 'flex',
                  }}>{p.emoji} {p.kr}</div>
                  <div style={{
                    fontFamily: TOKENS.display, fontStyle: 'italic', fontWeight: 800,
                    fontSize: p.isMax ? 16 : 14,
                    color: p.isMax ? '#C8A434' : TOKENS.ink, display: 'flex',
                    letterSpacing: 0.5,
                  }}>
                    {p.isMax ? 'MAX' : `${p.v}pt · R${rk.n}`}
                  </div>
                  {!p.isMax && (
                    <div style={{
                      fontFamily: TOKENS.sansKR, fontSize: 10,
                      color: TOKENS.noteBrown, display: 'flex', opacity: 0.8,
                    }}>{rName}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right: meters + thought + emotion */}
          <div style={{
            flex: 1, padding: '16px 22px', display: 'flex', flexDirection: 'column',
            gap: 12, fontFamily: TOKENS.sansKR, position: 'relative',
          }}>

            {/* Affection & Stress meters */}
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 10,
              background: '#FAF4E2', padding: '14px 16px',
              border: `2px solid ${TOKENS.ink}`,
              boxShadow: `5px 5px 0 ${TOKENS.ink}`,
            }}>
              {/* Affection row */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18, lineHeight: 1, display: 'flex' }}>❤</span>
                  <span style={{
                    fontFamily: TOKENS.display, fontStyle: 'italic', fontSize: 11,
                    letterSpacing: 3, color: TOKENS.heart, display: 'flex',
                  }}>AFFECTION</span>
                  <span style={{ fontFamily: TOKENS.sansKR, fontSize: 13, fontWeight: 900, color: TOKENS.ink, display: 'flex' }}>호감도</span>
                  <span style={{ flex: 1 }} />
                  <span style={{
                    fontFamily: TOKENS.display, fontStyle: 'italic', fontSize: 22,
                    color: TOKENS.ink, letterSpacing: 0.5, display: 'flex',
                  }}>{affection}<span style={{ fontSize: 11, opacity: 0.6 }}>%</span></span>
                </div>
                <div style={{
                  height: 14, background: '#E2D6B8', display: 'flex',
                  border: `2px solid ${TOKENS.ink}`, overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${Math.min(100, affection)}%`, height: '100%',
                    background: TOKENS.heart,
                    boxShadow: 'inset -2px -2px 0 rgba(0,0,0,0.18)', display: 'flex',
                  }} />
                </div>
              </div>
              {/* Stress row */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18, lineHeight: 1, display: 'flex' }}>🔥</span>
                  <span style={{
                    fontFamily: TOKENS.display, fontStyle: 'italic', fontSize: 11,
                    letterSpacing: 3, color: TOKENS.fire, display: 'flex',
                  }}>STRESS</span>
                  <span style={{ fontFamily: TOKENS.sansKR, fontSize: 13, fontWeight: 900, color: TOKENS.ink, display: 'flex' }}>스트레스</span>
                  <span style={{ flex: 1 }} />
                  <span style={{
                    fontFamily: TOKENS.display, fontStyle: 'italic', fontSize: 22,
                    color: TOKENS.ink, letterSpacing: 0.5, display: 'flex',
                  }}>{stress}<span style={{ fontSize: 11, opacity: 0.6 }}>%</span></span>
                </div>
                <div style={{
                  height: 14, background: '#E2D6B8', display: 'flex',
                  border: `2px solid ${TOKENS.ink}`, overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${Math.min(100, stress)}%`, height: '100%',
                    background: TOKENS.fire,
                    boxShadow: 'inset -2px -2px 0 rgba(0,0,0,0.18)', display: 'flex',
                  }} />
                </div>
              </div>
            </div>

            {/* 속마음 — notebook lines + highlighter + Nanum Pen Script */}
            <div style={{
              position: 'relative', display: 'flex', flexDirection: 'column',
              background: '#FFF9E0',
              backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 27px, #D9C9A6 27px, #D9C9A6 28px)',
              border: `2px solid ${TOKENS.ink}`,
              padding: '14px 18px 16px',
              boxShadow: `5px 5px 0 ${TOKENS.ink}`,
              flex: 1,
            }}>
              <div style={{
                fontFamily: TOKENS.display, fontStyle: 'italic', fontSize: 11,
                letterSpacing: 3, color: TOKENS.noteBrown, display: 'flex',
              }}>속마음 · INNER</div>
              {/* Highlighter bar */}
              <div style={{
                position: 'absolute', left: 14, right: 14, top: 42, height: 34,
                background: TOKENS.highlighter, transform: 'rotate(-0.6deg)', display: 'flex',
              }} />
              {/* Handwriting text */}
              <div style={{
                position: 'relative', marginTop: 6, display: 'flex',
                fontFamily: TOKENS.hand, fontSize: 28, color: TOKENS.noteBrown, lineHeight: 1.3,
              }}>
                <span style={{ fontFamily: TOKENS.display, fontStyle: 'italic', color: TOKENS.red, fontSize: 34, display: 'flex', lineHeight: 1 }}>"</span>
                {thought}
                <span style={{ fontFamily: TOKENS.display, fontStyle: 'italic', color: TOKENS.red, fontSize: 34, display: 'flex', lineHeight: 1 }}>"</span>
              </div>
            </div>

            {/* Emotion badge — ink background + colored hard shadow + skewX */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: TOKENS.ink, color: '#fff',
              paddingLeft: 16, paddingRight: 28, paddingTop: 12, paddingBottom: 12,
              boxShadow: `6px 6px 0 ${emo.color}`,
              transform: 'skewX(-10deg)',
            }}>
              {/* Emotion circle */}
              <div style={{
                width: 42, height: 42, borderRadius: '50%', background: emo.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: TOKENS.display, fontStyle: 'italic', fontSize: 20,
                transform: 'skewX(10deg)',
              }}>♥</div>
              {/* Emotion label */}
              <div style={{ display: 'flex', flexDirection: 'column', transform: 'skewX(10deg)' }}>
                <div style={{
                  fontFamily: TOKENS.display, fontStyle: 'italic', fontSize: 11,
                  letterSpacing: 3, color: emo.color, display: 'flex',
                }}>EMOTION · 감정</div>
                <div style={{
                  fontFamily: TOKENS.display, fontStyle: 'italic', fontSize: 24,
                  lineHeight: 1, marginTop: 2, display: 'flex',
                }}>
                  {emo.label}
                  <span style={{ fontFamily: TOKENS.sansKR, fontSize: 14, color: '#E2D6B8', marginLeft: 6, display: 'flex', alignItems: 'center' }}>· {emo.kr}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 600,
      fonts: [
        { name: 'Pretendard',    data: fonts.pretendard, weight: 700, style: 'normal' },
        { name: 'ArchivoBlack',  data: fonts.archivo,    weight: 400, style: 'normal' },
        { name: 'NanumPenScript', data: fonts.nanumLatin, weight: 400, style: 'normal' },
        { name: 'NanumPenScript', data: fonts.nanumKorean, weight: 400, style: 'normal' },
      ],
    }
  );

  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=600');
  res.end(buffer);
}
