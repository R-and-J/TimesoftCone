# 개발 환경 설정 가이드

**상태**: ⚪ TODO — 기술 스택 확정 후 완성
**전제**: [tech-stack.md](tech-stack.md)의 권장 스택 기준 (NestJS + PostgreSQL + Redis + Docker)

---

## 1. 시스템 요구사항

| 항목 | 최소 | 권장 |
|---|---|---|
| OS | Windows 10 / macOS 12 / Ubuntu 22.04 | Windows 11 / macOS 14 / Ubuntu 24.04 |
| RAM | 8 GB | 16 GB |
| Disk | 20 GB 가용 | 50 GB SSD |
| Docker Desktop | 4.x | 4.28+ |

---

## 2. 사전 설치 (Prerequisites)

### 2.1 공통
- **Git** 2.40+
- **Docker Desktop** (Windows/Mac) 또는 Docker Engine + Compose (Linux)
- **Node.js** 20 LTS (via [nvm](https://github.com/nvm-sh/nvm) or [Volta](https://volta.sh))
- **VS Code** 또는 IntelliJ IDEA

### 2.2 Windows 특이사항
> 팀원 개발 환경이 Windows 11이므로 추가 고려:

- **WSL 2** 활성화 권장 (Docker 성능·경로 이슈 회피)
- **Windows Terminal** + PowerShell 7 또는 WSL Ubuntu 셸
- Git 설정:
  ```powershell
  git config --global core.autocrlf input
  git config --global core.longpaths true
  ```

---

## 3. 프로젝트 초기 세팅 (예정)

```bash
# 저장소 클론
git clone https://github.com/timesoftcon/leave-auction.git
cd leave-auction

# 환경변수 복사
cp .env.example .env
# .env 파일 열어서 SSO_CLIENT_SECRET 등 채우기

# 의존성 설치
npm install

# 인프라 컨테이너 기동 (PG + Redis)
docker compose up -d

# DB 마이그레이션 + 시드
npm run db:migrate
npm run db:seed

# 개발 서버 기동
npm run dev
```

---

## 4. docker-compose.yml 예시 (작성 예정)

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: auction
      POSTGRES_PASSWORD: auction_dev
      POSTGRES_DB: auction_dev
    ports: ["5432:5432"]
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./06_tech/db-schema.sql:/docker-entrypoint-initdb.d/01-schema.sql

  redis:
    image: redis:7.2-alpine
    ports: ["6379:6379"]
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  pg_data:
  redis_data:
```

---

## 5. 환경변수 (.env.example)

```bash
# Server
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://auction:auction_dev@localhost:5432/auction_dev

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# SSO
SSO_PROVIDER=company-idp
SSO_CLIENT_ID=your-client-id
SSO_CLIENT_SECRET=...
SSO_REDIRECT_URI=http://localhost:3000/auth/sso/callback

# HR API
HR_API_BASE_URL=http://hr.company.internal
HR_API_TOKEN=...

# JWT
JWT_SECRET=change-me-in-production
JWT_EXPIRE_ACCESS=1h
JWT_EXPIRE_REFRESH=7d

# Logging
LOG_LEVEL=debug
```

---

## 6. 권장 VS Code 확장

```json
// .vscode/extensions.json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "prisma.prisma",
    "mtxr.sqltools",
    "humao.rest-client",
    "github.copilot",
    "ms-azuretools.vscode-docker"
  ]
}
```

---

## 7. 테스트 실행

```bash
# 단위 테스트
npm run test

# 통합 테스트 (docker-compose 기동 필요)
npm run test:e2e

# 커버리지
npm run test:cov

# 부하 테스트 (k6)
k6 run tests/load/bid-concurrent.js
```

---

## 8. 트러블슈팅

### Q1. Docker Desktop이 Redis에 연결 실패

→ WSL 2 모드에서 실행 중인지 확인 (`wsl --status`), `localhost` 대신 `host.docker.internal` 사용 확인.

### Q2. PostgreSQL 파티션 생성 오류

→ 파티션 테이블은 수동 생성 필요. `db-schema.sql` 끝부분 참조.

### Q3. SSO 콜백이 localhost에서 작동 안 함

→ 사내 IdP가 외부 도메인만 허용하는 경우, `ngrok`으로 터널링하거나 개발용 Mock IdP 사용.

---

## TODO

- [ ] 기술 스택 확정 후 실제 명령어 검증
- [ ] docker-compose.yml 최종본 작성
- [ ] .env.example 파일 커밋
- [ ] 프론트엔드 개발 서버 별도 섹션 추가
- [ ] 최초 세팅 스크립트 (`scripts/bootstrap.sh`) 작성

## 관련 문서
- [tech-stack.md](tech-stack.md)
- [git-workflow.md](git-workflow.md)
- [db-schema.sql](db-schema.sql)
