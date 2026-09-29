import assert from 'node:assert/strict';
import test from 'node:test';
import { getCourseGuidance } from '../content/course-guidance.js';
import { blogPosts } from '../config/blog.js';
import { courses } from '../config/courses.js';

const priorities = ['ohrana-truda', 'promyshlennaya-bezopasnost', 'elektrobezopasnost'];

test('priority course guidance links to existing localized articles relevant to its direction', () => {
  for (const slug of priorities) {
    for (const locale of ['ru', 'kk']) {
      const guidance = getCourseGuidance(slug, locale);
      assert.ok(guidance, `${slug}/${locale}`);
      assert.ok(guidance.articles.length >= 2 && guidance.articles.length <= 3);
      for (const link of guidance.articles) {
        const article = blogPosts.find(post => post._path === link.to);
        assert.ok(article, `${slug}/${locale}: article ${link.to} must exist`);
        assert.ok(article.title[locale] && article.bodyHtml[locale], `${link.to}: ${locale} content must exist`);
        assert.ok(article.relatedCourses.includes(slug), `${link.to}: must cover ${slug}`);
      }
    }
  }
});

test('other established course pages retain their existing content branch', () => {
  for (const course of courses.filter(course => !priorities.includes(course.slug))) {
    assert.equal(getCourseGuidance(course.slug, 'ru'), null);
    assert.equal(getCourseGuidance(course.slug, 'kk'), null);
  }
});
