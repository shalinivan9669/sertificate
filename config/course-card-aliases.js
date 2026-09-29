// Alternate public IDs for the same catalogue programme. This module must stay
// dependency-free so both SSR head and native Node SEO checks can import it.
export const courseCardAliases = Object.freeze({
  'labor-safety': 'ohrana-truda',
  'industrial-safety': 'promyshlennaya-bezopasnost',
  'fire-safety': 'ptm',
});
