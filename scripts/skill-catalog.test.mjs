import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function fixture(t, names = ['rust-expert']) {
  const root = mkdtempSync(join(tmpdir(), 'leon-catalog-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'skills/rust'), { recursive: true });
  copyFileSync(new URL('./skill-catalog.mjs', import.meta.url), join(root, 'scripts/skill-catalog.mjs'));
  writeFileSync(join(root, 'skills/rust/SKILL.md'), '---\nname: rust-expert\ndescription: Rust\n---\n');
  const config = { groupings: [{ title: 'Backend & Systems', description: 'Systems', skills: names }] };
  writeFileSync(join(root, 'skills.sh.json'), JSON.stringify(config));
  return {
    root,
    run: (...args) => spawnSync(process.execPath, [join(root, 'scripts/skill-catalog.mjs'), ...args], { encoding: 'utf8' }),
  };
}

test('maps a frontmatter name to its different directory name', t => {
  const f = fixture(t);
  const result = f.run('--stdout');
  assert.equal(result.status, 0, result.stderr);
  const plugin = JSON.parse(result.stdout).plugins[0];
  assert.equal(plugin.name, 'backend-systems');
  assert.deepEqual(plugin.skills, ['./skills/rust']);
  assert.equal(plugin.source, './');
});

test('rejects directory names used instead of declared skill names', t => {
  const result = fixture(t, ['rust']).run('--stdout');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown skill.*rust/);
});

test('rejects a skill assigned twice', t => {
  const result = fixture(t, ['rust-expert', 'rust-expert']).run('--stdout');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /multiple groups/);
});

test('check detects missing and stale manifests and accepts generated output', t => {
  const f = fixture(t);
  assert.equal(f.run('--check').status, 1);
  assert.equal(f.run().status, 0);
  assert.equal(f.run('--check').status, 0);
  writeFileSync(join(f.root, '.claude-plugin/marketplace.json'), '{}\n');
  const stale = f.run('--check');
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /stale/);
});
