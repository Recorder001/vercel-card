import satori, { init } from 'satori';
import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS = path.join(__dirname, 'fonts');

type FontCache = { pretendard: ArrayBuffer; gasoekOne: ArrayBuffer };
let fontCache: FontCache | null = null;
function toAB(b: Buffer): ArrayBuffer { return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; }
function loadFonts(): FontCache {
  if (fontCache) return fontCache;
  fontCache = {
    pretendard: toAB(fs.readFileSync(path.join(FONTS, 'Pretendard-Bold.woff'))),
    gasoekOne:  toAB(fs.readFileSync(path.join(FONTS, 'GasoekOne.ttf'))),
  };
  return fontCache;
}

let satoriReady = false;
async function ensureSatori() {
  if (satoriReady) return;
  await init(fs.readFileSync(path.join(__dirname, 'yoga.wasm')));
  satoriReady = true;
}

const UFE0F = /️/g;
const U200D = '‍';
function toCodePoint(s: string): string {
  const r: string[] = [];
  let p = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (p) { r.push((65536 + ((p - 55296) << 10) + (c - 56320)).toString(16)); p = 0; }
    else if (c >= 55296 && c <= 56319) { p = c; }
    else { r.push(c.toString(16)); }
  }
  return r.join('-');
}
async function loadAdditionalAsset(code: string, text: string): Promise<string> {
  if (code !== 'emoji') return text;
  const key = text.indexOf(U200D) < 0 ? text.replace(UFE0F, '') : text;
  const cp = toCodePoint(key);
  try {
    const res = await fetch(`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${cp}.svg`);
    if (!res.ok) return text;
    const svg = await res.text();
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  } catch { return text; }
}

function clamp(val: string | null, def = 0): number {
  const n = parseInt(val ?? String(def));
  return Math.min(100, Math.max(0, isNaN(n) ? def : n));
}
function rIdx(pt: number): number { return pt >= 100 ? 5 : Math.floor(pt / 20); }

// ── Design tokens ─────────────────────────────────────────────────────
const C = {
  bg: '#e7e2d2', panel: '#181613', card: '#f4efe1',
  line: '#d6cfba', red: '#e8362b', redDark: '#a8261d',
  ink: '#1c1a16', muted: '#8c8675', good: '#2e9e5b',
};
const DSP = 'GasoekOne';
const BDY = 'Pretendard';

const RANKS: Record<string, string[]> = {
  학업: ['바부',     '평균이하',  '평균이상',  '박학다식',       '지식의 요람', '만물박사'],
  체력: ['저질',     '달팽이',    '토끼',      '라이징스타',     '마라토너',    '올림푸스'],
  예술: ['무미건조', '정취',      '운치',      '풍류',           '거장',        '신필'],
  사교: ['외톨이',   '듣기만점',  '스피처',    '두터운교우관계', '인싸',        '카리스마'],
  재주: ['허접',     '고장잦음',  '취미생',    '전문가',         '장인',        '명장'],
};
const STAT_DEFS = [
  { key: 'study',   label: '학업', color: '#e63b46', how: '공부 · 독서 · 수업집중 · 토론' },
  { key: 'fitness', label: '체력', color: '#f47b20', how: '운동 · 체육 · 걷기 · 운동부 활동' },
  { key: 'art',     label: '예술', color: '#9340d4', how: '그림 · 음악 · 글쓰기 · 문화부 활동' },
  { key: 'social',  label: '사교', color: '#f5a623', how: '대화 · 협력 · 이벤트 · 새 관계' },
  { key: 'skill',   label: '재주', color: '#3a82c8', how: '요리 · 수리 · 제작 · PC 작업' },
];
const DM_UNLOCK   = 50;
const DAWN_UNLOCK = 70;
const HERE_INDEX  = 0;
const HERE_FRAC   = 0.85;
const TIME_NODES  = [
  { key: '아침', emoji: '🌅', gated: false },
  { key: '점심', emoji: '🏫', gated: false },
  { key: '저녁', emoji: '🌇', gated: false },
  { key: '밤',   emoji: '🌙', gated: false },
  { key: '새벽', emoji: '🌌', gated: true  },
];
const EVENTS = [
  { date: '05.15-19', name: '1학기\n중간고사', color: '#e63b46', year: 2026 },
  { date: '06.09',    name: '체육대회',        color: '#2e9e5b', year: 2026 },
  { date: '07.24-28', name: '1학기\n기말고사', color: '#e63b46', year: 2026 },
  { date: '08.01',    name: '여름방학',        color: '#f4a72a', year: 2026 },
  { date: '08.23',    name: 'ⓒ 생일',         color: '#e85a9b', year: 2026 },
  { date: '09.01',    name: '2학기 개학',      color: '#534ab7', year: 2026 },
  { date: '09.14-15', name: '문화제',          color: '#9340d4', year: 2026 },
  { date: '10.17',    name: '2학기\n중간고사', color: '#e63b46', year: 2026 },
  { date: '10.23-25', name: '수학여행',        color: '#1d9e88', year: 2026 },
  { date: '12.12-16', name: '2학기\n기말고사', color: '#e63b46', year: 2026 },
  { date: '12.22',    name: '겨울방학',        color: '#f4a72a', year: 2026 },
  { date: '01.01',    name: '3학기 개학',      color: '#534ab7', year: 2027 },
  { date: '02.20-24', name: '3학기\n기말고사', color: '#e63b46', year: 2027 },
  { date: '03.01',    name: '봄방학',          color: '#f4a72a', year: 2027 },
  { date: '03.30',    name: '졸업식',          color: '#3a82c8', year: 2027 },
];

// ── Shared components ─────────────────────────────────────────────────
function SCard({ en, ko, accent, children, py }: { en: string; ko: string; accent: string; children: any; py?: number }) {
  return (
    <div style={{ background: C.card, border: `3px solid ${C.ink}`, borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: C.panel, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, padding: '9px 14px' }}>
        <div style={{ width: 11, height: 22, background: accent, flexShrink: 0 }} />
        <span style={{ fontFamily: DSP, color: '#fff', fontSize: 19, lineHeight: 1, whiteSpace: 'nowrap', flexShrink: 0 }}>{en}</span>
        <span style={{ fontFamily: BDY, fontWeight: 800, color: '#b6afa0', fontSize: 14, whiteSpace: 'nowrap', flexShrink: 0 }}>{ko}</span>
      </div>
      <div style={{ padding: `${py ?? 18}px 18px`, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

function Chip({ color, big, children }: { color: string; big?: boolean; children: any }) {
  return (
    <div style={{ background: color, color: '#fff', fontFamily: BDY, fontWeight: 900, fontSize: big ? 18 : 15, padding: big ? '4px 14px' : '3px 11px', borderRadius: 7, display: 'flex', alignSelf: 'flex-start', alignItems: 'center', whiteSpace: 'nowrap' }}>
      {children}
    </div>
  );
}

function Bar({ value, color, height = 18, ticks = [] }: { value: number; color: string; height?: number; ticks?: number[] }) {
  const pct = Math.min(100, value);
  const r = height / 2;
  return (
    <div style={{ position: 'relative', height, background: '#ddd6c4', borderRadius: r, border: `2px solid ${C.ink}`, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: color }} />
      {ticks.map((t, i) => (
        <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${t}%`, width: 2, background: 'rgba(0,0,0,0.22)' }} />
      ))}
    </div>
  );
}

function GradeScale({ color, marks, pt, compact }: { color: string; marks: {at:number; label:string}[]; pt: number; compact?: boolean }) {
  const pct = Math.min(100, pt);
  const mt = compact ? 4 : 12;
  const mb = compact ? 12 : 28;
  const lblTop = compact ? 15 : 20;
  return (
    <div style={{ position: 'relative', marginTop: mt, marginBottom: mb, display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', height: 16, borderRadius: 8, background: '#ddd6c4', border: `2px solid ${C.ink}`, display: 'flex' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: color, borderRadius: 5 }} />
        {marks.filter(m => m.at > 0 && m.at < 100).map((m, i) => (
          <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${m.at}%`, width: 2, background: C.ink }} />
        ))}
      </div>
      {marks.map((m, i) => {
        const active = pt >= m.at && m.at > 0;
        const tform = m.at <= 4 ? 'none' : m.at >= 96 ? 'translateX(-100%)' : 'translateX(-50%)';
        return (
          <div key={i} style={{ position: 'absolute', left: `${m.at}%`, top: lblTop, transform: tform, fontFamily: BDY, fontSize: 12, fontWeight: 800, color: active ? color : C.muted, whiteSpace: 'nowrap' }}>
            {m.label}
          </div>
        );
      })}
    </div>
  );
}

// ── TIME section ──────────────────────────────────────────────────────
function TimeSystem({ timeSlot, affection }: { timeSlot: string; affection: number }) {
  const dawnUnlocked = affection >= DAWN_UNLOCK;
  return (
    <SCard en="TIME" ko="타임 시스템" accent="#3a82c8">
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 0, paddingTop: 14, paddingBottom: 4 }}>
        {TIME_NODES.flatMap((n, i) => {
          const isCur  = n.key === timeSlot;
          const locked = n.gated && !dawnUnlocked;
          const node = (
            <div key={n.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
              {isCur && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ background: C.red, color: '#fff', fontFamily: DSP, fontSize: 13, padding: '2px 8px', borderRadius: 4 }}>HERE</div>
                  <div style={{ color: C.red, fontSize: 11, display: 'flex' }}>▼</div>
                </div>
              )}
              {!isCur && <div style={{ height: 28 }} />}
              <div style={{ border: `3px solid ${isCur ? C.red : locked ? '#a09585' : C.ink}`, borderRadius: 10, background: locked ? '#cdc7b8' : isCur ? '#fde7e4' : '#fff', opacity: locked ? 0.65 : 1, textAlign: 'center', padding: '8px 4px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                <div style={{ fontSize: 24, lineHeight: 1 }}>{locked ? '🔒' : n.emoji}</div>
                <div style={{ fontFamily: BDY, fontWeight: 900, fontSize: 14, color: isCur ? C.red : C.ink, marginTop: 4 }}>{n.key}</div>
                {n.gated && (
                  <div style={{ fontFamily: BDY, fontSize: 11, fontWeight: 800, color: locked ? C.red : C.good }}>
                    {locked ? `${DAWN_UNLOCK}%↑` : '✓해금'}
                  </div>
                )}
              </div>
            </div>
          );
          if (i < TIME_NODES.length - 1) {
            return [node, <div key={`sep-${i}`} style={{ width: 10, height: 2, background: C.muted, flexShrink: 0, marginTop: 14 }} />];
          }
          return [node];
        })}
      </div>
      <div style={{ fontFamily: BDY, fontSize: 14, color: C.muted, fontWeight: 700, textAlign: 'center', borderTop: `1px solid ${C.line}`, paddingTop: 10, marginTop: 8, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
        <span>{`1 타임 = 4 턴 · 완료 시 자동 전환  |  새벽: 호감도 ${DAWN_UNLOCK}%↑ 해금`}</span>
        {!dawnUnlocked && <span style={{ color: C.red }}>{` (${DAWN_UNLOCK - affection}pt 남음)`}</span>}
      </div>
    </SCard>
  );
}

// ── STATS section ─────────────────────────────────────────────────────
function StatBar({ def, pt }: { def: typeof STAT_DEFS[0]; pt: number }) {
  const ri  = rIdx(pt);
  const max = pt >= 100;
  return (
    <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 6 }}>
        <Chip color={def.color}>{def.label}</Chip>
        <span style={{ fontFamily: BDY, fontWeight: 900, color: C.ink, fontSize: 18 }}>{RANKS[def.label][ri]}</span>
        <span style={{ fontFamily: BDY, fontWeight: 800, color: C.muted, fontSize: 14 }}>R{ri + 1}</span>
        <span style={{ marginLeft: 'auto', fontFamily: DSP, fontSize: 26, color: def.color }}>
          {max ? 'MAX' : `${pt}pt`}
        </span>
      </div>
      <div style={{ position: 'relative', paddingBottom: 22, display: 'flex', flexDirection: 'column' }}>
        <Bar value={pt} color={def.color} height={18} ticks={[20, 40, 60, 80]} />
        {max ? (
          <div style={{ position: 'absolute', left: 0, top: 22, fontFamily: BDY, fontSize: 11, fontWeight: 800, color: def.color, whiteSpace: 'nowrap' }}>{RANKS[def.label][5]}</div>
        ) : (
          RANKS[def.label].slice(0, 5).map((name, i) => (
            <div key={i} style={{ position: 'absolute', left: `${i * 20 + 10}%`, top: 22, transform: 'translateX(-50%)', fontFamily: BDY, fontSize: 11, fontWeight: 800, color: pt >= i * 20 ? def.color : C.muted, whiteSpace: 'nowrap' }}>{name}</div>
          ))
        )}
      </div>
      <div style={{ fontFamily: BDY, fontSize: 14, color: C.muted, fontWeight: 600 }}>{`↑ ${def.how}`}</div>
    </div>
  );
}

function StatSection({ stats }: { stats: Record<string, number> }) {
  return (
    <SCard en="STATS" ko="스탯 시스템" accent={C.red}>
      {STAT_DEFS.map(d => <StatBar key={d.key} def={d} pt={stats[d.key]} />)}
      <div style={{ fontFamily: BDY, fontSize: 14, color: C.muted, fontWeight: 700, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
        0~100pt · 20pt당 1랭크 · 스탯 상승 시 스트레스도 ×2 동반 상승
      </div>
    </SCard>
  );
}

// ── STRESS section ────────────────────────────────────────────────────
function StressSection({ stress }: { stress: number }) {
  return (
    <SCard en="STRESS" ko="스트레스" accent="#f47b20">
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 7 }}>
        <span style={{ fontFamily: BDY, fontWeight: 900, fontSize: 19, color: C.ink }}>🔥 스트레스</span>
        <span style={{ marginLeft: 'auto', fontFamily: DSP, fontSize: 28, color: stress >= 80 ? C.red : '#f47b20' }}>
          {stress}<span style={{ fontFamily: BDY, fontSize: 16, color: C.muted }}> / 100</span>
        </span>
      </div>
      <Bar value={stress} color="#f47b20" height={20} ticks={[50, 80]} />
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', fontFamily: BDY, fontWeight: 800, fontSize: 13, color: C.red, marginTop: 3 }}>100% ▶ 번아웃</div>
      <div style={{ fontFamily: BDY, fontSize: 16, color: C.ink, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}><span>· 스탯 증가량 </span><span style={{ fontWeight: 900 }}>× 2 pt</span><span> 만큼 동반 상승</span></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}><span>· 100% 도달 시 </span><span style={{ fontWeight: 900, color: C.red }}>번아웃 — 전체 스탯 −20pt</span><span> + 0%로 리셋</span></div>
        <div>· 휴식 · 놀이 · 미오와 긍정 상호작용으로 감소</div>
      </div>
    </SCard>
  );
}

// ── AFFECTION section ─────────────────────────────────────────────────
function AffectionSection({ affection }: { affection: number }) {
  const dm = affection >= DM_UNLOCK;
  const dn = affection >= DAWN_UNLOCK;
  return (
    <SCard en="AFFECTION" ko="호감도" accent={C.red}>
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 7 }}>
        <span style={{ fontFamily: BDY, fontWeight: 900, fontSize: 19, color: C.ink }}>❤️ 호감도</span>
        <span style={{ marginLeft: 'auto', fontFamily: DSP, fontSize: 28, color: C.red }}>
          {affection}<span style={{ fontFamily: BDY, fontSize: 16, color: C.muted }}> / 100</span>
        </span>
      </div>
      <div style={{ position: 'relative', marginTop: 22, display: 'flex', flexDirection: 'column' }}>
        <Bar value={affection} color={C.red} height={20} ticks={[DM_UNLOCK, DAWN_UNLOCK]} />
        <div style={{ position: 'absolute', left: `${DM_UNLOCK}%`, top: -18, transform: 'translateX(-50%)', fontFamily: BDY, fontSize: 12, fontWeight: 800, color: dm ? C.good : C.muted, whiteSpace: 'nowrap' }}>
          {`${dm ? '✓' : '·'} ${DM_UNLOCK}%`}
        </div>
        <div style={{ position: 'absolute', left: `${DAWN_UNLOCK}%`, top: -18, transform: 'translateX(-50%)', fontFamily: BDY, fontSize: 12, fontWeight: 800, color: dn ? C.good : C.muted, whiteSpace: 'nowrap' }}>
          {`${dn ? '✓' : '·'} ${DAWN_UNLOCK}%`}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'row', gap: 8, marginTop: 16 }}>
        {[
          { unlocked: dm, title: `${dm ? '🔓' : '🔒'} 50% · 선디엠`, desc: '미오가 먼저 DM 전송' },
          { unlocked: dn, title: `${dn ? '🔓' : '🔒'} 70% · 새벽 해금${!dn ? ` (${DAWN_UNLOCK - affection}pt 남음)` : ''}`, desc: '새벽 타임 · 옥상 개방' },
        ].map((b, i) => (
          <div key={i} style={{ flex: 1, background: b.unlocked ? '#e8f6ee' : '#f0ece0', border: `2px solid ${b.unlocked ? C.good : C.line}`, borderRadius: 9, padding: '7px 10px', fontFamily: BDY, fontSize: 16, fontWeight: 800, color: b.unlocked ? C.good : C.muted, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div>{b.title}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>{b.desc}</div>
          </div>
        ))}
      </div>
    </SCard>
  );
}

// ── WEATHER section ───────────────────────────────────────────────────
function WeatherGuide({ weather }: { weather: string }) {
  const pos = ['맑음', '눈'].includes(weather);
  const neg = ['흐림', '비', '뇌우'].includes(weather);
  return (
    <SCard en="WEATHER" ko="날씨" accent="#3a82c8">
      <div style={{ display: 'flex', flexDirection: 'row', gap: 14 }}>
        <div style={{ flex: 1, border: `2px solid ${pos ? C.red : '#bfe3cb'}`, borderRadius: 12, padding: 14, background: pos ? '#fdeae8' : '#eef8f0', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontFamily: BDY, fontWeight: 900, fontSize: 19, color: '#2e9e5b' }}>☀️ ❄️ 긍정 날씨</div>
          <div style={{ fontFamily: BDY, fontSize: 17, color: C.ink, fontWeight: 800 }}>맑음 / 눈</div>
          <div style={{ fontFamily: BDY, fontSize: 16, color: C.ink, display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}><span>스탯 </span><span style={{ color: '#2e9e5b', fontWeight: 900 }}>+2~3pt</span><span> · 스트레스 </span><span style={{ fontWeight: 900 }}>×2pt</span></div>
          <div style={{ fontFamily: BDY, fontSize: 14, color: C.muted }}>미오 감정 긍정 편향</div>
        </div>
        <div style={{ flex: 1, border: `2px solid ${neg ? C.red : '#cfd3da'}`, borderRadius: 12, padding: 14, background: neg ? '#fdeae8' : '#f2f3f6', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontFamily: BDY, fontWeight: 900, fontSize: 19, color: '#5b6470' }}>☁️ 🌧 ⛈ 부정 날씨</div>
          <div style={{ fontFamily: BDY, fontSize: 17, color: C.ink, fontWeight: 800 }}>흐림 / 비 / 뇌우</div>
          <div style={{ fontFamily: BDY, fontSize: 16, color: C.ink, display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}><span>스탯 </span><span style={{ fontWeight: 900 }}>+1pt 고정</span><span> · 스트레스 </span><span style={{ color: C.red, fontWeight: 900 }}>+5pt 고정</span></div>
          <div style={{ fontFamily: BDY, fontSize: 14, color: C.muted }}>미오 감정 부정 편향</div>
        </div>
      </div>
      <div style={{ marginTop: 12, fontFamily: BDY, fontSize: 16, color: C.ink, background: '#eef1f6', border: `2px solid ${C.line}`, borderRadius: 10, padding: '8px 12px', fontWeight: 700, display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
        <span>🌧 장마 · 6/30 ~ 7/30 매일 비 고정  |  현재 날씨 </span><span style={{ color: C.red, fontWeight: 900 }}>{weather}</span>
      </div>
    </SCard>
  );
}

// ── EVENT JUDGE section (그래프 + 판정 상세 분리) ─────────────────────
function JudgeSplit({ stats }: { stats: Record<string, number> }) {
  const sum   = stats.art + stats.social;
  const bonus = sum >= 200 ? '×2.0' : sum >= 150 ? '×1.5' : sum >= 100 ? '×1.25' : sum >= 50 ? '×1.1' : '×1.0';
  const col   = (k: string) => STAT_DEFS.find(d => d.key === k)!.color;
  const sub   = (t: string) => <div style={{ fontFamily: DSP, fontSize: 17, color: C.ink, margin: '0 0 2px' }}>{t}</div>;

  const details = [
    { title: '📚 시험 — 커트라인 (학업 기준)', lines: ['1학기 중간 20pt↑ · 기말 40pt↑ · 2학기 중간 60pt↑ · 기말 80pt↑ · 3학기 100pt', '커트 미달 = FAIL → 미오 부정감정 · 진로 압박↑ · 스트레스 +20%'] },
    { title: '💪 체육대회 (06/09) — 체력 랭크 = 등수', lines: ['100pt 우승 / 80pt↑ 은상 / 60pt↑ 동상 / 40pt↑ 하위권 / 20pt 미만 꼴지'] },
    { title: '🎭 문화제 (09/14~15) — 예술+사교 합산', lines: ['50~99:×1.1 / 100~149:×1.25 / 150~199:×1.5 / 200:×2.0'] },
    { title: '🚌 수학여행 (10/23~25) — 재주 스탯 기준', lines: ['0~19 대화X · 잠만 잠 / 20~39 디엠 가능 / 40~59 통화 가능', '60~79 미오 방에서 만남 / 80~99 숙소 탈출 / 100 음주가무'] },
    { title: '🎓 졸업식 (03/30) — 누적 결과 → 엔딩 분기', lines: ['시험 PASS+사교MAX → ⓤ와 같은 대학 / 예술MAX → 예체능 대학', '체력MAX+재주MAX → 운동선수 / 학업MAX → 명문대'] },
  ];

  return (
    <SCard en="JUDGE" ko="이벤트별 판정" accent="#9340d4" py={10}>
      <div style={{ display: 'flex', flexDirection: 'row', gap: 24 }}>
        {/* 좌: 그래프 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {sub('📚 시험 · 학업')}
          <Chip color={col('study')}>학업 {stats.study}pt</Chip>
          <GradeScale compact color={col('study')} marks={[{at:20,label:'중간1'},{at:40,label:'기말1'},{at:60,label:'중간2'},{at:80,label:'기말2'},{at:100,label:'3학기'}]} pt={stats.study} />

          {sub('💪 체육대회 · 체력')}
          <Chip color={col('fitness')}>체력 {stats.fitness}pt</Chip>
          <GradeScale compact color={col('fitness')} marks={[{at:40,label:'하위권'},{at:60,label:'동상'},{at:80,label:'은상'},{at:100,label:'우승'}]} pt={stats.fitness} />

          <div style={{ height: 1, background: C.line, margin: '2px 0 4px' }} />

          {sub('🎭 문화제 · 예술+사교')}
          <div style={{ display: 'flex', flexDirection: 'row', gap: 8, marginBottom: 2 }}>
            <Chip color={col('art')}>예술 {stats.art}pt</Chip>
            <Chip color={col('social')}>사교 {stats.social}pt</Chip>
          </div>
          <GradeScale compact color={col('art')}    marks={[{at:50,label:'예술 50'},{at:100,label:'예술 100'}]} pt={stats.art} />
          <GradeScale compact color={col('social')} marks={[{at:50,label:'사교 50'},{at:100,label:'사교 100'}]} pt={stats.social} />
          <div style={{ fontFamily: BDY, fontSize: 14, color: C.ink, background: '#f3ecfb', border: '2px solid #d9c4f2', borderRadius: 8, padding: '4px 9px', marginTop: 2, marginBottom: 4, display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
            <span>합산 </span><span style={{ fontWeight: 900 }}>{sum}</span><span> → 호감도 보너스 </span><span style={{ color: '#9340d4', fontWeight: 900 }}>{bonus}</span>
          </div>

          {sub('🚌 수학여행 · 재주')}
          <Chip color={col('skill')}>재주 {stats.skill}pt</Chip>
          <GradeScale compact color={col('skill')} marks={[{at:20,label:'디엠'},{at:40,label:'통화'},{at:60,label:'방에서'},{at:80,label:'탈출'},{at:100,label:'음주'}]} pt={stats.skill} />
        </div>

        {/* 우: 판정 상세 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, borderLeft: `2px solid ${C.line}`, paddingLeft: 20 }}>
          <div style={{ fontFamily: DSP, fontSize: 18, color: C.ink, marginBottom: 4 }}>📋 판정 상세</div>
          {details.map((r, i) => (
            <div key={i} style={{ padding: '8px 10px', background: '#faf8f2', border: `1.5px solid ${C.line}`, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ fontFamily: BDY, fontWeight: 900, fontSize: 14, color: C.ink }}>{r.title}</div>
              {r.lines.map((l, j) => (
                <div key={j} style={{ fontFamily: BDY, fontSize: 13, color: C.ink, lineHeight: 1.6 }}>{l}</div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </SCard>
  );
}

// ── CLUB section ──────────────────────────────────────────────────────
function ClubGuide({ club }: { club: string }) {
  const sports  = ['야구','축구','농구','배구','테니스','배드민턴','탁구','수영','육상','검도','유도','궁도','체조'];
  const culture = ['취주악','합창','미술','사진','문예','연극','애니연구','요리','원예','PC','과학','방송','신문','다도','서예'];
  const Tag = ({ t }: { t: string }) => {
    const active = club === t;
    return (
      <div style={{ background: active ? '#ffe4e1' : '#fff', border: `1.5px solid ${active ? C.red : C.line}`, borderRadius: 6, padding: '2px 8px', fontFamily: BDY, fontWeight: 700, fontSize: 14, color: active ? C.red : C.ink }}>
        {t}
      </div>
    );
  };
  return (
    <SCard en="CLUB" ko="동아리 시스템" accent="#2e9e5b">
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontFamily: BDY, fontWeight: 900, color: C.ink, fontSize: 18 }}>현재 : </span>
        <Chip color="#2e9e5b" big>{club}</Chip>
      </div>
      <div style={{ fontFamily: BDY, fontWeight: 900, color: '#9340d4', fontSize: 16, marginBottom: 6 }}>🎨 문화부 (15)</div>
      <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
        {culture.map(t => <Tag key={t} t={t} />)}
      </div>
      <div style={{ fontFamily: BDY, fontWeight: 900, color: '#f47b20', fontSize: 16, marginBottom: 6 }}>💪 운동부 (13)</div>
      <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
        {sports.map(t => <Tag key={t} t={t} />)}
      </div>
      <div style={{ fontFamily: BDY, fontSize: 14, color: C.muted, fontWeight: 700, borderTop: `1px solid ${C.line}`, paddingTop: 10, display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
        <span>가입 시 </span><span style={{ color: C.ink, fontWeight: 900 }}>저녁 타임에 동아리 활동 추가</span><span> · 관련 스탯(체력/예술) 상승 가능</span>
      </div>
    </SCard>
  );
}

// ── DM section ────────────────────────────────────────────────────────
function DMGuide({ affection }: { affection: number }) {
  const unlocked = affection >= DM_UNLOCK;
  return (
    <SCard en="DM" ko="DM 시스템" accent={C.red}>
      <div style={{ fontFamily: BDY, fontSize: 16, color: C.ink, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}><span style={{ fontWeight: 900 }}>/디엠 내용</span><span> 입력 → 미오에게 메시지 전송</span></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}><span style={{ fontWeight: 900 }}>{'/디엠 {스탬프코드}'}</span><span> → 스탬프 전송</span></div>
        <div style={{ color: C.muted }}>angry · lol · shy · thumbsup · ignore · heart · pout</div>
        <div style={{ color: C.muted }}>읽씹 여부는 미오의 성격·감정·호감도로 판정</div>
      </div>
      <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, fontFamily: BDY, fontWeight: 800, background: unlocked ? '#e8f6ee' : '#f0ece0', border: `2px solid ${unlocked ? C.good : C.line}`, color: unlocked ? C.good : C.muted, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div>{unlocked ? '🔓 선디엠 해금됨' : '🔒 선디엠 잠김'}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.muted }}>
          {`호감도 ${DM_UNLOCK}%↑ + 밤·새벽 타임 + lonely · conflicted · nostalgic 감정 시 미오가 먼저 연락`}
        </div>
      </div>
    </SCard>
  );
}

// ── TIMELINE section ──────────────────────────────────────────────────
function Timeline({ date }: { date: string }) {
  // 15 events, 4-per-row snake → 4 rows (last row has 3 events ending at x=152)
  const COLS = [56, 152, 248, 344];
  const ROWS = [80, 168, 256, 344];
  const SVG_W = 400, SVG_H = 404;
  const TW = 400, TH = 404;
  const s = (v: number) => Math.round(v * TW / SVG_W);

  const pos = (i: number) => {
    const row = Math.floor(i / 4);
    let col = i % 4;
    if (row % 2 === 1) col = 3 - col;
    return { x: COLS[col], y: ROWS[row] };
  };
  const A  = pos(HERE_INDEX), B = pos(HERE_INDEX + 1);
  const hx = A.x + (B.x - A.x) * HERE_FRAC;
  const hy = A.y + (B.y - A.y) * HERE_FRAC;

  return (
    <SCard en="TIMELINE" ko="주요 이벤트" accent="#534ab7" py={8}>
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 6 }}>
        <span style={{ fontFamily: DSP, fontSize: 16, color: C.muted }}>📅</span>
        <span style={{ fontFamily: DSP, fontSize: 19, color: C.ink }}>{date}</span>
      </div>
      <div style={{ position: 'relative', width: TW, height: TH, display: 'flex', alignSelf: 'center' }}>
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width={TW} height={TH} style={{ position: 'absolute', top: 0, left: 0 }}>
          {/* snake path: 4 rows, last row ends at x=152 (event 14) */}
          <path d="M56 80 H344 C384 80 384 168 344 168 H56 C16 168 16 256 56 256 H344 C384 256 384 344 344 344 H152" fill="none" stroke={C.line} strokeWidth="4" strokeLinecap="round" />
          <polygon points="193,74 206,80 193,86"     fill={C.muted} />
          <polygon points="207,162 194,168 207,174"  fill={C.muted} />
          <polygon points="193,250 206,256 193,262"  fill={C.muted} />
          <polygon points="261,338 248,344 261,350"  fill={C.muted} />
          {EVENTS.map((e, i) => {
            const { x, y } = pos(i);
            return <circle key={i} cx={x} cy={y} r={12.5} fill={e.color} stroke={C.ink} strokeWidth={2.5} />;
          })}
          <polygon points={`${hx-6},${hy-21} ${hx+6},${hy-21} ${hx},${hy-13}`} fill={C.red} />
          <circle cx={hx} cy={hy} r={7} fill={C.red} stroke="#fff" strokeWidth={2.5} />
          <circle cx={hx} cy={hy} r={10.5} fill="none" stroke={C.red} strokeWidth={1.5} strokeDasharray="3 3" />
        </svg>
        <div style={{ position: 'absolute', left: s(hx), top: s(hy) - 32, transform: 'translateX(-50%)', fontFamily: DSP, fontSize: 13, color: C.red, whiteSpace: 'nowrap' }}>HERE</div>
        {EVENTS.flatMap((e, i) => {
          const { x, y } = pos(i);
          const yr = e.year !== 2026 ? "'27 " : '';
          const nameLines = e.name.split('\n');
          return [
            <div key={`d${i}`} style={{ position: 'absolute', left: s(x), top: s(y) - 26, transform: 'translateX(-50%)', fontFamily: BDY, fontSize: 10, fontWeight: 700, color: C.muted, whiteSpace: 'nowrap' }}>{`${yr}${e.date}`}</div>,
            ...nameLines.map((l, j) => (
              <div key={`n${i}${j}`} style={{ position: 'absolute', left: s(x), top: s(y) + 13 + j * 12, transform: 'translateX(-50%)', fontFamily: BDY, fontSize: 11, fontWeight: 900, color: C.ink, whiteSpace: 'nowrap' }}>{l}</div>
            )),
          ];
        })}
      </div>
      <div style={{ textAlign: 'center', fontFamily: BDY, fontSize: 14, color: C.muted, fontWeight: 700, marginTop: 4 }}>
        2026.3 입학 → 2027.3 졸업 · 빨간 점이 현재 위치
      </div>
    </SCard>
  );
}

// ── Handler ───────────────────────────────────────────────────────────
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try { return await _handler(req, res); }
  catch (e: any) { res.statusCode = 500; res.end('ERROR: ' + String(e?.message || e)); }
}

async function _handler(req: IncomingMessage, res: ServerResponse) {
  const { searchParams } = new URL(req.url!, 'http://localhost');

  const timeSlot  = searchParams.get('timeslot') || '아침';
  const date      = searchParams.get('date')     || '2026.06.06';
  const weather   = searchParams.get('weather')  || '맑음';
  const affection = clamp(searchParams.get('affection'));
  const stress    = clamp(searchParams.get('stress'));
  const club      = searchParams.get('club')     || '귀가부';
  const stats = {
    study:   clamp(searchParams.get('study')),
    fitness: clamp(searchParams.get('fitness')),
    art:     clamp(searchParams.get('art')),
    social:  clamp(searchParams.get('social')),
    skill:   clamp(searchParams.get('skill')),
  };

  await ensureSatori();
  const fonts = loadFonts();
  const GAP = 20;
  const PAD = 24;
  const W = 1000;
  const H = 2600;
  const COL = Math.floor((W - PAD * 2 - GAP) / 2);

  const col = (children: any) => (
    <div style={{ width: COL, display: 'flex', flexDirection: 'column', gap: 18 }}>{children}</div>
  );

  const svg = await satori(
    (
      <div style={{ width: W, height: H, background: C.bg, display: 'flex', flexDirection: 'column', padding: PAD, gap: 18 }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, padding: '4px 0 2px' }}>
          <div style={{ fontFamily: DSP, fontWeight: 900, fontSize: 48, color: '#fff', textShadow: `5px 6px 0 ${C.redDark}`, lineHeight: 1, display: 'flex', alignItems: 'center' }}>
            <span>GUIDE</span><span style={{ color: C.red }}>&</span><span>PROGRESS</span>
          </div>
          <div style={{ fontFamily: BDY, fontWeight: 800, color: C.muted, fontSize: 17 }}>청춘회생록 · 플레이어 시스템 가이드</div>
        </div>

        {/* 상단 2열: 좌 TIME/STATS/STRESS+AFF/WEATHER  우 AFF/CLUB+DM/TIMELINE */}
        <div style={{ display: 'flex', flexDirection: 'row', gap: GAP, alignItems: 'flex-start' }}>
          {col([
            <TimeSystem key="time" timeSlot={timeSlot} affection={affection} />,
            <StatSection key="stats" stats={stats} />,
            <div key="sa" style={{ display: 'flex', flexDirection: 'row', gap: 14 }}>
              <div style={{ flex: 1, display: 'flex' }}><StressSection stress={stress} /></div>
              <div style={{ flex: 1, display: 'flex' }}><AffectionSection affection={affection} /></div>
            </div>,
          ])}
          {col([
            <div key="cd" style={{ display: 'flex', flexDirection: 'row', gap: 14 }}>
              <div style={{ flex: 1, display: 'flex' }}><ClubGuide club={club} /></div>
              <div style={{ flex: 1, display: 'flex' }}><DMGuide affection={affection} /></div>
            </div>,
            <Timeline key="timeline" date={date} />,
            <WeatherGuide key="weather" weather={weather} />,
          ])}
        </div>

        {/* 하단 풀폭: JUDGE (그래프 | 판정 상세) */}
        <JudgeSplit stats={stats} />

        <div style={{ textAlign: 'center', fontFamily: BDY, color: C.muted, fontSize: 14, padding: '4px 0' }}>
          청춘회생록 · 시스템 가이드 + 진행도
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: [
        { name: 'GasoekOne',  data: fonts.gasoekOne,  style: 'normal', weight: 400 },
        { name: 'Pretendard', data: fonts.pretendard,  style: 'normal', weight: 700 },
      ],
      loadAdditionalAsset,
    }
  );

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0');
  res.end(svg);
}
