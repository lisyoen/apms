# APMS - AI Project Management System

APMS는 프로젝트 지침, 작업지시서 큐, LLM 기반 멀티 워커 실행을 제공하는 오픈소스 다중 사용자 AI 프로젝트 관리 시스템입니다.

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
