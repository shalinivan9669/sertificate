# Synthetic document operations pilot

The pilot exercises B43 and the document cases T058/T060/T061/T062/T064/T075 against an actual local Node deployment artifact. It uses browser UI for every role, learning, assessment, instructor, template, issuance, retry, repair, revoke and reissue mutation. Auth sessions and MFA are real. Additional GET requests and SQL SELECTs inspect results and audit invariants; they do not complete academic or document state.

All users, material, templates and resulting PDFs are explicitly synthetic and carry no academic or legal validity. Email, CRM, invoices and payment processing are disabled. No production account, service, database or endpoint is used. The PDF marker is visible on the rendered page. Fixtures are restricted to a new local `document-pilot.sqlite` beneath an `ot-document-pilot-*` directory, and refuse Vercel or Turso settings.

## Reproduction on Windows

Use a verified Node `.output`, copied to a unique directory outside the application. Do not run cleanup/build against an artifact used by a running server. The directory name must begin `ot-document-pilot-`.

```powershell
$pilotRoot = 'C:\Users\Admin\Documents\ot-document-pilot-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
New-Item -ItemType Directory -Path $pilotRoot | Out-Null
robocopy '.output' (Join-Path $pilotRoot '.output') /E /MT:16 /NFL /NDL /NJH /NJS /NP
if ($LASTEXITCODE -ge 8) { throw 'Artifact copy failed' }

# PDF inspection requires pypdf, Pillow, Poppler and zxing-cpp.
# Use an isolated target for an additional decoder if it is not installed.
& 'C:\Users\Admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m pip install --target (Join-Path $pilotRoot 'python') zxing-cpp
& tests/run-document-pilot.ps1 -ArtifactRoot $pilotRoot -PythonPath (Join-Path $pilotRoot 'python')
```

The launcher refuses an occupied port 3103, creates a fresh database directory for every run, copies migration SQL when absent, verifies `/api/ready`, starts the server hidden, and stops only its own process in `finally`. A local SQLite artifact requires packaged migrations or `OT_MIGRATIONS_DIR`; simply copying `.output` is insufficient. Database and server logs remain in the isolated run directory for diagnosis. Ordinary `.data/e2e.sqlite` and servers on 3101 are not touched.

For a different local tool installation set `BROWSER_PATH`, `OT_TEST_PYTHON`, `OT_TEST_UNICODE_FONT_PATH`, or `OT_TEST_PDFTOPPM`. The Python interpreter must have `pypdf`, Pillow and `zxing-cpp`. The fixture contains users and a published synthetic text/practice version only: no enrollment, completed lesson, attempt, template, credential or queued render is precreated.

## Checks and evidence

`tests/document-pilot-browser.mjs` records each UI mutation's actual HTTP status and writes `artifacts/document-pilot/report.json`. The report includes the served Nuxt build ID, not a guessed Git revision. It performs:

1. Administrator MFA and instructor role grant with reason and explicit confirmation.
2. Learner enrollment and text completion, with incomplete required practice.
3. Administrator stops new intake with a reason; public curriculum and consultation remain while enrollment is unavailable.
4. Issuer MFA and refused premature issuance, with no serial reservation.
5. Instructor MFA and practice confirmation with reason/evidence; issuer and queue tools absent for this role.
6. Learner exam start, answer autosave and server submission/grade.
7. Test AcroForm template upload and independent review. The first template intentionally lacks a Unicode font, so actual rendering fails after serial reservation.
8. Administrator queue processing and reasoned manual retry; same job and serial survive repeated failure.
9. Corrected Unicode/QR template upload and independent review, issuer repair, successful rendering with unchanged credential ID, serial, token, enrollment and assessment evidence.
10. Issuer acknowledges the actual pending-document incident with a reason; successful repair automatically resolves the incident, retained in the closed history.
11. Owner UI download, PDF text/structure inspection, Poppler render, actual QR image decoding and anonymous verification with noindex/no-store and minimal disclosure.
12. Foreign learner UI refusal and direct owner-download endpoint 404.
13. Issuer withdrawal and reissue, public revoked/superseded states, immutable old file, linked replacement, second download and decoded replacement QR.
14. Issuer previews and explicitly confirms a batch for the already eligible assignment; the result reuses the existing replacement without a third document and remains visible after reopening history.
15. Administrator searches the learner, appends a support note and linked correction, then reloads and verifies that both original and correction remain.
16. Administrator role revocation invalidating the existing issuer's privileged access/MFA authorization.
17. Administrator reopens intake after existing learning, assessment and document obligations were completed while intake was closed.
18. Instructor controls and public verification fit a 360px viewport without horizontal overflow.
19. Read-only audit validation of actor, reason, timestamp and history; browser JavaScript error collection.

The combined flows above produce 20 named browser checkpoints in the machine-readable report. No incident, note or batch state is written directly by the test; only their actual UI forms perform those writes.

`tests/document-pilot-pdf.py` requires a valid flattened PDF with no editable fields, widgets or dangling annotation references. It renders the page to PNG and decodes exactly one actual QR from that image. A successful HTTP download or `%PDF` prefix alone is insufficient.

## Initial actual findings

The initial artifact is Node build `6aa9fbb6-2c27-4ec9-bb12-8eb4f4fd60f9`, copied to `C:\Users\Admin\Documents\ot-document-pilot-20260907-194834`. Eight UI stages completed through actual owner download. The strict PDF check then failed; this is not a complete pilot pass.

The downloaded file contained six dangling page `/Annots` references after `pdf-lib` flattened its AcroForm. Both pypdf and Poppler reported missing objects/invalid XRef entries (9, 13, 16, 19, 22, 25). The page visibly contained correct Cyrillic text and the actual serial, and its QR decoded, but those successes do not make the structure valid. Preserved evidence: `dangling-annotations-failure.json`, `TEST-ONLY-dangling-original.pdf`, and `dangling-diagnostic.png` in `artifacts/document-pilot`.

The operational UI also required an undiscoverable raw practice-lesson ID. `pages/admin/index.vue` now selects the learner assignment by visible name/program and the practical lesson by title from that assignment's exact published version. It does not expose or load the answer bank. The final pilot requires these selectors; it cannot accidentally pass against the older raw-ID form.

Earlier fixture setup/selector issues are kept separate: missing migration files in the isolated copy, an overly exact accessible-name selector for a `<select>`, and test navigation directly to an empty exam instead of following the visible pre-test link. Those were pilot setup/test corrections, not application defects.

`server/services/credentials.ts` now removes unresolved annotation references and remaining form widgets after flattening, preserves valid non-form annotations, and removes the empty AcroForm tree. The regression test renders and downloads a credential with both a QR and a valid text annotation, reopens the serialized PDF, and requires every retained annotation to resolve, no widgets/form tree, the retained note and embedded QR image. `node --import tsx --test tests/credential-repair.test.ts` passed **7/7**, including the new structural regression, with no skips and exit 0. Lint of all affected source/test files and `git diff --check` also passed.

## Completed final pilot

The rebuilt Node artifact `c76fd093-af00-4e6b-9b68-b69a40dc2480` was copied to `C:\Users\Admin\Documents\ot-document-pilot-20260907-203147`. The full UI pilot finished on **2026-09-07 at 15:36:18 UTC** with **20/20 named checkpoints passed, zero failures, zero JavaScript errors and ordinary exit 0**. The report records 25 observed domain POST responses made by UI controls; authentication, lesson completion and answer autosave also ran through their actual UI controls.

The isolated database is `C:\Users\Admin\Documents\ot-document-pilot-20260907-203147\.data\run-20260907-203350\document-pilot.sqlite`. The launcher stopped its own port-3103 server after completion. No production or shared E2E database was changed. The full log is `implementation-document-pilot.log`; structured results and read-only audit evidence are `artifacts/document-pilot/report.json` and `audit.json`.

Both actual owner downloads, `TEST-ONLY-original.pdf` and `TEST-ONLY-replacement.pdf`, passed the strict PDF inspector: one page, readable Cyrillic and serial, no editable fields/widgets, no dangling annotation references, and exactly one QR decoded from the rendered image. The original and replacement QR URLs differ and resolve to the expected records; the old record changes from revoked to superseded and retains its original stored PDF hash. The final database has exactly two linked credentials even after confirmed batch issuance of the same eligible assignment.

The generated `original-pdf.png` and `replacement-pdf.png` were visually inspected: the TEST ONLY notice, full Cyrillic learner/program strings, serial, date, verification URL and issuer text are visible without clipping, and the QR remains separate and readable. `instructor-360.png` and `replacement-qr-360.png` were also inspected; the full pages remain within the viewport and their controls/text are usable. The synthetic template is a test fixture, not a production document design or an approved qualification.

The three additional operations passed through actual forms: issuer acknowledgment of a failed-render incident followed by automatic resolution after repair, administrator support-note append plus linked correction retained after reload, and issuer batch preview/confirmation returning the existing replacement as a duplicate with completed history after reload. These required no further runtime fixes in the final artifact. The actual application defects found and fixed during this pilot were the unusable practice-ID entry and the dangling PDF annotation references described above.
