---
name: test-feature
description: Test a UI feature using Puppeteer browser automation. Captures screenshots at each step, saves them as PNGs, and writes a markdown test report. Invoke with a plain-English description of the feature — e.g. /test-feature test the download to zip functionality
---

You are running a Puppeteer-based UI feature test. Follow every step below exactly.

## Phase 0 — Derive inputs from the user's description

The user's message is a plain-English description of what to test. From it you must determine two things before doing anything else:

### 1. Derive `$FEATURE` (folder name)

Convert the user's description into a concise kebab-case identifier (2–4 words max). Examples:

| User says | `$FEATURE` |
|-----------|-----------|
| "test the download to zip functionality" | `download-zip` |
| "test that users can sign up and sign in" | `auth-flow` |
| "check the live preview updates correctly" | `live-preview` |
| "verify the code editor tab switching" | `code-editor-tabs` |

The output folder is: `test/$FEATURE/` (relative to the project root).

### 2. Discover `$URL` (dev server)

Do **not** ask the user for the URL. Instead, probe common local ports in this order using PowerShell until one responds with HTTP 200:

```powershell
$ports = @(3000, 3001, 3002, 3003, 4000, 5173, 8080)
$found = $null
foreach ($p in $ports) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:$p" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $found = "http://localhost:$p"; break }
    } catch {}
}
$found
```

Use the first port that responds as `$URL`. If none respond, tell the user to start the dev server and stop.

---

## Phase 1 — Setup

1. Report to the user: "Testing **<feature description>** → folder `test/$FEATURE/`, URL `$URL`" before proceeding.

2. Create the output directory using Bash:
   ```
   mkdir "test\$FEATURE" 2>nul
   ```

3. Define a reusable PowerShell helper that saves the most recently written Puppeteer encoded screenshot to a PNG file. Use this snippet every time you need to save a screenshot — substitute `$OUTFILE` with the target path:

   ```powershell
   $snap = Get-ChildItem -Path "$env:USERPROFILE\.claude\projects\*\*\tool-results\mcp-puppeteer-puppeteer_screenshot-*.txt" |
       Sort-Object LastWriteTime -Descending | Select-Object -First 1
   $json  = Get-Content $snap.FullName -Raw | ConvertFrom-Json
   $b64   = $json[1].text -replace '^data:image/png;base64,', ''
   $bytes = [Convert]::FromBase64String($b64)
   [IO.File]::WriteAllBytes("$OUTFILE", $bytes)
   "Saved $OUTFILE ($($bytes.Length) bytes)"
   ```

   Always take the encoded screenshot **before** running this snippet so the file it finds is the one just captured.

---

## Phase 2 — Test execution

Run the test steps below in order. At every step marked **[SCREENSHOT]**:
1. Call `mcp__puppeteer__puppeteer_screenshot` with `encoded: true`, width `1400`, height `900`.
2. Immediately run the PowerShell save helper to write the PNG to `test/$FEATURE/NN_description.png` (zero-padded two-digit step number).
3. Note what you observe for the report.

### Required steps (adapt to the feature under test)

| # | Action | Screenshot filename |
|---|--------|---------------------|
| 01 | Navigate to the discovered `$URL`. Observe initial page state. | `01_initial_state.png` |
| 02 | Identify the feature entry point (button, link, form, etc.). Check whether it is enabled or disabled and why. | `02_feature_entry.png` |
| 03 | Perform the prerequisite action needed to activate the feature (e.g. generate content, fill a form, sign in). | `03_precondition.png` |
| 04 | Confirm the feature is now enabled / interactive. Use `mcp__puppeteer__puppeteer_evaluate` to verify state in JS if helpful. | `04_feature_enabled.png` |
| 05 | Trigger the feature (click the button / submit the form / etc.). Intercept any programmatic side-effects with JS if needed (e.g. intercept `document.createElement('a')` clicks to capture blob URLs). | `05_feature_triggered.png` |
| 06 | (Optional) Observe any post-action UI change (toast, modal, redirect, disabled state). | `06_post_action.png` |

Add or remove steps as needed. Keep filenames zero-padded and descriptive.

---

## Phase 3 — Write the report

After all steps are complete, write `test/$FEATURE/report.md` using the `Write` tool.

The report must contain:

```markdown
# <Feature Display Name> — Test Report

**Date:** <today's date>
**URL:** <discovered $URL>
**Feature:** <one-line description>
**Overall Result:** PASS | FAIL | PARTIAL

---

## Test Steps

### Step N — <Description>

<What was observed. Include any JS-verified values as inline code or a code block.>

![Step N](<NN_filename.png>)

---

## Summary

| Check | Result |
|-------|--------|
| <check 1> | PASS / FAIL |
| ... | ... |

---

## Observations

<Any bugs, UX gaps, or notable findings. Be specific — file path and line number where relevant.>
```

---

## Rules

- **Always save every screenshot as a PNG** before moving to the next step. Never skip the PowerShell save step.
- **Never use non-encoded screenshots** for the report (they are not persisted to disk).
- **Use `mcp__puppeteer__puppeteer_evaluate`** to assert JS state (disabled flags, DOM values, intercepted events) — do not rely on visual inspection alone.
- **Folder must exist** before writing any file. Create it in Phase 1 and never write outside `test/$FEATURE/`.
- **Report filename is always `report.md`** inside the feature folder.
- If a step produces an error, record it in the report under the relevant step and mark that check as FAIL.
- At the end, print a one-line summary to the user: overall result, folder path, and number of screenshots saved.
