import { ImageResponse } from '@vercel/og';
import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS   = path.join(__dirname, 'fonts');
const ASSETS  = path.join(__dirname, 'assets');

type FontCache = { pretendard: ArrayBuffer; bowlby: ArrayBuffer; paperozi: ArrayBuffer; paperozi7: ArrayBuffer; nanumLatin: ArrayBuffer; nanumKorean: ArrayBuffer; gasoekOne: ArrayBuffer };
let fontCache: FontCache | null = null;
let statBgCache: string | null = null;
function toAB(b: Buffer): ArrayBuffer { return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; }

function loadStatBg(): string {
  if (statBgCache) return statBgCache;
  statBgCache = `data:image/jpeg;base64,${fs.readFileSync(path.join(ASSETS, 'stat_bg.jpg')).toString('base64')}`;
  return statBgCache;
}

function loadFonts(): FontCache {
  if (fontCache) return fontCache;
  fontCache = {
    pretendard:  toAB(fs.readFileSync(path.join(FONTS, 'Pretendard-Bold.woff'))),
    bowlby:      toAB(fs.readFileSync(path.join(FONTS, 'BowlbyOneSC.ttf'))),
    paperozi:    toAB(fs.readFileSync(path.join(FONTS, 'Paperozi.ttf'))),
    paperozi7:   toAB(fs.readFileSync(path.join(FONTS, 'Paperozi7.ttf'))),
    nanumLatin:  toAB(fs.readFileSync(path.join(FONTS, 'NanumPenLatin.woff'))),
    nanumKorean: toAB(fs.readFileSync(path.join(FONTS, 'NanumPenKorean.woff'))),
    gasoekOne:   toAB(fs.readFileSync(path.join(FONTS, 'GasoekOne.ttf'))),
  };
  return fontCache;
}

function renderThought(text: string) {
  return text.replace(/…/g, '...');
}

function clamp(val: string | null): number {
  const n = parseFloat(val ?? '0');
  return Math.min(100, Math.max(0, isNaN(n) ? 0 : n));
}

const TOKENS = {
  paper: '#F5EFE0', paperDeep: '#EDE3CB', paperShade: '#E2D6B8',
  red: '#C0392B', redDeep: '#8E2A1F', ink: '#1A1A1A', inkSoft: '#2A2522',
  noteBrown: '#5C4A3A', highlighter: 'rgba(255,225,90,0.55)',
  study: '#D45858', power: '#E07835', art: '#9050BB', social: '#2EAD68', craft: '#3A8EC8',
  heart: '#E63946', fire: '#F37121',
  display: 'BowlbyOneSC, Paperozi, sans-serif',
  sansKR: 'Paperozi, sans-serif',
  hand: 'NanumPenLatin, NanumPenKorean, Pretendard, cursive',
  charName: 'GasoekOne, Pretendard, sans-serif',
};

const EMOTIONS: Record<string, { label: string; kr: string; color: string }> = {
  depressed:   { label: 'DEPRESSED',  kr: '우울',    color: '#5D6D7E' },
  anxious:     { label: 'ANXIOUS',    kr: '불안',    color: '#7D6B8A' },
  shocked:     { label: 'SHOCKED',    kr: '충격',    color: '#F1C40F' },
  happy:       { label: 'HAPPY',      kr: '행복',    color: '#F39C12' },
  joy:         { label: 'JOY',        kr: '기쁨',    color: '#FFB800' },
  expect:      { label: 'EXPECT',     kr: '기대',    color: '#E67E22' },
  moved:       { label: 'MOVED',      kr: '감동',    color: '#3498DB' },
  flutter:     { label: 'FLUTTER',    kr: '설렘',    color: '#EC7AA0' },
  love:        { label: 'LOVE',       kr: '사랑',    color: '#E91E63' },
  angry:       { label: 'ANGRY',      kr: '분노',    color: '#922B21' },
  lonely:      { label: 'LONELY',     kr: '외로움',  color: '#607D8B' },
  embarrassed: { label: 'BLUSH',      kr: '부끄러움', color: '#E91E8C' },
  conflicted:  { label: 'CONFLICTED', kr: '갈등',    color: '#9B59B6' },
  nostalgic:   { label: 'NOSTALGIC',  kr: '그리움',  color: '#C8960C' },
  numb:        { label: 'NUMB',       kr: '무감각',  color: '#90A4AE' },
  proud:       { label: 'PROUD',      kr: '자부심',  color: '#C8A434' },
  relieved:    { label: 'RELIEVED',   kr: '안도',    color: '#26A69A' },
  nervous:     { label: 'NERVOUS',    kr: '긴장',    color: '#FF9800' },
  frustrated:  { label: 'FRUSTRATED', kr: '답답함',  color: '#E64A19' },
  guilty:      { label: 'GUILTY',     kr: '죄책감',  color: '#795548' },
  calm:        { label: 'CALM',       kr: '평온',    color: '#5BA3C9' },
  determined:  { label: 'DETERMINED', kr: '결의',    color: '#1565C0' },
  jealous:     { label: 'JEALOUS',    kr: '질투',    color: '#388E3C' },
  annoyed:     { label: 'ANNOYED',    kr: '짜증',    color: '#D84315' },
  furious:     { label: 'FURIOUS',    kr: '격노',    color: '#7B0000' },
};

const STAT_META = [
  { key: 'study',  emoji: '📚', kr: '학업', color: TOKENS.study,  colorDark: '#952C2C', labelExtra: 38 },
  { key: 'power',  emoji: '💪', kr: '체력', color: TOKENS.power,  colorDark: '#9B4A18', labelExtra: 80 },
  { key: 'art',    emoji: '🎨', kr: '예술', color: TOKENS.art,    colorDark: '#5C2880', labelExtra: 42 },
  { key: 'social', emoji: '💬', kr: '사교', color: TOKENS.social, colorDark: '#1A7A40', labelExtra: 42 },
  { key: 'craft',  emoji: '🛠', kr: '재주', color: TOKENS.craft,  colorDark: '#1E5E90', labelExtra: 72 },
];

const RANK_NAMES: Record<string, string[]> = {
  study:  ['바부', '평균이하', '평균이상', '박학다식', '지식의 요람', '만물박사'],
  power:  ['저질', '달팽이', '토끼', '라이징스타', '마라토너', '올림푸스'],
  art:    ['무미건조', '정취', '운치', '풍류', '거장', '신필'],
  social: ['외톨이', '듣기만점', '스피처', '두터운교우관계', '인싸', '카리스마'],
  craft:  ['허접', '고장잦음', '취미생', '전문가', '장인', '명장'],
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
  const emotion   = searchParams.get('emotion')  || 'calm';
  const event     = searchParams.get('event')    || '미정';
  const dday      = searchParams.get('dday')     || '?';
  const thought   = searchParams.get('thought')  || '...';

  const emo = EMOTIONS[emotion] || EMOTIONS.flutter;
  const fonts = loadFonts();

  // ── Pentagon radar geometry ────────────────────────────────────────
  const cx = 250, cy = 271, R = 175, N = 5;
  const statVals = [study, power, art, social, craft];
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI / N);
  const points = STAT_META.map((s, i) => {
    const v = Math.min(100, statVals[i] ?? 0);
    const r = (v / 100) * R;
    return {
      x: cx + r * Math.cos(angle(i)), y: cy + r * Math.sin(angle(i)),
      ax: cx + R * Math.cos(angle(i)), ay: cy + R * Math.sin(angle(i)),
      lx: cx + (R + s.labelExtra) * Math.cos(angle(i)), ly: cy + (R + s.labelExtra) * Math.sin(angle(i)),
      v, color: s.color, colorDark: s.colorDark, key: s.key, kr: s.kr, emoji: s.emoji,
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
          height: 100, background: TOKENS.ink, color: '#fff', display: 'flex',
          alignItems: 'center', padding: '0 26px', position: 'relative', overflow: 'hidden',
        }}>
          {/* STATUS — 3-layer stamp (ArchivoBlack Italic) */}
          <div style={{ position: 'relative', display: 'flex', alignSelf: 'center', paddingRight: 10, marginTop: -12 }}>
            {/* Transparent spacer sets layout width */}
            <div style={{ fontFamily: TOKENS.display, fontStyle: 'italic', fontSize: 76, lineHeight: 1, color: 'transparent', display: 'flex' }}>STATUS</div>
            {/* Back shadow */}
            <div style={{ position: 'absolute', left: 7, top: 7, fontFamily: TOKENS.display, fontStyle: 'italic', fontSize: 76, color: TOKENS.redDeep, lineHeight: 1, display: 'flex' }}>STATUS</div>
            {/* Red mid */}
            <div style={{ position: 'absolute', left: 3, top: 3, fontFamily: TOKENS.display, fontStyle: 'italic', fontSize: 76, color: TOKENS.red, lineHeight: 1, display: 'flex' }}>STATUS</div>
            {/* White front — last in DOM = renders on top */}
            <div style={{ position: 'absolute', left: 0, top: 0, fontFamily: TOKENS.display, fontStyle: 'italic', fontSize: 76, color: '#fff', lineHeight: 1, display: 'flex' }}>STATUS</div>
          </div>

          <div style={{ flex: 1 }} />

          {/* NEXT EVENT badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: TOKENS.red, color: '#fff',
            paddingLeft: 16, paddingRight: 26, paddingTop: 4, paddingBottom: 4,
            boxShadow: `3px 3px 0 ${TOKENS.paper}`,
            transform: 'skewX(-10deg)',
          }}>
            <span style={{
              fontFamily: TOKENS.display, fontSize: 24, fontStyle: 'italic',
              letterSpacing: 2, opacity: 0.85, display: 'flex', transform: 'skewX(10deg)',
            }}>NEXT EVENT</span>
            <span style={{
              fontFamily: TOKENS.display, fontStyle: 'italic', fontSize: 38,
              fontWeight: 900, display: 'flex', transform: 'skewX(10deg)',
            }}>{event}</span>
            <span style={{ opacity: 0.5, display: 'flex', transform: 'skewX(10deg)' }}>·</span>
            <span style={{
              fontFamily: TOKENS.display, fontStyle: 'italic', fontSize: 24,
              fontWeight: 900, display: 'flex', transform: 'skewX(10deg)', alignItems: 'center', gap: 2,
            }}><span style={{ fontSize: 42 }}>{dday}</span>일 남음</span>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', position: 'relative' }}>

          {/* Left: Stat radar */}
          <div style={{
            width: 620, position: 'relative', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            borderRight: `3px solid ${TOKENS.ink}`,
            overflow: 'hidden',
          }}>
            {/* Filled polygon + grid + vertex dots */}
            <svg width={500} height={500} viewBox="0 0 500 500"
                 style={{ position: 'absolute', top: 0, left: 60 }}>
              {/* Grid: concentric pentagons */}
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
              {/* Spoke lines */}
              {points.map((p, i) => (
                <line key={i} x1={cx} y1={cy} x2={p.ax} y2={p.ay}
                  stroke={TOKENS.paperShade} strokeWidth={1.2} />
              ))}
              {/* Filled stat polygon */}
              <polygon points={polyData}
                fill={TOKENS.red} fillOpacity={0.22}
                stroke={TOKENS.red} strokeWidth={2.5} />
              {/* Vertex dots */}
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={p.isMax ? 7 : 4}
                  fill={p.color} stroke={TOKENS.ink} strokeWidth={1.5} />
              ))}
            </svg>

            {/* Stat labels */}
            {points.map((p, i) => {
              const rk = rankOf(p.v);
              const rName = RANK_NAMES[p.key][p.isMax ? 5 : rk.n - 1];
              return (
                <div key={i} style={{
                  position: 'absolute',
                  left: 60 + p.lx, top: p.ly + ([2, 3].includes(i) ? 8 : -18),
                  transform: 'translate(-50%, -50%)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9,
                }}>
                  <div style={{ position: 'relative', display: 'flex' }}>
                    {/* Spacer — sets layout size */}
                    <div style={{ transform: 'skewX(-8deg)', padding: '4px 12px', display: 'flex' }}>
                      <span style={{ fontFamily: 'Paperozi, sans-serif', fontSize: 32, lineHeight: 1, display: 'flex', color: 'transparent' }}>{p.kr}</span>
                    </div>
                    {/* Dark shadow layer */}
                    <div style={{ position: 'absolute', left: 4, top: 4, background: p.colorDark, transform: 'skewX(-8deg)', padding: '4px 12px', display: 'flex' }}>
                      <span style={{ fontFamily: 'Paperozi, sans-serif', fontWeight: 900, fontSize: 32, color: p.colorDark, lineHeight: 1, display: 'flex', transform: 'skewX(8deg)' }}>{p.kr}</span>
                    </div>
                    {/* Main color layer */}
                    <div style={{ position: 'absolute', left: 0, top: 0, background: p.color, transform: 'skewX(-8deg)', padding: '4px 12px', display: 'flex' }}>
                      <span style={{ fontFamily: 'Paperozi, sans-serif', fontWeight: 900, fontSize: 32, color: '#fff', lineHeight: 1, display: 'flex', transform: 'skewX(8deg)' }}>{p.kr}</span>
                    </div>
                  </div>
                  <div style={{
                    fontFamily: 'Paperozi, sans-serif', fontSize: 20,
                    fontWeight: 700,
                    color: p.isMax ? '#C8A434' : TOKENS.inkSoft,
                    lineHeight: 1, display: 'flex',
                  }}>
                    {p.isMax ? `MAX · ${rName}` : `${p.v}pt · ${rName}`}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: meters + thought + emotion */}
          <div style={{
            flex: 1, padding: '14px 22px', display: 'flex', flexDirection: 'column',
            gap: 10, fontFamily: TOKENS.sansKR, position: 'relative',
          }}>

            {/* Affection & Stress meters */}
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 2,
              background: '#FAF4E2', padding: '4px 14px',
              border: `2px solid ${TOKENS.ink}`,
              boxShadow: `5px 5px 0 ${TOKENS.ink}`,
            }}>
              {/* Affection row */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 29, lineHeight: 1, display: 'flex' }}>❤</span>
                  <span style={{
                    fontFamily: TOKENS.display, fontSize: 24, fontStyle: 'italic',
                    letterSpacing: 3, color: TOKENS.heart, display: 'flex',
                  }}>AFFECTION</span>
                  <span style={{ fontFamily: TOKENS.sansKR, fontSize: 25, fontWeight: 900, color: TOKENS.ink, display: 'flex' }}>호감도</span>
                  <span style={{ flex: 1 }} />
                  <span style={{
                    fontFamily: TOKENS.display, fontStyle: 'italic', fontSize: 28,
                    color: TOKENS.ink, lineHeight: 1, display: 'flex', alignItems: 'baseline',
                  }}>{parseFloat(affection.toFixed(1))}<span style={{ fontSize: 15, opacity: 0.6 }}>%</span></span>
                </div>
                <div style={{
                  height: 18, background: '#E2D6B8', display: 'flex',
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 29, lineHeight: 1, display: 'flex' }}>🔥</span>
                  <span style={{
                    fontFamily: TOKENS.display, fontSize: 24, fontStyle: 'italic',
                    letterSpacing: 3, color: TOKENS.fire, display: 'flex',
                  }}>STRESS</span>
                  <span style={{ fontFamily: TOKENS.sansKR, fontSize: 25, fontWeight: 900, color: TOKENS.ink, display: 'flex' }}>스트레스</span>
                  <span style={{ flex: 1 }} />
                  <span style={{
                    fontFamily: TOKENS.display, fontStyle: 'italic', fontSize: 28,
                    color: TOKENS.ink, lineHeight: 1, display: 'flex', alignItems: 'baseline',
                  }}>{parseFloat(stress.toFixed(1))}<span style={{ fontSize: 15, opacity: 0.6 }}>%</span></span>
                </div>
                <div style={{
                  height: 18, background: '#E2D6B8', display: 'flex',
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
                fontFamily: TOKENS.display, fontSize: 20, fontStyle: 'italic',
                letterSpacing: 3, color: TOKENS.noteBrown, display: 'flex',
              }}>속마음 · INNER</div>
              {/* Handwriting text — highlighter background sized to text width */}
              <div style={{ position: 'relative', marginTop: 1, display: 'flex', alignItems: 'center' }}>
                <span style={{
                  fontFamily: TOKENS.hand, fontSize: 48, color: TOKENS.noteBrown,
                  display: 'flex', lineHeight: 1.3,
                  background: TOKENS.highlighter,
                  padding: '3px 8px',
                  transform: 'rotate(-0.6deg)',
                }}>{renderThought(thought)}</span>
              </div>
            </div>

            {/* Emotion badge */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: TOKENS.ink, color: '#fff',
              paddingLeft: 16, paddingRight: 28, paddingTop: 12, paddingBottom: 12,
              boxShadow: `6px 6px 0 ${emo.color}`,
              transform: 'skewX(-10deg)',
            }}>
              <div style={{
                width: 63, height: 63, borderRadius: '50%', background: emo.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: TOKENS.display, fontStyle: 'italic', fontSize: 30,
                transform: 'skewX(10deg)',
              }}>♥</div>
              <div style={{ display: 'flex', flexDirection: 'column', transform: 'skewX(10deg)' }}>
                <div style={{
                  fontFamily: TOKENS.display, fontSize: 20, fontStyle: 'italic',
                  letterSpacing: 3, color: emo.color, display: 'flex',
                }}>EMOTION · 감정</div>
                <div style={{
                  fontFamily: TOKENS.display, fontStyle: 'italic', fontSize: 41,
                  lineHeight: 1, marginTop: 2, display: 'flex',
                }}>
                  {emo.label}
                  <span style={{ fontFamily: TOKENS.sansKR, fontSize: 24, color: '#E2D6B8', marginLeft: 6, display: 'flex', alignItems: 'center' }}>· {emo.kr}</span>
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
        { name: 'Pretendard',     data: fonts.pretendard,  weight: 700, style: 'normal' },
        { name: 'BowlbyOneSC',    data: fonts.bowlby,      weight: 400, style: 'normal' },
        { name: 'Paperozi',       data: fonts.paperozi,    weight: 900, style: 'normal' },
        { name: 'Paperozi',       data: fonts.paperozi7,   weight: 700, style: 'normal' },
        { name: 'NanumPenLatin',  data: fonts.nanumLatin,  weight: 400, style: 'normal' },
        { name: 'NanumPenKorean', data: fonts.nanumKorean, weight: 400, style: 'normal' },
        { name: 'GasoekOne',      data: fonts.gasoekOne,   weight: 400, style: 'normal' },
      ],
    }
  );

  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0');
  res.end(buffer);
}
