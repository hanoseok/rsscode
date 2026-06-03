# RSScode

RSS 피드를 모니터링하여 새 글을 Discord 채널로 자동 전송하는 서비스.

## Features

- **사용자 인증**: 회원가입 / 로그인 (세션 기반)
- **워크스페이스**: 팀 또는 용도별로 피드를 분리 관리
- **워크스페이스별 Discord 설정**: 워크스페이스마다 독립된 Discord Client ID/Secret, 체크 주기
- **다중 피드 관리**: 여러 RSS 피드를 등록하고 관리
- **피드별 Discord 채널**: 각 피드마다 다른 Discord 채널로 알림 전송 가능
- **Discord OAuth2 연동**: Webhook URL 직접 입력 없이 OAuth로 간편 연결
- **메시지 템플릿**: 피드별 메시지 포맷 커스터마이징 (드래그 앤 드롭 에디터)
- **자동 스케줄링**: 워크스페이스별 설정 가능한 주기로 새 글 확인 (기본 10분)
- **스마트 알림**: 첫 연결 시 기존 글은 저장만, 새 글부터 알림
- **피드 내보내기/가져오기**: JSON으로 피드 설정 백업 및 복원
- **관리자 기능**: 사용자 관리, 권한 설정
- **웹 UI**: 다크 테마, LNB(왼쪽 네비게이션) 기반 관리자 인터페이스
- **Docker 지원**: 간편한 배포

## Quick Start

### 1. Discord Application 설정

1. [Discord Developer Portal](https://discord.com/developers/applications) 접속
2. **New Application** 클릭 → 이름 입력 → Create
3. 좌측 메뉴에서 **OAuth2 → General** 클릭
4. **Client ID** 복사
5. **Client Secret** → Reset Secret → 복사
6. **Redirects** 섹션에서 **Add Redirect** 클릭:
   ```
   https://your-domain.com/api/discord/callback
   ```
   > 로컬 테스트: `http://localhost:3000/api/discord/callback`
7. **Save Changes** 클릭

### 2. 실행 방법 (택 1)

#### A. Docker (권장)

```bash
docker run -d \
  --name rsscode \
  -p 3000:3000 \
  -e SESSION_SECRET="$(openssl rand -base64 32)" \
  -e NODE_ENV=production \
  -v rsscode_data:/data \
  hanoseok/rsscode:latest
```

또는 **docker-compose.yml**:
```yaml
services:
  rsscode:
    image: hanoseok/rsscode:latest
    container_name: rsscode
    restart: unless-stopped
    environment:
      NODE_ENV: production
      SESSION_SECRET: ${SESSION_SECRET}          # 필수
      ALLOWED_ORIGINS: ${ALLOWED_ORIGINS:-}      # 선택 (콤마 구분 origin 목록)
    ports:
      - "32770:3000"
    volumes:
      - rsscode_data:/data

volumes:
  rsscode_data:
```

```bash
export SESSION_SECRET="$(openssl rand -base64 32)"
docker-compose up -d
```

#### B. 사전 빌드된 tarball 다운로드

GitHub Releases에서 `rsscode-vX.Y.Z-linux-x64.tar.gz`를 받아 압축 해제 후 실행.

```bash
# 최신 릴리스 다운로드
curl -L -o rsscode.tar.gz \
  https://github.com/hanoseok/rsscode/releases/latest/download/rsscode-vX.Y.Z-linux-x64.tar.gz

tar -xzf rsscode.tar.gz
cd rsscode-vX.Y.Z
cp .env.example .env
$EDITOR .env       # SESSION_SECRET 설정 필수 (production)
./run.sh           # 또는: node dist/index.js
```

요구사항: Linux x64 + Node.js 20.

### 3. 첫 로그인

1. `https://your-domain.com` 접속
2. **로그인**
   - 신규 배포: 첫 부팅 시 콘솔 로그에 출력된 랜덤 비밀번호로 `admin` 로그인 (또는 `ADMIN_INITIAL_PASSWORD` 환경변수로 지정한 값)
   - 기존 배포(업그레이드): 기존 관리자 계정 그대로
3. 좌측 LNB에서 워크스페이스 선택
4. **Settings**에서 Discord Client ID/Secret 입력
5. **Add Feed** 클릭 → RSS URL 입력
6. **Connect** 버튼으로 Discord 채널 연결
7. **Test** 버튼으로 테스트 메시지 전송
8. 토글로 피드 활성화

> ⚠️ 로그인 후 바로 비밀번호를 변경하세요. 변경은 관리자 메뉴에서 가능합니다.

## 인증 및 워크스페이스

### 사용자 인증

- 세션 기반 인증 (쿠키, 7일 유효)
- 회원가입 시 기본 워크스페이스 자동 생성
- 관리자(admin)는 사용자 관리 가능 (비밀번호 초기화, 권한 변경, 삭제)

### 워크스페이스

워크스페이스는 피드와 Discord 설정을 묶는 단위입니다.

- 각 워크스페이스는 독립된 Discord Client ID/Secret, 체크 주기를 가짐
- 워크스페이스 소유자(owner)와 멤버(member)가 접근 가능
- 피드는 반드시 하나의 워크스페이스에 속함
- 워크스페이스 삭제 시 하위 피드와 설정 모두 삭제 (cascade)

## 메시지 템플릿

피드별로 Discord 메시지 포맷을 커스터마이징할 수 있습니다.

### 템플릿 문법

| 문법 | 설명 | 예시 |
|------|------|------|
| `{field}` | 필드 값 출력 | `{title}` |
| `{field:N}` | N자로 잘라서 출력 | `{description:100}` |
| `[{field}]({link})` | 클릭 가능한 링크 | `[{title}]({link})` |

### 사용 가능한 필드

`title`, `link`, `description`, `content`, `pubDate`, `isoDate`, `author`, `categories`

### 기본 템플릿

```
[{title}]({link})
{description}
```

## 알림 동작 방식

| 상황 | 동작 |
|------|------|
| Toggle OFF | 체크 안 함, 전송 안 함 |
| Toggle ON + 첫 체크 | 최신 글 1개만 전송, 나머지 저장 |
| Toggle ON + 이후 체크 | 새 글만 알림 |
| Test 버튼 | 수동으로 최신 글 전송 (미리보기 후) |

## Environment Variables

| 변수 | 필수 | 설명 | 기본값 |
|------|:---:|------|--------|
| `SESSION_SECRET` | ⚠️ production 필수 | 세션 쿠키 서명 키. 미설정 시 `NODE_ENV=production`에서 부팅 실패 | (없음) |
| `ALLOWED_ORIGINS` | 선택 | CORS 허용 origin 콤마 구분 목록. 비우면 모든 origin 허용 (개발용) | (비어 있음) |
| `ADMIN_INITIAL_PASSWORD` | 선택 | 신규 배포 시 admin 초기 비밀번호. 미설정 시 랜덤 생성 후 콘솔 출력 (1회) | (랜덤) |
| `NODE_ENV` | 선택 | `production` 권장 (쿠키 secure 활성화 + SESSION_SECRET 강제) | `development` |
| `DATABASE_URL` | 선택 | SQLite DB 경로 | `/data/rsscode.db` |
| `PORT` | 선택 | 서버 포트 | `3000` |

> Discord Client ID/Secret, 체크 주기는 웹 UI의 워크스페이스별 **Settings**에서 설정합니다.

### `SESSION_SECRET` 생성 예시

```bash
openssl rand -base64 32
# 또는
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### `ALLOWED_ORIGINS` 예시

```bash
# 단일 origin
ALLOWED_ORIGINS=https://rss.example.com

# 여러 origin
ALLOWED_ORIGINS=https://rss.example.com,https://admin.example.com
```

리버스 프록시 뒤에서 서비스 자체와 동일 origin으로만 호출한다면 비워둬도 됩니다 (Origin 헤더 없는 동일 출처 호출은 항상 허용).

## Discord OAuth 설정 가이드

### Redirect URI 설정

Discord Developer Portal에서 반드시 **정확한 Redirect URI**를 등록해야 합니다:

| 환경 | Redirect URI |
|------|--------------|
| 로컬 개발 | `http://localhost:3000/api/discord/callback` |
| 프로덕션 | `https://your-domain.com/api/discord/callback` |

### 필요한 OAuth2 Scope

- `webhook.incoming` - 채널에 웹훅 생성 권한

### 연결 흐름

1. 사용자가 "Connect" 클릭
2. Discord 로그인 페이지로 이동
3. 서버와 채널 선택
4. 권한 승인
5. 자동으로 웹훅 생성 및 저장

## Synology NAS 배포

### Container Manager 설정

1. **레지스트리** → `hanoseok/rsscode` 검색 → 다운로드
2. **이미지** → `hanoseok/rsscode` → **실행**
3. **포트 설정**: 로컬 포트 → 3000
4. **볼륨**: `/data` 폴더 마운트

### 역방향 프록시 설정

**제어판 → 로그인 포털 → 고급 → 역방향 프록시**:

| 항목 | 값 |
|------|-----|
| 소스 프로토콜 | HTTPS |
| 소스 호스트명 | your-domain.com |
| 소스 포트 | 443 |
| 대상 프로토콜 | HTTP |
| 대상 호스트명 | localhost |
| 대상 포트 | (컨테이너 외부 포트) |

## Development

```bash
npm install       # 의존성 설치
npm run dev       # 개발 서버 (hot reload)
npm test          # 테스트 (vitest)
npx tsc --noEmit  # 타입 체크
npm run build     # 빌드 → dist/
npm run start     # 프로덕션 실행
```

## 릴리스 / 배포 자동화

이 저장소는 GitHub Actions에 4개의 워크플로우를 두고 있습니다.

| 워크플로우 | 트리거 | 하는 일 |
|------------|--------|---------|
| `ci.yml` | PR / main push | 타입 체크 + 테스트 |
| `auto-release.yml` | main push | 커밋 메시지 분석 → 버전 자동 산정 → 태그 push → docker + release 호출 |
| `docker.yml` | `v*` 태그 push, 또는 `auto-release`가 호출 | Docker Hub `hanoseok/rsscode` 에 `latest` + `<version>` 태그로 push |
| `release.yml` | `v*` 태그 push, 또는 `auto-release`가 호출 | 런타임 tarball 빌드 + GitHub Release에 첨부 |

### 자동 릴리스 동작

main 브랜치에 push될 때, 마지막 `v*` 태그 이후의 커밋 메시지를 분석합니다. 다음 prefix가 하나라도 있으면 새 버전이 산정됩니다.

| 커밋 prefix | 버전 bump |
|-------------|-----------|
| `feat:` | minor (예: 1.0.7 → 1.1.0) |
| `fix:` / `perf:` / `refactor:` / `security:` | patch (예: 1.0.7 → 1.0.8) |
| `BREAKING CHANGE:` 또는 `feat!:` 같이 `!` 포함 | major (예: 1.0.7 → 2.0.0) |
| `docs:` / `chore:` / `test:` / `style:` / `ci:` | 변화 없음 (릴리스 생성 안 됨) |

새 태그가 만들어지면:
1. `docker.yml`이 호출되어 Docker Hub에 push
2. `release.yml`이 호출되어 tarball을 빌드하고 GitHub Release에 첨부

### 수동 릴리스

특정 버전으로 직접 태그를 푸시해도 동일하게 동작합니다.

```bash
git tag v1.0.7
git push origin v1.0.7
# → docker.yml 과 release.yml 이 자동 실행됨
```

또는 GitHub Actions UI에서:
- Actions → **Auto Release** → Run workflow → 커밋 분석에 따라 자동 진행
- Actions → **Release** → Run workflow → 버전 입력 (이 경로는 Release 생성 없이 workflow artifact만 생성)

### 다운로드 형식

- **Docker 이미지**: `hanoseok/rsscode:<version>` 및 `hanoseok/rsscode:latest`
- **Tarball**: `rsscode-<version>-linux-x64.tar.gz` + `.sha256`
  - 포함: `dist/`, `public/`, `drizzle/`, `package.json`, `node_modules/` (prod only), `run.sh`, `README.txt`
  - 사용: 압축 풀고 `./run.sh` 또는 `node dist/index.js`
  - 요구사항: Linux x64, Node.js 20

### 첫 번째 자동 릴리스 트리거하기

이 저장소에 아직 `v*` 태그가 없다면, 첫 자동 릴리스 전에 베이스라인 태그가 필요합니다.

```bash
git tag v1.0.0
git push origin v1.0.0
# 이후 main에 feat:/fix: 커밋이 들어오면 자동으로 v1.0.1, v1.1.0, ... 으로 올라감
```

## API

### 인증 (Auth)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | - | 로그인 |
| POST | `/api/auth/register` | - | 회원가입 |
| POST | `/api/auth/logout` | O | 로그아웃 |
| GET | `/api/auth/me` | O | 현재 사용자 정보 |

### 워크스페이스 (Workspaces)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/workspaces` | O | 내 워크스페이스 목록 |
| POST | `/api/workspaces` | O | 워크스페이스 생성 |
| GET | `/api/workspaces/:id` | O | 워크스페이스 상세 |
| PUT | `/api/workspaces/:id` | O | 워크스페이스 수정 |
| DELETE | `/api/workspaces/:id` | O | 워크스페이스 삭제 |

### 피드 (Feeds)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/feeds?workspaceId=N` | O | 피드 목록 |
| GET | `/api/feeds/:id` | O | 피드 상세 조회 |
| POST | `/api/feeds` | O | 피드 등록 |
| PUT | `/api/feeds/:id` | O | 피드 수정 |
| DELETE | `/api/feeds/:id` | O | 피드 삭제 |
| GET | `/api/feeds/export?workspaceId=N` | O | 피드 JSON 내보내기 |
| POST | `/api/feeds/import` | O | 피드 JSON 가져오기 |
| POST | `/api/feeds/preview-rss` | O | RSS 필드 미리보기 |
| GET | `/api/feeds/:id/preview` | O | 테스트 메시지 미리보기 |
| POST | `/api/feeds/:id/test` | O | 테스트 전송 |

### Discord

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/discord/authorize?workspaceId=N&feedId=N` | O | Discord OAuth 시작 |
| GET | `/api/discord/callback` | O | Discord OAuth 콜백 |
| GET | `/api/discord/channels` | O | 연결된 채널 목록 |
| DELETE | `/api/discord/:feedId` | O | Discord 연결 해제 |

### 설정 (Settings)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/settings?workspaceId=N` | O | 워크스페이스 설정 조회 |
| PUT | `/api/settings?workspaceId=N` | O | 워크스페이스 설정 저장 |

### 관리자 (Admin)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/users` | Admin | 전체 사용자 목록 |
| PUT | `/api/admin/users/:id` | Admin | 사용자 정보 수정 (권한) |
| PUT | `/api/admin/users/:id/password` | Admin | 사용자 비밀번호 초기화 |
| DELETE | `/api/admin/users/:id` | Admin | 사용자 삭제 |

### 기타

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/check` | O | 수동 RSS 체크 |
| GET | `/api/health` | - | 헬스체크 |

## License

MIT
