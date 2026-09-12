# Dirigo CLI

This phase exposes only `dirigo config`. Local-file mode is the default; `--local` makes that intent explicit. Token-backed remote control belongs to a later phase, while `--server` provides the API-client skeleton using `DIRIGO_URL` and optional `DIRIGO_TOKEN`.

```text
dirigo config init [--project slug] [--local]
dirigo config get [key] [--project slug] [--json] [--local]
dirigo config validate [file] [--project slug] [--json] [--local]
dirigo config diff [file] [--project slug] [--json] [--local]
dirigo config apply [file] [--project slug] [--dry-run] [--json] [--local]
```

With no file, validate/diff/apply read the scoped current YAML. `apply --dry-run` returns changes without writing. Exit codes are 0 success, 1 validation or command failure, and 2 hash conflict. `--json` emits machine-readable output.
