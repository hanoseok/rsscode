# RSScode

RSS 피드를 모니터링하여 새 글을 Discord 채널로 자동 전송하는 서비스.

## Features

- **다중 피드 관리**: 여러 RSS 피드를 등록하고 관리
- **피드별 Discord 채널**: 각 피드마다 다른 Discord 채널로 알림 전송 가능
- **Discord OAuth2 연동**: Webhook URL 직접 입력 없이 OAuth로 간편 연결
- **피드 활성화/비활성화**: 토글로 피드별 알림 on/off
- **테스트 전송**: 미리보기 후 Discord로 테스트 전송
- **메시지 템플릿**: 피드별 메시지 포맷 커스터마이징 (드래그 앤 드롭 에디터)
- **자동 스케줄링**: 설정 가능한 주기로 새 글 확인 (기본 10분)
- **스마트 알림**: 첫 연결 시 기존 글은 저장만, 새 글부터 알림
- **피드 내보내기/가져오기**: JSON으로 피드 설정 백업 및 복원
- **웹 UI**: 다크 테마의 관리자 인터페이스
- **Docker 지원**: 간편한 배포

## Quick Start

### 1. Discord Application 설정

1. [Discord Developer Portal](https://discord.com/developers/applications) 접속
2. **New Application** 클릭 → 이름 입력 → Create
3. 좌측 메뉴에서 **OAuth2 → General** 클릭
4. **Client ID** 복사 (나중에 사용)
5. **Client Secret** → Reset Secret → 복사 (나중에 사용)
6. **Redirects** 섹션에서 **Add Redirect** 클릭:
   ```
   https://your-domain.com/api/discord/callback
   ```
   > 로컬 테스트: `http://localhost:3000/api/discord/callback`
7. **Save Changes** 클릭

### 2. Docker로 실행

```bash
docker run -d \
  --name rsscode \
  -p 3000:3000 \
  -v rsscode_data:/data \
  -e DISCORD_CLIENT_ID=your_client_id \
  -e DISCORD_CLIENT_SECRET=your_client_secret \
  -e CHECK_INTERVAL_MINUTES=10 \
  hanoseok/rsscode:latest
```

또는 **docker-compose.yml**:
```yaml
services:
  rsscode:
    image: hanoseok/rsscode:latest
    container_name: rsscode
    restart: unless-stopped
    ports:
      - "32770:3000"
    volumes:
      - rsscode_data:/data
    environment:
      - DISCORD_CLIENT_ID=your_client_id
      - DISCORD_CLIENT_SECRET=your_client_secret
      - CHECK_INTERVAL_MINUTES=10

volumes:
  rsscode_data:
```

```bash
docker-compose up -d
```

### 3. 사용하기

1. `https://your-domain.com` 접속
2. **Add Feed** 버튼 클릭
3. **Connect** 버튼으로 Discord 채널 연결
4. RSS 피드 이름과 URL 입력
5. **Add Feed** 클릭
6. **Test** 버튼으로 테스트 메시지 전송 (첫 알림 활성화)
7. 토글로 피드 활성화

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

### 예시

```
[{title}]({link})
{description:200}
```

결과:
```
스마트스토어센터 Oracle에서 MySQL로...  ← 클릭 가능
본문 미리보기 200자까지...
```

## 알림 동작 방식

| 상황 | 동작 |
|------|------|
| 첫 체크 | 최신 글 1개만 전송, 나머지 저장 |
| 이후 체크 | 새 글만 알림 |
| Test 버튼 | 수동으로 최신 글 전송 (미리보기 후) |

## Environment Variables

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `DISCORD_CLIENT_ID` | Discord OAuth2 Client ID | - |
| `DISCORD_CLIENT_SECRET` | Discord OAuth2 Client Secret | - |
| `CHECK_INTERVAL_MINUTES` | RSS 체크 주기 (분) | `10` |
| `DATABASE_URL` | SQLite DB 경로 | `/data/rsscode.db` |
| `PORT` | 서버 포트 | `3000` |

> 환경변수가 설정되면 웹 UI의 Settings보다 우선 적용됩니다.

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
5. **환경변수** 추가:
   - `DISCORD_CLIENT_ID`
   - `DISCORD_CLIENT_SECRET`
   - `CHECK_INTERVAL_MINUTES`

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
# 의존성 설치
npm install

# 개발 서버 (hot reload)
npm run dev

# 테스트
npm test

# 빌드
npm run build
```

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/feeds` | 피드 목록 |
| GET | `/api/feeds/:id` | 피드 상세 조회 |
| POST | `/api/feeds` | 피드 등록 |
| PUT | `/api/feeds/:id` | 피드 수정 |
| DELETE | `/api/feeds/:id` | 피드 삭제 |
| GET | `/api/feeds/export` | 피드 JSON 내보내기 |
| POST | `/api/feeds/import` | 피드 JSON 가져오기 |
| POST | `/api/feeds/preview-rss` | RSS 필드 미리보기 |
| GET | `/api/feeds/:id/preview` | 테스트 메시지 미리보기 |
| POST | `/api/feeds/:id/test` | 테스트 전송 |
| GET | `/api/discord/authorize` | Discord OAuth 시작 |
| GET | `/api/discord/callback` | Discord OAuth 콜백 |
| GET | `/api/discord/channels` | 연결된 채널 목록 |
| DELETE | `/api/discord/:feedId` | Discord 연결 해제 |
| GET | `/api/settings` | 설정 조회 |
| PUT | `/api/settings` | 설정 저장 |
| POST | `/api/check` | 수동 RSS 체크 |
| GET | `/api/health` | 헬스체크 |

## License

MIT
