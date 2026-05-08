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

function clamp(val: string | null): number {
  const n = parseInt(val ?? '0');
  return Math.min(100, Math.max(0, isNaN(n) ? 0 : n));
}

const RANK_NAMES: Record<string, string[]> = {
  study: ['바부', '평균이하', '평균이상', '박학다식', '지식의 요람'],
  power: ['저질', '달팽이', '토끼', '라이징스타', '마라토너'],
  art: ['무미건조', '정취', '운치', '풍류', '거장'],
  social: ['외톨이', '듣기만점', '스피처', '두터운교우관계', '인싸'],
  craft: ['마이너스의 손', '잔고장전문가', '야무짐', '독보적', '미다스의손'],
};

const STAT_META: Record<string, { emoji: string; label: string; color: string }> = {
  study: { emoji: '📚', label: '학업', color: '#D9534F' },
  power: { emoji: '💪', label: '체력', color: '#E67E22' },
  art: { emoji: '🎨', label: '예술', color: '#8E44AD' },
  social: { emoji: '💬', label: '사교', color: '#27AE60' },
  craft: { emoji: '🛠', label: '재주', color: '#2980B9' },
};

const EMOTION_MAP: Record<string, string> = {
  depressed: '😓 우울',
  anxious: '😨 불안',
  shocked: '😱 충격',
  happy: '😄 행복',
  joy: '😆 즐거움',
  expect: '🥺 기대',
  moved: '🥹 감동',
  flutter: '💕 설렘',
  love: '💞 사랑',
};

function ptToRank(pt: number): number {
  return Math.min(5, Math.floor(pt / 20) + 1);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try { return await _handler(req, res); } catch (e: any) { res.statusCode = 500; res.end('ERROR: ' + String(e?.message || e)); }
}
async function _handler(req: IncomingMessage, res: ServerResponse) {
  const { searchParams } = new URL(req.url!, 'http://localhost');

  const charName = searchParams.get('char') || '캐릭터';
  const userName = searchParams.get('user') || 'P';
  const study = clamp(searchParams.get('study'));
  const power = clamp(searchParams.get('power'));
  const art = clamp(searchParams.get('art'));
  const social = clamp(searchParams.get('social'));
  const craft = clamp(searchParams.get('craft'));
  const affection = clamp(searchParams.get('affection'));
  const emotion = searchParams.get('emotion') || 'happy';
  const event = searchParams.get('event') || '-';
  const dday = searchParams.get('dday') || '-';
  const thought = searchParams.get('thought') || '...';

  const stats = [
    { key: 'study', pt: study },
    { key: 'power', pt: power },
    { key: 'art', pt: art },
    { key: 'social', pt: social },
    { key: 'craft', pt: craft },
  ];

  const paperBg = `https://www.transparenttextures.com/patterns/paper-fibers.png`;
  const notebookBg = `https://www.transparenttextures.com/patterns/lined-paper.png`;
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
          backgroundImage: `url(${paperBg})`,
          padding: '32px',
          fontFamily: 'Pretendard',
          position: 'relative',
        }}
      >
        {/* 페5 빨간 액센트 */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '120px',
            height: '40px',
            backgroundColor: '#C0392B',
            transform: 'skewX(-20deg) translateX(-20px)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: '120px',
            height: '40px',
            backgroundColor: '#1A1A1A',
            transform: 'skewX(-20deg) translateX(20px)',
            display: 'flex',
          }}
        />

        {/* 헤더 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginBottom: '20px',
            paddingBottom: '16px',
            borderBottom: '3px solid #2C2C2C',
          }}
        >
          <div style={{ display: 'flex', fontSize: '14px', color: '#8B7355', letterSpacing: '4px', marginBottom: '4px' }}>
            STATUS / {userName.toUpperCase()}
          </div>
          <div style={{ display: 'flex', fontSize: '40px', fontWeight: 900, color: '#1A1A1A', fontStyle: 'italic', letterSpacing: '-1px' }}>
            {charName}
          </div>
        </div>

        {/* 호감도 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginBottom: '20px',
            backgroundColor: 'rgba(255,255,255,0.6)',
            padding: '14px 18px',
            borderRadius: '4px',
            border: '2px solid #2C2C2C',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', fontSize: '20px', fontWeight: 700, color: '#C0392B' }}>❤ 호감도</div>
            <div style={{ display: 'flex', fontSize: '22px', fontWeight: 900, color: '#1A1A1A' }}>
              {affection}% · {EMOTION_MAP[emotion] || EMOTION_MAP['happy']}
            </div>
          </div>
          <div style={{ display: 'flex', width: '100%', height: '14px', backgroundColor: '#E8DCC4', borderRadius: '2px', overflow: 'hidden', border: '1px solid #2C2C2C' }}>
            <div style={{ display: 'flex', width: `${affection}%`, height: '100%', backgroundColor: '#C0392B' }} />
          </div>
        </div>

        {/* 이벤트 D-day */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            padding: '10px 16px',
            backgroundColor: '#1A1A1A',
            color: '#F5EFE0',
          }}
        >
          <div style={{ display: 'flex', fontSize: '14px', letterSpacing: '3px' }}>NEXT EVENT</div>
          <div style={{ display: 'flex', fontSize: '18px', fontWeight: 700 }}>{event} · D-{dday}</div>
        </div>

        {/* 5스탯 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {stats.map(({ key, pt }) => {
            const meta = STAT_META[key];
            const rank = ptToRank(pt);
            const rankName = RANK_NAMES[key][rank - 1];
            return (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'rgba(255,255,255,0.5)', padding: '10px 14px', borderLeft: `6px solid ${meta.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', fontSize: '18px', fontWeight: 700, color: '#1A1A1A' }}>
                    {meta.emoji} {meta.label}
                    <span style={{ marginLeft: '12px', fontSize: '13px', color: meta.color, fontWeight: 900, letterSpacing: '1px' }}>
                      RANK {rank} · {rankName}
                    </span>
                  </div>
                  <div style={{ display: 'flex', fontSize: '18px', fontWeight: 900, color: '#1A1A1A' }}>{pt}</div>
                </div>
                <div style={{ display: 'flex', width: '100%', height: '8px', backgroundColor: '#E8DCC4', borderRadius: '1px', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', width: `${Math.max(pt, 0)}%`, height: '100%', backgroundColor: meta.color }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* 속마음 */}
        <div
          style={{
            display: 'flex',
            marginTop: '20px',
            padding: '12px 16px',
            backgroundColor: 'rgba(255,255,180,0.4)',
            backgroundImage: `url(${notebookBg})`,
            borderTop: '1px solid #8B7355',
            borderBottom: '1px solid #8B7355',
            fontStyle: 'italic',
            fontSize: '15px',
            color: '#5C4A3A',
          }}
        >
          " {thought} "
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
