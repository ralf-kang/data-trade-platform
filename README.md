# 폼 제너레이터 (Web Report Editor)

이 프로젝트는 기관/기업 내에서 복잡한 양식(설문, 동의서, 서명, 파일 업로드 등 23종의 컴포넌트)을 동적으로 생성하고, 외부 사용자에게 URL/QR/API 형태로 배포하여 데이터를 수집하는 **지능형 동적 폼 빌더 플랫폼**입니다.

## 🚀 주요 기능 (Key Features)

### 1. 최고 관리자 (Super Admin) 워크스페이스
- **기본 접속 계정**: `ralfkang@ktl.re.kr` / `test1234` / MFA: `111111`
- **조직 및 하위 관리자 제어 (`/super-admin/users`)**
  - 하위 관리자 초대 (이메일 발송)
  - 등록된 하위 관리자 리스트 조회
  - 단일 팝업 모달을 통한 사용자 권한 승급(SUPER_ADMIN 전환), 비밀번호 초기화, 계정 정지 및 영구 삭제 처리 기능
- **시스템 환경 설정 (`/super-admin/settings`)**
  - SMTP 메일 서버 연동 (초대 메일, 비밀번호 찾기 등 발송용)
  - Claude API OAuth 2.0 연동 (AI 자동 양식 생성용 자격 증명)
- **전체 행동 감사 (Audit Logs)**
  - 플랫폼 내에서 이루어지는 모든 사용자의 행동 이력 조회

### 2. 일반 관리자 (Admin) 워크스페이스
- **대시보드 메인 (`/admin/dashboard`)**
  - 생성한 폼 개수, 누적 제출 수, 일일 방문자 트래픽 시각화 차트
- **내 양식 관리 및 폼 빌더 (`/admin/templates`, `/admin/builder`)**
  - 드래그 앤 드롭 기반의 동적 폼 생성 (단답형, 장문형, 서명, 지도 등 23개 컴포넌트 지원)
  - 기존 양식을 템플릿화 하거나 부분 복사(Partial Clone) 가능
  - 모바일/PC 반응형 실시간 프리뷰 기능 지원
- **배포 URL 및 접속 관리 (`/admin/templates/urls`)**
  - 양식별 배포 URL 생성 및 QR 코드 자동 발급
  - **대용량 트래픽 대응용 다중 API 자동 발급 (Load Balanced Endpoints)** 기능 제공
  - 클릭 한 번으로 양식 제출 마감(Closed) 제어
- **제출 데이터 뷰어 (`/admin/data/[formId]`)**
  - 수집된 데이터의 실시간 테이블 뷰
  - 이상치 자동 감지 및 관리자 수동 재가공(수정) 에디터 내장

### 3. 사용자(User) 응답 화면
- **외부 응답 페이지 (`/q/[formId]`)**
  - 배포된 URL/QR을 통해 일반 사용자가 응답을 제출할 수 있는 반응형 렌더링 화면
  - **f-999 테스트 폼**: 23종의 모든 컴포넌트가 렌더링되는 종합 테스트 화면 확인 가능

---

## 🛠️ 기술 스택 (Tech Stack)
- **프레임워크**: Next.js 16 (App Router, Route Handlers)
- **언어**: TypeScript, React
- **스타일링**: Tailwind CSS
- **아이콘**: Lucide React
- **정형 데이터베이스**: PostgreSQL (Prisma ORM) — 관리자 계정, 폼 배포/운영 메타데이터(상태·소유자·조회수·제출수), 감사 로그, 양식 공유 워크플로우
- **비정형 데이터베이스**: Elasticsearch — 폼마다 계속 바뀌는 필드 구성(23종 컴포넌트), 폼 필드 구성에 따라 스키마가 확장되는 제출 데이터
- **인프라**: Docker / docker-compose 기반 3-tier(web·WAS·DB) 구성

---

## 🏗️ 아키텍처 (Architecture)

### 정형 / 비정형 데이터베이스 분리
| 구분 | 저장소 | 대상 데이터 | 이유 |
|---|---|---|---|
| 정형 | PostgreSQL (`prisma/schema.prisma`) | 관리자 계정, 폼 운영 메타데이터(`FormRegistry`: 상태/소유자/URL/조회·제출 카운터), 감사 로그, 공유 요청 | 스키마가 고정적이고 관계(소유자, 요청자 등) 조회가 중요한 데이터 |
| 비정형 | Elasticsearch (`src/lib/elasticsearch.ts`) | 폼 필드 구성(`webreport-form-templates`), 제출 데이터(`webreport-submissions`) | 폼마다 필드 구성이 다르고 계속 확장되며, 제출 데이터의 컬럼 수/타입이 폼 필드에 종속적으로 늘어남 |

두 저장소는 `FormRegistry.id` (예: `f-101`)를 공용 키로 공유해 서로 조인된다. 실제 CRUD는 `src/lib/services/*` 서비스 계층 → `src/app/api/**/route.ts` Route Handler를 거쳐 프론트엔드에 `fetch`로 노출된다.

### 3-tier Docker 구성
```
[nginx: web]  →  [Next.js: WAS]  →  [PostgreSQL: 정형 DB]
   (80 포트)      (Route Handlers)    [Elasticsearch: 비정형 DB]
```
- `Dockerfile`: 멀티스테이지 빌드(`deps → builder → migrator/runner`). `next.config.ts`의 `output: "standalone"`로 런타임 이미지를 경량화.
- `docker-compose.yml`: `web`(nginx 리버스 프록시) · `app`(WAS) · `postgres` · `elasticsearch` · `migrate`(1회성 Prisma 마이그레이션) 서비스로 분리.
- `docker/nginx/nginx.conf`: 외부에 노출되는 유일한 진입점. `/_next/static/`은 장기 캐시, 나머지는 WAS로 프록시.

### 로컬 실행
```bash
cp .env.example .env
docker compose up --build
# 최초 1회, 데모 데이터 적재 (mock으로 있던 데이터를 Postgres/Elasticsearch에 시드)
docker compose run --rm seed
```
브라우저에서 `http://localhost` 접속.

Docker 없이 로컬 Postgres/Elasticsearch를 직접 띄워 개발하려면:
```bash
npm install
npm run db:migrate      # Postgres 스키마 적용
npm run db:seed         # 데모 데이터 적재
npm run dev
```

---

## 🧪 테스트 가이드 (How to Test)

### 종합 컴포넌트 테스트 (f-999)
본 프로젝트에는 23종의 모든 폼 컴포넌트가 하나씩 적용된 `f-999 (종합 컴포넌트 테스트 양식지)`가 내장되어 있습니다.
- **빌더 렌더링 테스트**: `/admin/builder?id=f-999` 로 접속하여 각 컴포넌트의 설정 UI와 우측 프리뷰를 확인하세요.
- **응답 화면 렌더링 테스트**: `/q/f-999` 로 접속하여 일반 사용자 관점에서 어떻게 보여지는지 테스트하세요.
- **데이터 조회/페이징 테스트**: `/admin/data/f-999` 메뉴로 진입하면 시드 스크립트로 적재된 샘플 제출 데이터가 테이블로 표시됩니다(페이지당 20건, 검색/CSV 추출 지원). 실 운영 데이터는 `/q/f-999`를 통한 실제 제출로 계속 쌓입니다.

---

## ⚖️ 데이터베이스제작자 권리 보호 (저작권법 제4장)

수집되는 폼 필드 구성·제출 데이터는 「저작권법」 제2조 제19호의 "데이터베이스"에 해당하고,
이를 구축·운영하는 주체는 같은 조 제20호의 "데이터베이스제작자"로서 제93조의 권리
(무단 복제·배포·전송 금지, 반복적/체계적 상당 부분 추출 금지)를 가집니다. 아래는 관련
조항과 그에 대응하는 구현을 정리한 것입니다.

| 조항 | 요지 | 구현 |
|---|---|---|
| 제91~92조 (보호 대상) | 데이터베이스는 보호 대상, 컴퓨터프로그램 자체는 제외 | 폼 필드/제출 데이터(콘텐츠)만 보호 대상으로 취급하고, 이를 다루는 코드는 별개로 취급 |
| 제93조 (제작자의 권리) | 무단 복제·배포·전송 금지, 반복적·체계적 상당 부분 추출도 금지 | ① 모든 관리자 API에 인증 요구(`src/lib/auth.ts requireAdmin`) ② 목록 조회 API 요청 빈도 제한(`src/lib/rateLimit.ts`, 분당 120회) ③ 서버가 단일 응답으로 내려줄 수 있는 최대 건수 상한(`MAX_PAGE_SIZE=200`, `src/lib/elasticsearch.ts`) ④ 대량 추출(CSV) 전용 엔드포인트 분리 + 더 엄격한 속도 제한(5분당 5회) + 전량 상한(5,000건) — `src/app/api/forms/[formId]/submissions/export/route.ts` ⑤ `robots.txt`로 관리자/API 경로 크롤링 명시적 금지 |
| 제95조 (보호기간) | 제작완료일로부터 5년, 상당한 투자 갱신 시 그 부분은 갱신일로부터 재기산 | `DatabaseRegistration`/`DatabaseUpdateLog` 모델(정형, Postgres)이 제작완료일·갱신이력을 구조화 기록. 보호기간 만료일은 `src/lib/services/databaseRightsService.ts`에서 최근 갱신일 + 5년으로 자동 계산 |
| 명시적 고지 | 권리자·보호 범위를 이용자에게 공지 | `/legal/database-rights` 공개 페이지(로그인 화면·관리자 사이드바에서 링크) + `GET /api/database-registration` 공개 API |
| 감사·추적 | 침해 발생 시 소명 근거 확보 | 모든 대량 추출은 `AuditLog`에 `DATA_EXPORT` 액션으로 기록(요청자, 건수, 절단 여부 포함) |

**알려진 한계**: 레이트 리미터는 현재 단일 프로세스 메모리 기반이라, WAS를 다중 레플리카로
수평 확장하면 인스턴스별로 한도가 분리되어 우회 가능합니다. 운영 확장 시 Redis 등
공유 저장소 기반 리미터로 교체가 필요합니다.

---

## 🔐 권한 체계 (RBAC)

| 기능 | 일반 관리자(ADMIN) | 슈퍼관리자(SUPER_ADMIN) |
|---|---|---|
| 양식지 생성 | ✅ (본인 소유) | ✅ |
| 양식지 편집/삭제/기간설정 | 본인 소유만 | 전체 |
| 제출 데이터 조회/수정 | **본인 소유 + 공유 승인받은 것만** | 전체 |
| 제출 데이터 CSV 대량 추출 | 조회 권한 + 슈퍼관리자가 허용한 경우만 | ✅ (항상) |
| 양식지 소유권 이전 | ❌ | ✅ |
| 관리자 계정 속성 수정(이름/이메일/소속) | ❌ | ✅ |
| 관리자 승격/강등 (ADMIN ↔ SUPER_ADMIN) | ❌ | ✅ |
| 관리자 계정 정지(제재)/삭제 | ❌ | ✅ (삭제 시 소유 양식지 위임 강제) |
| 관리자별 대량 추출 허용/제한 | ❌ | ✅ |

- **제출 데이터 접근 판정**: `canAccessFormData()` (`src/lib/services/formService.ts`) — 소유자 본인, 승인된 공유(`ShareRequest.status = APPROVED`), 슈퍼관리자만 통과. 목록/상세/수정/추출 모든 엔드포인트에서 재검증됩니다.
- **공유 권한 가시성**: 내가 받은 권한은 `/admin/data`(통합 조회) 카드의 `내 양식`/`공유받음`/`조회 권한 없음` 배지로, 내가 남에게 준 권한은 `/admin/templates` 하단 "내가 부여한 제출 데이터 조회 권한" 목록으로 확인합니다.
- **계정 삭제 시 소유권 처리**: 삭제 API는 `reassignOwnerId`를 필수로 요구해, 소유 양식지를 다른 관리자에게 위임하거나 슈퍼관리자 자신에게 귀속시킨 뒤에만 삭제됩니다 (임자 없는 양식지 방지).
- **이상치 대응**: 공개 폼 제출 시 필수 미입력·정규식 불일치·숫자 형식 오류를 감지해 감사 로그(`DATA_ANOMALY`)와 소유자 인앱 알림(사이드바 종 아이콘)으로 보고하며, 관리자는 데이터 뷰어에서 직접 수정할 수 있습니다.

---

## 🏢 온프레미스 / 오프라인(망분리) 환경 대응

외부 인터넷이 차단된 환경에서도 동작하도록 다음을 확인·조치했습니다.

| 항목 | 상태 |
|---|---|
| 런타임 외부 API 호출 | **없음** — 모든 `fetch`가 상대경로(자체 서버) |
| 외부 CDN `<script>`/`<link>` | **없음** |
| 웹폰트 | `next/font/google`(빌드 시 Google Fonts 다운로드 필요)를 **제거**하고 OS 시스템 폰트 스택으로 교체 |
| QR 코드 생성 | `qrcode` 패키지로 브라우저 캔버스에 로컬 렌더링 (외부 QR 생성 서비스 미사용) |
| 지도(주소) 컴포넌트 | 현재 안내 문구만 표시하며 실제 지도 SDK를 로드하지 않음 — 향후 실제 지도 연동 시 사내 지도 서버 필요 |
| 랜딩 페이지 | create-next-app 보일러플레이트(vercel.com/nextjs.org 링크)를 자체 로그인 안내 화면으로 교체 |

**남은 사전 준비물** (망분리 환경에 반입해야 하는 것):
- Docker 이미지: `node:22-alpine`, `postgres:16-alpine`, `nginx:alpine`, `docker.elastic.co/elasticsearch/elasticsearch:9.1.3` → 사내 레지스트리에 미리 push
- `npm ci`용 의존성: 사내 npm 미러(Nexus/Verdaccio) 또는 `node_modules`를 포함한 이미지 사전 빌드

---

## ⚠️ 알려진 한계 (Known Limitations)
- **인증**: 로그인은 여전히 `adminRole`/`adminEmail` 쿠키 기반의 임시 구현입니다(`src/lib/auth.ts` 참고). 운영 전환 전 비밀번호 해시 검증 + 정식 세션(JWT/DB 세션) 기반 인증으로 교체가 필요합니다. 현재는 쿠키만으로 신원이 결정되므로 **권한 체계 자체가 최종 방어선이 될 수 없습니다.**
- **레이트 리미터**: 인메모리 방식이라 WAS를 다중 레플리카로 확장하면 인스턴스별로 한도가 분리됩니다. Redis 등 공유 저장소 기반으로 교체 필요.
- **SMTP / Claude OAuth 설정**: `/super-admin/settings`의 SMTP·OAuth 입력값은 아직 저장되지 않는 목업입니다 (같은 화면의 "운영 서버 공개 기본 URL"만 실제 DB에 저장/적용됩니다).
- **슈퍼 어드민 대시보드**: `/super-admin`의 B2B/CRM 통계 위젯은 아직 Mock 상태입니다.
- **AI 자동 생성기**: `AiAutoGenerator` 컴포넌트는 여전히 목업 응답을 반환합니다(코드 내 TODO 참고).
- **외부 연계 API 발급 모달**: 표시되는 엔드포인트/API Key는 아직 실제 발급되지 않는 예시 값입니다.

## 🚀 향후 고도화 목표 (Future Roadmap)
- **인증 고도화**: 비밀번호 해시 + 정식 세션 기반 인증, 관리자 초대(SMTP) 실제 연동.
- **AI 폼 자동 생성 고도화**: Claude API를 연동하여 HWPX, Word, Excel 파일을 업로드 시 즉각적으로 Web Form UI로 변환하는 AI Agent 도입.
- **Export Engine**: 수집된 데이터를 원본 양식(HWPX, PDF 등)의 지정된 위치에 매핑하여 병합(Merge) 추출하는 엔진 적용.
