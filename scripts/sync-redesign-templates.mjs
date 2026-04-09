import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

const pages = [
  {
    source: 'nuxt-redesign/pages/01_index/index.html',
    target: 'components/HomePage.vue',
  },
  {
    source: 'nuxt-redesign/pages/02_categories/index.html',
    target: 'pages/categories.vue',
  },
  {
    source: 'nuxt-redesign/pages/03_wizard/index.html',
    target: 'pages/wizard.vue',
  },
  {
    source: 'nuxt-redesign/pages/04_catalog/index.html',
    target: 'pages/courses/index.vue',
  },
  {
    source: 'nuxt-redesign/pages/05_course/index.html',
    target: 'pages/courses/[id].vue',
  },
  {
    source: 'nuxt-redesign/pages/06_learning/index.html',
    target: 'pages/learn/[id].vue',
  },
  {
    source: 'nuxt-redesign/pages/07_pre-test-confirm/index.html',
    target: 'pages/learn/[id]/confirm.vue',
  },
  {
    source: 'nuxt-redesign/pages/08_pre-test/index.html',
    target: 'pages/learn/[id]/pre-test.vue',
  },
  {
    source: 'nuxt-redesign/pages/09_exam/index.html',
    target: 'pages/learn/[id]/exam.vue',
  },
  {
    source: 'nuxt-redesign/pages/10_result-failed/index.html',
    target: 'pages/learn/[id]/failed.vue',
  },
  {
    source: 'nuxt-redesign/pages/11_payment/index.html',
    target: 'pages/payment/[courseId].vue',
  },
  {
    source: 'nuxt-redesign/pages/12_result-success/index.html',
    target: 'pages/learn/[id]/success.vue',
  },
  {
    source: 'nuxt-redesign/pages/13_certificate/index.html',
    target: 'pages/certificates/[id].vue',
  },
  {
    source: 'nuxt-redesign/pages/14_payment-pending/index.html',
    target: 'pages/payment/pending.vue',
  },
  {
    source: 'nuxt-redesign/pages/15_overview/index.html',
    target: 'pages/cabinet/index.vue',
  },
  {
    source: 'nuxt-redesign/pages/16_b2b/index.html',
    target: 'pages/b2b.vue',
  },
];

const extractBody = (html) => {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!match) {
    throw new Error('Could not locate <body> content.');
  }
  return match[1].trim();
};

const replaceTemplate = (source, template) => {
  const nextTemplate = `<template>\n${template}\n</template>`;
  if (!source.includes('<template>')) {
    throw new Error('Target file does not contain a <template> block.');
  }
  return source.replace(/<template>[\s\S]*?<\/template>/, nextTemplate);
};

for (const page of pages) {
  const sourcePath = path.join(root, page.source);
  const targetPath = path.join(root, page.target);

  const [html, vue] = await Promise.all([
    readFile(sourcePath, 'utf8'),
    readFile(targetPath, 'utf8'),
  ]);

  const body = extractBody(html);
  const nextVue = replaceTemplate(vue, body);
  await writeFile(targetPath, nextVue, 'utf8');
  console.log(`Synced template: ${page.target}`);
}
