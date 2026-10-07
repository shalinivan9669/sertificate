import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { addTemplate, defineNuxtModule, updateTemplates } from '@nuxt/kit';
import { renderBlogClientTemplates } from '../scripts/blog-client-templates.mjs';

const execute = promisify(execFile);

export default defineNuxtModule({
  meta: { name: 'ot-blog-data' },
  async setup(_options, nuxt) {
    // A fresh process also avoids Node's transitive ESM cache during dev edits.
    const readSource = async () => {
      const { stdout } = await execute(process.execPath, [resolve(nuxt.options.rootDir, 'scripts/blog-client-data.mjs'), '--json'], { maxBuffer: 5 * 1024 * 1024 });
      return JSON.parse(stdout);
    };
    let files = renderBlogClientTemplates(await readSource());
    const registered = new Set();
    const registerTemplates = () => {
      for (const filename of Object.keys(files)) {
        if (registered.has(filename)) continue;
        registered.add(filename);
        addTemplate({
          filename,
          write: true,
          getContents: () => files[filename] ?? 'export default null;\n',
        });
      }
    };
    registerTemplates();
    nuxt.hook('builder:watch', async (_event, path) => {
      const normalized = path.replaceAll('\\', '/');
      if (!normalized.includes('content/blog/') && !['config/blog.js', 'config/blog-format.js', 'config/blog-publication.js', 'scripts/blog-client-data.mjs'].some((file) => normalized.endsWith(file))) return;
      files = renderBlogClientTemplates(await readSource());
      registerTemplates();
      await updateTemplates({ filter: (template) => template.filename.startsWith('blog-') });
    });
  },
});
