# Goo9 캐챗 가변 스탯 카드 시스템

페5 톤 + 학원물 + 종이/노트 질감의 가변 이미지 API.
Vercel Edge Function + @vercel/og.

## 🚀 배포 방법

### 1. Vercel 계정 + CLI

```bash
npm i -g vercel
vercel login
```

### 2. 이 폴더로 이동 → 배포

```bash
cd vercel-card
npm install
vercel --prod
```

배포되면 URL 받음 (예: `https://goo9-card.vercel.app`)

### 3. (선택) 베이스 일러스트 호스팅

Portrait API는 외부 이미지 URL을 `img` 파라미터로 받음.
- 깃허브 raw 링크 (너 Loop 챗봇처럼)
- Cloudinary
- Vercel `public/characters/` 폴더에 올리고 `https://너프로젝트.vercel.app/characters/aira_happy.png` 식으로 접근

---

## 🎴 API 명세

### `/api/card` — 스탯 카드 (캐릭터 무관)

**파라미터:**
| 키 | 타입 | 설명 |
|---|---|---|
| `char` | string | 캐릭터 이름 (예: `아이라`) |
| `user` | string | ⓤ 이름 (기본 `P`) |
| `study` | int | 학업 0~100 |
| `power` | int | 체력 0~100 |
| `art` | int | 예술 0~100 |
| `social` | int | 사교 0~100 |
| `craft` | int | 재주 0~100 |
| `affection` | int | 호감도 0~100 |
| `emotion` | string | `depressed/anxious/shocked/happy/joy/expect/moved/flutter/love` |
| `event` | string | 가까운 이벤트명 |
| `dday` | string | D-day 숫자 |
| `thought` | string | ⓒ 속마음 한 줄 |

**예시 URL:**
```
https://goo9-card.vercel.app/api/card?char=아이라&study=47&power=23&art=68&social=51&craft=12&affection=34&emotion=flutter&event=체육대회&dday=15&thought=오늘은 좀 어색하네
```

### `/api/portrait` — 캐릭터 일러스트 + 감정 오버레이

**파라미터:**
| 키 | 타입 | 설명 |
|---|---|---|
| `img` | URL | 베이스 일러스트 URL (필수) |
| `char` | string | 캐릭터 이름 |
| `emotion` | string | 감정 (card와 동일) |
| `weather` | string | `sunny/cloudy/rain/storm/snow` |
| `date` | string | 날짜 표기 |
| `time` | string | 시간 표기 |
| `location` | string | 위치 |
| `turn` | int | 턴 카운터 |

**예시:**
```
https://goo9-card.vercel.app/api/portrait?img=https://raw.githubusercontent.com/recorder001/.../aira_happy.png&char=아이라&emotion=flutter&weather=sunny&date=05/12&time=14:30&location=교실&turn=42
```

---

## 🧩 캐챗 프롬프트 통합

기존 정보창 자리에 이 두 줄 박으면 끝:

```markdown
![](https://goo9-card.vercel.app/api/portrait?img={베이스URL}&char={이름}&emotion={감정}&weather={날씨}&date={날짜}&time={시간}&location={위치}&turn={n})

![](https://goo9-card.vercel.app/api/card?char={이름}&study={n}&power={n}&art={n}&social={n}&craft={n}&affection={n}&emotion={감정}&event={이벤트}&dday={n}&thought={속마음})
```

AI한테 알려줄 룰:
- 매 응답마다 두 URL을 새로 작성
- 점수·이벤트·감정 등 상태 변경분 반영
- 한국어 파라미터 값은 자동으로 URL 인코딩됨 (브라우저가 처리)

---

## 🎨 디자인 커스텀

`api/card.js`에서 만질 곳:
- `STAT_META` — 스탯별 색상 (페5 빨강·검정 + 학원물 톤)
- `RANK_NAMES` — 랭크 명칭 (이미 너 정의대로)
- 배경: `#F5EFE0` (크림 종이) — 더 노트 느낌이면 `#FFF8DC`로 변경
- 액센트: `#C0392B` (페5 빨강) — 기본 톤

`api/portrait.js`에서 만질 곳:
- 하단 그라데이션 톤
- 감정 박스 위치/크기
- 페5 액센트 (우상단 빨간 사선)

---

## ⚡ 성능

- Edge Function 콜드스타트: ~50~200ms
- 응답 시간: ~50ms (캐싱 효과)
- 무료 티어: 100GB/월 대역폭, Edge 100k req/일

너 캐챗 정도면 무료티어로 평생 가도 됨.
