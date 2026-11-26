import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const cli = fileURLToPath(new URL('../cli/leon.mjs', import.meta.url));

test('one install records each selected source and keeps the curated alias', t => {
  const root = mkdtempSync(join(tmpdir(), 'leon-install-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = {
    ...process.env,
    DISABLE_TELEMETRY: '1',
    GIT_ALLOW_PROTOCOL: 'file',
    GIT_CONFIG_COUNT: '2',
  };
  const sources = [
    { repo: 'fellipeutaka/leon', dir: 'shadcn-dream', name: 'shadcn-dream' },
    { repo: 'vercel-labs/agent-skills', dir: 'react-native-skills', name: 'vercel-react-native-skills' },
  ];
  for (const [index, { repo, dir, name }] of sources.entries()) {
    const checkout = join(root, `source-${index}`);
    const skillDir = join(checkout, 'skills', dir);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), `---\nname: ${name}\ndescription: Test skill\n---\n${repo}\n`);
    execFileSync('git', ['init', '-q', '-b', 'main', checkout]);
    execFileSync('git', ['-C', checkout, 'add', '.']);
    execFileSync('git', [
      '-C', checkout, '-c', 'user.name=Leon test', '-c', 'user.email=test@example.com',
      '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'Add skill',
    ]);
    env[`GIT_CONFIG_KEY_${index}`] = `url.${pathToFileURL(checkout).href}.insteadOf`;
    env[`GIT_CONFIG_VALUE_${index}`] = `https://github.com/${repo}.git`;
  }

  const cwd = join(root, 'project');
  mkdirSync(cwd);
  const offline = 'data:text/javascript,globalThis.fetch=async()=>new Response(null,{status:404})';
  execFileSync(process.execPath, [
    '--import', offline, cli, 'add', '--agent', 'universal',
    '--skill', 'shadcn-dream', '--skill', 'react-native-skills',
  ], { cwd, env });
  const { skills } = JSON.parse(readFileSync(join(cwd, 'skills-lock.json'), 'utf8'));
  assert.deepEqual(Object.keys(skills).sort(), ['react-native-skills', 'shadcn-dream']);
  assert.equal(skills['shadcn-dream'].source, 'fellipeutaka/leon');
  assert.equal(skills['react-native-skills'].source, 'vercel-labs/agent-skills');
  assert.equal(skills['react-native-skills'].skillPath, 'skills/react-native-skills/SKILL.md');
  assert.equal(skills['react-native-skills'].skillName, 'vercel-react-native-skills');
  assert.match(
    readFileSync(join(cwd, '.agents/skills/react-native-skills/SKILL.md'), 'utf8'),
    /^name: react-native-skills$/m
  );
});
