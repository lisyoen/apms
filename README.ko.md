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

## YAML 설정

Dirigo는 전역 설정 원천으로 `$DIRIGO_DATA_ROOT/config/dirigo.yaml`, 프로젝트 덮어쓰기로 `$DIRIGO_DATA_ROOT/projects/<slug>/project.yaml`을 사용합니다. 우선순위는 코드 기본값 → 전역 YAML → 프로젝트 YAML → 기존 `DIRIGO_*` 환경변수입니다. 파일이 없어도 기본값으로 동작합니다.

```bash
dirigo config init --local
dirigo config validate --local
dirigo config get worker.max_workers --local --json
dirigo config diff proposed.yaml --local
dirigo config apply proposed.yaml --dry-run --local
```

주석 포함 예시는 [`config/dirigo.example.yaml`](config/dirigo.example.yaml)을 참고하세요. YAML의 시크릿은 `${env:NAME}`으로만 참조하며 평문 `api_key`, `password`, `token` 값은 거부합니다. 자세한 내용은 [설정](docs/ko/CONFIG.md)과 [CLI](docs/ko/CLI.md)에 있습니다.

| 변수 | 예시/기본값 | 용도 |
|---|---:|---|
| `DIRIGO_SEARXNG_URL` | `http://localhost:8889` | 선택적 서버 전용 SearXNG 주소. 없으면 프로젝트 챗에 `web_search`를 노출하지 않음 |

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

## 프로젝트 챗 URL 읽기와 웹 검색

*구현 상태: 구현 완료*

프로젝트 챗은 공개 HTTP(S) 페이지에 `fetch_url`을 호출하고, `DIRIGO_SEARXNG_URL`이 설정되면 SearXNG 상위 5건을 가져오는 `web_search`를 호출합니다. URL 읽기는 localhost·사설/link-local·메타데이터 주소를 차단하고 최대 3회 리다이렉트마다 주소를 다시 검사하며, 10초 또는 2MB에서 중단합니다. HTML의 읽을 수 있는 본문을 추출하고 8,000자에서 절단합니다. 검색은 세션별 분당 5회로 제한합니다.

도구 결과는 최대 3라운드의 제한된 LLM 도구 루프에 주입됩니다. 답변 말미에는 `출처:` URL 블록이 붙고, 기획·작업 발주 결합 요청이면 proposal 항목과 작업 본문에도 URL을 보존합니다. 실패는 URL 접속·타임아웃·차단 상태·미지원 형식·내부망 주소와 SearXNG 연결·결과 없음(응답 엔진 수)·요청 한도를 구분해 표시합니다. 도구 대상·상태·소요 시간은 메시지 메타데이터에 저장합니다.

## 설계 문서

영문 설계 문서가 원본이며, 같은 파일명의 국문 번역본은 `docs/ko/`에 있습니다.

- [문서 목록](docs/ko/README.md)
- [아키텍처](docs/ko/ARCHITECTURE.md)
- [파일·폴더 규격](docs/ko/FOLDER-SPEC.md)
- [데이터 모델](docs/ko/DATA-MODEL.md)
- [REST API](docs/ko/API.md)
- [설정](docs/ko/CONFIG.md)
- [CLI](docs/ko/CLI.md)
- [스케줄러와 워커](docs/ko/WORKER.md)
