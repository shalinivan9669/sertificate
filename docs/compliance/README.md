# OT Center Compliance Foundation

This directory is the evidence and publication-control layer for the OT Center training catalog.

## Core rule

A marketing claim is not evidence. A course is publishable only after the exact provider, legal authority/basis, current regulation, approved program, assessment process, completion document, validity/retraining rule, required consents, material rights and legal-review date are all resolved.

The default policy is **deny publication when evidence is incomplete or conflicting**.

## Current verified foundation (2026-09-08)

- The public PDF `KZ07VEK00018551` is an **attestation for the right to perform work in industrial safety**, not a generic “license”.
- The PDF is issued to **ТОО «Аттестационный центр Стандарт»**, BIN `160440010815`, and states a five-year validity term.
- Its stated scope is preparation/retraining of managers, specialists and workers in industrial safety.
- The OT Center brand/operator relationship to that legal entity must be documented separately before the site describes the attestation as an OT Center corporate authority without qualification.
- Labor-safety rules are in a transition state: Order №223 states a 12 July 2026 effective date, while the Ministry officially announced initiation of a postponement to 1 January 2027. Publication of date-sensitive №223 claims is therefore blocked until the final formal act is verified.
- Current industrial-safety rules establish category-dependent program durations (including 10 and 40 academic-hour models), commission/testing requirements and a knowledge-verification credential.
- Fire-safety rules confirm employer-organized briefing/PTM workflows; they do not by themselves prove a specific OT Center completion document.

## Registers

- `source-register.json` — evidence sources and review status.
- `authority-register.json` — provider authority documents and scope.
- `course-registry.seed.json` — conservative course evidence state.
- `document-types.json` — legal document taxonomy.
- `consent-matrix.json` — versioned consent types and evidence schema.
- `occupation-registry-map.json` — Career Enbek synchronization contract.
- `publication-gates.json` — mandatory gates and forbidden unsupported claims.
- `regulatory-change-log.json` — version/change history.
- `document-collection-status.md` — missing scan workflow.
- `competitor-gap-analysis.md` — analysis-only market comparison.
- `missing-owner-inputs.md` — evidence required from the center owner.

## Data handling

Original documents are private source artifacts by default. Public derivatives must be separately generated and reviewed for unnecessary personal data. OCR is assistive only and never changes names, numbers, seals, signatures or legal wording.

## Architecture boundary

The current repository is a Nuxt site and does not yet contain the persistence/authentication architecture needed to honestly claim production multi-tenancy, tenant isolation, RBAC, immutable audit logs, consent evidence storage or learner document issuance. Those capabilities must be implemented in a dedicated authenticated data layer before being marked complete.

The frontend foundation in this repository exposes only curated public evidence and blocks unsupported publication in the compliance registry.
