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
| `enabled` | INTEGER | 활성화 여부 (0/1, 기본값 1) |
| `created_at` | INTEGER | 생성 시간 (Unix timestamp) |
| `last_checked_at` | INTEGER | 마지막 체크 시간 |

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
    "enabled": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "lastCheckedAt": "2024-01-01T12:00:00.000Z"
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
  "webhookGuildId": "987654321"
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
  "webhookUrl": "https://discord.com/api/webhooks/...",
  "webhookChannelId": "123456789",
  "webhookGuildId": "987654321",
  "enabled": false
}
```

**Response**: `200 OK`

#### `DELETE /api/feeds/:id`
피드 삭제

**Response**: `204 No Content`

#### `POST /api/feeds/:id/test`
테스트 메시지 전송

**Response**: `200 OK`
```json
{
  "message": "Test message sent: \"Article Title\""
}
```

**Errors**:
- `400 Bad Request`: Discord 미연결 또는 RSS 항목 없음
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
1. 사용자 → "Connect New" 클릭
          ↓
2. 서버 → Discord OAuth URL 생성 (scope: webhook.incoming)
          ↓
3. 사용자 → Discord 로그인 & 서버/채널 선택 & 권한 승인
          ↓
4. Discord → Authorization Code를 callback URL로 전송
          ↓
5. 서버 → Code로 Token 교환 → Webhook 정보 수신
          ↓
6. 서버 → Webhook URL을 DB에 저장
```

### 7.2 Webhook 메시지 포맷

```json
{
  "username": "피드 이름",
  "avatar_url": "프로필 이미지 URL",
  "embeds": [
    {
      "title": "글 제목",
      "url": "글 URL",
      "color": 5793266,
      "timestamp": "2024-01-01T12:00:00.000Z"
    }
  ]
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
   a. RSS 파싱
   b. 각 항목의 guid로 중복 체크
   c. 새 항목이면:
      - Discord로 전송
      - posts 테이블에 기록
   d. feed.last_checked_at 업데이트
```

---

## 9. 프로젝트 구조

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
│       └── docker.yml        # CI/CD
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## 10. 배포

### 10.1 Docker 이미지

**레지스트리**: Docker Hub (`hanoseok/rsscode`)

**태그 규칙**:
| 트리거 | 태그 |
|--------|------|
| `main` 브랜치 push | `latest` |
| `v1.2.3` 태그 push | `1.2.3`, `1.2`, `1`, `latest` |

### 10.2 CI/CD Pipeline

```
1. GitHub에 push/tag
       ↓
2. GitHub Actions 트리거
       ↓
3. Docker 이미지 빌드
       ↓
4. Docker Hub에 push
       ↓
5. (수동) NAS에서 이미지 업데이트
```

---

## 11. 버전 히스토리

| 버전 | 날짜 | 변경 사항 |
|------|------|----------|
| v0.1.0 | 2024-02-01 | 초기 릴리즈 |
| v0.2.0 | 2024-02-01 | Discord OAuth HTTPS 프로토콜 수정 |
| v0.3.0 | 2024-02-01 | 환경변수 지원 (Discord credentials, Check interval) |

---

## 12. 라이선스

MIT License
