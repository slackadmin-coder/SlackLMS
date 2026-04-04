# Host Schema Contract (Canonical)

This document defines the **single canonical runtime schema contract** for the host app.

- Source of truth in code: `DbSchema.CONTRACT` in `08_DbSchema.gs`.
- Registration source of truth: `createHostDbClient()` in `00_WebAppEntry.gs` registers only `DbSchema.CONTRACT.TABLES`.
- Contract test source of truth: `runSchemaContractTests()` in `19_HostTestHarness.gs` validates exact table set and column order.

## Canonical table set (exactly 13)

1. `learners`
2. `enrollment`
3. `lessons`
4. `learner_progress`
5. `submission_log`
6. `delivery_queue`
7. `retry_queue`
8. `audit_log`
9. `courses`
10. `modules`
11. `onboarding_requests`
12. `onboarding_checklists`
13. `onboarding_task_log`

> Non-canonical operational tables must not be added to host schema registration without a contract update.

## Column contract by table (ordered)

- `learners`
  - `id`, `slackUserId`, `email`, `name`, `status`, `createdAt`, `updatedAt`, `deletedAt`
- `enrollment`
  - `id`, `learnerId`, `courseId`, `track`, `status`, `createdAt`, `updatedAt`, `deletedAt`
- `lessons` (**exactly 41 columns, exact order**)
  - `id`, `courseId`, `moduleId`, `sequenceNumber`, `track`, `title`, `topic`, `objective`, `difficulty`, `hook`, `coreContent`, `insight`, `takeaway`, `mission`, `missionType`, `missionDuration`, `verification`, `submitBlock`, `contentRef`, `slackPayload`, `active`, `lessonType`, `estimatedMinutes`, `prerequisites`, `tags`, `deliveryChannel`, `releaseAt`, `sunsetAt`, `locale`, `owner`, `status`, `version`, `qaStatus`, `qaScore`, `qaReviewer`, `qaDate`, `sourceRef`, `migrationNotes`, `createdAt`, `updatedAt`, `deletedAt`
- `learner_progress`
  - `id`, `learnerId`, `lessonId`, `state`, `dueAt`, `completedAt`, `createdAt`, `updatedAt`, `deletedAt`
- `submission_log`
  - `id`, `learnerId`, `lessonId`, `submitKey`, `payload`, `createdAt`, `updatedAt`, `deletedAt`
- `delivery_queue`
  - `id`, `learnerId`, `lessonId`, `status`, `runAt`, `priority`, `attempts`, `availableAt`, `conditionExpr`, `createdAt`, `updatedAt`, `deletedAt`
- `retry_queue`
  - `id`, `jobType`, `payload`, `attempts`, `nextRunAt`, `status`, `lastError`, `correlationId`, `createdAt`, `updatedAt`, `deletedAt`
- `audit_log`
  - `id`, `actor`, `action`, `resourceType`, `resourceId`, `status`, `message`, `metadata`, `createdAt`, `updatedAt`, `deletedAt`
- `courses`
  - `id`, `courseTitle`, `brandScope`, `moduleOrder`, `durationMonths`, `status`, `createdAt`, `updatedAt`, `deletedAt`
- `modules`
  - `id`, `courseId`, `moduleTitle`, `monthNumber`, `lessonCount`, `status`, `createdAt`, `updatedAt`, `deletedAt`
- `onboarding_requests`
  - `id`, `requestorUserId`, `targetEmail`, `targetName`, `targetBrand`, `targetRole`, `courseId`, `source`, `status`, `createdAt`, `updatedAt`, `deletedAt`
- `onboarding_checklists`
  - `id`, `learnerId`, `taskTitle`, `taskOwner`, `dueDate`, `status`, `createdAt`, `updatedAt`, `deletedAt`
- `onboarding_task_log`
  - `id`, `checklistItemId`, `learnerId`, `eventType`, `eventBy`, `note`, `createdAt`, `updatedAt`, `deletedAt`

## Ownership and change control

- **Canonical code owner:** `08_DbSchema.gs` (`DbSchema.CONTRACT`).
- **Host registration owner:** `00_WebAppEntry.gs#createHostDbClient`.
- **Contract test owner:** `19_HostTestHarness.gs#runSchemaContractTests`.
- **Migration/repair owner:** `25_SchemaRegistry.gs#enforceWave1ManagedTables` and state migration helpers.

Any schema change must update all of the following in the same change:
1. `DbSchema.CONTRACT`.
2. Schema registration path (`createHostDbClient`).
3. Contract tests (`runSchemaContractTests`).
4. This document.

## audit_log append-only policy

`audit_log` is append-only at the repository layer:
- `insert` is allowed.
- `update` is denied.
- `remove` is denied.

Contract/security tests should assert append-only violations for `update/remove` and should **not** assume soft-delete behavior for `audit_log` reads.

## Migration guidance

1. **Additive columns only** unless a coordinated migration is approved.
2. Preserve existing column order unless the contract explicitly changes and migration code is included.
3. If introducing canonical tables/columns, add forward migration logic in `SchemaRegistry` for existing sheets.
4. Backfill defaults for new required columns before enabling strict validations.
5. Run contract tests after migration and verify:
   - 13-table exact set,
   - exact per-table ordered headers,
   - 41-column ordered `lessons` contract,
   - `audit_log` append-only enforcement.
