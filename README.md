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
docker compose run --rm app npm run db:seed
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

## ⚠️ 알려진 한계 (Known Limitations)
- **인증**: 로그인은 여전히 `adminRole`/`adminEmail` 쿠키 기반의 임시 구현입니다(`src/lib/auth.ts` 참고). 운영 전환 전 비밀번호 해시 검증 + 정식 세션(JWT/DB 세션) 기반 인증으로 교체가 필요합니다.
- **슈퍼 어드민 콘솔 일부**: `/super-admin/users`, `/super-admin/settings`, `/super-admin` 대시보드의 B2B/CRM 통계 위젯은 아직 Mock 상태입니다. 이번 작업은 "양식지·제출 데이터"의 정형/비정형 분리에 집중했습니다.
- **AI 자동 생성기**: `AiAutoGenerator` 컴포넌트는 여전히 목업 응답을 반환합니다(코드 내 TODO 참고).

## 🚀 향후 고도화 목표 (Future Roadmap)
- **인증 고도화**: 비밀번호 해시 + 정식 세션 기반 인증, 슈퍼 어드민 하위 관리자 관리 화면의 실제 API 연동.
- **AI 폼 자동 생성 고도화**: Claude API를 연동하여 HWPX, Word, Excel 파일을 업로드 시 즉각적으로 Web Form UI로 변환하는 AI Agent 도입.
- **Export Engine**: 수집된 데이터를 원본 양식(HWPX, PDF 등)의 지정된 위치에 매핑하여 병합(Merge) 추출하는 엔진 적용.
