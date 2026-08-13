import test from 'node:test';
import assert from 'node:assert/strict';
import { canStartNextRound } from './roundUtils.js';

test('allows rounds until the selected max is reached', () => {
  assert.equal(canStartNextRound(0, 5, false), true);
  assert.equal(canStartNextRound(4, 5, false), true);
  assert.equal(canStartNextRound(5, 5, false), false);
  assert.equal(canStartNextRound(5, 5, true), false);
});
