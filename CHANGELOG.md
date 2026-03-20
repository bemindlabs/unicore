# Changelog — @unicore (Community Edition)

## [0.0.2] - 2026-03-20

### Added
- `TiktokAdapter` in `@unicore/integrations` — TikTok Marketing API v1.3 adapter with campaigns, ad groups, ads sync, injectable `ITiktokClient`, and 14 unit tests (UNC-459)
- `DELETE /api/v1/admin/users/:id` endpoint with self-deletion guard, last-OWNER guard, ChatHistory cleanup, Task assignee nullification, and audit logging (UNC-460)
- Admin user delete button + confirmation dialog in dashboard (UNC-461)
- `admin.controller.spec.ts` — 14 unit tests for AdminController (UNC-462)
- Role update guards — prevent self-demotion and last-OWNER demotion (UNC-463)
- Task delete ownership check (creator or OWNER only) and audit logging (UNC-464)
- Settings/Integrations page redesign — 16 integrations, 5 categories, tab navigation, search, connected state styling, field hints, Pro tier gating per integration

### Fixed
- Task delete endpoint now requires ownership (was open to any authenticated user)
- Admin role update uses `BadRequestException` instead of generic `Error`
- Admin role update validates OWNER count before demotion

## [0.0.1] - 2026-03-10

- Initial release — full scaffold of dashboard, api-gateway, erp, ai-engine, rag, bootstrap, openclaw-gateway, workflow, and all packages
