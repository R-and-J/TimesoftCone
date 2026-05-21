# Git 워크플로우

**상태**: 🟡 제안 — 팀 확정 필요
**팀**: 타임소프트콘 (김기철, 오지석)

---

## 1. 브랜치 전략 — GitHub Flow (권장)

2인 소규모 팀 + 학교 프로젝트 특성상 단순한 **GitHub Flow** 권장.

```
main (protected, 항상 배포 가능 상태)
  ├─ feature/ADR-005-outbox
  ├─ feature/auction-bid-api
  ├─ feature/leave-balance-schema
  └─ hotfix/escrow-precision-bug
```

### 규칙
- `main` 브랜치 직접 push 금지 → 반드시 PR 경유
- 브랜치명 규칙: `<type>/<short-description>`
  - `feature/` — 신규 기능
  - `fix/` — 버그 수정
  - `docs/` — 문서 작업
  - `refactor/` — 리팩터링
  - `chore/` — 빌드/설정
- 하나의 브랜치에 변경 **1개 이슈/1개 PR** 원칙

## 2. 커밋 메시지 규칙 — Conventional Commits

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type
| Type | 의미 | 예시 |
|---|---|---|
| `feat` | 신규 기능 | `feat(auction): 입찰 API 및 Redis 락 통합` |
| `fix` | 버그 수정 | `fix(escrow): 소수점 반올림 오차 수정` |
| `docs` | 문서 | `docs(adr): ADR-005 Outbox 패턴 확정` |
| `refactor` | 기능 변화 없는 구조 개선 | |
| `test` | 테스트 추가/수정 | |
| `chore` | 빌드·설정 | |
| `perf` | 성능 개선 | |

### Scope 예시
`auction`, `bid`, `escrow`, `hr-api`, `leave`, `dividend`, `auth`, `db`, `infra`

### 예시
```
feat(bid): Redis 분산 락을 이용한 동시 입찰 처리 구현

- ADR-006 결정 반영
- Redlock 알고리즘 사용 (TTL 5s)
- 통합 테스트 추가 (k6 부하 시나리오)

Closes #12
```

## 3. PR 규칙

### PR 제목
Conventional Commits 형식 유지.

### PR 본문 템플릿
```markdown
## 목적
<이 PR이 왜 필요한가>

## 변경 내용
- [ ] ...
- [ ] ...

## 관련 ADR / SRS
- ADR-XXX
- FR-X.X

## 테스트
- [ ] 단위 테스트 통과
- [ ] 통합 테스트 통과
- [ ] 수동 검증 시나리오: ...

## 체크리스트
- [ ] 문서 업데이트 (필요 시)
- [ ] 마이그레이션 스크립트 (DB 변경 시)
- [ ] 환경변수 추가 여부 확인
```

### 리뷰 규칙
- 2인 팀: **서로의 PR은 반드시 상호 리뷰**
- Self-merge 금지 (최소 1명 리뷰)
- `main` 머지는 **Squash and Merge** (히스토리 깔끔)

## 4. 태그 / 릴리스 전략

### 버전 체계 — Semantic Versioning
```
v<major>.<minor>.<patch>
v0.1.0  → 최초 배포 가능 버전 (MVP)
v0.2.0  → 연말 배치 기능 추가
v1.0.0  → 실제 운영 배포
```

### 태그 규칙
- `v` 접두어 필수
- Release Notes를 GitHub Release로 자동 생성

## 5. 보호 규칙 (main)

```yaml
# .github/branch-protection.yml (권장 설정)
main:
  required_reviews: 1
  dismiss_stale_reviews: true
  require_status_checks:
    - build
    - test
    - lint
  enforce_admins: false
  restrict_pushes: true
```

## 6. 금지 행위

- ❌ `git push --force` to main (절대 금지)
- ❌ 시크릿·환경변수 커밋 (`.env`, `credentials.json`)
- ❌ 빌드 결과물 커밋 (`dist/`, `build/`)
- ❌ 대용량 바이너리 커밋 (Git LFS 사용)
- ❌ 리베이스된 히스토리 push (공유 브랜치에서)

## 7. `.gitignore` 표준 항목

```gitignore
# Dependencies
node_modules/
target/
.gradle/

# Build
dist/
build/
out/

# Env / Secrets
.env
.env.*
!.env.example
credentials.json
*.pem

# IDE
.idea/
.vscode/
*.iml

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Test
coverage/
.nyc_output/
```

## 8. 역할별 Git 권한 (예시)

| 역할 | 권한 |
|---|---|
| 김기철 | Maintainer — main 보호 규칙 관리, release 권한 |
| 오지석 | Write — PR 생성/리뷰 |

## TODO

- [ ] GitHub Repository 생성 + 초기 `main` 보호 규칙 설정
- [ ] `.github/pull_request_template.md` 등록
- [ ] commitlint 설정 (Conventional Commits 강제)
- [ ] CI 워크플로우 초안 (`.github/workflows/ci.yml`)

## 관련 문서
- [tech-stack.md](tech-stack.md)
- [dev-setup.md](dev-setup.md)
