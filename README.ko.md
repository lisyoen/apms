# Dirigo

**Dirigo — AI-directed project management**

디리고는 프로젝트 지침, 작업지시서 큐, LLM 기반 멀티 워커 실행을 제공하는 오픈소스 다중 사용자 프로젝트 관리 시스템입니다.

## 이름

이름은 “지휘하다, 똑바로 이끌다”라는 뜻의 라틴어 *dirigere*에서 왔습니다. *Dirigo*는 1인칭 현재형으로 “나는 지휘한다” 또는 “나는 이끈다”라는 뜻입니다. 영어 *direct*·*director*, 독일어 *Dirigent*, 스페인어 *dirigir*와 같은 어근이며, 미국 메인주의 표어 “Dirigo (I lead)”이기도 합니다.

이 이름은 AI가 프로젝트를 지휘한다는 뜻을 한 단어로 압축하고 director와 conductor의 뉘앙스를 함께 담습니다. 세 음절이라 한국어와 영어로 발음하기 쉽고(디리고), 이름 충돌이 적으며, 도메인·`dirigo run` 같은 CLI·`dirigo` 패키지명으로 자연스럽게 확장할 수 있습니다.

English documentation is available in [README.md](README.md).

## 개발

`.env.example`을 `.env`로 복사하고 로컬 전용 값을 채운 뒤 실행합니다.

```bash
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

운영 서버는 기본적으로 `9107` 포트를 사용합니다. `.env`나 자격 증명을 커밋하지 마세요.

## 인증 환경 변수

*Implementation status: implemented*

| 변수 | 기본값 | 용도 |
|---|---:|---|
| `DIRIGO_SESSION_TTL_HOURS` | `24` | 서명 JWT와 영속 `dirigo_session` 쿠키에 함께 적용하는 고정 수명 |
| `DIRIGO_LOGIN_MAX_ATTEMPTS` | `5` | 이메일과 IP 조합별 잠금 전 로그인 실패 허용 횟수 |
| `DIRIGO_LOGIN_LOCKOUT_MINUTES` | `15` | 로그인 시도 집계 및 잠금 시간 |

로그인 자격 증명 체크박스는 해당 브라우저에만 값을 저장하며 서버 세션의 24시간 수명은 변경하지 않습니다.

## 계정 및 관리자 화면

*구현 상태: 최소 개인설정 화면 구현, 편집 기능은 #033 예정*

헤더에는 현재 표시 이름을 노출하고, 표시 이름이 없으면 계정 이메일을 사용합니다. 계정명을 선택하면 로그인 필수 `/settings` 화면으로 이동하며 현재 이메일, slug, 역할, 표시 이름을 읽기 전용으로 확인할 수 있습니다. 모바일 이메일·전화번호 자동 감지를 차단하며 계정명을 이메일 발송 동작으로 연결하지 않습니다.

`admin` 역할 사용자에게만 헤더의 **관리자** 링크가 보입니다. `/admin` 서버 페이지와 모든 `/api/admin/*` 핸들러는 서버에서 역할을 검증합니다. 일반 사용자가 관리자 페이지에 직접 접근하면 한국어 403 권한 화면을 표시하고, 관리자 API는 HTTP 403을 반환합니다.

## 설계 문서

영문 설계 문서가 원본이며, 같은 파일명의 국문 번역본은 `docs/ko/`에 있습니다.

- [문서 목록](docs/ko/README.md)
- [아키텍처](docs/ko/ARCHITECTURE.md)
- [파일·폴더 규격](docs/ko/FOLDER-SPEC.md)
- [데이터 모델](docs/ko/DATA-MODEL.md)
- [REST API](docs/ko/API.md)
- [스케줄러와 워커](docs/ko/WORKER.md)
