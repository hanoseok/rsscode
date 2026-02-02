# RSS to Discord - 기술 명세서

## 1. 개요

### 1.1 프로젝트 설명
RSS 피드를 주기적으로 모니터링하여 새로운 글을 Discord 채널로 자동 전송하는 서비스.

### 1.2 주요 기능
| 기능 | 설명 |
|------|------|
| 다중 피드 관리 | 여러 RSS 피드 등록/수정/삭제 |
| 피드별 Discord 채널 | 각 피드마다 다른 Discord 채널 연결 가능 |
| Discord OAuth2 연동 | Webhook URL 직접 입력 없이 OAuth로 간편 연결 |
| 피드 활성화/비활성화 | 토글로 피드별 알림 on/off |
| 테스트 전송 | 최신 RSS 항목을 Discord로 테스트 전송 |
| 자동 스케줄링 | 설정 가능한 주기로 새 글 확인 (1-1440분) |
| 웹 UI | 다크 테마의 관리자 인터페이스 |
| 스마트 알림 | 첫 체크 시 기존 글은 저장만, 새 글만 알림 |

---

## 2. 기술 스택

### 2.1 Backend
| 구성요소 | 기술 | 버전 |
|----------|------|------|
| Runtime | Node.js | 20+ |
| Language | TypeScript | 5.7+ |
| Framework | Express.js | 4.x |
| Database | SQLite | - |
| ORM | Drizzle ORM | 0.38+ |
| Validation | Zod | 3.x |
| RSS Parser | rss-parser | 3.x |
| Scheduler | node-cron | 3.x |

### 2.2 Frontend
| 구성요소 | 기술 |
|----------|------|
| UI | Vanilla HTML/CSS/JavaScript |
| 스타일 | 다크 테마 (Tailwind-like) |

### 2.3 Infrastructure
| 구성요소 | 기술 |
|----------|------|
| Container | Docker |
| Registry | Docker Hub |
| CI/CD | GitHub Actions |

---

## 3. 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (Browser)                      │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTPS
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Reverse Proxy (Synology)                  │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      Express.js Server                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  REST API   │  │  Static     │  │  Scheduler  │         │
│  │  /api/*     │  │  Files      │  │  (cron)     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└───────┬─────────────────┬───────────────────┬───────────────┘
        │                 │                   │
        ▼                 ▼                   ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────────────┐
│    SQLite     │ │  RSS Feeds    │ │   Discord Webhook     │
│   Database    │ │  (External)   │ │      (External)       │
└───────────────┘ └───────────────┘ └───────────────────────┘
```

---

## 4. 데이터베이스 스키마

### 4.1 feeds 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | INTEGER | PK, Auto Increment |
| `name` | TEXT | 피드 이름 (필수) |
| `url` | TEXT | RSS URL (필수, Unique) |
| `profile_image` | TEXT | 프로필 이미지 URL |
| `webhook_url` | TEXT | Discord Webhook URL |
| `webhook_channel_id` | TEXT | Discord 채널 ID |
| `webhook_guild_id` | TEXT | Discord 서버 ID |
| `webhook_name` | TEXT | Webhook 이름 |
| `enabled` | INTEGER | 활성화 여부 (0/1, 기본값 1) |
| `created_at` | INTEGER | 생성 시간 (Unix timestamp) |
| `last_checked_at` | INTEGER | 마지막 체크 시간 |
| `last_checked_title` | TEXT | 마지막 체크한 글 제목 |
| `last_sent_at` | INTEGER | 마지막 전송 시간 |
| `last_sent_title` | TEXT | 마지막 전송한 글 제목 |
| `message_template` | TEXT | 메시지 템플릿 (기본: `{title}\n{link}`) |

### 4.2 posts 테이블
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

### 4.3 settings 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| `key` | TEXT | PK, 설정 키 |
| `value` | TEXT | 설정 값 |

**사용되는 키**:
- `discord_client_id`
- `discord_client_secret`
- `check_interval_minutes`

---

## 5. API 명세

### 5.1 피드 API

#### `GET /api/feeds`
피드 목록 조회

**Response**: `200 OK`
```json
[
  {
    "id": 1,
    "name": "TechCrunch",
    "url": "https://techcrunch.com/feed/",
    "profileImage": "https://example.com/logo.png",
    "webhookUrl": "https://discord.com/api/webhooks/...",
    "webhookChannelId": "123456789",
    "webhookGuildId": "987654321",
    "webhookName": "RSS to Discord",
    "enabled": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "lastCheckedAt": "2024-01-01T12:00:00.000Z",
    "lastCheckedTitle": "Latest Article",
    "lastSentAt": "2024-01-01T12:00:00.000Z",
    "lastSentTitle": "Latest Article"
  }
]
```

#### `POST /api/feeds`
피드 등록

**Request Body**:
```json
{
  "name": "TechCrunch",
  "url": "https://techcrunch.com/feed/",
  "profileImage": "https://example.com/logo.png",
  "webhookUrl": "https://discord.com/api/webhooks/...",
  "webhookChannelId": "123456789",
  "webhookGuildId": "987654321",
  "webhookName": "RSS to Discord"
}
```

**Response**: `201 Created`

**Errors**:
- `400 Bad Request`: 유효성 검사 실패
- `409 Conflict`: URL 중복

#### `PUT /api/feeds/:id`
피드 수정

**Request Body** (모두 optional):
```json
{
  "name": "New Name",
  "url": "https://new-url.com/feed/",
  "profileImage": "https://example.com/new-logo.png",
  "enabled": false
}
```

**Response**: `200 OK`

#### `DELETE /api/feeds/:id`
피드 삭제

**Response**: `204 No Content`

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
  "fields": ["title", "link", "description", "content", "pubDate", "author", "categories"],
  "sample": {
    "title": "Article Title",
    "link": "https://example.com/article",
    "description": "Article description..."
  }
}
```

#### `GET /api/feeds/:id/preview`
테스트 메시지 미리보기

**Response**: `200 OK`
```json
{
  "feedName": "TechCrunch",
  "profileImage": "https://example.com/logo.png",
  "webhookName": "RSS to Discord",
  "content": "Article Title\nhttps://example.com/article",
  "rssItem": { ... }
}
```

#### `POST /api/feeds/:id/test`
테스트 메시지 전송 (lastCheckedAt/lastSentAt 업데이트)

**Response**: `200 OK`
```json
{
  "message": "Test message sent: \"Article Title\""
}
```

**Errors**:
- `400 Bad Request`: Discord 미연결, RSS fetch 실패, RSS 항목 없음
- `404 Not Found`: 피드 없음

---

### 5.2 Discord API

#### `GET /api/discord/authorize`
Discord OAuth 시작

**Query Parameters**:
- `feedId` (optional): 연결할 피드 ID

**Response**: Discord OAuth 페이지로 리다이렉트

#### `GET /api/discord/callback`
Discord OAuth 콜백 (내부 사용)

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

**Response**: `200 OK`

---

### 5.3 설정 API

#### `GET /api/settings`
설정 조회

**Response**: `200 OK`
```json
{
  "discord_client_id": "1234567890",
  "discord_client_secret": "••••••••",
  "check_interval_minutes": "10",
  "_env_configured": "true"
}
```

#### `PUT /api/settings`
설정 저장

**Request Body**:
```json
{
  "discord_client_id": "1234567890",
  "discord_client_secret": "secret_value",
  "check_interval_minutes": 10
}
```

**Response**: `200 OK`

---

### 5.4 기타 API

#### `POST /api/check`
수동 RSS 체크

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Feed check completed"
}
```

#### `GET /api/health`
헬스체크

**Response**: `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

---

## 6. 환경 변수

| 변수 | 필수 | 설명 | 기본값 |
|------|------|------|--------|
| `DISCORD_CLIENT_ID` | △ | Discord OAuth2 Client ID | - |
| `DISCORD_CLIENT_SECRET` | △ | Discord OAuth2 Client Secret | - |
| `CHECK_INTERVAL_MINUTES` | - | RSS 체크 주기 (분, 1-1440) | `10` |
| `DATABASE_URL` | - | SQLite DB 경로 | `/data/rsscode.db` |
| `PORT` | - | 서버 포트 | `3000` |
| `NODE_ENV` | - | 환경 (`production`/`development`) | - |

> △ = 환경변수 또는 웹 UI에서 설정 필요

**우선순위**: 환경변수 > DB 설정

---

## 7. Discord 연동

### 7.1 OAuth2 Flow

```
1. 사용자 → "Connect" 클릭
          ↓
2. 서버 → Discord OAuth URL 생성 (scope: webhook.incoming)
          ↓
3. 사용자 → Discord 로그인 & 서버/채널 선택 & 권한 승인
          ↓
4. Discord → Authorization Code를 callback URL로 전송
          ↓
5. 서버 → Code로 Token 교환 → Webhook 정보 수신
          ↓
6. 서버 → Webhook URL, Name을 DB에 저장
```

### 7.2 메시지 템플릿

#### 템플릿 문법
| 문법 | 설명 | 예시 |
|------|------|------|
| `{field}` | 필드 값 출력 | `{title}` → "Article Title" |
| `{field:N}` | N자로 잘라서 출력 | `{description:100}` → "First 100 chars..." |
| `[{field}]({link})` | 마크다운 링크 | `[{title}]({link})` → "[Title](url)" |

#### 사용 가능한 필드
- `title` - 글 제목
- `link` - 글 URL
- `description` - 본문 미리보기
- `content` - 전체 본문
- `pubDate` - 발행일
- `author` - 작성자
- `categories` - 카테고리

#### 기본 템플릿
```
{title}
{link}
```

### 7.3 Webhook 메시지 포맷

```json
{
  "username": "피드 이름",
  "avatar_url": "프로필 이미지 URL",
  "content": "템플릿이 적용된 메시지 내용"
}
```

---

## 8. 스케줄러

### 8.1 동작 방식
- `node-cron`을 사용하여 주기적으로 RSS 체크
- 기본 주기: 10분 (`*/10 * * * *`)
- 환경변수 또는 설정으로 변경 가능 (1-1440분)

### 8.2 RSS 체크 로직
```
1. 활성화된 피드 목록 조회
2. 각 피드에 대해:
   a. RSS 파싱 (User-Agent 헤더 포함)
   b. 각 항목의 guid로 중복 체크
   c. lastSentAt이 null이면 (첫 체크):
      - 모든 항목을 posts에 저장만 (전송 안함)
   d. lastSentAt이 있으면:
      - 항목의 publishedAt > lastSentAt인 경우만 Discord 전송
      - lastSentAt, lastSentTitle 업데이트
   e. lastCheckedAt, lastCheckedTitle 업데이트
```

### 8.3 알림 규칙
| 조건 | 동작 |
|------|------|
| `lastSentAt` 없음 (첫 체크) | 저장만, 전송 안함 |
| 항목 발행일 ≤ `lastSentAt` | 저장만, 전송 안함 |
| 항목 발행일 > `lastSentAt` | Discord 전송 |

---

## 9. 웹 UI 기능

### 9.1 Settings
- Discord Client ID/Secret 설정
- Check Interval 설정 (1-1440분)
- 마지막 체크 시간 / 다음 체크까지 남은 시간 표시

### 9.2 Add Feed (모달)
- Discord Channel 연결 (맨 위)
- Feed Name, RSS URL, Profile Image URL 입력
- Profile Image 미리보기
- **Message Template Builder**:
  - Fetch 버튼으로 RSS 필드 로드
  - 칩 기반 비주얼 에디터
  - 드래그 앤 드롭으로 순서 변경
  - 우클릭 메뉴로 링크 추가/글자수 제한 설정

### 9.3 Registered Feeds
- 스크롤 가능 (최대 60vh)
- lastSentAt 기준 내림차순 정렬
- 각 피드 표시:
  - 프로필 이미지, 이름, URL
  - Checked: 마지막 체크 시간 + 제목
  - Sent: 마지막 전송 시간 + 제목
  - Test / Edit / Delete 버튼
  - 활성화 토글

### 9.4 Edit Feed (모달)
- Discord Channel 상태 표시 (Webhook: 이름)
- Feed Name, RSS URL, Profile Image URL 수정
- Profile Image 미리보기

---

## 10. 프로젝트 구조

```
rsscode/
├── src/
│   ├── index.ts              # 앱 진입점
│   ├── api/
│   │   ├── feeds.ts          # 피드 API
│   │   ├── discord.ts        # Discord OAuth API
│   │   └── settings.ts       # 설정 API
│   ├── db/
│   │   ├── schema.ts         # Drizzle 스키마 정의
│   │   └── index.ts          # DB 연결 & 마이그레이션
│   ├── services/
│   │   ├── rss.ts            # RSS 파싱 & 체크
│   │   ├── discord.ts        # Discord Webhook 전송
│   │   └── scheduler.ts      # Cron 스케줄러
│   ├── types/
│   │   └── index.ts          # Zod 스키마
│   └── test/
│       ├── setup.ts          # 테스트 설정
│       ├── app.ts            # 테스트용 앱
│       └── *.test.ts         # 테스트 파일
├── public/
│   └── index.html            # 웹 UI (SPA)
├── .github/
│   └── workflows/
│       ├── ci.yml            # 테스트 워크플로우
│       └── docker.yml        # Docker 빌드 (태그 전용)
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## 11. 배포

### 11.1 Docker 이미지

**레지스트리**: Docker Hub (`hanoseok/rsscode`)

**태그 규칙**:
| 트리거 | 태그 |
|--------|------|
| `v1.2.3` 태그 push | `v1.2.3`, `latest` |

### 11.2 CI/CD Pipeline

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

## 12. 버전 히스토리

| 버전 | 날짜 | 변경 사항 |
|------|------|----------|
| v0.1.0 | 2024-02-01 | 초기 릴리즈 |
| v0.2.0 | 2024-02-01 | Discord OAuth HTTPS 프로토콜 수정 |
| v0.3.0 | 2024-02-01 | 환경변수 지원 (Discord credentials, Check interval) |
| v0.4.0 | 2024-02-01 | Form persistence during OAuth, simplified channel UI |
| v0.5.0 | 2024-02-01 | Discord message format (title+link, 200 char content) |
| v0.6.0 | 2024-02-02 | Smart notifications, UI improvements, webhook name display |
| v0.7.0 | 2024-02-02 | Message template builder, test preview modal |

### v0.7.0 상세 변경사항
- **메시지 템플릿 빌더**: 피드별 Discord 메시지 포맷 커스터마이징
  - 칩 기반 비주얼 에디터 (드래그 앤 드롭 지원)
  - 템플릿 문법: `{field}`, `{field:N}` (글자수 제한), `[{field}]({link})` (링크)
  - 사용 가능한 필드: title, link, description, content, pubDate, author, categories
  - 기본 글자수 제한: 500자 (link 제외)
- **테스트 미리보기 모달**: Discord 스타일로 메시지 미리보기 후 전송
- **새 API**: `POST /api/feeds/preview-rss`, `GET /api/feeds/:id/preview`
- 우클릭 컨텍스트 메뉴: 링크 추가/제거, 글자수 제한 설정/해제

### v0.6.0 상세 변경사항
- 첫 체크 시 기존 글 저장만 (알림 안함)
- lastSentAt 이전 글은 절대 전송 안함
- Add New Feed 모달로 변경
- 피드 목록 스크롤 가능, lastSentAt 기준 정렬
- Profile Image 미리보기
- 마지막 체크/전송 시간 및 제목 표시
- 다음 체크 시간 카운트다운
- Webhook 이름 표시
- RSS 파서 User-Agent 헤더 추가 (일부 서버 호환성)

---

## 13. 라이선스

MIT License
