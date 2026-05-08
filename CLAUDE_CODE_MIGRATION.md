# Claude Code 마이그레이션 프롬프트

> 이 파일을 Claude Code에 통째로 던지고 작업 시작하면 됨.

---

## 🎯 프로젝트 목표

Goo9의 학원물 캐챗 시스템에 사용할 **가변 스탯 카드 + 캐릭터 포트레이트 이미지 API**를 Vercel에 배포하고 운영 가능한 상태로 만든다.

웹기반 캐챗(외부 이미지 마크다운 지원) 인터페이스에서 매 응답마다 AI가 URL만 새로 써서 박으면 → 서버가 실시간으로 베이스 일러스트 위에 텍스트·진행도바·감정 오버레이를 합성해서 PNG로 응답하는 구조.

## 🛠 기술 스택 (확정)

- **Vercel Edge Functions** (서버리스, ~50ms 응답)
- **@vercel/og** (Satori 기반 JSX→PNG 렌더러)
- 외부 호스팅 일러스트 (깃허브 raw / Cloudinary 등)
- 종이/노트 질감은 `transparenttextures.com` 패턴 활용

## 🎨 디자인 톤 (확정)

- **페르소나5 스타일**: 빨간 사선 액센트, 굵은 이탤릭 캐릭터명, 검은색 띠, RANK 라벨
- **학원물 따뜻한 톤**: 크림 베이지 배경 (#F5EFE0)
- **종이 질감 + 노트 재질**: 배경 텍스처, 속마음 박스 줄노트 패턴

색상 팔레트:
- 종이 베이스: `#F5EFE0`
- 페5 빨강: `#C0392B`
- 검정 액센트: `#1A1A1A`
- 노트 갈색 글자: `#5C4A3A`
- 형광펜 톤: `rgba(255,255,180,0.4)`

## 📁 현재 상태

`vercel-card/` 폴더에 초기 코드 셋 들어있음:

```
vercel-card/
├── api/
│   ├── card.js          ← 스탯 카드 API (페5+종이 톤으로 작성됨)
│   └── portrait.js      ← 캐릭터 일러스트 + 감정 오버레이 (작성됨)
├── public/
│   ├── characters/      ← (비어있음) 베이스 일러스트 넣을 곳
│   └── textures/        ← (비어있음) 로컬 텍스처 넣을 곳
├── package.json
├── vercel.json          ← Edge runtime 설정
└── README.md            ← 배포 가이드
```

코드는 메인 세션에서 짠 초안 상태. **테스트·배포·실전 보정은 아직 안 됐음.**

## 📋 작업 리스트 (우선순위 순)

### 1. 로컬 환경 세팅 + 빌드 검증
- `npm install` 으로 `@vercel/og` 설치
- `vercel dev` 로 로컬 서버 띄우기
- `/api/card?char=테스트&study=47&power=23&art=68&social=51&craft=12&affection=34&emotion=flutter&event=체육대회&dday=15&thought=오늘은 좀 어색하네` 호출해서 PNG 정상 출력 확인
- `/api/portrait?img={아무 PNG URL}&char=테스트&emotion=flutter&weather=sunny&date=05/12&time=14:30&location=교실&turn=42` 호출해서 PNG 정상 출력 확인

### 2. 한국어 폰트 처리 (이게 진짜 중요함)
- `@vercel/og`는 기본적으로 라틴 폰트만 들고 있음 → **한국어가 깨질 가능성 ↑**
- 해결: Edge runtime 환경에서 한국어 폰트 로드해야 함
  - Pretendard, Noto Sans KR, 또는 Goo9이 평소 쓰는 디자인 폰트 (사용자에게 물어볼 것)
  - `fetch()` 로 폰트 파일 받아서 `ImageResponse` 의 `fonts` 옵션에 박는 방식
  - 폰트 파일은 Vercel `public/fonts/` 에 배치하거나 외부 CDN 사용
- 한자(漢字)·이모지 호환성도 함께 검증

### 3. 디자인 보정
- 한국어 폰트 적용 후 레이아웃이 깨지면 padding·font-size·letter-spacing 재조정
- 이모지가 컬러로 안 나오면 Twemoji 또는 Noto Color Emoji 폰트 추가 로드
- 페5스러운 빨간 사선 액센트 위치·크기 시각적으로 확인 후 조정
- 5스탯 카드의 막대그래프가 0pt일 때도 깨지지 않는지 확인 (border 처리)
- 호감도가 100% 일 때 바가 컨테이너 밖으로 안 튀어나가는지

### 4. 에러 핸들링
- `img` 파라미터 없이 portrait API 호출됐을 때 fallback 이미지 로직 강화 (현재는 placeholder URL)
- 잘못된 emotion 값 들어왔을 때 default 처리 검증
- 점수에 음수·문자열 들어와도 0~100 범위로 clamp 되도록 추가

### 5. 캐싱 헤더 추가
- 같은 URL = 같은 이미지니까 `Cache-Control` 헤더로 CDN 캐싱 활성화
- 추천: `Cache-Control: public, max-age=31536000, immutable` (URL 파라미터로 버전 관리되는 셈)
- 단, 동일 응답이 다음 턴에 다른 점수로 호출될 가능성 있으니 max-age 좀 짧게 (예: 600초)

### 6. Vercel 배포
- `vercel login` (사용자가 직접)
- `vercel --prod` 로 첫 배포
- 받은 도메인 (예: `goo9-card.vercel.app`) 기록
- 양쪽 엔드포인트 production URL 로 다시 테스트

### 7. README 업데이트
- 실제 배포된 production URL 반영
- 한국어 폰트 처리 방법 추가
- 트러블슈팅 섹션 (이미지 안 뜰 때, URL 인코딩 이슈 등)

### 8. (선택) 추가 기능
- `?theme=dark` 같은 다크모드 옵션
- 캐릭터별 색상 팔레트 (`?palette=aira`)
- 점수 변화 시 시각적 강조 (`?delta=+3`)

## ⚠️ 주의사항

1. **한국어 폰트가 메인 이슈가 될 가능성 90%**. 이거 안 풀리면 다른 거 다 무의미함. 먼저 작은 한국어 텍스트 하나 띄우는 PoC부터 해보고 작업 진행
2. **Edge Function 메모리 제한 128MB** — 폰트 파일 용량 큰 거 (Pretendard 풀웨이트) 한꺼번에 로드하면 터질 수 있음. 필요한 굵기만 골라 쓸 것
3. **무료티어 한도** — 100GB/월 대역폭, Edge 100k req/일. 캐싱 안 걸면 빨리 소진될 수 있음
4. **로컬 `vercel dev` 와 production 환경이 다름** — Edge runtime은 Node.js 가 아니라서 일부 npm 모듈 못 씀. 로컬에서 되던 게 prod 에서 깨질 수 있음

## 🎯 완료 조건

- [ ] 로컬에서 한국어 포함된 PNG 정상 렌더링
- [ ] Vercel 배포 완료, production URL 작동
- [ ] 양쪽 API 모두 한국어·이모지·이미지 합성 정상
- [ ] 캐싱 헤더 적용
- [ ] README 최신화
- [ ] 사용자(Goo9)가 캐챗 프롬프트에 박을 수 있는 최종 URL 템플릿 정리

## 💬 사용자 컨텍스트

- 사용자는 Goo9, 한국 고3 (반말 OK)
- RTX 4060 노트북 + 데스크탑 환경 둘 다 있음
- Claude Code 헤비 유저, 깃허브 페이지 운영 중 (recorder001.github.io)
- 이 시스템은 학원물 캐챗 외에 Loop / Luminous / Lost Bright 𝄇 같은 다른 Goo9 Universe 챗봇에도 재활용 예정

## 🔗 참조

- @vercel/og 공식: https://vercel.com/docs/functions/og-image-generation
- Satori 폰트 처리: https://github.com/vercel/satori#fonts
- 한국어 폰트 적용 예시 검색해볼 것

---

작업 들어가면서 막히는 거 있으면 사용자한테 물어봐. 디자인 의견·폰트 선택·도메인명 같은 건 사용자가 정해야 함.

화이팅 ㄱㄱ
