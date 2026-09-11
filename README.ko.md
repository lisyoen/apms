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

## 설계 문서

영문 설계 문서가 원본이며, 같은 파일명의 국문 번역본은 `docs/ko/`에 있습니다.

- [문서 목록](docs/ko/README.md)
- [아키텍처](docs/ko/ARCHITECTURE.md)
- [파일·폴더 규격](docs/ko/FOLDER-SPEC.md)
- [데이터 모델](docs/ko/DATA-MODEL.md)
- [REST API](docs/ko/API.md)
- [스케줄러와 워커](docs/ko/WORKER.md)
