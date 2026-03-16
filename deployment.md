# Deployment Guide (No Technical Background Required)

This guide helps you publish this project so staff can use Slack to enroll students.

## Before you begin

You need:
- A Google account that can create Apps Script projects.
- Access to a Google Spreadsheet (or permission to create one).
- Admin access to the Slack workspace (to add a slash command).

---

## Step 1: Create the Google Sheet (your database)

1. Create a new Google Spreadsheet.
2. Name it something like: **LMS Enrollments DB**.
3. Copy the Spreadsheet ID from the URL.
   - URL example: `https://docs.google.com/spreadsheets/d/THIS_PART_IS_THE_ID/edit`

Save this ID for later.

---

## Step 2: Create Apps Script project

1. Go to [script.google.com](https://script.google.com).
2. Create a new standalone Apps Script project.
3. Paste in all files from this repository (or sync via your preferred Apps Script workflow).
4. Save the project.

---

## Step 3: Set Script Properties (important)

In Apps Script:
1. Open **Project Settings**.
2. Find **Script Properties**.
3. Add these keys.

### Required
- `SHEET_DB_SPREADSHEET_ID` = your spreadsheet ID from Step 1.
- `APP_PASSCODE` = a long random secret (example: 32+ chars).

### Optional but recommended
- `SLACK_DEFAULT_CHANNEL` = default channel ID for context.
- `SHEET_DB_LOCK_TIMEOUT_MS` = `30000` (default).

### Optional legacy/compatibility keys
These exist in config helpers and can be set if your org needs them:
- `SIGNING_SECRET`
- `WEBHOOK_SECRET`
- `API_KEY`
- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`

---

## Step 4: Deploy as Web App

1. In Apps Script, click **Deploy** → **New deployment**.
2. Type: **Web app**.
3. Execute as: **Me**.
4. Who has access: choose based on policy (often “Anyone” for Slack integrations).
5. Click **Deploy**.
6. Copy the Web App URL.

You will use this URL in Slack.

---

## Step 5: Configure Slack slash command

1. Go to your Slack app settings.
2. Open **Slash Commands** → **Create New Command**.
3. Command: `/enroll-student`
4. Request URL: your Apps Script Web App URL.
5. Save.

### Passcode requirement
Because this project checks `passcode`/`api_key` in request params, ensure your integration flow includes the secret passcode.

If your Slack setup cannot send custom secret params directly, place a small secure relay in front of Apps Script that appends `passcode`, or use a workflow/webhook path that can include it.

---

## Step 6: Test end-to-end

Run in Slack:

`/enroll-student STU-100 MATH-101`

Expected result:
- Slack shows success message.
- Spreadsheet has rows in:
  - `students`
  - `enrollments`
  - `audit_logs`

---

## Step 7: Go live safely

- Share command usage with staff.
- Save passcode in a password manager.
- Restrict who can edit Script Properties.
- Monitor `audit_logs` daily for first week.

---

## Rollback plan (simple)

If a deployment causes issues:
1. In Apps Script, open **Deploy**.
2. Edit deployment to previous working version.
3. Save.
4. Re-test slash command.

---

## Maintenance checklist (monthly)

- Rotate `APP_PASSCODE`.
- Confirm spreadsheet permissions are still correct.
- Send one test enrollment command.
- Review `audit_logs` for repeated errors.
