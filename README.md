# RSS to Discord

RSS 피드를 모니터링하여 새 글을 Discord 채널로 자동 전송하는 서비스.

## Features

- **다중 피드 관리**: 여러 RSS 피드를 등록하고 관리
- **피드별 Discord 채널**: 각 피드마다 다른 Discord 채널로 알림 전송 가능
- **Discord OAuth2 연동**: Webhook URL 직접 입력 없이 OAuth로 간편 연결
- **피드 활성화/비활성화**: 토글로 피드별 알림 on/off
- **테스트 전송**: 최신 RSS 항목을 Discord로 테스트 전송
- **자동 스케줄링**: 10분마다 새 글 확인 (cron 설정 가능)
- **웹 UI**: 다크 테마의 관리자 인터페이스
- **Docker 지원**: 간편한 배포

## Quick Start

### 1. Discord Application 설정

1. [Discord Developer Portal](https://discord.com/developers/applications)에서 **New Application** 클릭
2. **OAuth2 > General**에서 Client ID와 Client Secret 복사
3. **OAuth2 > General > Redirects**에 추가:
   ```
   http://localhost:3000/api/discord/callback
   ```
   > 배포 시: `https://your-domain.com/api/discord/callback`

### 2. 실행

**Docker (권장)**
```bash
docker-compose up -d
```

**개발 모드**
```bash
npm install
npm run dev
```

### 3. 초기 설정

1. http://localhost:3000 접속
2. **Settings** 섹션에서 Discord Client ID / Secret 입력 후 저장
3. RSS 피드 추가 (이름, URL 입력)
4. **Edit** 버튼 → Discord 채널 연결
5. 토글로 피드 활성화

## Environment Variables

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `DATABASE_URL` | SQLite DB 경로 | `./data/rsscode.db` |
| `PORT` | 서버 포트 | `3000` |
| `CRON_SCHEDULE` | RSS 체크 주기 (cron) | `*/10 * * * *` |

> Discord Client ID/Secret은 웹 UI의 Settings에서 설정합니다.

## Usage

### 피드 관리

- **Add Feed**: 이름과 RSS URL 입력하여 피드 추가
- **Edit**: 피드 정보 수정 및 Discord 채널 연결/변경
- **Test**: Discord로 최신 RSS 항목 테스트 전송
- **Toggle**: 피드 활성화/비활성화 (비활성화 시 알림 중단)
- **Delete**: 피드 삭제

### Discord 채널 연결

1. 피드의 **Edit** 버튼 클릭
2. Discord Channel 드롭다운에서 기존 채널 선택 또는 **Connect New** 클릭
3. Discord OAuth 인증 후 채널 선택
4. 저장

## Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript (ESM)
- **Framework**: Express.js
- **Database**: SQLite (better-sqlite3 + Drizzle ORM)
- **Validation**: Zod
- **Testing**: Vitest + Supertest

## Development

```bash
# 의존성 설치
npm install

# 개발 서버 (hot reload)
npm run dev

# 테스트
npm test
npm run test:watch

# 빌드
npm run build

# 프로덕션 실행
npm start
```

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/feeds` | 피드 목록 조회 |
| POST | `/api/feeds` | 피드 등록 |
| GET | `/api/feeds/:id` | 피드 상세 조회 |
| PUT | `/api/feeds/:id` | 피드 수정 |
| DELETE | `/api/feeds/:id` | 피드 삭제 |
| POST | `/api/feeds/:id/test` | 테스트 메시지 전송 |
| GET | `/api/discord/authorize` | Discord OAuth 시작 |
| GET | `/api/discord/channels` | 연결된 채널 목록 |
| DELETE | `/api/discord/:feedId` | Discord 연결 해제 |
| GET | `/api/settings` | 설정 조회 |
| PUT | `/api/settings` | 설정 저장 |
| POST | `/api/check` | 수동 RSS 체크 |
| GET | `/api/health` | 헬스체크 |

## Docker

```bash
# 이미지 빌드
docker build -t rsscode:latest .

# 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f
```

**docker-compose.yml** 설정:
```yaml
services:
  rsscode:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - rsscode_data:/data
    environment:
      - CRON_SCHEDULE=*/10 * * * *
```

## License

MIT
