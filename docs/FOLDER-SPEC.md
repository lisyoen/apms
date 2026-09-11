# Dirigo file and folder specifications

## 1. Purpose

*Implementation status: partial*

This document defines the user/project documentation and file-based work queue specifications under `DIRIGO_data_root`.
All path examples are data root relative paths.
The contents of the file are the original work, and the DB is the index to search and aggregate them.

## 2. Entire tree

*Implementation status: implemented*

```text
DIRIGO_DATA_ROOT/
└── {user}/
    ├── docs/
    │   └── *.md
    └── {project}/
        ├── docs/
        │   ├── {project}.guide.md
        │   ├── {project}.setting.md
        │   ├── {project}.proposal.md
        │   ├── {project}.dev.md
        │   └── {project}.next.md
        └── tasks/
            ├── pending/
            ├── in-progress/
            ├── done/
            ├── failed/
            └── reports/
```

## 3. Route segment rules

*Implementation status: implemented*

| Segments | Rules | Examples |
|---|---|---|
| `{user}` | Lowercase alphanumeric characters and hyphens, 2-63 characters | `team-user` |
| `{project}` | Lowercase alphanumeric characters and hyphens, 2-63 characters | `sample-app` |
| Extension | UTF-8 Markdown only | `.md` |
| Separator | Express with `/` regardless of operating system | `user/project/docs` |

Dots, empty segments, `..`, leading and trailing hyphens are not allowed.
Keep the user display name and project display name separate in the DB and use only the slug in the path.
Symbolic links are excluded from browsing and writing.
If the normalized real path goes out of the data route, the request is rejected.

## 4. User documentation

*Implementation status: partial*

`{user}/docs/` stores user instructions that are common to all projects.
We recommend an explanatory kebab-case that does not conflict with the filename.
User guidance takes precedence over project guidance, and project guidance takes precedence in the event of a conflict.
Incognito and API keys are not stored in Markdown.

| Document example | Intended use |
|---|---|
| `preferences.md` | Language, Output format, Tendency |
| `coding.md` | Common coding conventions |
| `review.md' | Criteria for review and completion |

## 5. Project documentation

*Implementation status: implemented*

| file | role | created by |
|---|---|---|
| `{project} .guide.md` | Project instructions always followed by agents | Users/Admins |
| `{project} .setting.md` | Non-sensitive execution settings and project options | System/User |
| `{project} .proposal.md` | Definitive Planning and Scope | Users/Chatbots |
| `{project} .dev.md` | Development status, history, next steps | Worker/user |
| `{project} .next.md` | Session Handover Summary | Chatbot |

When creating a project, atomically create all five files. `guide`, `proposal`, `dev`, and `next` use a minimum section skeleton; `setting` uses the complete template in section 18.
Selected documents that are missing are treated the same as empty documents, while project initialization guarantees every template.
Document changes are made in the following order: temporary file writing, flush, rename of the same directory.

## 6. Work Queue Directory

*Implementation status: implemented*

| Directory | Meaning | Writing Subject |
|---|---|---|
| `pending/` | Action waiting for execution | API, Scheduler |
| `in-progress/` | Work where workers have leases | Scheduler |
| `done/` | Successful End Work Order | worker Runner |
| `failed/` | Failed · Cancel · Timeout Work Order | worker Runner |
| `reports/` | Successful & Failed Execution Reports | worker Runner |

The same working file must exist in exactly one of your state directories.
Since the report is not a status, it will be kept independently in `reports/`.

## 7. File naming conventions

*Implementation status: implemented*

The work order is in the format `YYYYMMDD-###-task.md`.
Report is formatted as` YYYYMMDD-###-report.md `.
The date is the creation date as of UTC used by the project.
The number is a 3-digit 0-filled decimal number from 001 to 999.
Tasks and reports share the same date and number.

| valid | reason |
|---|---|
| `20260909-001-task.md` | Exact date · number · type |
| `20260909-001-report.md` | Tasks and corresponding reports |

| Invalid | Reason |
|---|---|
| `2026-09-09-1-task.md` | Date and number format error |
| `20260909-000-task.md` | Forbid number 000 |
| `20260909-001-fix.md` | Type suffix error |

## 8. Number allocation

*Implementation status: partial*

1. Scope based on user, project and UTC date.
2. Secure the next number of that date in the DB transaction as a row lock.
3. Reconfirm the existence of the same number in your status directory and reports.
4. If it crashes, retry with this number:
5. The number where the file was created will not be reused after deletion.
6. If 999 is exhausted, refuse the order and demand the next date or operator action.

When recovering the DB, scan all directories and start after the maximum by date.
In the simultaneous ordering, the only constraint is` (project_id, task_date, sequence) `.

## 9. Frontmatter Schema

*Implementation status: implemented*

```yaml
---
title: fix login errors
project: sample-app
user: team-user
pre-task: 20260909-001-task.md
next-task: 20260909-003-task.md
type: task
created_at: 2026-09-09T06:00:00Z
timeout_min: 20
---
```

| Field | Type | Required | Rule |
|---|---|---|---|
| `title` | string | Yes | 1 line, 1-120 characters |
| `project` | slug | Yes | Matches projects in path |
| `user` | slug | Yes | Matches a user in the path |
| `pre-task` | string/null | Yes | Prerequisite filename or `null` |
| `next-task` | string/null | Yes | Follow-up filename or `null` |
| `type` | enum | Yes | `task` or `report` |
| `created_at` | datetime | Yes | ISO 8601 UTC |
| `timeout_min` | integer | task only | default 20, allow 1-1440 |

Preserve unknown keys, but ignore the core scheduler.
Reject duplicate keys, YAML aliases, and actionable tags.
The `pre-task' and `next-task` of the report copy the corresponding task value.

## 10. Working Body Specifications

*Implementation status: implemented*

The recommended section order is as follows:

```markdown
Task Title
Background
objectives
Scope of Works
## Out of scope
## Implementation requirements
Validation Checklist
## Completion report
```

Write goals with verifiable results.
In the scope of work, write only accessible project relative paths.
The completion checklist includes testing, change files, and generating reports.
External system changes specify the permissions required and the behavior in the event of failure.

## 11. Report Body Specification

*Implementation status: implemented*

```markdown
Task Report
Results
Changes
## Validation results
## Run information
## Remaining issues
```

Reports generate both successes and failures.
In the execution information, write the run ID, start and end time, end code, and timeout.
Log summaries and log identifiers instead of full text.

## 12. Status transition

*Implementation status: implemented*

```mermaid
stateDiagram-v2
[*] --> pending: ordering
pending --> in-progress: preceding completion + slots secured
in-progress --> done: Success + Report
in-progress --> failed: failure/timeout + report
failed --> pending: user retry
  done --> [*]
```

State transitions are performed with an atomic `rename` within the same mount.
Check the object file member before moving and prohibit overwriting.
update DB status after rename success.
When DB update fails, the regulator modifies the DB based on the actual directory.
Issue a retry for a new run without reverting from `done` to `in-progress` directly.

## 13. Dependencies

*Implementation status: partial*

`pre-task: null` is a stand-alone operation.
If a value exists, the exact filename of the same project must be referenced
It can only be picked up when the preceding work file is in `done/`.
If the precedent task is` failed/`, the follow-up task will remain in pending and indicate the reason for blocking.
Self-references and circular references are rejected at creation.
`next-task' is a hint to enqueue the subsequent draft that exists upon success into pending.

## 14. guide Specifications

*Implementation status: partial*

`{project} .guide.md` replaces the project guidance role in ClaudeQ.
Always load before creating chatbot prompts and executing workers.
After the user's common instructions, place them in front of the work order.

```markdown
# Project Instructions
Project Purpose:
## Technology stack and structure
## Task rules
## Security and prohibitions
## Testing and validation
## Deployment rules
## Definition of completion
```

| Section | Required | Content |
|---|---|---|
| Project purpose | Example | Goals and users |
| Technology Stack and Structure | Example | Runtime, Framework, Key Paths |
| Working Rules | Examples | Style and Change Principles |
| Security and Prohibitions | Yes | Sensitive Information, Prohibited Actions |
| Test and Verify | Yes | Mandatory commands and checks |
| Deployment rules | No | Deployment steps and approvals |
| Definition of Completion | Example | Reporting and Output Criteria |

the changes to the guide are applied from the tasks that are created and executed afterwards.
For reproducibility, save the SHA-256 of the used guide in task_run.

## 15. Handover Document

*Implementation status: partial*

`{project} .next.md` will update atomically when context reaches 70%.
Include current goals, confirmation decisions, recent work, open questions, and the following actions:
Do not duplicate the original dialogue text or secret values.
The new session reads in the following order: guide, proposal, next, and restores continuity.

## 16. Synchronization and audit

*Implementation status: partial*

Carry out periodic full adjustments without trusting only the file monitoring events.
The file hash determines the DB mismatch with the external modification.
The parsing failure file does not move and leaves the error in the operational log.
All status changes will record the actor, previous and next paths, and time in the audit log.

## 17. Validation checklist

*Implementation status: partial*

- All paths are inside `DIRIGO_data_root`.
- User and project slug match DB ownership.
- The working file name satisfies the date and number rules.
- The frontmatter required fields and body are valid.
- There is only one working file in one state directory.
- The report shares the date and number of the corresponding task.
- The state move is an atomic rename of the same filesystem.
- Incognito is not included in the Markdown document.

## 18. Project setting template

*Implementation status: implemented*

`{project}.setting.md` starts with every key accepted by the setting validator: `repo`, `branch`, `push_policy`, `verify_cmd`, `workdir`, `workspace`, remote workspace fields, `max_concurrent`, `guides`, and secret-name references. Values in this tracked template are non-sensitive defaults only.

The Korean body has six required sections: project purpose and operation, task-writing rules, worker execution, report location and format, prohibitions, and public-repository precautions. `{project}` and `{created_at}` are replaced at creation time. The same template is used by the API, migration, and validator tests so a newly created setting document opens normally in the administrator editor.

## 19. Setting migration

*Implementation status: implemented*

Run `node scripts/migrate-settings.mjs` (or pass `--dry-run`) to list missing and title-only setting documents beneath every user/project in `DIRIGO_DATA_ROOT` without changing them. Review the printed relative paths, then run `node scripts/migrate-settings.mjs --apply` to write them atomically. `--root=/path/to/data` may select another data root.

The migration preserves existing frontmatter values and fills missing keys from the template. A document with meaningful body content is never changed. Back up operational data and run dry-run before apply.
