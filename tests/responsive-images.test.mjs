import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { blogPosts } from '../config/blog.js';

test('all active blog covers and the LCP hero have real responsive AVIF and WebP assets', async () => {
  const manifest = JSON.parse(await readFile(new URL('../config/responsive-images.json', import.meta.url), 'utf8'));
  const sources = ['/images/editorial/workshop-mentor-v2.png', ...blogPosts.map(post => post.image.src)];
  for (const src of sources) {
    const entry = manifest[src];
    assert.ok(entry, `missing responsive image: ${src}`);
    assert.ok(entry.width > 0 && entry.height > 0);
    for (const format of ['avif', 'webp']) {
      assert.ok(entry[format].length >= 3, `${src}: missing small screen variants`);
      let previousWidth = 0;
      for (const variant of entry[format]) {
        assert.ok(variant.width > previousWidth && variant.width <= entry.width);
        previousWidth = variant.width;
        assert.match(variant.src, new RegExp(`^/images/optimized/[a-z0-9-]+-[a-f0-9]{12}-${variant.width}\\.${format}$`));
        const bytes = await readFile(new URL(`../public${variant.src}`, import.meta.url));
        if (format === 'webp') {
          assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
          assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
        } else assert.match(bytes.toString('ascii', 4, 20), /ftypavif/);
      }
    }
  }
  const hero = manifest[sources[0]];
  const mobile = hero.avif.find(image => image.width === 768);
  const [before, after] = await Promise.all([sources[0], mobile.src].map(src => readFile(new URL(`../public${src}`, import.meta.url))));
  assert.ok(after.byteLength < before.byteLength / 10, 'Hero must not regress to a megabyte mobile image');
});
