# RSScode - 기술 명세서

## 1. 개요

### 1.1 프로젝트 설명
RSS 피드를 주기적으로 모니터링하여 새로운 글을 Discord 채널로 자동 전송하는 서비스.

### 1.2 주요 기능
| 기능 | 설명 |
|------|------|
| 사용자 인증 | 세션 기반 로그인/회원가입 |
| 워크스페이스 | 팀 또는 용도별 피드 분리 관리 |
| 워크스페이스별 설정 | Discord Client ID/Secret, 체크 주기를 워크스페이스마다 독립 설정 |
| 다중 피드 관리 | 여러 RSS 피드 등록/수정/삭제 |
| 피드별 Discord 채널 | 각 피드마다 다른 Discord 채널 연결 가능 |
| Discord OAuth2 연동 | Webhook URL 직접 입력 없이 OAuth로 간편 연결 |
| 메시지 템플릿 | 피드별 메시지 포맷 커스터마이징 (드래그 앤 드롭 에디터) |
| 자동 스케줄링 | 워크스페이스별 설정 가능한 주기로 새 글 확인 (1-1440분) |
| 스마트 알림 | 첫 체크 시 최신 글 1개만 전송, 이후 새 글만 알림 |
| 피드 내보내기/가져오기 | JSON으로 피드 설정 백업 및 복원 |
| 관리자 기능 | 사용자 관리, 권한 변경, 비밀번호 초기화 |
| 웹 UI | 다크 테마, LNB 기반 관리자 인터페이스 |

---

## 2. 기술 스택

### 2.1 Backend
| 구성요소 | 기술 | 버전 |
|----------|------|------|
| Runtime | Node.js | 20+ |
| Language | TypeScript | 5.7+ (strict) |
| Framework | Express.js | 4.x |
| Database | SQLite | via better-sqlite3 |
| ORM | Drizzle ORM | 0.38+ |
| Validation | Zod | 3.x |
| RSS Parser | rss-parser | 3.x |
| Scheduler | node-cron | 3.x |
| Auth | express-session + bcryptjs | - |
| Module | ESM (type: module) | - |

### 2.2 Frontend
| 구성요소 | 기술 |
|----------|------|
| UI | Vanilla HTML/CSS/JavaScript (SPA) |
| 스타일 | 다크 테마 |
| 레이아웃 | LNB(좌측 네비게이션) + 메인 컨텐츠 |

### 2.3 Infrastructure
| 구성요소 | 기술 |
|----------|------|
| Container | Docker (multi-stage build) |
| Registry | Docker Hub |
| CI/CD | GitHub Actions |

---

## 3. 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (Browser)                      │
│  ┌───────────┐  ┌────────────────┐  ┌────────────┐         │
│  │ Login/    │  │ LNB            │  │ Main       │         │
│  │ Register  │  │ (Workspaces)   │  │ Content    │         │
│  └───────────┘  └────────────────┘  └────────────┘         │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTPS (Session Cookie)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Reverse Proxy (Synology)                   │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      Express.js Server                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Auth     │ │ REST API │ │ Static   │ │ Schedulers   │  │
│  │ Middleware│ │ /api/*   │ │ Files    │ │ (per-ws cron)│  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
└───────┬─────────────────┬───────────────────┬──────────────┘
        │                 │                   │
        ▼                 ▼                   ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────────────┐
│    SQLite     │ │  RSS Feeds    │ │   Discord Webhook     │
│   Database    │ │  (External)   │ │      (External)       │
└───────────────┘ └───────────────┘ └───────────────────────┘
```

---

## 4. 데이터베이스 스키마

### 4.1 users 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | INTEGER | PK, Auto Increment |
| `username` | TEXT | 사용자명 (필수, Unique, 3-20자) |
| `password_hash` | TEXT | bcrypt 해시 (필수) |
| `is_admin` | INTEGER | 관리자 여부 (0/1, 기본값 0) |
| `created_at` | INTEGER | 생성 시간 (Unix timestamp) |

### 4.2 workspaces 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | INTEGER | PK, Auto Increment |
| `name` | TEXT | 워크스페이스 이름 (필수, 1-50자) |
| `owner_id` | INTEGER | FK → users.id (CASCADE) |
| `created_at` | INTEGER | 생성 시간 (Unix timestamp) |

### 4.3 workspace_members 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | INTEGER | PK, Auto Increment |
| `workspace_id` | INTEGER | FK → workspaces.id (CASCADE) |
| `user_id` | INTEGER | FK → users.id (CASCADE) |
| `role` | TEXT | 역할 (`owner` / `member`, 기본값 `member`) |

**Unique Constraint**: `(workspace_id, user_id)`

### 4.4 workspace_settings 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | INTEGER | PK, Auto Increment |
| `workspace_id` | INTEGER | FK → workspaces.id (CASCADE, Unique) |
| `discord_client_id` | TEXT | Discord OAuth2 Client ID |
| `discord_client_secret` | TEXT | Discord OAuth2 Client Secret |
| `check_interval_minutes` | INTEGER | RSS 체크 주기 (기본값 10) |

### 4.5 feeds 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | INTEGER | PK, Auto Increment |
| `workspace_id` | INTEGER | FK → workspaces.id (CASCADE) |
| `name` | TEXT | 피드 이름 (필수) |
| `url` | TEXT | RSS URL (필수, Unique) |
| `profile_image` | TEXT | 프로필 이미지 URL |
| `webhook_url` | TEXT | Discord Webhook URL |
| `webhook_channel_id` | TEXT | Discord 채널 ID |
| `webhook_guild_id` | TEXT | Discord 서버 ID |
| `webhook_name` | TEXT | Webhook 이름 |
| `message_template` | TEXT | 메시지 템플릿 |
| `enabled` | INTEGER | 활성화 여부 (0/1, 기본값 1) |
| `created_at` | INTEGER | 생성 시간 (Unix timestamp) |
| `last_checked_at` | INTEGER | 마지막 체크 시간 |
| `last_checked_title` | TEXT | 마지막 체크한 글 제목 |
| `last_sent_at` | INTEGER | 마지막 전송 시간 |
| `last_sent_title` | TEXT | 마지막 전송한 글 제목 |

### 4.6 posts 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | INTEGER | PK, Auto Increment |
| `feed_id` | INTEGER | FK → feeds.id (CASCADE) |
| `guid` | TEXT | RSS 항목 고유 ID |
| `title` | TEXT | 글 제목 |
| `link` | TEXT | 글 URL |
| `published_at` | INTEGER | 발행 시간 |
| `sent_at` | INTEGER | Discord 전송 시간 |

**Unique Constraint**: `(feed_id, guid)`

### 4.7 ER 다이어그램

```
users 1──N workspaces
users 1──N workspace_members
workspaces 1──N workspace_members
workspaces 1──1 workspace_settings
workspaces 1──N feeds
feeds 1──N posts
```

---

## 5. 인증 및 권한

### 5.1 인증 방식

- **세션 기반** (express-session)
- 쿠키: `connect.sid`, httpOnly, 7일 유효
- 비밀번호: bcryptjs (salt rounds: 10)

### 5.2 사용자 유형

| 유형 | 권한 |
|------|------|
| 일반 사용자 | 자신이 소유하거나 멤버인 워크스페이스의 피드/설정 관리 |
| 관리자 (admin) | 위 + 전체 사용자 관리 (목록 조회, 권한 변경, 비밀번호 초기화, 삭제) |

### 5.3 미들웨어

| 미들웨어 | 역할 |
|----------|------|
| `requireAuth` | 세션에 userId 확인, 없으면 401 |
| `requireAdmin` | requireAuth + isAdmin 확인, 없으면 403 |

### 5.4 초기 설정

- 첫 실행 시 기본 관리자 계정 자동 생성: `admin` / `admin`
- 기본 관리자의 워크스페이스(`my workspace`)와 workspace_settings 자동 생성
- 기존 워크스페이스 없는 피드는 관리자 워크스페이스로 마이그레이션

---

## 6. API 명세

### 6.1 인증 API

#### `POST /api/auth/login`
로그인 (인증 불필요)

**Request Body**:
```json
{
  "username": "admin",
  "password": "admin"
}
```

**Response**: `200 OK`
```json
{
  "id": 1,
  "username": "admin",
  "isAdmin": true
}
```

**Errors**: `400` 유효성 실패, `401` 잘못된 자격증명

#### `POST /api/auth/register`
회원가입 (인증 불필요). 회원가입 시 기본 워크스페이스 자동 생성.

**Request Body**:
```json
{
  "username": "newuser",
  "password": "pass1234",
  "passwordConfirm": "pass1234"
}
```

**Validation**: username 3-20자, password 4자 이상

**Response**: `201 Created`

**Errors**: `400` 유효성 실패/비밀번호 불일치, `409` 중복 사용자명

#### `POST /api/auth/logout`
로그아웃

**Response**: `200 OK`

#### `GET /api/auth/me`
현재 로그인 사용자 정보

**Response**: `200 OK`
```json
{
  "id": 1,
  "username": "admin",
  "isAdmin": true
}
```

**Errors**: `401` 미인증

---

### 6.2 워크스페이스 API

모든 엔드포인트는 `requireAuth` 미들웨어 적용.

#### `GET /api/workspaces`
내가 소유하거나 멤버인 워크스페이스 목록

**Response**: `200 OK`
```json
[
  {
    "id": 1,
    "name": "my workspace",
    "ownerId": 1,
    "createdAt": "2026-02-07T00:00:00.000Z"
  }
]
```

#### `POST /api/workspaces`
워크스페이스 생성. workspace_settings 및 scheduler 자동 생성.

**Request Body**:
```json
{
  "name": "New Workspace"
}
```

**Response**: `201 Created`

#### `GET /api/workspaces/:id`
워크스페이스 상세 (소유자 또는 멤버만 접근)

**Errors**: `403` 접근 거부, `404` 없음

#### `PUT /api/workspaces/:id`
워크스페이스 수정 (소유자 또는 admin만)

#### `DELETE /api/workspaces/:id`
워크스페이스 삭제 (소유자 또는 admin만). scheduler 중지, cascade로 피드/설정/멤버 모두 삭제.

---

### 6.3 피드 API

모든 엔드포인트는 `requireAuth` 미들웨어 적용. 사용자가 접근 가능한 워크스페이스의 피드만 조회/수정 가능.

#### `GET /api/feeds?workspaceId=N`
피드 목록. workspaceId 지정 시 해당 워크스페이스 피드만, 미지정 시 접근 가능한 모든 워크스페이스의 피드.

**Response**: `200 OK`
```json
[
  {
    "id": 1,
    "workspaceId": 1,
    "name": "TechCrunch",
    "url": "https://techcrunch.com/feed/",
    "profileImage": "https://example.com/logo.png",
    "webhookUrl": "https://discord.com/api/webhooks/...",
    "webhookChannelId": "123456789",
    "webhookGuildId": "987654321",
    "webhookName": "RSS to Discord",
    "messageTemplate": "[{title}]({link})\n{description}",
    "enabled": true,
    "createdAt": "2026-02-07T00:00:00.000Z",
    "lastCheckedAt": "2026-02-07T12:00:00.000Z",
    "lastCheckedTitle": "Latest Article",
    "lastSentAt": "2026-02-07T12:00:00.000Z",
    "lastSentTitle": "Latest Article"
  }
]
```

#### `POST /api/feeds`
피드 등록. `workspaceId` 필수.

**Request Body**:
```json
{
  "workspaceId": 1,
  "name": "TechCrunch",
  "url": "https://techcrunch.com/feed/",
  "profileImage": "https://example.com/logo.png",
  "webhookUrl": "https://discord.com/api/webhooks/...",
  "webhookChannelId": "123456789",
  "webhookGuildId": "987654321",
  "webhookName": "RSS to Discord",
  "messageTemplate": "[{title}]({link})\n{description}"
}
```

**Response**: `201 Created`

**Errors**: `400` 유효성/workspaceId 누락, `403` 접근 거부, `409` URL 중복

#### `PUT /api/feeds/:id`
피드 수정 (소유 워크스페이스 피드만)

#### `DELETE /api/feeds/:id`
피드 삭제 (소유 워크스페이스 피드만)

**Response**: `204 No Content`

#### `GET /api/feeds/export?workspaceId=N`
피드 설정 JSON 내보내기

**Response**: `200 OK` (파일 다운로드: `rsscode_yyyyMMdd.json`)

#### `POST /api/feeds/import`
피드 설정 JSON 가져오기

**Request Body**:
```json
{
  "workspaceId": 1,
  "feeds": [ ... ]
}
```

**Response**: `200 OK`
```json
{
  "imported": 3,
  "skipped": 1,
  "total": 4
}
```

#### `POST /api/feeds/preview-rss`
RSS 필드 미리보기 (템플릿 빌더용)

**Request Body**:
```json
{
  "url": "https://example.com/feed.xml"
}
```

**Response**: `200 OK`
```json
{
  "fields": ["title", "link", "description", "content", "pubDate", "isoDate", "author", "categories"],
  "sample": {
    "title": "Article Title",
    "link": "https://example.com/article",
    "description": "Article description..."
  }
}
```

#### `GET /api/feeds/:id/preview`
테스트 메시지 미리보기

#### `POST /api/feeds/:id/test`
테스트 메시지 전송 (lastCheckedAt/lastSentAt 업데이트)

---

### 6.4 Discord API

모든 엔드포인트는 `requireAuth` 미들웨어 적용.

#### `GET /api/discord/authorize?workspaceId=N&feedId=N`
Discord OAuth 시작. workspaceId 필수. feedId는 기존 피드에 연결할 때 사용.

OAuth state에 `workspaceId`와 `feedId`를 인코딩하여 전달.

**Response**: Discord OAuth 페이지로 리다이렉트

#### `GET /api/discord/callback`
Discord OAuth 콜백. state에서 workspaceId를 추출하여 해당 워크스페이스의 Discord credentials 사용.

#### `GET /api/discord/channels`
연결된 채널 목록

**Response**: `200 OK`
```json
[
  {
    "webhookUrl": "https://discord.com/api/webhooks/...",
    "channelId": "123456789",
    "guildId": "987654321",
    "usedBy": ["TechCrunch", "Hacker News"]
  }
]
```

#### `DELETE /api/discord/:feedId`
피드의 Discord 연결 해제

---

### 6.5 설정 API

모든 엔드포인트는 `requireAuth` 미들웨어 적용. 접근 가능한 워크스페이스의 설정만 조회/수정 가능.

#### `GET /api/settings?workspaceId=N`
워크스페이스별 설정 조회. workspaceId 필수.

**Response**: `200 OK`
```json
{
  "discord_client_id": "1234567890",
  "discord_client_secret": "••••••••",
  "check_interval_minutes": 10
}
```

**Errors**: `400` workspaceId 누락, `403` 접근 거부

#### `PUT /api/settings?workspaceId=N`
워크스페이스별 설정 저장

**Request Body** (모두 optional):
```json
{
  "discord_client_id": "1234567890",
  "discord_client_secret": "secret_value",
  "check_interval_minutes": 10
}
```

`discord_client_secret`이 `••••••••`이면 업데이트하지 않음.

---

### 6.6 관리자 API

모든 엔드포인트는 `requireAdmin` 미들웨어 적용.

#### `GET /api/admin/users`
전체 사용자 목록 (password_hash 제외)

**Response**: `200 OK`
```json
[
  {
    "id": 1,
    "username": "admin",
    "isAdmin": true,
    "createdAt": "2026-02-07T00:00:00.000Z"
  }
]
```

#### `PUT /api/admin/users/:id`
사용자 정보 수정 (현재 isAdmin 변경만 지원)

**Request Body**:
```json
{
  "isAdmin": true
}
```

#### `PUT /api/admin/users/:id/password`
사용자 비밀번호 초기화

**Request Body**:
```json
{
  "password": "newpassword"
}
```

#### `DELETE /api/admin/users/:id`
사용자 삭제 (자기 자신 삭제 불가)

**Response**: `204 No Content`

---

### 6.7 기타 API

#### `POST /api/check`
수동 RSS 체크 (`requireAuth`)

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Feed check completed"
}
```

#### `GET /api/health`
헬스체크 (인증 불필요)

**Response**: `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2026-02-07T12:00:00.000Z"
}
```

---

## 7. 환경 변수

| 변수 | 필수 | 설명 | 기본값 |
|------|------|------|--------|
| `DATABASE_URL` | - | SQLite DB 경로 | `/data/rsscode.db` |
| `PORT` | - | 서버 포트 | `3000` |
| `NODE_ENV` | - | 환경 (`production` / `development`) | - |

> Discord Client ID/Secret, 체크 주기는 환경변수가 아닌 **웹 UI의 워크스페이스별 Settings**에서 설정합니다.

---

## 8. Discord 연동

### 8.1 OAuth2 Flow

```
1. 사용자 → "Connect" 클릭 (workspaceId 전달)
          ↓
2. 서버 → 워크스페이스의 Discord Client ID로 OAuth URL 생성
          ↓
3. 사용자 → Discord 로그인 & 서버/채널 선택 & 권한 승인
          ↓
4. Discord → Authorization Code를 callback URL로 전송
          ↓
5. 서버 → state에서 workspaceId 추출 → 해당 워크스페이스의 credentials로 Token 교환
          ↓
6. 서버 → Webhook URL, Name을 피드에 저장
```

### 8.2 메시지 템플릿

#### 템플릿 문법
| 문법 | 설명 | 예시 |
|------|------|------|
| `{field}` | 필드 값 출력 (최대 500자) | `{title}` → "Article Title" |
| `{field:N}` | N자로 잘라서 출력 | `{description:100}` → "First 100 chars..." |
| `[{field}]({link})` | 마크다운 링크 | `[{title}]({link})` → "[Title](url)" |

#### 사용 가능한 필드
- `title` - 글 제목
- `link` - 글 URL
- `description` - 본문 미리보기 (contentSnippet)
- `content` - 전체 본문
- `pubDate` - 발행일
- `isoDate` - ISO 8601 형식 발행일
- `author` - 작성자
- `categories` - 카테고리 (쉼표 구분)

#### 기본 템플릿
```
[{title}]({link})
{description}
```

### 8.3 Webhook 메시지 포맷

```json
{
  "username": "피드 이름",
  "avatar_url": "프로필 이미지 URL",
  "content": "템플릿이 적용된 메시지 내용"
}
```

---

## 9. 스케줄러

### 9.1 동작 방식
- `node-cron`을 사용하여 워크스페이스별 독립 스케줄러 실행
- 각 워크스페이스의 `check_interval_minutes` 설정에 따라 주기 결정 (기본 10분)
- 서버 시작 시 모든 워크스페이스의 스케줄러 자동 시작
- 워크스페이스 생성/삭제 시 스케줄러 자동 시작/중지

### 9.2 RSS 체크 로직
```
1. 워크스페이스의 활성화된 피드 목록 조회
2. 각 피드에 대해:
   a. RSS 파싱 (User-Agent 헤더 포함)
   b. 각 항목의 guid로 중복 체크
   c. lastSentAt이 null이면 (첫 체크):
       - 최신 항목 1개만 Discord 전송
       - 나머지 항목은 posts에 저장만
   d. lastSentAt이 있으면:
      - 항목의 publishedAt > lastSentAt인 경우만 Discord 전송
      - lastSentAt, lastSentTitle 업데이트
   e. lastCheckedAt, lastCheckedTitle 업데이트
```

### 9.3 알림 규칙
| 조건 | 동작 |
|------|------|
| Toggle OFF | 체크 안 함, 전송 안 함 |
| Toggle ON + `lastSentAt` 없음 (첫 체크) | 최신 1개 전송, 나머지 저장 |
| Toggle ON + 항목 발행일 ≤ `lastSentAt` | 저장만, 전송 안함 |
| Toggle ON + 항목 발행일 > `lastSentAt` | Discord 전송 |

---

## 10. 웹 UI

### 10.1 화면 구성

```
┌─────────────────────────────────────────────────────┐
│                    Login / Register                   │
└─────────────────────────────────────────────────────┘
                       ↓ 인증 후
┌─────────┬───────────────────────────────────────────┐
│  LNB    │  Main Content                              │
│         │                                            │
│ Avatar  │  ┌───────────────────────────────────┐    │
│ User    │  │ Settings (워크스페이스별)           │    │
│ ─────── │  │ Discord Client ID/Secret           │    │
│ WS 1 ◀ │  │ Check Interval                      │    │
│ WS 2   │  └───────────────────────────────────┘    │
│ WS 3   │                                            │
│ + New   │  ┌───────────────────────────────────┐    │
│         │  │ Feeds List                          │    │
│ ─────── │  │ [Add Feed] [Export] [Import]        │    │
│ Admin ▸ │  │                                     │    │
│ ─────── │  │ Feed Card 1 (toggle, test, edit)    │    │
│ Logout  │  │ Feed Card 2                         │    │
│         │  │ ...                                 │    │
└─────────┴──┴───────────────────────────────────┘────┘
```

### 10.2 주요 기능

#### 인증 화면
- 로그인 / 회원가입 전환
- 유효성 검사 및 에러 표시

#### LNB (좌측 네비게이션)
- 사용자 아바타 + 이름
- 워크스페이스 목록 (클릭으로 전환)
- 새 워크스페이스 생성 버튼
- 관리자 메뉴 (admin만 표시)
- 로그아웃 버튼

#### Settings (워크스페이스별)
- Discord Client ID/Secret 설정
- Check Interval 설정 (1-1440분)

#### Feed 관리
- Add Feed 모달: Discord 연결 → 이름/URL/이미지 입력 → 템플릿 빌더
- Message Template Builder: 칩 기반 비주얼 에디터, 드래그 앤 드롭
- Feed 카드: 프로필 이미지, 이름, URL, 체크/전송 시간, 토글, Test/Edit/Delete
- Feed 내보내기/가져오기 (JSON)

#### Admin 페이지
- 사용자 목록
- 권한 변경 (admin 토글)
- 비밀번호 초기화
- 사용자 삭제

---

## 11. 프로젝트 구조

```
rsscode/
├── src/
│   ├── index.ts              # 앱 진입점 (Express 설정, 라우터 등록)
│   ├── api/
│   │   ├── auth.ts           # 인증 API (login, register, logout, me)
│   │   ├── workspaces.ts     # 워크스페이스 CRUD
│   │   ├── admin.ts          # 관리자 API (사용자 관리)
│   │   ├── feeds.ts          # 피드 CRUD + 내보내기/가져오기
│   │   ├── discord.ts        # Discord OAuth API
│   │   └── settings.ts       # 워크스페이스별 설정 API
│   ├── middleware/
│   │   └── auth.ts           # requireAuth, requireAdmin 미들웨어
│   ├── utils/
│   │   └── auth.ts           # hashPassword, verifyPassword
│   ├── db/
│   │   ├── schema.ts         # Drizzle 스키마 정의
│   │   └── index.ts          # DB 연결, 테이블 생성, 마이그레이션
│   ├── services/
│   │   ├── rss.ts            # RSS 파싱 & 체크
│   │   ├── discord.ts        # Discord Webhook 전송 + 템플릿 엔진
│   │   └── scheduler.ts      # 워크스페이스별 Cron 스케줄러
│   ├── types/
│   │   └── index.ts          # Zod 스키마 (피드 생성/수정)
│   └── test/
│       ├── setup.ts          # 테스트 DB 설정 (in-memory SQLite)
│       ├── app.ts            # 테스트용 Express 앱
│       ├── feeds.test.ts     # 피드 API 테스트
│       ├── settings.test.ts  # 설정 API 테스트
│       └── discord.test.ts   # Discord 서비스 테스트
├── public/
│   └── index.html            # 웹 UI (SPA)
├── .github/
│   └── workflows/
│       ├── ci.yml            # 테스트 워크플로우
│       └── docker.yml        # Docker 빌드 (태그 전용)
├── Dockerfile                # Multi-stage Docker 빌드
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── AGENTS.md                 # AI 코딩 에이전트 가이드라인
└── SPEC.md                   # 이 문서
```

---

## 12. 배포

### 12.1 Docker 이미지

**레지스트리**: Docker Hub (`hanoseok/rsscode`)

**태그 규칙**:
| 트리거 | 태그 |
|--------|------|
| `v1.2.3` 태그 push | `v1.2.3`, `latest` |

### 12.2 CI/CD Pipeline

```
1. GitHub에 tag push (v*)
       ↓
2. GitHub Actions 트리거
       ↓
3. 테스트 실행
       ↓
4. Docker 이미지 빌드
       ↓
5. Docker Hub에 push
       ↓
6. (수동) NAS에서 이미지 업데이트
```

---

## 13. 버전 히스토리

| 버전 | 날짜 | 변경 사항 |
|------|------|----------|
| v0.1.0 | 2024-02-01 | 초기 릴리즈 |
| v0.2.0 | 2024-02-01 | Discord OAuth HTTPS 프로토콜 수정 |
| v0.3.0 | 2024-02-01 | 환경변수 지원 (Discord credentials, Check interval) |
| v0.4.0 | 2024-02-01 | Form persistence during OAuth, simplified channel UI |
| v0.5.0 | 2024-02-01 | Discord message format (title+link, 200 char content) |
| v0.6.0 | 2024-02-02 | Smart notifications, UI improvements, webhook name display |
| v0.7.0 | 2024-02-02 | Message template builder, test preview modal |
| v0.8.0 | 2026-02-04 | Feed export/import, default template change, UI improvements |
| v0.8.1 | 2026-02-05 | 프로젝트명 RSScode로 변경 |
| v0.8.2 | 2026-02-05 | 첫 체크 시 최신 글 자동 전송 |
| v0.9.0 | 2026-02-07 | 사용자 인증, 워크스페이스, 워크스페이스별 설정, 관리자 기능 |

### v0.9.0 상세 변경사항
- **사용자 인증**: 세션 기반 로그인/회원가입 (bcryptjs)
- **워크스페이스**: 팀 또는 용도별 피드 분리 관리
- **워크스페이스별 Discord 설정**: Client ID/Secret, 체크 주기를 워크스페이스마다 독립 설정
- **워크스페이스별 스케줄러**: 각 워크스페이스의 체크 주기에 맞는 독립 cron 스케줄러
- **관리자 기능**: 사용자 목록 조회, 권한 변경, 비밀번호 초기화, 삭제
- **웹 UI 전면 개편**: LNB 기반 레이아웃, 로그인/회원가입 화면, 관리자 페이지
- **기존 환경변수 제거**: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `CHECK_INTERVAL_MINUTES`는 더 이상 환경변수로 설정하지 않고 워크스페이스별 Settings에서 관리
- **DB 스키마 변경**: users, workspaces, workspace_members, workspace_settings 테이블 추가, settings(key-value) 테이블 제거

---

## 14. 라이선스

MIT License
