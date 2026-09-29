import fs from 'node:fs/promises';
import { blogPosts } from '../config/blog.js';

const directory = new URL('../docs/seo/', import.meta.url);
const posts = blogPosts.filter((post) => post.date === '2026-09-29');
const published = process.argv.includes('--published');
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const words = (html) => html.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
const manifest = posts.map((post, index) => ({
  number: index + 1, slug: post.slug, title: post.title, seoTitle: post.seoTitle,
  description: post.description, localSource: `content/blog/${post.slug}.js`,
  intendedUrls: { ru: `https://www.otcenter.kz${post._path}`, kk: `https://www.otcenter.kz/kk${post._path}` },
  publicationStatus: published ? 'published; verified by production HTTP' : 'prepared locally; deployment verification pending',
  words: { ru: words(post.bodyHtml.ru), kk: words(post.bodyHtml.kk) },
  titleLength: { ru: post.seoTitle.ru.length, kk: post.seoTitle.kk.length },
  descriptionLength: { ru: post.description.ru.length, kk: post.description.kk.length },
}));
let section = 0;
const linkify = (html) => {
  const prefix = `section-${++section}-`;
  return html.replace(/href="\/(?!\/)([^"\s]*)"/g, 'href="https://www.otcenter.kz/$1"')
    .replace(/\bid="([^"]+)"/g, `id="${prefix}$1"`)
    .replace(/href="#([^"]+)"/g, `href="#${prefix}$1"`);
};
const html = `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>OT Center — 10 статей, редакционный пакет</title><style>
body{margin:0;background:#f5f5f0;color:#10262a;font:18px/1.7 Arial,sans-serif}main{max-width:980px;margin:auto;padding:48px 24px}h1{font-size:44px;line-height:1.15}h2{line-height:1.3;margin-top:2em}h3{line-height:1.4}a{color:#236a6b}article{padding:36px 0;border-top:2px solid #baccc4}nav{padding:20px;background:#dde8e1}figure{margin:24px 0}img{width:100%;height:auto}table{display:block;overflow:auto;border-collapse:collapse;font-size:16px}th,td{padding:14px;border:1px solid #baccc4;min-width:140px;text-align:left}th{background:#dde8e1}.snippet{padding:24px;background:#fff;border:1px solid #baccc4}.snippet strong{font-size:23px;color:#173d78}small,figcaption{font-size:14px;color:#526b6b}details{margin:20px 0;padding:20px;background:#fff}summary{cursor:pointer;font-weight:bold}.note{padding:20px;background:#e7eee9}code{font-size:14px;overflow-wrap:anywhere}@media print{details{display:block}article{break-before:page}nav{display:none}}
</style><main><small>OT CENTER · 29 СЕНТЯБРЯ 2026</small><h1>10 статей для поискового спроса в Казахстане</h1><p class="note">Полные русские и казахские тексты, SEO title и description. ${published ? "Опубликовано на www.otcenter.kz; новые страницы проверены по HTTP." : "Подготовлено в локальном проекте; публикация ещё не проверена."} Блок сниппета — редакционный образец: Google выбирает фактический текст самостоятельно. Ссылки в статьях указывают на основные адреса сайта.</p><nav><ol>${posts.map((p,i)=>`<li><a href="#post-${i+1}">${escape(p.title.ru)}</a></li>`).join('')}</ol></nav>${posts.map((post,i)=>`<article id="post-${i+1}"><small>МАТЕРИАЛ ${i+1} / 10 · ${words(post.bodyHtml.ru)} СЛОВ RU · ${words(post.bodyHtml.kk)} СЛОВ KK</small><h2>${escape(post.title.ru)}</h2><p><code>${escape(post._path)}</code></p><div class="snippet"><small>otcenter.kz › blog</small><br><strong>${escape(post.seoTitle.ru)} — OT Center</strong><p>${escape(post.description.ru)}</p></div><figure><img src="../../public${post.image.src}" alt="${escape(post.image.alt.ru)}"><figcaption>${escape(post.image.caption?.ru || "Тематическая иллюстрация")}</figcaption></figure>${linkify(post.bodyHtml.ru)}<details lang="kk"><summary>Қазақша толық мәтін</summary><h2>${escape(post.title.kk)}</h2><div class="snippet"><strong>${escape(post.seoTitle.kk)} — OT Center</strong><p>${escape(post.description.kk)}</p></div>${linkify(post.bodyHtml.kk)}</details></article>`).join('')}</main></html>`;
await fs.mkdir(directory, { recursive: true });
await fs.writeFile(new URL('2026-09-29-articles.html', directory), html);
await fs.writeFile(new URL('2026-09-29-article-manifest.json', directory), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(JSON.stringify({ articles: posts.length, wordsRu: manifest.reduce((n,p)=>n+p.words.ru,0), wordsKk: manifest.reduce((n,p)=>n+p.words.kk,0), manifest }, null, 2));
