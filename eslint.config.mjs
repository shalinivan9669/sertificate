import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
export default tseslint.config(
  { ignores: ['.nuxt/**', '.output/**', '.vercel/**', 'node_modules/**', 'nuxt-redesign/**', '.serena/**', 'artifacts/**', '.data/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/essential'],
  { files: ['composables/useLmsApi.ts', 'server/utils/validation.ts', 'shared/course-registry.ts'], rules: { 'no-control-regex': 'off' } },
  { files: ['**/*.vue'], languageOptions: { parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.vue'] } } },
  { files: ['**/*.{js,mjs,ts,vue}'], languageOptions: { globals: { process: 'readonly', Buffer: 'readonly', console: 'readonly', URL: 'readonly', URLSearchParams: 'readonly', Headers: 'readonly', Response: 'readonly', Request: 'readonly', AbortSignal: 'readonly', fetch: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly', window: 'readonly', document: 'readonly', localStorage: 'readonly', sessionStorage: 'readonly', navigator: 'readonly', innerWidth: 'readonly', FormData: 'readonly', FileReader: 'readonly', crypto: 'readonly', atob: 'readonly', btoa: 'readonly' } }, rules: { '@typescript-eslint/no-explicit-any': 'off', '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }], 'no-unused-vars': 'off', 'no-undef': 'off', 'vue/multi-word-component-names': 'off' } },
);
