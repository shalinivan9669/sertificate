import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lmsMoneyInputMinor } from '../composables/useLmsApi';

const cases: Array<[string, string, number | null]> = [
  ['one minor unit with a decimal comma', '0,01', 1],
  ['two fractional digits with a decimal point', '1.23', 123],
  ['one fractional digit is tenths, not hundredths', '1,2', 120],
  ['leading zeroes preserve the amount', '001.20', 120],
  ['surrounding whitespace is harmless', ' 12,34 ', 1234],
  ['whole currency units are converted to minor units', '100', 10000],
  ['largest safe minor-unit integer stays exact', '90071992547409.91', Number.MAX_SAFE_INTEGER],
  ['one unit above the safe integer limit is rejected', '90071992547409.92', null],
  ['exponent notation cannot change the entered amount', '1e2', null],
  ['a third fractional digit is not silently rounded', '5.001', null],
  ['zero cannot create a refund', '0', null],
  ['fractional zero cannot create a refund', '0,00', null],
  ['negative money is rejected', '-1', null],
  ['infinity is rejected', 'Infinity', null],
  ['empty input is rejected', '', null],
  ['whitespace-only input is rejected', ' ', null],
  ['missing whole units require correction', '.5', null],
  ['an unfinished fraction requires correction', '1,', null],
  ['ambiguous internal grouping spaces are rejected', '1 000', null],
  ['unbounded integer text is rejected', '10000000000000000', null],
];

for (const [description, input, expected] of cases) {
  test(`refund input: ${description}`, () => {
    assert.equal(lmsMoneyInputMinor(input), expected);
  });
}
