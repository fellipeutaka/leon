import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// skills.sh uses frontmatter names; the CLI's plugin manifest uses directory paths.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, '.claude-plugin/marketplace.json');

try {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--check', '--stdout'].includes(arg))) {
    throw new Error('Usage: node scripts/skill-catalog.mjs [--check | --stdout]');
  }
  const config = JSON.parse(readFileSync(join(root, 'skills.sh.json'), 'utf8'));
  const paths = new Map();
  for (const entry of readdirSync(join(root, 'skills'), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = join(root, 'skills', entry.name, 'SKILL.md');
    if (!existsSync(file)) continue;
    const frontmatter = readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const rawName = frontmatter?.[1].match(/^name:\s*(.+)$/m)?.[1].trim();
    const name = rawName?.replace(/^(["'])(.*)\1$/, '$2');
    if (!name || paths.has(name)) throw new Error(`Missing or duplicate skill name: ${entry.name}`);
    paths.set(name, `./skills/${entry.name}`);
  }
  const used = new Set();
  const groupNames = new Set();
  const plugins = config.groupings.map(group => {
    const name = group.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!name || groupNames.has(name)) throw new Error(`Duplicate or empty group: ${group.title}`);
    groupNames.add(name);
    const skills = group.skills.map(skill => {
      if (!paths.has(skill)) throw new Error(`Unknown skill in ${group.title}: ${skill}`);
      if (used.has(skill)) throw new Error(`Skill appears in multiple groups: ${skill}`);
      used.add(skill);
      return paths.get(skill);
    });
    return { name, description: group.description, source: './', strict: false, skills };
  });
  const output = JSON.stringify({ name: 'leon', owner: { name: 'fellipeutaka' }, plugins }, null, 2) + '\n';
  if (args.includes('--stdout')) {
    process.stdout.write(output);
  } else if (args.includes('--check')) {
    if (!existsSync(target) || readFileSync(target, 'utf8') !== output) {
      throw new Error('CLI catalog is missing or stale. Run npm run catalog:generate.');
    }
    console.log(`Catalog valid: ${plugins.length} groups, ${used.size} grouped skills.`);
  } else {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, output);
    console.log('Updated .claude-plugin/marketplace.json from skills.sh.json.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
