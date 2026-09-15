import { test } from 'node:test';
import { assertClassicSource } from './classic-design-contract.mjs';

test('reviewed classic source remains at /second while the root renders the requested editorial design', assertClassicSource);
