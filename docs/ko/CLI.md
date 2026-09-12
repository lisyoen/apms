# Dirigo CLI

이번 단계는 `dirigo config`만 노출합니다. 로컬 파일 모드가 기본이며 `--local`로 의도를 명시할 수 있습니다. 토큰 기반 원격 제어는 후속 단계 범위이고, `--server` 골격은 `DIRIGO_URL`과 선택적 `DIRIGO_TOKEN`으로 API를 호출합니다.

```text
dirigo config init [--project slug] [--local]
dirigo config get [key] [--project slug] [--json] [--local]
dirigo config validate [file] [--project slug] [--json] [--local]
dirigo config diff [file] [--project slug] [--json] [--local]
dirigo config apply [file] [--project slug] [--dry-run] [--json] [--local]
```

파일을 생략하면 해당 스코프의 현재 YAML을 읽습니다. `apply --dry-run`은 쓰지 않고 변경 목록만 반환합니다. 종료 코드는 성공 0, 검증·명령 실패 1, 해시 충돌 2입니다. `--json`은 자동화용 JSON을 출력합니다.
