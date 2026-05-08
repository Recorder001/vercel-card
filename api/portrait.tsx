import { ImageResponse } from '@vercel/og';
import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let cachedFont: Buffer | null = null;
function loadFont(): Buffer {
  if (cachedFont) return cachedFont;
  cachedFont = fs.readFileSync(path.join(__dirname, 'fonts/Pretendard-Bold.woff'));
  return cachedFont;
}

const TOKENS = {
  paper: '#F5EFE0', paperDeep: '#EDE3CB', paperShade: '#E2D6B8',
  red: '#C0392B', redDeep: '#8E2A1F', ink: '#1A1A1A', inkSoft: '#2A2522',
  noteBrown: '#5C4A3A',
  sansKR: '"Pretendard","Noto Sans KR",sans-serif',
  display: '"Pretendard",sans-serif',
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
  const char     = searchParams.get('char')     || '엠버';
  const emotion  = searchParams.get('emotion')  || 'flutter';
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

  const emo = EMOTIONS[emotion] || EMOTIONS.flutter;
  const w   = WEATHER[weather]  || WEATHER.sunny;
  const tIcon = TIMESLOT[timeslot] || '🏙';
  const fontData = loadFont();

  const imageResponse = new ImageResponse(
    (
      <div style={{
        position: 'relative', width: 1200, height: 600, overflow: 'hidden',
        background: TOKENS.paperDeep, color: TOKENS.ink,
        display: 'flex', flexDirection: 'column',
        fontFamily: TOKENS.sansKR,
      }}>
        {/* Full-bleed background + slash decorations (behind everything) */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex',
          alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden',
          background: 'linear-gradient(135deg,#EDE3CB 0%,#D9C9A6 60%,#B8A57F 100%)',
        }}>
          {img ? (
            <img src={img} width={680} height={680}
                 style={{ position: 'absolute', left: '50%', bottom: -40,
                          transform: 'translateX(-50%)', objectFit: 'cover' }} />
          ) : (
            <div style={{
              position: 'absolute', left: '50%', bottom: 80, transform: 'translateX(-50%)',
              width: 240, height: 240, borderRadius: '50%', background: emo.color,
              opacity: 0.4, display: 'flex',
            }} />
          )}
          {/* Vignettes */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 120,
            background: 'linear-gradient(180deg,rgba(26,26,26,0.55),transparent)', display: 'flex',
          }} />
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 140,
            background: 'linear-gradient(0deg,rgba(26,26,26,0.55),transparent)', display: 'flex',
          }} />
          {/* Diagonal slash decorations (inside background layer = behind UI) */}
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
            transform: 'rotate(-22deg)', bottom: 84, right: -110, display: 'flex',
          }} />
        </div>

        {/* HUD strip */}
        <div style={{
          position: 'relative', zIndex: 2, display: 'flex',
          height: 56, width: '100%',
          background: TOKENS.ink, color: '#F5EFE0', alignItems: 'center', overflow: 'hidden',
          fontFamily: TOKENS.sansKR, fontWeight: 700, fontSize: 18,
        }}>
          <div style={{
            background: TOKENS.red, color: '#fff',
            paddingLeft: 18, paddingRight: 30, height: '100%',
            display: 'flex', alignItems: 'center', gap: 8,
            fontFamily: TOKENS.display, fontStyle: 'italic', fontSize: 22,
            transform: 'skewX(-14deg)',
          }}>
            <span style={{ display: 'flex', transform: 'skewX(14deg)', opacity: 0.8, fontSize: 16 }}>TURN</span>
            <span style={{ display: 'flex', transform: 'skewX(14deg)', fontSize: 26 }}>{String(turn).padStart(2, '0')}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '0 22px', flex: 1 }}>
            {date && <span style={{ display: 'flex', gap: 6 }}>📅 <b>{date}</b></span>}
            {date && <span style={{ opacity: 0.4, display: 'flex' }}>·</span>}
            <span style={{ display: 'flex', gap: 6 }}>{tIcon} {timeslot}</span>
            <span style={{ opacity: 0.4, display: 'flex' }}>·</span>
            <span style={{ display: 'flex', gap: 6 }}>{w.icon} {w.label}</span>
            {location && <span style={{ opacity: 0.4, display: 'flex' }}>·</span>}
            {location && <span style={{ display: 'flex', gap: 6 }}>📍 {location}</span>}
          </div>
        </div>

        {/* U panel (left) */}
        <div style={{
          position: 'absolute', left: 24, top: 90, zIndex: 3, width: 280,
          background: 'rgba(245,239,224,0.92)',
          border: `3px solid ${TOKENS.ink}`,
          boxShadow: `8px 8px 0 ${TOKENS.ink}`,
          padding: '14px 16px', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', background: TOKENS.ink, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: TOKENS.display, fontStyle: 'italic', fontSize: 20,
            }}>U</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 10, letterSpacing: 2.5, fontWeight: 800, color: '#9A8B6A', display: 'flex' }}>YOU</div>
              <div style={{ fontWeight: 900, fontSize: 24, color: TOKENS.ink, lineHeight: 1, letterSpacing: -0.5, display: 'flex' }}>{u_name}</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12.5, color: TOKENS.inkSoft, lineHeight: 1.55 }}>
            <div style={{ display: 'flex', gap: 6 }}><b style={{ color: '#9A8B6A' }}>CLUB</b> {u_club}</div>
            <div style={{ display: 'flex', gap: 6 }}><b style={{ color: '#9A8B6A' }}>FIT</b>  {u_outfit}</div>
            <div style={{ display: 'flex', gap: 6 }}><b style={{ color: '#9A8B6A' }}>ACT</b>  {u_act}</div>
          </div>
        </div>

        {/* C panel (right) */}
        <div style={{
          position: 'absolute', right: 24, top: 90, zIndex: 3, width: 300,
          background: TOKENS.ink, color: '#fff',
          boxShadow: `-8px 8px 0 ${TOKENS.red}`,
          padding: '14px 16px', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', background: emo.color, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: TOKENS.display, fontStyle: 'italic', fontSize: 22,
            }}>C</div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 10, letterSpacing: 2.5, fontWeight: 800, color: emo.color, display: 'flex' }}>NOW</div>
              <div style={{ fontWeight: 900, fontSize: 26, color: '#fff', lineHeight: 1, letterSpacing: -0.5, display: 'flex' }}>{char}</div>
            </div>
            <div style={{
              background: emo.color, padding: '3px 8px', display: 'flex',
              fontFamily: TOKENS.display, fontStyle: 'italic', fontSize: 11, letterSpacing: 1,
            }}>{emo.label}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12.5, color: '#E2D6B8', lineHeight: 1.55 }}>
            <div style={{ display: 'flex', gap: 6 }}><b style={{ color: emo.color }}>CLUB</b> {c_club}</div>
            <div style={{ display: 'flex', gap: 6 }}><b style={{ color: emo.color }}>FIT</b>  {c_outfit}</div>
            <div style={{ display: 'flex', gap: 6 }}><b style={{ color: emo.color }}>ACT</b>  {c_act}</div>
          </div>
        </div>

        {/* Character name — 3-layer stamp effect (black → red → white) */}
        <div style={{
          position: 'absolute', left: 40, bottom: 14, zIndex: 3, display: 'flex',
          fontFamily: TOKENS.sansKR, fontWeight: 900, color: TOKENS.ink,
          fontSize: 88, lineHeight: 0.9, letterSpacing: -3,
        }}>{char}</div>
        <div style={{
          position: 'absolute', left: 35, bottom: 19, zIndex: 4, display: 'flex',
          fontFamily: TOKENS.sansKR, fontWeight: 900, color: TOKENS.red,
          fontSize: 88, lineHeight: 0.9, letterSpacing: -3,
        }}>{char}</div>
        <div style={{
          position: 'absolute', left: 30, bottom: 24, zIndex: 5, display: 'flex',
          fontFamily: TOKENS.sansKR, fontWeight: 900, color: '#fff',
          fontSize: 88, lineHeight: 0.9, letterSpacing: -3,
        }}>{char}</div>
      </div>
    ),
    {
      width: 1200,
      height: 600,
      fonts: [{ name: 'Pretendard', data: fontData, weight: 700, style: 'normal' }],
    }
  );

  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=600');
  res.end(buffer);
}
