import { test } from 'node:test';
import { assertClassicSource } from './classic-design-contract.mjs';

test('HomePageClassic retains the reviewed classic with owner-approved catalogue changes and the original index route', assertClassicSource);
