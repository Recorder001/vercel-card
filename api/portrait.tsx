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

const EMOTION_MAP: Record<string, { emoji: string; label: string; color: string }> = {
  depressed: { emoji: '😓', label: '우울', color: '#5D6D7E' },
  anxious: { emoji: '😨', label: '불안', color: '#7D6608' },
  shocked: { emoji: '😱', label: '충격', color: '#922B21' },
  happy: { emoji: '😄', label: '행복', color: '#D68910' },
  joy: { emoji: '😆', label: '즐거움', color: '#E67E22' },
  expect: { emoji: '🥺', label: '기대', color: '#A569BD' },
  moved: { emoji: '🥹', label: '감동', color: '#C39BD3' },
  flutter: { emoji: '💕', label: '설렘', color: '#EC7063' },
  love: { emoji: '💞', label: '사랑', color: '#C0392B' },
};

const WEATHER_EMOJI: Record<string, string> = {
  sunny: '☀',
  cloudy: '☁',
  rain: '☂',
  storm: '⚡',
  snow: '☃',
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const { searchParams } = new URL(req.url!, 'http://localhost');

  const charImg = searchParams.get('img');
  const charName = searchParams.get('char') || '';
  const emotion = searchParams.get('emotion') || 'happy';
  const weather = searchParams.get('weather') || 'sunny';
  const date = searchParams.get('date') || '';
  const time = searchParams.get('time') || '';
  const location = searchParams.get('location') || '';
  const turn = searchParams.get('turn') || '0';

  const emotionMeta = EMOTION_MAP[emotion] || EMOTION_MAP['happy'];
  const weatherIcon = WEATHER_EMOJI[weather] || '☀';
  const bgImage = charImg || 'https://placehold.co/600x900/F5EFE0/1A1A1A?text=No+Image';
  const paperBg = 'https://www.transparenttextures.com/patterns/paper-fibers.png';
  const fontData = loadFont();

  const imageResponse = new ImageResponse(
    (
      <div
        style={{
          width: '600px',
          height: '900px',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#F5EFE0',
          backgroundImage: `url(${bgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
          fontFamily: 'Pretendard',
        }}
      >
        {/* 종이 질감 오버레이 */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundImage: `url(${paperBg})`,
            opacity: 0.3,
            display: 'flex',
          }}
        />

        {/* 페5 액센트 */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '180px',
            height: '50px',
            backgroundColor: '#C0392B',
            transform: 'skewX(-15deg) translateX(20px)',
            display: 'flex',
          }}
        />

        {/* 상단 HUD */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            margin: '24px 24px 0',
            padding: '12px 16px',
            backgroundColor: 'rgba(26,26,26,0.85)',
            color: '#F5EFE0',
            borderRadius: '2px',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', fontSize: '12px', letterSpacing: '4px', color: '#C0392B', fontWeight: 700, marginBottom: '4px' }}>
            ⌛ TURN {turn}
          </div>
          <div style={{ display: 'flex', fontSize: '16px', fontWeight: 700 }}>
            {date} · {time} · {weatherIcon}
          </div>
          <div style={{ display: 'flex', fontSize: '14px', color: '#D5C8A8' }}>
            📍 {location}
          </div>
        </div>

        {/* 하단 감정 + 이름 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '24px',
            background: 'linear-gradient(to top, rgba(26,26,26,0.9) 0%, rgba(26,26,26,0.6) 70%, transparent 100%)',
          }}
        >
          {charName && (
            <div style={{ display: 'flex', fontSize: '12px', letterSpacing: '4px', color: emotionMeta.color, marginBottom: '4px', fontWeight: 700 }}>
              NOW SPEAKING
            </div>
          )}
          <div style={{ display: 'flex', fontSize: '36px', fontWeight: 900, color: '#F5EFE0', fontStyle: 'italic', marginBottom: '8px', letterSpacing: '-1px' }}>
            {charName}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 14px',
              backgroundColor: emotionMeta.color,
              alignSelf: 'flex-start',
              borderRadius: '2px',
            }}
          >
            <div style={{ display: 'flex', fontSize: '24px' }}>{emotionMeta.emoji}</div>
            <div style={{ display: 'flex', fontSize: '16px', fontWeight: 900, color: '#FFFFFF', letterSpacing: '2px' }}>
              {emotionMeta.label.toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 600,
      height: 900,
      fonts: [{ name: 'Pretendard', data: fontData, weight: 700, style: 'normal' }],
    }
  );

  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=600');
  res.end(buffer);
}
