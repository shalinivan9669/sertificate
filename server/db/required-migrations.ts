/** Shared release readiness contract; only additive migrations are appended. */
export const requiredMigrations = [
  '001-core.sql',
  '002-business.sql',
  '003-credential-templates.sql',
  '004-corporate-invoices.sql',
  '005-invoice-allocations.sql',
  '006-operational-incidents.sql',
  '007-learning-reminders.sql',
  '008-program-intake.sql',
  '009-staff-workflows.sql',
  '010-observability.sql',
  '011-lead-attribution.sql',
  '012-sales-links.sql',
] as const;
