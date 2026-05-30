import type { IncomingMessage, ServerResponse } from 'http';

// ── Design tokens ──────────────────────────────────────────────────────
const C = {
  bg: '#e7e2d2', panel: '#181613', card: '#f4efe1',
  line: '#d6cfba', red: '#e8362b', redDark: '#a8261d',
  ink: '#1c1a16', muted: '#8c8675', good: '#2e9e5b',
};
const DISPLAY = "'Black Han Sans', sans-serif";
const BODY    = "'Gothic A1', sans-serif";

// ── Game data ──────────────────────────────────────────────────────────
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

const TIME_NODES = [
  { key: '아침', emoji: '🌅', gated: false },
  { key: '점심', emoji: '🏫', gated: false },
  { key: '저녁', emoji: '🌇', gated: false },
  { key: '밤',   emoji: '🌙', gated: false },
  { key: '새벽', emoji: '🌌', gated: true  },
];

const EVENTS = [
  { date: '05.15', name: '1학기 중간고사', color: '#e63b46', year: 2026 },
  { date: '06.09', name: '체육대회',       color: '#2e9e5b', year: 2026 },
  { date: '07.24', name: '1학기 기말고사', color: '#e63b46', year: 2026 },
  { date: '08.01', name: '여름방학',       color: '#f4a72a', year: 2026 },
  { date: '08.23', name: '미오 생일',      color: '#e85a9b', year: 2026 },
  { date: '09.14', name: '문화제',         color: '#9340d4', year: 2026 },
  { date: '10.17', name: '2학기 중간고사', color: '#e63b46', year: 2026 },
  { date: '10.23', name: '수학여행',       color: '#1d9e88', year: 2026 },
  { date: '12.12', name: '2학기 기말고사', color: '#e63b46', year: 2026 },
  { date: '12.22', name: '겨울방학',       color: '#f4a72a', year: 2026 },
  { date: '02.20', name: '3학기 기말고사', color: '#e63b46', year: 2027 },
  { date: '03.30', name: '졸업식',         color: '#3a82c8', year: 2027 },
];

// ── Helpers ────────────────────────────────────────────────────────────
function clamp(val: string | null, def = 0): number {
  const n = parseInt(val ?? String(def));
  return Math.min(100, Math.max(0, isNaN(n) ? def : n));
}

function rIdx(pt: number): number {
  return pt >= 100 ? 5 : Math.floor(pt / 20);
}

type StyleMap = Record<string, string | number | undefined | null>;
function s(obj: StyleMap): string {
  return Object.entries(obj)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => {
      let prop = k.replace(/([A-Z])/g, m => `-${m.toLowerCase()}`);
      if (prop.startsWith('webkit-')) prop = `-${prop}`;
      return `${prop}: ${v}`;
    })
    .join('; ');
}

// ── Shared components ──────────────────────────────────────────────────
function card(en: string, ko: string, accent: string, content: string): string {
  return `
<section style="${s({ background: C.card, border: `3px solid ${C.ink}`, 'border-radius': '16px', overflow: 'hidden', 'box-shadow': '5px 5px 0 rgba(0,0,0,0.18)' })}">
  <div style="${s({ background: C.panel, display: 'flex', 'align-items': 'center', gap: '10px', padding: '9px 16px' })}">
    <span style="width:12px;height:22px;background:${accent};display:inline-block;transform:skewX(-11deg)"></span>
    <span style="font-family:${DISPLAY};color:#fff;font-size:21px;letter-spacing:1px;line-height:1">${en}</span>
    <span style="font-family:${BODY};font-weight:800;color:#b6afa0;font-size:14px">${ko}</span>
  </div>
  <div style="padding:18px">${content}</div>
</section>`;
}

function chip(color: string, text: string, big = false): string {
  const p = big ? '4px 13px' : '2px 10px';
  const fs = big ? '15px' : '13px';
  return `<span style="background:${color};color:#fff;font-family:${BODY};font-weight:900;font-size:${fs};padding:${p};border-radius:7px;box-shadow:0 3px 0 rgba(0,0,0,0.28);display:inline-block;line-height:1.5;white-space:nowrap">${text}</span>`;
}

function bar(value: number, color: string, height = 18, ticks: number[] = []): string {
  const pct = Math.min(100, value);
  const ticksHtml = ticks.map(t =>
    `<div style="position:absolute;left:${t}%;top:0;bottom:0;width:2px;background:rgba(0,0,0,0.22);z-index:1"></div>`
  ).join('');
  const r = height / 2;
  return `<div style="position:relative;height:${height}px;background:#ddd6c4;border-radius:${r}px;border:2px solid ${C.ink};overflow:hidden">
  <div style="position:absolute;left:0;top:0;bottom:0;width:${pct}%;background:${color};border-radius:${r}px 0 0 ${r}px"></div>
  ${ticksHtml}
</div>`;
}

function gradeScale(color: string, marks: { at: number; label: string }[], currentPt: number): string {
  const pct = Math.min(100, currentPt);
  const dividers = marks.filter(m => m.at > 0 && m.at < 100).map(m =>
    `<div style="position:absolute;top:0;bottom:0;left:${m.at}%;width:2px;background:${C.ink};z-index:2"></div>`
  ).join('');
  const labels = marks.map(m => {
    const active = currentPt >= m.at && m.at > 0;
    const anchor = m.at <= 4 ? '0' : m.at >= 96 ? '-100%' : '-50%';
    return `<div style="position:absolute;left:${m.at}%;top:18px;transform:translateX(${anchor});font-family:${BODY};font-size:10.5px;font-weight:800;color:${active ? color : C.muted};white-space:nowrap">${m.label}</div>`;
  }).join('');
  const fillR = pct >= 99 ? '5px' : '5px 0 0 5px';
  return `<div style="position:relative;margin-top:20px;margin-bottom:28px">
  <div style="position:absolute;left:${pct}%;top:-18px;transform:translateX(-50%);color:${C.red};font-family:${DISPLAY};font-size:11px;white-space:nowrap;z-index:3">▼YOU</div>
  <div style="position:relative;height:14px;border-radius:7px;background:#ddd6c4;border:2px solid ${C.ink}">
    <div style="position:absolute;left:0;top:0;bottom:0;width:${pct}%;background:${color};border-radius:${fillR}"></div>
    ${dividers}
  </div>
  ${labels}
</div>`;
}

// ── TIME section ───────────────────────────────────────────────────────
function timeSystem(timeSlot: string, affection: number): string {
  const dawnUnlocked = affection >= DAWN_UNLOCK;

  const nodes = TIME_NODES.map((n, i) => {
    const isCur = n.key === timeSlot;
    const locked = n.gated && !dawnUnlocked;

    const here = isCur ? `
      <div style="position:absolute;bottom:calc(100% + 4px);left:50%;transform:translateX(-50%);text-align:center;white-space:nowrap">
        <div style="background:${C.red};color:#fff;font-family:${DISPLAY};font-size:11px;padding:2px 8px;border-radius:4px;line-height:1.4">HERE</div>
        <div style="color:${C.red};font-size:9px;line-height:1">▼</div>
      </div>` : '';

    const gatedBadge = n.gated ? `
      <div style="font-family:${BODY};font-size:9px;font-weight:800;color:${locked ? C.red : C.good};margin-top:2px">
        ${locked ? `${DAWN_UNLOCK}%↑` : '✓해금'}
      </div>` : '';

    const nodeBorder = isCur ? C.red : locked ? '#a09585' : C.ink;
    const nodeBg = locked ? '#cdc7b8' : isCur ? '#fde7e4' : '#fff';
    const shadow = isCur ? `0 0 0 2px ${C.red}55` : 'none';
    const arrow = i < TIME_NODES.length - 1
      ? `<span style="flex:0 0 auto;color:${C.muted};font-size:15px;font-weight:900;line-height:1">›</span>`
      : '';

    return `
      <div style="flex:1 1 0;min-width:44px;position:relative">
        ${here}
        <div style="border:3px solid ${nodeBorder};border-radius:10px;background:${nodeBg};opacity:${locked ? 0.65 : 1};text-align:center;padding:8px 4px 6px;box-shadow:${shadow}">
          <div style="font-size:20px;line-height:1">${locked ? '🔒' : n.emoji}</div>
          <div style="font-family:${BODY};font-weight:900;font-size:12px;color:${isCur ? C.red : C.ink};margin-top:4px">${n.key}</div>
          ${gatedBadge}
        </div>
      </div>
      ${arrow}`;
  }).join('');

  const remain = !dawnUnlocked
    ? `<span style="color:${C.red}"> (${DAWN_UNLOCK - affection}pt 남음)</span>`
    : '';

  const content = `
    <div style="display:flex;align-items:center;gap:4px;padding-top:34px;padding-bottom:4px">
      ${nodes}
    </div>
    <div style="font-family:${BODY};font-size:12px;color:${C.muted};font-weight:700;text-align:center;border-top:1px dashed ${C.line};padding-top:10px;margin-top:8px">
      1 타임 = 4 턴 · 완료 시 자동 전환 &nbsp;|&nbsp; 새벽: 호감도 ${DAWN_UNLOCK}%↑ 해금${remain}
    </div>`;
  return card('TIME', '타임 시스템', '#3a82c8', content);
}

// ── STATS section ──────────────────────────────────────────────────────
function statBar(def: typeof STAT_DEFS[0], pt: number): string {
  const ri = rIdx(pt);
  const max = pt >= 100;

  const rankLabels = max
    ? `<div style="position:absolute;left:0;top:22px;font-family:${BODY};font-size:9px;font-weight:800;color:${def.color};white-space:nowrap">${RANKS[def.label][5]}</div>`
    : RANKS[def.label].slice(0, 5).map((name, i) =>
        `<div style="position:absolute;left:${i * 20 + 10}%;top:22px;transform:translateX(-50%);font-family:${BODY};font-size:9px;font-weight:800;color:${pt >= i * 20 ? def.color : C.muted};white-space:nowrap">${name}</div>`
      ).join('');

  const ptDisplay = max
    ? 'MAX'
    : `${pt}<span style="font-family:${BODY};font-size:12px;color:${C.muted};font-weight:800"> pt</span>`;

  return `
<div style="margin-bottom:20px">
  <div style="display:flex;align-items:center;gap:9px;margin-bottom:6px">
    ${chip(def.color, def.label)}
    <span style="font-family:${BODY};font-weight:900;color:${C.ink};font-size:15px">${RANKS[def.label][ri]}</span>
    <span style="font-family:${BODY};font-weight:800;color:${C.muted};font-size:12px">R${ri + 1}</span>
    <span style="margin-left:auto;font-family:${DISPLAY};font-size:22px;color:${def.color};line-height:1">${ptDisplay}</span>
  </div>
  <div style="position:relative;padding-bottom:20px">
    ${bar(pt, def.color, 18, [20, 40, 60, 80])}
    ${rankLabels}
  </div>
  <div style="font-family:${BODY};font-size:12.5px;color:${C.muted};font-weight:600">↑ ${def.how}</div>
</div>`;
}

function statSection(stats: Record<string, number>): string {
  const bars = STAT_DEFS.map(d => statBar(d, stats[d.key])).join('');
  const content = `
    ${bars}
    <div style="font-family:${BODY};font-size:12px;color:${C.muted};font-weight:700;border-top:1px dashed ${C.line};padding-top:10px">
      0~100pt · 20pt당 1랭크 · 스탯 상승 시 스트레스도 ×2 동반 상승
    </div>`;
  return card('STATS', '스탯 시스템', C.red, content);
}

// ── STRESS section ─────────────────────────────────────────────────────
function stressSection(stress: number): string {
  const valColor = stress >= 80 ? C.red : '#f47b20';
  const content = `
    <div style="display:flex;align-items:center;margin-bottom:7px;font-family:${BODY}">
      <span style="font-weight:900;font-size:16px;color:${C.ink}">🔥 스트레스</span>
      <span style="margin-left:auto;font-family:${DISPLAY};font-size:24px;color:${valColor}">
        ${stress}<span style="font-family:${BODY};font-size:13px;color:${C.muted};font-weight:800"> / 100</span>
      </span>
    </div>
    ${bar(stress, '#f47b20', 20, [50, 80])}
    <div style="display:flex;justify-content:flex-end;font-family:${BODY};font-weight:800;font-size:11px;color:${C.red};margin-top:3px">100% ▶ 번아웃</div>
    <ul style="font-family:${BODY};font-size:13px;color:${C.ink};margin:10px 0 0;padding-left:18px;line-height:1.8">
      <li>스탯 증가량 <b>× 2 pt</b> 만큼 동반 상승</li>
      <li>100% 도달 시 <b style="color:${C.red}">번아웃 — 전체 스탯 −20pt</b> + 0%로 리셋</li>
      <li>휴식 · 놀이 · 미오와 긍정 상호작용으로 감소</li>
    </ul>`;
  return card('STRESS', '스트레스', '#f47b20', content);
}

// ── AFFECTION section ──────────────────────────────────────────────────
function affectionSection(affection: number): string {
  const dm = affection >= DM_UNLOCK;
  const dn = affection >= DAWN_UNLOCK;

  const box = (unlocked: boolean, inner: string) =>
    `<span style="flex:1 1 150px;min-width:150px;display:block;background:${unlocked ? '#e8f6ee' : '#f0ece0'};border:2px solid ${unlocked ? C.good : C.line};border-radius:9px;padding:7px 10px;font-family:${BODY};font-size:13px;font-weight:800;color:${unlocked ? C.good : C.muted}">${inner}</span>`;

  const dmRemain = !dn
    ? `<span style="color:${C.red}"> (${DAWN_UNLOCK - affection}pt 남음)</span>`
    : '';

  const content = `
    <div style="display:flex;align-items:center;margin-bottom:7px;font-family:${BODY}">
      <span style="font-weight:900;font-size:16px;color:${C.ink}">❤️ 호감도</span>
      <span style="margin-left:auto;font-family:${DISPLAY};font-size:24px;color:${C.red}">
        ${affection}<span style="font-family:${BODY};font-size:13px;color:${C.muted};font-weight:800"> / 100</span>
      </span>
    </div>
    <div style="position:relative;margin-top:22px">
      ${bar(affection, C.red, 20, [DM_UNLOCK, DAWN_UNLOCK])}
      <div style="position:absolute;left:${DM_UNLOCK}%;top:-18px;transform:translateX(-50%);font-family:${BODY};font-size:10px;font-weight:800;color:${dm ? C.good : C.muted};white-space:nowrap">${dm ? '✓' : '·'} ${DM_UNLOCK}%</div>
      <div style="position:absolute;left:${DAWN_UNLOCK}%;top:-18px;transform:translateX(-50%);font-family:${BODY};font-size:10px;font-weight:800;color:${dn ? C.good : C.muted};white-space:nowrap">${dn ? '✓' : '·'} ${DAWN_UNLOCK}%</div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
      ${box(dm, `${dm ? '🔓' : '🔒'} 50% · 선디엠<div style="font-size:11px;font-weight:600;color:${C.muted};margin-top:2px">미오가 먼저 DM 전송</div>`)}
      ${box(dn, `${dn ? '🔓' : '🔒'} 70% · 새벽 해금${dmRemain}<div style="font-size:11px;font-weight:600;color:${C.muted};margin-top:2px">새벽 타임 · 옥상 개방</div>`)}
    </div>`;
  return card('AFFECTION', '호감도', C.red, content);
}

// ── WEATHER section ────────────────────────────────────────────────────
function weatherGuide(weather: string): string {
  const pos = ['맑음', '눈'].includes(weather);
  const neg = ['흐림', '비', '뇌우'].includes(weather);

  const posBorder = pos ? C.red : '#bfe3cb';
  const negBorder = neg ? C.red : '#cfd3da';

  const content = `
    <div style="display:flex;gap:14px;flex-wrap:wrap">
      <div style="flex:1 1 240px;min-width:240px;border:2px solid ${posBorder};border-radius:12px;padding:14px;background:${pos ? '#fdeae8' : '#eef8f0'};font-family:${BODY}">
        <div style="font-weight:900;font-size:16px;color:#2e9e5b">☀️ ❄️ 긍정 날씨</div>
        <div style="font-size:14px;color:${C.ink};font-weight:800;margin:8px 0 4px">맑음 / 눈</div>
        <div style="font-size:13px;color:${C.ink}">스탯 <b style="color:#2e9e5b">+2~3pt</b> · 스트레스 <b>×2pt</b></div>
        <div style="font-size:12px;color:${C.muted};margin-top:4px">미오 감정 긍정 편향</div>
      </div>
      <div style="flex:1 1 240px;min-width:240px;border:2px solid ${negBorder};border-radius:12px;padding:14px;background:${neg ? '#fdeae8' : '#f2f3f6'};font-family:${BODY}">
        <div style="font-weight:900;font-size:16px;color:#5b6470">☁️ 🌧️ ⛈️ 부정 날씨</div>
        <div style="font-size:14px;color:${C.ink};font-weight:800;margin:8px 0 4px">흐림 / 비 / 뇌우</div>
        <div style="font-size:13px;color:${C.ink}">스탯 <b>+1pt 고정</b> · 스트레스 <b style="color:${C.red}">+5pt 고정</b></div>
        <div style="font-size:12px;color:${C.muted};margin-top:4px">미오 감정 부정 편향</div>
      </div>
    </div>
    <div style="margin-top:12px;font-family:${BODY};font-size:13px;color:${C.ink};background:#eef1f6;border:2px solid ${C.line};border-radius:10px;padding:8px 12px;font-weight:700">
      🌧️ 장마 · 6/30 ~ 7/30 매일 비 고정 &nbsp;|&nbsp; 현재 날씨 <b style="color:${C.red}">${weather}</b>
    </div>`;
  return card('WEATHER', '날씨', '#3a82c8', content);
}

// ── EVENT JUDGE section ────────────────────────────────────────────────
function eventJudge(stats: Record<string, number>): string {
  const sum = stats.art + stats.social;
  const bonus = sum >= 200 ? '×2.0' : sum >= 150 ? '×1.5' : sum >= 100 ? '×1.25' : sum >= 50 ? '×1.1' : '×1.0';
  const colorOf = (key: string) => STAT_DEFS.find(d => d.key === key)!.color;
  const sub = (t: string) => `<div style="font-family:${DISPLAY};font-size:16px;color:${C.ink};margin:4px 0 6px">${t}</div>`;

  const details = [
    {
      title: '📚 시험 — 커트라인 (학업 기준)',
      body:  '1학기 중간 20pt↑ · 1학기 기말 40pt↑ · 2학기 중간 60pt↑ · 2학기 기말 80pt↑ · 3학기 기말 100pt',
      note:  '커트 미달 = FAIL → 미오 부정감정 · 진로 압박↑ · 스트레스 +20%',
    },
    {
      title: '💪 체육대회 (06/09) — 체력 랭크 = 등수',
      body:  '100pt 우승 / 80pt↑ 은상 / 60pt↑ 동상 / 40pt↑ 하위권 / 20pt 미만 꼴지',
    },
    {
      title: '🎭 문화제 (09/14~15) — 예술 + 사교 합산',
      body:  '50~99: ×1.1 / 100~149: ×1.25 / 150~199: ×1.5 / 200: ×2.0 (호감도 증가량 배율)',
    },
    {
      title: '🚌 수학여행 (10/23~25) — 재주 스탯 기준',
      lines: [
        '0~19 — 대화X · 잠만 잠 (스마트폰 제출)',
        '20~39 — 디엠 가능 (스마트폰 훔쳐옴)',
        '40~59 — 통화 가능 (룸메이트 몰래 화장실)',
        '60~79 — 미오 방에서 만남 (방 탈출)',
        '80~99 — 숙소 탈출',
        '100 — 음주가무',
      ],
    },
    {
      title: '🎓 졸업식 (03/30) — 누적 스탯·호감도·이벤트 결과 종합 → 엔딩 분기',
      lines: [
        '모든 시험 PASS + 사교 MAX — ⓤ와 같은 대학 진학 성공',
        '예술 MAX — 예체능 관련 대학 진학',
        '체력 MAX + 재주 MAX — 운동선수 진로',
        '학업 MAX — 명문대 진학',
        '기타 스탯·이벤트 조합에 따라 다양한 엔딩 분기 존재',
      ],
    },
  ] as const;

  const detailsHtml = details.map((r, i, arr) => {
    const bodyHtml = 'lines' in r
      ? `<div style="font-family:${BODY};font-size:12px;color:${C.ink};line-height:1.8">${r.lines.map(l => `<div>${l}</div>`).join('')}</div>`
      : `<div style="font-family:${BODY};font-size:12px;color:${C.ink};line-height:1.7">${r.body}</div>`;
    const noteHtml = 'note' in r
      ? `<div style="font-family:${BODY};font-size:11.5px;color:${C.red};font-weight:700;margin-top:3px">${r.note}</div>`
      : '';
    return `<div style="margin-bottom:${i === arr.length - 1 ? 0 : 10}px;padding:8px 10px;background:#faf8f2;border:1.5px solid ${C.line};border-radius:8px">
      <div style="font-family:${BODY};font-weight:900;font-size:12.5px;color:${C.ink};margin-bottom:4px">${r.title}</div>
      ${bodyHtml}${noteHtml}
    </div>`;
  }).join('');

  const content = `
    ${sub('📚 시험 · 학업')}
    ${chip(colorOf('study'), `학업 ${stats.study}pt`)}
    ${gradeScale(colorOf('study'), [
      { at: 20, label: '1학기 중간' }, { at: 40, label: '1학기 기말' },
      { at: 60, label: '2학기 중간' }, { at: 80, label: '2학기 기말' },
      { at: 100, label: '3학기 기말' },
    ], stats.study)}

    ${sub('💪 체육대회 · 체력')}
    ${chip(colorOf('fitness'), `체력 ${stats.fitness}pt`)}
    ${gradeScale(colorOf('fitness'), [
      { at: 40, label: '하위권' }, { at: 60, label: '동상' },
      { at: 80, label: '은상' },   { at: 100, label: '우승' },
    ], stats.fitness)}

    <div style="height:1px;background:${C.line};margin:12px 0 16px"></div>

    ${sub('🎭 문화제 · 예술 + 사교')}
    <div style="display:flex;gap:8px;margin-bottom:4px">
      ${chip(colorOf('art'),    `예술 ${stats.art}pt`)}
      ${chip(colorOf('social'), `사교 ${stats.social}pt`)}
    </div>
    ${gradeScale(colorOf('art'),    [{ at: 50, label: '예술 50' }, { at: 100, label: '예술 100' }], stats.art)}
    ${gradeScale(colorOf('social'), [{ at: 50, label: '사교 50' }, { at: 100, label: '사교 100' }], stats.social)}
    <div style="font-family:${BODY};font-size:13px;color:${C.ink};background:#f3ecfb;border:2px solid #d9c4f2;border-radius:10px;padding:8px 12px;margin-bottom:18px">
      예술 + 사교 합산 <b>${sum}</b> → 호감도 보너스 <b style="color:#9340d4">${bonus}</b>
      <span style="color:${C.muted}">&nbsp;(50:×1.1 / 100:×1.25 / 150:×1.5 / 200:×2.0)</span>
    </div>

    ${sub('🚌 수학여행 · 재주')}
    ${chip(colorOf('skill'), `재주 ${stats.skill}pt`)}
    ${gradeScale(colorOf('skill'), [
      { at: 20, label: '디엠 가능' }, { at: 40, label: '통화 가능' },
      { at: 60, label: '방에서 만남' }, { at: 80, label: '숙소 탈출' },
      { at: 100, label: '음주가무' },
    ], stats.skill)}

    <div style="margin-top:20px;border-top:2px solid ${C.line};padding-top:14px">
      <div style="font-family:${DISPLAY};font-size:14px;color:${C.ink};margin-bottom:10px">📋 판정 상세</div>
      ${detailsHtml}
    </div>`;
  return card('JUDGE', '이벤트별 판정', '#9340d4', content);
}

// ── CLUB section ───────────────────────────────────────────────────────
function clubGuide(currentClub: string): string {
  const sports  = ['야구','축구','농구','배구','테니스','배드민턴','탁구','수영','육상','검도','유도','궁도','체조'];
  const culture = ['취주악','합창','미술','사진','문예','연극','애니연구','요리','원예','PC','과학','방송','신문','다도','서예'];

  const tag = (t: string) => {
    const active = currentClub === t;
    return `<span style="display:inline-block;background:${active ? '#ffe4e1' : '#fff'};border:1.5px solid ${active ? C.red : C.line};border-radius:6px;padding:2px 8px;margin:0 5px 5px 0;font-family:${BODY};font-weight:700;font-size:12px;color:${active ? C.red : C.ink}">${t}</span>`;
  };

  const content = `
    <div style="font-family:${BODY};margin-bottom:14px">
      <span style="font-weight:900;color:${C.ink};font-size:15px">현재 : </span>
      ${chip('#2e9e5b', currentClub, true)}
    </div>
    <div style="font-family:${BODY};font-weight:900;color:#9340d4;font-size:13px;margin-bottom:6px">🎨 문화부 (15)</div>
    <div style="margin-bottom:12px">${culture.map(tag).join('')}</div>
    <div style="font-family:${BODY};font-weight:900;color:#f47b20;font-size:13px;margin-bottom:6px">💪 운동부 (13)</div>
    <div style="margin-bottom:12px">${sports.map(tag).join('')}</div>
    <div style="font-family:${BODY};font-size:12.5px;color:${C.muted};font-weight:700;border-top:1px dashed ${C.line};padding-top:10px">
      가입 시 <b style="color:${C.ink}">저녁 타임에 동아리 활동 추가</b> · 관련 스탯(체력/예술) 상승 가능
    </div>`;
  return card('CLUB', '동아리 시스템', '#2e9e5b', content);
}

// ── DM section ─────────────────────────────────────────────────────────
function dmGuide(affection: number): string {
  const unlocked = affection >= DM_UNLOCK;
  const content = `
    <div style="font-family:${BODY};font-size:13.5px;color:${C.ink};line-height:1.8">
      <div><b>!디엠 내용</b> 입력 → 미오에게 메시지 전송</div>
      <div><b>!디엠 {스탬프코드}</b> → 스탬프 전송</div>
      <div style="color:${C.muted};margin-top:4px">angry · lol · shy · thumbsup · ignore · heart · pout</div>
      <div style="color:${C.muted};margin-top:6px">읽씹 여부는 미오의 성격·감정·호감도로 판정</div>
    </div>
    <div style="margin-top:14px;padding:10px 14px;border-radius:10px;font-family:${BODY};font-weight:800;background:${unlocked ? '#e8f6ee' : '#f0ece0'};border:2px solid ${unlocked ? C.good : C.line};color:${unlocked ? C.good : C.muted}">
      ${unlocked ? '🔓 선디엠 해금됨' : '🔒 선디엠 잠김'}
      <div style="font-size:12px;font-weight:600;color:${C.muted};margin-top:3px">
        호감도 ${DM_UNLOCK}%↑ + 밤·새벽 타임 + lonely · conflicted · nostalgic 감정 시 미오가 먼저 연락
      </div>
    </div>`;
  return card('DM', 'DM 시스템', C.red, content);
}

// ── TIMELINE section ───────────────────────────────────────────────────
function timeline(date: string): string {
  const COLS = [56, 152, 248, 344];
  const ROWS = [80, 190, 300];
  const pos = (i: number) => {
    const row = Math.floor(i / 4);
    let col = i % 4;
    if (row % 2 === 1) col = 3 - col;
    return { x: COLS[col], y: ROWS[row] };
  };

  const A = pos(HERE_INDEX), B = pos(HERE_INDEX + 1);
  const hx = A.x + (B.x - A.x) * HERE_FRAC;
  const hy = A.y + (B.y - A.y) * HERE_FRAC;

  const eventNodes = EVENTS.map((e, i) => {
    const { x, y } = pos(i);
    const parts = e.name.split(' ');
    const yr = e.year !== 2026 ? "'27 " : '';
    const textContent = parts.length > 1
      ? `<tspan x="${x}">${parts[0]}</tspan><tspan x="${x}" dy="13">${parts.slice(1).join(' ')}</tspan>`
      : e.name;
    const textY = parts.length > 1 ? y + 26 : y + 27;
    return `<g>
      <text x="${x}" y="${y - 19}" text-anchor="middle" style="font-family:${BODY};font-weight:700;font-size:10px;fill:${C.muted}">${yr}${e.date}</text>
      <circle cx="${x}" cy="${y}" r="12.5" fill="${e.color}" stroke="${C.ink}" stroke-width="2.5"/>
      <text x="${x}" y="${textY}" text-anchor="middle" style="font-family:${BODY};font-weight:900;font-size:11.5px;fill:${C.ink}">${textContent}</text>
    </g>`;
  }).join('');

  const content = `
    <div style="display:flex;align-items:center;margin-bottom:12px">
      <span style="font-family:${DISPLAY};font-size:13px;color:${C.muted}">📅</span>
      <span style="font-family:${DISPLAY};font-size:16px;color:${C.ink};margin-left:6px">${date}</span>
    </div>
    <svg viewBox="0 0 400 360" style="width:100%;max-width:560px;display:block;margin:0 auto">
      <path d="M56 80 H344 C384 80 384 190 344 190 H56 C16 190 16 300 56 300 H344"
        fill="none" stroke="${C.line}" stroke-width="4" stroke-linecap="round"/>
      <polygon points="194,74 207,80 194,86" fill="${C.muted}"/>
      <polygon points="207,184 194,190 207,196" fill="${C.muted}"/>
      <polygon points="194,294 207,300 194,306" fill="${C.muted}"/>
      ${eventNodes}
      <text x="${hx}" y="${hy - 28}" text-anchor="middle" style="font-family:${DISPLAY};font-size:13px;fill:${C.red}">HERE</text>
      <polygon points="${hx - 6},${hy - 21} ${hx + 6},${hy - 21} ${hx},${hy - 13}" fill="${C.red}"/>
      <circle cx="${hx}" cy="${hy}" r="7" fill="${C.red}" stroke="#fff" stroke-width="2.5"/>
      <circle cx="${hx}" cy="${hy}" r="10.5" fill="none" stroke="${C.red}" stroke-width="1.5" stroke-dasharray="3 3"/>
    </svg>
    <div style="text-align:center;font-family:${BODY};font-size:12px;color:${C.muted};font-weight:700;margin-top:6px">
      2026.3 입학 &nbsp;→&nbsp; 2027.3 졸업 · 빨간 점이 현재 위치
    </div>`;
  return card('TIMELINE', '주요 이벤트', '#534ab7', content);
}

// ── Handler ────────────────────────────────────────────────────────────
export default function handler(req: IncomingMessage, res: ServerResponse) {
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

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>청춘회생록 · 시스템 가이드</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Gothic+A1:wght@400;500;700;800;900&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; padding: 0; }
    b { font-weight: 900; }
  </style>
</head>
<body style="background:${C.bg};min-height:100vh;padding:22px;font-family:${BODY}">
  <div style="max-width:980px;margin:0 auto;display:flex;flex-direction:column;gap:18px">

    <div style="text-align:center;padding:8px 0 4px">
      <h1 style="margin:0;font-family:${DISPLAY};font-weight:900;font-size:clamp(30px,8.5vw,56px);color:#fff;-webkit-text-stroke:3px ${C.ink};paint-order:stroke fill;text-shadow:5px 6px 0 ${C.redDark};line-height:1.02;letter-spacing:-0.5px;word-break:keep-all">
        GUIDE<span style="color:${C.red};-webkit-text-stroke:3px ${C.ink}">&amp;</span>PROGRESS
      </h1>
      <div style="font-family:${BODY};font-weight:800;color:${C.muted};font-size:13px;margin-top:6px">
        청춘회생록 · 플레이어 시스템 가이드
      </div>
    </div>

    ${timeSystem(timeSlot, affection)}
    ${statSection(stats)}

    <div style="display:flex;gap:18px;flex-wrap:wrap">
      <div style="flex:1 1 340px">${stressSection(stress)}</div>
      <div style="flex:1 1 340px">${affectionSection(affection)}</div>
    </div>

    ${weatherGuide(weather)}
    ${eventJudge(stats)}

    <div style="display:flex;gap:18px;flex-wrap:wrap">
      <div style="flex:1 1 340px">${clubGuide(club)}</div>
      <div style="flex:1 1 340px">${dmGuide(affection)}</div>
    </div>

    ${timeline(date)}

    <div style="text-align:center;font-family:${BODY};color:${C.muted};font-size:12px;padding:8px 0 4px">
      청춘회생록 · 시스템 가이드 + 진행도
    </div>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.statusCode = 200;
  res.end(html);
}
