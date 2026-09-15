/** Resolve an actual server version without confusing program, version or enrollment IDs. */
export function preferredProgramVersion<
  T extends { id: string; language: string; format?: string },
>(
  versions: T[],
  context: {
    selected?: string;
    versionId?: unknown;
    language: string;
    format?: unknown;
  },
): T | undefined {
  const explicit =
    versions.find((version) => version.id === context.selected) ||
    versions.find((version) => version.id === context.versionId);
  if (explicit) return explicit;
  const languageVersions = versions.filter(
    (version) => version.language === context.language,
  );
  return (
    languageVersions.find((version) => version.format === context.format) ||
    languageVersions[0] ||
    versions[0]
  );
}
