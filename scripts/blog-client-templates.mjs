// Build-time module source only. The browser imports the resulting small card
// registry and loader, not this function or the authoritative full registry.
export function renderBlogClientTemplates({ summaries, articles }) {
  const files = {};
  const entries = Object.keys(articles).map((key) => {
    const file = `blog-content/${key.replace(':', '.')}.mjs`;
    files[file] = `export default ${JSON.stringify(articles[key])};\n`;
    return `${JSON.stringify(key)}: () => import(${JSON.stringify(`./${file}`)}).then(module => module.default)`;
  });
  files['blog-summaries.mjs'] = `const posts = ${JSON.stringify(summaries)};\nexport const getSortedBlogPosts = () => [...posts];\n`;
  files['blog-loaders.mjs'] = `const loaders = {\n${entries.join(',\n')}\n};\nexport const loadBlogPost = (slug, locale = 'ru') => loaders[slug + ':' + (locale === 'kk' ? 'kk' : 'ru')]?.() ?? Promise.resolve(null);\n`;
  return files;
}
