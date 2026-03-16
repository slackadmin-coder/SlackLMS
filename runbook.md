# Operations Runbook (Simple, Step-by-Step)

This runbook is for day-to-day support.

## Service overview

The service accepts requests and writes to Google Sheets tables:
- `students`
- `enrollments`
- `automations`
- `audit_logs`

Main user action:
- Slack command `/enroll-student <studentId> <courseId>`

---

## Normal operation checklist (daily)

1. Open the spreadsheet.
2. Check `audit_logs` for new rows.
3. Confirm most recent rows have `status = success`.
4. If failures exist, use the troubleshooting section below.

---

## Troubleshooting quick map

### Symptom: Slack says unauthorized / invalid passcode
Likely cause:
- `APP_PASSCODE` not set correctly, or caller not sending the same value.

Fix:
1. Open Apps Script → Script Properties.
2. Confirm `APP_PASSCODE` is present.
3. Confirm caller sends matching value as `passcode` or `api_key`.
4. Re-test.

### Symptom: Error about invalid arguments
Likely cause:
- Command missing student or course.

Fix:
- Use exactly: `/enroll-student <studentId> <courseId>`

### Symptom: No new rows in spreadsheet
Likely cause:
- Wrong `SHEET_DB_SPREADSHEET_ID`, permission issue, or wrong deployment URL.

Fix:
1. Confirm script property `SHEET_DB_SPREADSHEET_ID` matches the target sheet.
2. Confirm script owner has edit access to that sheet.
3. Confirm Slack command points to current deployment URL.
4. Re-deploy web app if needed.

### Symptom: Same command works sometimes, fails sometimes
Likely cause:
- Temporary lock/contention or malformed payload from source.

Fix:
1. Retry once.
2. Check latest `audit_logs` row message.
3. If repeated, capture timestamp + request details and escalate.

---

## Incident response procedure

When a user reports “enrollment failed”:

1. Collect:
   - Approximate time
   - studentId
   - courseId
   - Slack channel/user
2. Check `audit_logs` around that time.
3. Identify error code/message.
4. Apply matching fix from Troubleshooting map.
5. Re-run test command.
6. Confirm row exists in `enrollments`.
7. Close incident with summary.

---

## Escalation template

Use this message to escalate to engineering:

- **Time window:**
- **Environment:** production
- **User command:**
- **Observed error code/message:**
- **Recent changes (deployment/property edits):**
- **Impact (how many users blocked):**
- **What has already been tried:**

---

## Recovery steps for major outage

If all commands are failing:

1. Pause user comms: “We are investigating enrollment command issues.”
2. Check latest deployment status in Apps Script.
3. Roll back to last known good deployment version.
4. Verify Script Properties still exist (especially `APP_PASSCODE`, `SHEET_DB_SPREADSHEET_ID`).
5. Run a known test:
   - `/enroll-student TEST-STUDENT TEST-COURSE`
6. Confirm `audit_logs` + `enrollments` updated.
7. Announce recovery.

---

## Change management notes

Any time you change config or deployment:
- Record who changed it.
- Record what changed.
- Record why.
- Run one test command immediately.

Keep this history in your team’s ops tracker.
