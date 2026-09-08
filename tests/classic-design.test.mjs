import { test } from 'node:test';
import { assertClassicSource } from './classic-design-contract.mjs';

test('HomePageClassic and its real index route retain the explicitly protected 413ad4a source', assertClassicSource);
