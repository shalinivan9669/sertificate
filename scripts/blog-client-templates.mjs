// Build-time module source only. The browser imports the resulting small card
// registry and loader, not this function or the authoritative full registry.
export function renderBlogClientTemplates({ summaries, articles }) {
  const files = {};
  const entries = Object.keys(articles).map((key) => {
    const file = `blog-content/${key.replace(':', '.')}.mjs`;
    files[file] = `export default ${JSON.stringify(articles[key])};\n`;
    return `${JSON.stringify(key)}: () => import(${JSON.stringify(`./${file}`)}).then(module => module.default)`;
  });
  files['blog-summaries.mjs'] = `const posts = ${JSON.stringify(summaries)};\nconst revision = (post, locale) => locale ? post.updatedAtByLocale?.[locale] || post.updatedAt || post.date : [post.updatedAt || post.date, ...Object.values(post.updatedAtByLocale || {})].filter(Boolean).sort().at(-1);\nexport const getSortedBlogPosts = (locale) => posts.filter(post => !locale || post.publishedLocales.includes(locale)).sort((a, b) => String(revision(b, locale)).localeCompare(String(revision(a, locale))));\nexport const getBlogPublishedLocales = (path) => posts.find(post => post._path === path)?.publishedLocales || [];\n`;
  files['blog-loaders.mjs'] = `const loaders = {\n${entries.join(',\n')}\n};\nexport const loadBlogPost = (slug, locale = 'ru') => loaders[slug + ':' + (locale === 'kk' ? 'kk' : 'ru')]?.() ?? Promise.resolve(null);\n`;
  return files;
}
