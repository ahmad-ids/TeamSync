import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('MemberDetailsSections does not contain React inline style props', () => {
  const filePath = resolve(process.cwd(), 'src/pages/MemberDetails/MemberDetailsSections.tsx');
  const source = readFileSync(filePath, 'utf8');

  assert.equal(
    source.includes('style={{'),
    false,
    'Expected MemberDetailsSections.tsx to be free of React inline style props.',
  );
});
