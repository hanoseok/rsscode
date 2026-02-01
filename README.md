# RSS to Discord

RSS 피드를 모니터링하여 새 글을 Discord로 알림 전송하는 서비스.
각 피드마다 다른 Discord 채널에 알림을 보낼 수 있습니다.

## Quick Start

### 1. Discord Application 생성

1. [Discord Developer Portal](https://discord.com/developers/applications)에서 New Application
2. OAuth2 > General에서 **Client ID**와 **Client Secret** 복사
3. OAuth2 > General > Redirects에 추가:
   - `http://localhost:3000/api/discord/callback`
   - (배포시) `https://your-domain.com/api/discord/callback`

### 2. 실행

```bash
cp .env.example .env
# DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET 설정

# Docker
docker-compose up -d

# 또는 개발 모드
npm install
npm run dev
```

### 3. 사용

1. http://localhost:3000 접속
2. RSS 피드 등록 (이름, URL)
3. "Connect Discord" 버튼 클릭하여 채널 연결
4. 10분마다 자동으로 새 글 확인 후 Discord에 전송

## Environment Variables

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `DISCORD_CLIENT_ID` | Discord OAuth2 Client ID (필수) | - |
| `DISCORD_CLIENT_SECRET` | Discord OAuth2 Client Secret (필수) | - |
| `DATABASE_URL` | SQLite DB 경로 | `./data/rsscode.db` |
| `PORT` | 서버 포트 | `3000` |
| `CRON_SCHEDULE` | RSS 체크 주기 (cron) | `*/10 * * * *` |

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/feeds` | 피드 목록 |
| POST | `/api/feeds` | 피드 등록 |
| PUT | `/api/feeds/:id` | 피드 수정 |
| DELETE | `/api/feeds/:id` | 피드 삭제 |
| GET | `/api/discord/authorize/:feedId` | Discord OAuth 시작 |
| DELETE | `/api/discord/:feedId` | Discord 연결 해제 |
| POST | `/api/check` | 수동 RSS 체크 |
| GET | `/api/health` | 헬스체크 |
