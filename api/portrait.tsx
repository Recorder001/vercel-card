import { ImageResponse } from '@vercel/og';
import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const FONTS      = path.join(__dirname, 'fonts');
const MIO_CHARS  = path.join(__dirname, '미오통합', '캐릭터');
const MIO_BG     = path.join(__dirname, '미오통합', '배경');

type FontCache = { pretendard: ArrayBuffer; bowlby: ArrayBuffer; paperozi: ArrayBuffer; nanumLatin: ArrayBuffer; nanumKorean: ArrayBuffer; gasoekOne: ArrayBuffer };
let fontCache: FontCache | null = null;
function toAB(b: Buffer): ArrayBuffer { return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; }

function loadCharExpr(expr: string): string {
  const specific = path.join(MIO_CHARS, `미오_${expr}.png`);
  const fallback  = path.join(MIO_CHARS, '미오_무표정.png');
  const file = fs.existsSync(specific) ? specific : fallback;
  return `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
}

function loadBg(bg: string): string | null {
  const file = path.join(MIO_BG, `배경_${bg}.png`);
  if (!fs.existsSync(file)) return null;
  return `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
}

function loadFonts(): FontCache {
  if (fontCache) return fontCache;
  fontCache = {
    pretendard:  toAB(fs.readFileSync(path.join(FONTS, 'Pretendard-Bold.woff'))),
    bowlby:      toAB(fs.readFileSync(path.join(FONTS, 'BowlbyOneSC.ttf'))),
    paperozi:    toAB(fs.readFileSync(path.join(FONTS, 'Paperozi.ttf'))),
    nanumLatin:  toAB(fs.readFileSync(path.join(FONTS, 'NanumPenLatin.woff'))),
    nanumKorean: toAB(fs.readFileSync(path.join(FONTS, 'NanumPenKorean.woff'))),
    gasoekOne:   toAB(fs.readFileSync(path.join(FONTS, 'GasoekOne.ttf'))),
  };
  return fontCache;
}

const TOKENS = {
  paper: '#F5EFE0', paperDeep: '#EDE3CB', paperShade: '#E2D6B8',
  red: '#C0392B', redDeep: '#8E2A1F', ink: '#1A1A1A', inkSoft: '#2A2522',
  noteBrown: '#5C4A3A',
  sansKR:   'Paperozi, sans-serif',
  display:  'BowlbyOneSC, Paperozi, sans-serif',
  hand:     'NanumPenLatin, NanumPenKorean, Pretendard, cursive',
  charName: 'GasoekOne, Pretendard, sans-serif',
};

const WEATHER: Record<string, { icon: string; label: string }> = {
  sunny:  { icon: '☀', label: '맑음' },
  cloudy: { icon: '☁', label: '흐림' },
  rain:   { icon: '☂', label: '비'   },
  storm:  { icon: '⚡', label: '폭풍' },
  snow:   { icon: '❄', label: '눈'   },
};

const TIMESLOT: Record<string, string> = {
  '아침': '🌄', '점심': '🏙', '저녁': '🌆', '밤': '🌃', '새벽': '🌠',
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try { return await _handler(req, res); }
  catch (e: any) { res.statusCode = 500; res.end('ERROR: ' + String(e?.message || e)); }
}

async function _handler(req: IncomingMessage, res: ServerResponse) {
  const { searchParams } = new URL(req.url!, 'http://localhost');

  const img      = searchParams.get('img')      || '';
  const char     = searchParams.get('char')     || '미오';
  const expr     = searchParams.get('expr')     || '무표정';
  const bg       = searchParams.get('bg')       || '';
  const weather  = searchParams.get('weather')  || 'sunny';
  const date     = searchParams.get('date')     || '';
  const timeslot = searchParams.get('timeslot') || '점심';
  const location = searchParams.get('location') || '';
  const turn     = Number(searchParams.get('turn') ?? 1);

  const u_name   = searchParams.get('u_name')   || '-';
  const u_club   = searchParams.get('u_club')   || '-';
  const u_outfit = searchParams.get('u_outfit') || '-';
  const u_act    = searchParams.get('u_act')    || '-';
  const c_club   = searchParams.get('c_club')   || '-';
  const c_outfit = searchParams.get('c_outfit') || '-';
  const c_act    = searchParams.get('c_act')    || '-';

  const w       = WEATHER[weather] || WEATHER.sunny;
  const tIcon   = TIMESLOT[timeslot] || '🏙';
  const turnSlot = turn % 4 === 0 ? 4 : turn % 4;
  const fonts   = loadFonts();
  const charSrc = img || loadCharExpr(expr);
  const bgSrc   = bg ? loadBg(bg) : null;

  const imageResponse = new ImageResponse(
    (
      <div style={{
        position: 'relative', width: 1200, height: 600, overflow: 'hidden',
        background: TOKENS.paperDeep, color: TOKENS.ink,
        display: 'flex', flexDirection: 'column',
        fontFamily: TOKENS.sansKR,
      }}>

        {/* ── Layer 1: Background ─────────────────────────────────────── */}
        {bgSrc ? (
          <img src={bgSrc} width={1278} height={639}
            style={{ position: 'absolute', left: -39, top: -20, objectFit: 'cover', display: 'flex' }} />
        ) : (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex',
            background: 'linear-gradient(135deg,#EDE3CB 0%,#D9C9A6 60%,#B8A57F 100%)',
          }} />
        )}

        {/* ── Layer 2: Character expression ───────────────────────────── */}
        <img src={charSrc} width={1200} height={530}
          style={{ position: 'absolute', left: 0, top: 70, objectFit: 'contain', display: 'flex' }} />

        {/* ── Layer 3: Slash decorations ──────────────────────────────── */}
        <div style={{
          position: 'absolute', width: 420, height: 48, background: TOKENS.ink,
          transform: 'rotate(-22deg)', top: 80, left: -80, display: 'flex',
        }} />
        <div style={{
          position: 'absolute', width: 360, height: 20, background: TOKENS.red,
          transform: 'rotate(-22deg)', top: 96, left: -110, display: 'flex',
        }} />
        <div style={{
          position: 'absolute', width: 420, height: 48, background: TOKENS.ink,
          transform: 'rotate(-22deg)', bottom: 60, right: -80, display: 'flex',
        }} />
        <div style={{
          position: 'absolute', width: 360, height: 20, background: TOKENS.red,
          transform: 'rotate(-22deg)', bottom: 78, right: -120, display: 'flex',
        }} />

        {/* ── Layer 4: Top vignette ───────────────────────────────────── */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 120,
          background: 'linear-gradient(180deg,rgba(26,26,26,0.55),transparent)', display: 'flex',
        }} />

        {/* ── Layer 5: HUD strip ──────────────────────────────────────── */}
        <div style={{
          position: 'relative', zIndex: 3, display: 'flex',
          height: 70, width: '100%',
          background: TOKENS.ink, color: '#F5EFE0', alignItems: 'center', overflow: 'hidden',
          fontFamily: TOKENS.sansKR, fontWeight: 700, fontSize: 30,
        }}>
          <div style={{
            background: TOKENS.red, color: '#fff',
            paddingLeft: 18, paddingRight: 30, height: '100%',
            display: 'flex', alignItems: 'center', gap: 12,
            fontFamily: TOKENS.display, fontStyle: 'italic', fontSize: 36,
            transform: 'skewX(-14deg)',
          }}>
            <span style={{ display: 'flex', transform: 'skewX(14deg)', opacity: 0.8, fontSize: 27 }}>TURN</span>
            <span style={{ display: 'flex', transform: 'skewX(14deg)', fontSize: 45 }}>{String(turn).padStart(2, '0')}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '0 22px', flex: 1 }}>
            {date && <span style={{ display: 'flex', gap: 6 }}>📅 <b>{date}</b></span>}
            {date && <span style={{ opacity: 0.4, display: 'flex' }}>·</span>}
            <span style={{ display: 'flex', gap: 6 }}>{tIcon} {timeslot} <span style={{ opacity: 0.55, fontSize: 22, display: 'flex', alignSelf: 'center' }}>({turnSlot}/4)</span></span>
            <span style={{ opacity: 0.4, display: 'flex' }}>·</span>
            <span style={{ display: 'flex', gap: 6 }}>{w.icon} {w.label}</span>
            {location && <span style={{ opacity: 0.4, display: 'flex' }}>·</span>}
            {location && <span style={{ display: 'flex', gap: 6 }}>📍 {location}</span>}
          </div>
        </div>

        {/* ── Layer 6: U panel (left, square) ─────────────────────────── */}
        <div style={{
          position: 'absolute', left: 24, top: 110, zIndex: 4,
          width: 264, height: 264, display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          border: `3px solid ${TOKENS.ink}`,
          boxShadow: `7px 7px 0 ${TOKENS.ink}`,
        }}>
          {/* Header strip */}
          <div style={{
            background: TOKENS.ink, color: '#fff',
            padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: TOKENS.paper, color: TOKENS.ink,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: TOKENS.display, fontStyle: 'italic', fontSize: 20,
            }}>U</div>
            <span style={{
              fontFamily: TOKENS.display, fontStyle: 'italic',
              fontSize: 20, letterSpacing: 4, color: '#9A8B6A', display: 'flex',
            }}>YOU</span>
          </div>
          {/* Name */}
          <div style={{
            background: TOKENS.paper, padding: '10px 14px 8px',
            display: 'flex', borderBottom: `2px solid ${TOKENS.ink}`,
          }}>
            <div style={{
              fontFamily: TOKENS.charName, fontSize: 48,
              color: TOKENS.ink, lineHeight: 1, display: 'flex',
            }}>{u_name}</div>
          </div>
          {/* Info rows */}
          <div style={{
            background: 'rgba(245,239,224,0.95)', flex: 1,
            padding: '10px 14px', display: 'flex', flexDirection: 'column',
            justifyContent: 'space-around',
          }}>
            {[['CLUB', u_club], ['FIT', u_outfit], ['ACT', u_act]].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{
                  fontFamily: TOKENS.display, fontStyle: 'italic', fontSize: 14,
                  letterSpacing: 2, color: '#9A8B6A', display: 'flex', minWidth: 40,
                }}>{label}</span>
                <span style={{ fontFamily: 'Pretendard, sans-serif', fontSize: 18, color: TOKENS.inkSoft, display: 'flex' }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Layer 6: C panel (right, square) ────────────────────────── */}
        <div style={{
          position: 'absolute', right: 24, top: 110, zIndex: 4,
          width: 264, height: 264, display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: `-7px 7px 0 ${TOKENS.red}`,
        }}>
          {/* Header strip — right-aligned: MIO ● */}
          <div style={{
            background: TOKENS.red, color: '#fff',
            padding: '10px 14px', display: 'flex', alignItems: 'center',
            justifyContent: 'flex-end', gap: 10,
          }}>
            <span style={{
              fontFamily: TOKENS.display, fontStyle: 'italic',
              fontSize: 20, letterSpacing: 4, color: '#fff', display: 'flex',
            }}>MIO</span>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: '#fff', color: TOKENS.red,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: TOKENS.display, fontStyle: 'italic', fontSize: 20,
            }}>C</div>
          </div>
          {/* Name — right-aligned */}
          <div style={{
            background: TOKENS.ink, padding: '10px 14px 8px',
            display: 'flex', justifyContent: 'flex-end',
            borderBottom: `2px solid ${TOKENS.red}`,
          }}>
            <div style={{
              fontFamily: TOKENS.charName, fontSize: 48,
              color: '#fff', lineHeight: 1, display: 'flex',
            }}>{char}</div>
          </div>
          {/* Info rows — right-aligned, value before label */}
          <div style={{
            background: TOKENS.ink, flex: 1,
            padding: '10px 14px', display: 'flex', flexDirection: 'column',
            justifyContent: 'space-around',
          }}>
            {([[c_club, 'CLUB'], [c_outfit, 'FIT'], [c_act, 'ACT']] as [string, string][]).map(([val, label]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 8 }}>
                <span style={{ fontFamily: 'Pretendard, sans-serif', fontSize: 18, color: '#E2D6B8', display: 'flex' }}>{val}</span>
                <span style={{
                  fontFamily: TOKENS.display, fontStyle: 'italic', fontSize: 14,
                  letterSpacing: 2, color: TOKENS.red, display: 'flex',
                }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Layer 7: Character name stamp (black → red → white) ─────── */}
        <div style={{
          position: 'absolute', left: 40, bottom: 14, zIndex: 4, display: 'flex',
          fontFamily: TOKENS.charName, color: TOKENS.ink,
          fontSize: 132, lineHeight: 0.9, letterSpacing: -3,
        }}>{char}</div>
        <div style={{
          position: 'absolute', left: 33, bottom: 21, zIndex: 5, display: 'flex',
          fontFamily: TOKENS.charName, color: TOKENS.red,
          fontSize: 132, lineHeight: 0.9, letterSpacing: -3,
        }}>{char}</div>
        <div style={{
          position: 'absolute', left: 26, bottom: 28, zIndex: 6, display: 'flex',
          fontFamily: TOKENS.charName, color: '#fff',
          fontSize: 132, lineHeight: 0.9, letterSpacing: -3,
        }}>{char}</div>

      </div>
    ),
    {
      width: 1200,
      height: 600,
      fonts: [
        { name: 'Pretendard',     data: fonts.pretendard,  weight: 700, style: 'normal' },
        { name: 'BowlbyOneSC',    data: fonts.bowlby,      weight: 400, style: 'normal' },
        { name: 'Paperozi',       data: fonts.paperozi,    weight: 900, style: 'normal' },
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
