# Project Agent Rules

## Mandatory Learning Log Update

- For every execution/session that changes code, docs, infra, or runbook, update `/Users/coldbrew/Documents/photo_blog/photo_blog/docs/execution-log.md`.
- In execution log entries, do not record personal local absolute paths (for example `/Users/...`); use repository-relative paths only.
- Each log entry must include:
  - Date/time
  - Goal
  - Steps taken
  - Troubleshooting (issue, cause, fix)
  - Tech stack/tools used
  - Usage notes or commands
  - Next action

## Scope

- This rule applies to all migration phases (Supabase, Vercel, auth, upload, operations) and normal feature work.
- If there is no troubleshooting event, explicitly write `- Troubleshooting: none`.

## Global Workflow Rule (tmux Split for Multi-Agent)

- When doing multi-agent work, start from a `tmux` session and split panes before execution.
- Recommended default pane layout:
  - Pane 1: Orchestrator (main plan, decisions, integration)
  - Pane 2: Explorer/Research agent (codebase analysis, impact mapping)
  - Pane 3: Worker agent (implementation, tests, fixes)
- Assign non-overlapping file ownership to each pane/agent to avoid edit conflicts.
- Run final integration and validation from the orchestrator pane before finishing.
