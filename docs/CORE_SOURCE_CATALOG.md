# Source inventory integration

The supplied two-page product inventory adds 11 directions to the 9 existing identifiers. `legacyCourseDirections` retains all nine legacy entries in their original order, including `labor-safety`, `industrial-safety`, and `fire-safety` aliases. `courseDirections` contains 20 unique directions. Sixteen PDF products map to five existing and eleven additional directions; four legacy directions have no matching PDF product.

The explicit database migration workflow seeds the entire 20-direction metadata inventory with one `INSERT OR IGNORE` statement. It creates no program versions, lessons, questions, prices, progress, payment or documents, and does not replace newer labels/records. No numeric rates are imported into runtime services or public DTOs. The owner chose “Стоимость по запросу”; source rate data resides in the ignored local `.data` directory, outside the public repository and frontend bundle.

Public catalog program DTOs now include:

```text
pricing: {
  mode: 'request', amountMinor: null, currency: 'KZT',
  basis: 'organization' | 'learner' | null,
  label: {ru, kk}, basisLabel: {ru, kk}
}
sourceProduct: null | {
  id, title: {ru, kk}, sourceDocumentId, sourcePage, sourceRow,
  academicContentStatus: 'not_provided',
  guidance: {kind: 'marketing_orientation', summary: {ru,kk},
             audience: {ru,kk}, topics: {ru: string[],kk: string[]}}
}
```

Guidance describes the service topic and audience. It is explicitly not a curriculum, learning outcome validation, exam bank or approval. Consultation entries retain empty `versions`. Independently authored and approved learning versions continue to use the existing immutable publication workflow. Existing actual published-version prices are separate from the unapproved source quotations and retain their explicit approved contract semantics.

An authenticated editor/reviewer/admin with fresh MFA can read `GET /api/v1/admin/programs/:id/authoring-guide`. It returns `{guide:{programId,directionId,title,pricing,sourceProduct,source,fields,missingFields,readiness,workflow}}`. `fields` is a localized checklist `{path,provided,value?,label:{ru,kk}}`. Only service name and source billing basis are marked provided. Real audience requirements, outcomes, duration, lessons, practical activities, exam rules, question bank, source references, support and document conditions need authored input. The endpoint performs no writes and offers no fabricated draft suitable for publication.

Privileged source provenance preserves the original document name, page/row, wording and clarification flags. The last source row writes ISO 14001 for a health/safety management title. This discrepancy is retained for the author, and the public direction is named health/safety management without claiming ISO 45001. Publication still requires actual content and an independent reviewer.

`ProgramData.billingBasis` accepts `learner` or `organization`; omitted values in older versions are interpreted as `learner` without rewriting immutable data. The source checklist supplies the appropriate basis, including the four organization-priced products. This field is included in published DTOs and controls actual future invoices; quoted source prices themselves never become approved prices automatically.

Actually run after this increment: core domain + invoice integration suites **29/29 pass**, strict targeted TypeScript and targeted ESLint. Checks cover nine preserved legacy entries, 20 unique catalog rows, all 16 source mappings, four organization billing bases, null public source prices, omission of raw rate fields, metadata reseed without replacing newer labels, no fabricated program versions, authoring-guide role/MFA, source discrepancy preservation, default billing compatibility and fixed-fee integer invoice allocations.
