# Document collection status

## Verified/reviewed public document

| Record | Legal holder | Status | Public rule |
|---|---|---|---|
| KZ07VEK00018551 — attestation for industrial-safety work | ТОО «Аттестационный центр Стандарт», BIN 160440010815 | Public PDF reviewed; OT Center ↔ holder relationship pending verification | May show exact holder, title, number and scope. Do not relabel as a generic OT Center “license”. |

## Pending owner documents

At least one placeholder record is retained in `authority-register.json` with `claimed_pending_scan`. Additional real documents must be added without inventing names, numbers or scope.

### Required collection workflow

1. Record the exact document name as supplied by the owner.
2. Record the claimed holder/legal entity and BIN if known.
3. Record number, issuing body, issue date and stated validity.
4. Record claimed scope and affected courses.
5. Upload photo/PDF/multiple pages from a phone or desktop.
6. Keep the original private.
7. Auto-rotate and run quality checks.
8. OCR only into a draft field set.
9. A human compares every legal field against the original.
10. Verify against eLicense/official registry when available.
11. Produce a separate public derivative with unnecessary personal data redacted.
12. Only then change to `ready_for_publication`.
13. Store next review/expiry reminder.

### State machine

`claimed_pending_scan → pending_verification → internal_only | ready_for_publication → expired`

Any failed authenticity/scope review goes to `rejected`.

### Prohibited transformations

No reconstructed seals, signatures, names, numbers, missing pages or invented scans. Partner documents cannot be presented as OT Center documents.
