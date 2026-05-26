# 개발 환경 설정 가이드

**상태**: ⚪ TODO — 기술 스택 확정 후 완성
**전제**: [tech-stack.md](tech-stack.md)의 권장 스택 기준 (NestJS + SQLite — DB 컨테이너 불필요)

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

# DB 준비 (SQLite — 파일 기반, 컨테이너 불필요)
npm run db:migrate   # dev.db 생성
npm run db:seed

# 개발 서버 기동
npm run dev
```

---

## 4. DB 컨테이너 (불필요)

> **SQLite는 파일 기반(`backend/prisma/dev.db`)이라 docker compose가 필요 없습니다.**
> `npm run db:migrate`가 `dev.db`를 생성하고 `npm run db:seed`가 시드를 넣습니다.
> 외부 DB 서버·컨테이너 0. (과거 PostgreSQL/MySQL compose 블록은 SQLite 전환으로 제거됨 — 2026-05-26.)

---

## 5. 환경변수 (.env.example)

```bash
# Server
NODE_ENV=development
PORT=3000

# Database (SQLite — 파일 기반, 외부 서버 불필요)
DATABASE_URL=file:./prisma/dev.db

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

# 통합 테스트 (SQLite 파일 DB — 컨테이너 불필요)
npm run test:e2e

# 커버리지
npm run test:cov

# 부하 테스트 (k6)
k6 run tests/load/bid-concurrent.js
```

---

## 8. 트러블슈팅

### Q1. `database is locked` (SQLite 파일 잠김)

→ SQLite는 동시 write를 직렬화하므로, 다른 프로세스(`npm run dev` · 마이그레이션 · DB 뷰어)가 `dev.db`를 잡고 있으면 발생. 점유 중인 프로세스를 닫고 재시도. 필요 시 `dev.db`를 지우고 `npm run db:migrate`로 재생성.

### Q2. SSO 콜백이 localhost에서 작동 안 함

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
