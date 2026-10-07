import test from 'node:test';
import assert from 'node:assert/strict';
import { getSortedBlogPosts } from '../config/blog.js';
import { selectCourseArticles } from '../config/course-article-selection.js';

test('BiOT links answer rules, planning and verification before recent news', () => {
  const selected = selectCourseArticles(getSortedBlogPosts('ru'), 'ohrana-truda');
  assert.deepEqual(selected.map(post => post.slug), [
    'biot-novye-pravila-2026-2027',
    'plan-obucheniya-personala-2027',
    'udostoverenie-ohrana-truda-proverka-kazakhstan',
  ]);
});

test('selected links require an available published destination and have no duplicates', () => {
  const available = getSortedBlogPosts('ru').filter(post => post.slug !== 'plan-obucheniya-personala-2027');
  const selected = selectCourseArticles(available, 'ohrana-truda');
  assert.equal(selected.length, 3);
  assert.equal(new Set(selected.map(post => post.slug)).size, 3);
  assert.ok(selected.every(post => available.includes(post)));
  assert.ok(!selected.some(post => post.slug === 'plan-obucheniya-personala-2027'));
});
