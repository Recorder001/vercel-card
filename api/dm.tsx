import { ImageResponse } from '@vercel/og';
import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const FONTS      = path.join(__dirname, 'fonts');

type FontCache = { pretendard: ArrayBuffer; paperozi: ArrayBuffer; gasoekOne: ArrayBuffer };
let fontCache: FontCache | null = null;
const avImgCache: Record<string, string | null> = {};
const stampImgCache: Record<string, string | null> = {};

function toAB(b: Buffer): ArrayBuffer { return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; }

function loadFonts(): FontCache {
  if (fontCache) return fontCache;
  fontCache = {
    pretendard: toAB(fs.readFileSync(path.join(FONTS, 'Pretendard-Bold.woff'))),
    paperozi:   toAB(fs.readFileSync(path.join(FONTS, 'Paperozi.ttf'))),
    gasoekOne:  toAB(fs.readFileSync(path.join(FONTS, 'GasoekOne.ttf'))),
  };
  return fontCache;
}

function loadAvImg(char: string): string | null {
  if (char in avImgCache) return avImgCache[char];
  const file = path.join(__dirname, 'assets', `${char}_프사.png`);
  avImgCache[char] = fs.existsSync(file)
    ? `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`
    : null;
  return avImgCache[char];
}

function loadStampImg(code: string): string | null {
  if (code in stampImgCache) return stampImgCache[code];
  const file = path.join(__dirname, 'assets', `${code}_스탬프.png`);
  stampImgCache[code] = fs.existsSync(file)
    ? `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`
    : null;
  return stampImgCache[code];
}

const INK   = '#1A1A1A';
const RED   = '#C0392B';
const PAPER = '#F5EFE0';
const CREAM = '#FAFAF5';
const KR    = 'Paperozi, Pretendard, sans-serif';
const BR    = 27;  // default bubble corner radius
const AV    = 54;  // avatar size

interface Msg { type: string; msg: string; time: string | null; stamp: string | null; read: string | null; }
type Role = 'solo' | 'first' | 'middle' | 'last';

function getRole(messages: Msg[], idx: number): Role {
  // Stamps are always rendered as standalone — never merged
  if (messages[idx].stamp) return 'solo';

  const t = messages[idx].type;

  // Look backward, skipping stamps, for a previous text bubble of the same type
  let hasPrev = false;
  for (let j = idx - 1; j >= 0; j--) {
    if (messages[j].stamp) continue;   // stamps are transparent to grouping
    hasPrev = messages[j].type === t;
    break;
  }

  // Look forward, skipping stamps, for a next text bubble of the same type
  let hasNext = false;
  for (let j = idx + 1; j < messages.length; j++) {
    if (messages[j].stamp) continue;
    hasNext = messages[j].type === t;
    break;
  }

  if (!hasPrev && !hasNext) return 'solo';
  if (!hasPrev &&  hasNext) return 'first';
  if ( hasPrev &&  hasNext) return 'middle';
  return 'last';
}

// recv TL TR BR BL
// solo: capsule | first: TL round BL sharp | middle: both L sharp | last: TL sharp BL round
function recvRadius(role: Role): string {
  if (role === 'solo')   return `${BR}px ${BR}px ${BR}px ${BR}px`;
  if (role === 'first')  return `${BR}px ${BR}px ${BR}px 0px`;
  if (role === 'middle') return `0px ${BR}px ${BR}px 0px`;
  return `0px ${BR}px ${BR}px ${BR}px`; // last
}

// send TL TR BR BL (right-side mirror of recv)
// solo: capsule | first: TR round BR sharp | middle: both R sharp | last: TR sharp BR round
function sendRadius(role: Role): string {
  if (role === 'solo')   return `${BR}px ${BR}px ${BR}px ${BR}px`;
  if (role === 'first')  return `${BR}px ${BR}px 0px ${BR}px`;
  if (role === 'middle') return `${BR}px 0px 0px ${BR}px`;
  return `${BR}px 0px ${BR}px ${BR}px`; // last
}

function makeAvatar(avImg: string | null, char: string, size: number) {
  if (avImg) {
    return (
      <img
        src={avImg}
        width={size}
        height={size}
        style={{ width: size, height: size, minWidth: size, minHeight: size, display: 'block', flexShrink: 0, borderRadius: '50%', objectFit: 'cover' }}
      />
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: RED, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <div style={{ fontSize: Math.floor(size * 0.5), color: '#fff', display: 'flex', fontFamily: 'GasoekOne, Pretendard, sans-serif' }}>{char[0]}</div>
    </div>
  );
}

function estimateMsgHeight(m: Msg, role: Role, showRead = false): number {
  const isFirst = role === 'solo' || role === 'first';
  if (m.stamp) return (m.type === 'recv' && isFirst ? 27 : 0) + 225;
  const extraLines = Math.max(0, Math.ceil((m.msg || '').length / 12) - 1);
  const nameRow  = m.type === 'recv' && isFirst ? 27 : 0;
  const readRow  = showRead ? 28 : 0;
  return nameRow + 69 + extraLines * 30 + readRow;
}

function stampJsx(code: string) {
  const dataUrl = loadStampImg(code);
  if (!dataUrl) return null;
  return (
    <img
      src={dataUrl}
      width={180}
      height={180}
      style={{ width: 180, height: 180, minWidth: 180, minHeight: 180, display: 'block', flexShrink: 0, objectFit: 'contain' }}
    />
  );
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try { return await _handler(req, res); }
  catch (e: any) { res.statusCode = 500; res.end('ERROR: ' + String(e?.message || e)); }
}

async function _handler(req: IncomingMessage, res: ServerResponse) {
  const { searchParams } = new URL(req.url!, 'http://localhost');

  const char       = searchParams.get('char')       || '캐릭터';
  const c_id       = 'miooo_ss';
  const c_fullname = '시라세 미오';

  const messages: Msg[] = [];
  let i = 0;
  while (searchParams.get(`m${i}`) !== null && i < 10) {
    const raw = searchParams.get(`m${i}`)!;
    const ci  = raw.indexOf(':');
    messages.push({
      type:  ci >= 0 ? raw.slice(0, ci) : 'recv',
      msg:   ci >= 0 ? raw.slice(ci + 1) : raw,
      time:  searchParams.get(`t${i}`),
      stamp: searchParams.get(`s${i}`),
      read:  searchParams.get(`r${i}`),
    });
    i++;
  }

  const roles    = messages.map((_, idx) => getRole(messages, idx));
  const HEADER_H = 105;
  // stamps always get normal 12px gap; consecutive same-type text bubbles get 3px
  const gapOf = (idx: number): number => {
    if (idx === 0) return 0;
    if (messages[idx].stamp || messages[idx - 1].stamp) return 12;
    return messages[idx].type === messages[idx - 1].type ? 3 : 12;
  };
  const lastReadIdx = messages.reduce((best, m, idx) =>
    m.type === 'send' && m.read === 'true' ? idx : best, -1);
  const totalH = HEADER_H + roles.reduce((s, r, idx) =>
    s + estimateMsgHeight(messages[idx], r, idx === lastReadIdx) + gapOf(idx), 0) + 34;
  const fonts    = loadFonts();
  const charImg  = loadAvImg(char);

  const imageResponse = new ImageResponse(
    (
      <div style={{ width: 600, height: totalH, display: 'flex', flexDirection: 'column', position: 'relative' }}>

        {/* ── Header: Instagram DM style ─────────────────────────────── */}
        <div style={{
          height: HEADER_H, background: INK, color: '#fff',
          display: 'flex', alignItems: 'center',
          paddingLeft: 24, gap: 18, flexShrink: 0,
          borderBottom: `5px solid ${RED}`, position: 'relative',
        }}>
          {makeAvatar(charImg, char, 66)}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ fontFamily: KR, fontSize: 23, color: '#ffffff', display: 'flex' }}>{c_id}</div>
            {c_fullname
              ? <div style={{ fontFamily: KR, fontSize: 20, color: '#888888', display: 'flex' }}>{c_fullname}</div>
              : null}
          </div>
          <svg style={{ position: 'absolute', top: 0, right: 0 }} width={30} height={30}>
            <polygon points="30,0 30,30 0,0" fill={RED}/>
          </svg>
        </div>

        {/* ── Message area ───────────────────────────────────────────── */}
        <div style={{
          flex: 1, background: PAPER, display: 'flex', flexDirection: 'column',
          paddingTop: 24, paddingBottom: 10,
          position: 'relative',
        }}>

          {(() => {
            return messages.map((m, idx) => {
            const role       = roles[idx];
            const isSend     = m.type === 'send';
            const timeText   = m.time || '';
            const showRead   = isSend && m.read === 'true' && idx === lastReadIdx;
            // showName/showAvatar based on actual adjacent types, not text-bubble role
            // (stamps don't break the recv run for display purposes)
            const isFirstInRun = !isSend && (idx === 0 || messages[idx - 1].type !== m.type);
            const isLastInRun  = !isSend && (idx === messages.length - 1 || messages[idx + 1].type !== m.type);
            const showName   = isFirstInRun;
            const showAvatar = isLastInRun;

            const timePill = timeText
              ? <div style={{ fontSize: 17, color: '#999999', paddingBottom: 3, display: 'flex', fontFamily: KR, flexShrink: 0 }}>{timeText}</div>
              : null;

            const mt = gapOf(idx);

            // ── Stamp ───────────────────────────────────────────────
            if (m.stamp) {
              const stamp = stampJsx(m.stamp);
              if (isSend) {
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', paddingRight: 18, marginTop: mt }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      {timePill}
                      {stamp}
                    </div>
                    {showRead && <div style={{ fontSize: 15, color: '#888888', display: 'flex', fontFamily: KR, marginTop: 10 }}>읽음</div>}
                  </div>
                );
              }
              return (
                <div key={idx} style={{ display: 'flex', paddingLeft: 18, gap: 12, alignItems: 'flex-end', marginTop: mt }}>
                  {showAvatar ? makeAvatar(charImg, char, AV) : <div style={{ width: AV, flexShrink: 0, display: 'flex' }} />}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {showName && <div style={{ fontSize: 18, color: '#999999', display: 'flex', fontFamily: KR }}>{char}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      {stamp}
                      {timePill}
                    </div>
                  </div>
                </div>
              );
            }

            // ── Send bubble ─────────────────────────────────────────
            if (isSend) {
              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', paddingRight: 18, marginTop: mt }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 9 }}>
                    {timePill}
                    <div style={{
                      background: CREAM, color: INK,
                      padding: '14px 18px', border: `2px solid ${INK}`,
                      borderRadius: sendRadius(role),
                      maxWidth: 360, fontSize: 24, lineHeight: 1.5,
                      fontFamily: KR, wordBreak: 'break-word',
                      display: 'flex', flexDirection: 'column',
                    }}>{m.msg}</div>
                  </div>
                  {showRead && <div style={{ fontSize: 15, color: '#888888', display: 'flex', fontFamily: KR, marginTop: 10 }}>읽음</div>}
                </div>
              );
            }

            // ── Recv bubble ─────────────────────────────────────────
            return (
              <div key={idx} style={{ display: 'flex', paddingLeft: 18, gap: 12, alignItems: 'flex-end', marginTop: mt }}>
                {showAvatar ? makeAvatar(charImg, char, AV) : <div style={{ width: AV, flexShrink: 0, display: 'flex' }} />}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {showName && <div style={{ fontSize: 18, color: '#999999', display: 'flex', fontFamily: KR }}>{char}</div>}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 9 }}>
                    <div style={{
                      background: INK, color: '#ffffff',
                      padding: '14px 18px',
                      borderRadius: recvRadius(role),
                      maxWidth: 360, fontSize: 24, lineHeight: 1.5,
                      fontFamily: KR, wordBreak: 'break-word',
                      display: 'flex', flexDirection: 'column',
                    }}>{m.msg}</div>
                    {timePill}
                  </div>
                </div>
              </div>
            );
          })})()}

        </div>

      </div>
    ),
    {
      width: 600, height: totalH,
      fonts: [
        { name: 'Pretendard', data: fonts.pretendard, weight: 700, style: 'normal' },
        { name: 'Paperozi',   data: fonts.paperozi,   weight: 900, style: 'normal' },
        { name: 'GasoekOne',  data: fonts.gasoekOne,  weight: 400, style: 'normal' },
      ],
    }
  );

  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0');
  res.end(buffer);
}
