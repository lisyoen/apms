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
| `DIRIGO_SESSION_TTL_HOURS` | `24` | 일반 로그인 시 서명 JWT와 영속 `dirigo_session` 쿠키에 함께 적용하는 수명 |
| `DIRIGO_REMEMBER_TTL_DAYS` | `30` | 자동 로그인 시 서명 JWT와 쿠키에 함께 적용하는 수명 |
| `DIRIGO_LOGIN_MAX_ATTEMPTS` | `5` | 이메일과 IP 조합별 잠금 전 로그인 실패 허용 횟수 |
| `DIRIGO_LOGIN_LOCKOUT_MINUTES` | `15` | 로그인 시도 집계 및 잠금 시간 |

**ID/PW 저장**은 이메일, Base64로 난독화한 비밀번호, 자동 로그인 선택 상태를 해당 브라우저의 `localStorage`에 저장하며 공용 PC 사용을 경고합니다. 아래에 들여쓴 **자동 로그인**은 이 옵션에 종속됩니다. 자동 로그인을 선택하면 ID/PW 저장도 선택되고, ID/PW 저장을 해제하면 자동 로그인도 해제·비활성화됩니다. 로그인 API에는 저장 여부가 아닌 `remember`만 전송합니다. 자동 로그인 세션은 JWT에 `remember: true`를 포함해 30일간 유지하고, 미선택 시 24시간 유지합니다. 쿠키 `Max-Age`와 JWT 만료는 항상 같습니다.

## 계정 및 관리자 화면

*구현 상태: 구현 완료*

헤더에는 현재 표시 이름을 노출하고, 표시 이름이 없으면 계정 이메일을 사용합니다. 계정명을 선택하면 로그인 필수 `/settings`로 이동합니다. 네 카드에서 계정 정보와 표시 이름, 별도 비밀번호 변경, UI 언어·채팅 폭·기본 작업 섹션, 완료 이메일 설정을 관리합니다. 고정 저장 바는 프로필·환경설정을 저장/취소하고 미저장 이탈을 확인하며, 저장된 표시 이름은 헤더에 즉시 반영됩니다. 모바일 이메일·전화번호 자동 감지는 차단합니다.

`admin` 역할 사용자에게만 헤더의 **관리자** 링크가 보입니다. `/admin` 서버 페이지와 모든 `/api/admin/*` 핸들러는 서버에서 역할을 검증합니다. 일반 사용자가 관리자 페이지에 직접 접근하면 한국어 403 권한 화면을 표시하고, 관리자 API는 HTTP 403을 반환합니다.

## 프로젝트 챗에서 기획하기

프로젝트 챗은 명시적인 기획 키워드, 요구사항 명령형, 복수 요구사항 목록을 기획 입력으로 처리합니다. 구체적인 요구사항·결정·열린 질문을 정제한 bullet로 프로젝트 `.proposal.md`의 `## 기획 YYYY-MM-DD` 절에 기록하며, 같은 날짜 절은 재사용하고 정규화한 중복 항목은 병합합니다. “기획해볼까?”처럼 기록할 내용이 없는 발화에는 세부 내용을 질문하고 proposal을 바꾸지 않으며, 일반 질의와 상태 조회도 기록하지 않습니다.

기록에 성공하면 챗은 기획서 위치·요약·열린 질문을 고정된 네 줄 형식으로 확인합니다. 사용자가 구현·발주·배포도 명시한 경우에만 기획을 먼저 기록한 뒤 작업을 생성합니다. 자격 증명으로 의심되는 문자열은 문서에 쓰지 않고 거부합니다.

## 설계 문서

영문 설계 문서가 원본이며, 같은 파일명의 국문 번역본은 `docs/ko/`에 있습니다.

- [문서 목록](docs/ko/README.md)
- [아키텍처](docs/ko/ARCHITECTURE.md)
- [파일·폴더 규격](docs/ko/FOLDER-SPEC.md)
- [데이터 모델](docs/ko/DATA-MODEL.md)
- [REST API](docs/ko/API.md)
- [스케줄러와 워커](docs/ko/WORKER.md)
