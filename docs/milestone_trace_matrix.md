# Milestone Trace Matrix (M6–M10)

Status date: **2026-04-04**.

## Acceptance trace

| Milestone | Acceptance criteria (reviewable) | Code evidence | Test evidence | Deployment / UAT evidence | Status |
|---|---|---|---|---|---|
| **M6 – Canonical scaffold ownership** | Canonical modules `00`–`21` defined with unique ownership; drifted modules mapped once to canonical owners. | `docs/scaffold_traceability.md` canonical table + drift mapping; ownership enforcement references in `tests/traceability_contract_test.py`. | `python3 tests/traceability_contract_test.py` validates module uniqueness and mapping validity. | Reviewer can inspect scaffold map + test output artifact from CI/local run. | **Done** |
| **M7 – Schema contract hardening** | Host runtime schema fixed to 13 canonical tables with ordered column contracts; append-only `audit_log` policy documented. | `08_DbSchema.gs#DbSchema.CONTRACT`; `00_WebAppEntry.gs#createHostDbClient`; `docs/schema_contract.md`. | `19_HostTestHarness.gs#runSchemaContractTests` (Apps Script) + repository traceability test references schema ownership files. | Deployment checklist requires schema registration and contract verification before release (`deployment.md`). | **Done** |
| **M8 – Skill-first workflow traceability** | Workflow actions (`enrollment`, `submission`, `delivery`, `reporting`, `offboarding`) resolve through canonical skill IDs with explicit guardrails. | `37_SkillRegistry.gs` registry/mapping; `docs/skills_registry.md` ownership/triggers/controls. | `19_HostTestHarness.gs#runTraceabilityTests` asserts mapping completeness + valid skill IDs. | UAT scripts use slash and webhook entrypoints to verify action-to-skill routing. | **Done** |
| **M9 – Architecture guardrails enforcement** | Queue-first progression, database-as-truth, GAS write ownership, event-driven progression, two-engine boundaries, idempotency/security controls documented and reviewable. | `docs/architecture_guardrails.md`; owning services: `09_LmsEnrollmentService.gs`, `12_LmsLessonService.gs`, `13a_LmsCompletionService.gs`, `33_WorkflowEngine.gs`, `13_LearnerProgressStateMachine.gs`. | `tests/traceability_contract_test.py` + host harness smoke functions in `19_HostTestHarness.gs` for command/event/webhook flows. | Runbook/deployment flows require scheduler + smoke verification (`runbook.md`, `deployment.md`). | **Done** |
| **M10 – Release-readiness trace package** | README/doc index links to registry/matrix/guardrails; traceability and schema docs cross-reference architecture evidence for audit-ready review packet. | `README.md` docs index links; `docs/scaffold_traceability.md` and `docs/schema_contract.md` cross-references; this matrix file. | Documentation review gate (PR checklist) + `python3 tests/traceability_contract_test.py` for structural integrity. | UAT sign-off packet includes these docs and test command output snapshot. | **In Progress** (docs complete; final UAT sign-off pending release cycle) |

## Notes

- “Done” means acceptance criteria have concrete code/doc/test evidence available in-repo.
- “In Progress” at M10 reflects process state: documentation package is ready, but production UAT approval is a release-governance step.
