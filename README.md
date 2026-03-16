# LMS Library (Plain-English Guide)

This project is a **Google Apps Script backend** that helps a Slack command create/update student enrollments in a Google Sheet.

Think of it like this:
- **Slack** is where a staff member sends a command.
- **This app** receives that command and decides what to do.
- **Google Sheets** is the storage database.
- **Audit logs** are a history of what happened.

---

## What this project does

### 1) Accepts a Slack command
A person can run:

`/enroll-student <studentId> <courseId>`

Example:

`/enroll-student STU-100 MATH-101`

The app will:
- Create the student if needed.
- Create or update enrollment for that student and course.
- Save a log line so you can review what happened.

### 2) Accepts workflow webhook events
If another system sends JSON data, this app can:
- Update enrollment records (for enrollment events), or
- Save automation records (for other workflow events).

### 3) Keeps audit history
Every request (success or failure) writes to `audit_logs` so you can troubleshoot later.

---

## Where data is stored

Data is stored in one Google Spreadsheet using these logical tables (tabs):
- `students`
- `enrollments`
- `automations`
- `audit_logs`

The app uses a helper library in this repo called `sheet_db_lib` to treat spreadsheet tabs like database tables.

---

## Security at a glance

This app can require a shared secret passcode (`APP_PASSCODE`).
- If passcode is set, incoming requests must include it.
- If passcode is not set, passcode checking is skipped.

For production, set a passcode.

---

## Repo layout

- `slack_host/` → Slack/webhook app logic and `doPost` entrypoint.
- `sheet_db_lib/` → Spreadsheet database library (schemas, tables, transactions, helpers).
- `pdf_mirror/` → PDF mirror of codebase docs.

---

## Who should read what

- **New owner / manager:** this README + `deployment.md`.
- **Operations/support:** `runbook.md`.
- **Developer:** source files under `slack_host/` and `sheet_db_lib/`.

---

## Quick success checklist

You are “done” when:
- Google Apps Script web app is deployed.
- Script Properties are filled in.
- Slack slash command points to the web app URL.
- A test `/enroll-student` command returns success.
- You can see rows in `students`, `enrollments`, and `audit_logs`.

See full steps in `deployment.md`.
