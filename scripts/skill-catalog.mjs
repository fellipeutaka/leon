import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// skills.sh uses frontmatter names; the CLI's plugin manifest uses directory paths.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, '.claude-plugin/marketplace.json');

try {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some(arg => !['--check', '--stdout', '--wrapper'].includes(arg))) {
    throw new Error('Usage: node scripts/skill-catalog.mjs [--check | --stdout | --wrapper]');
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
  if (args.includes('--wrapper')) {
    const { parse } = await import('yaml');
    const readJson = file => JSON.parse(readFileSync(join(root, file), 'utf8'));
    const upstream = new Map();
    for (const { repo, branch, skills } of readJson('upstream.json').upstreams) {
      for (const { localPath, remotePath } of skills) {
        if (upstream.has(localPath)) throw new Error(`Duplicate upstream path: ${localPath}`);
        upstream.set(localPath, { repo, path: remotePath, ref: branch.replace(/^refs\/tags\//, '') });
      }
    }
    const variants = new Set(readJson('downstream.json').variants.map(({ localPath }) => localPath));
    const overrides = readJson('cli/catalog-sources.json');
    for (const name of Object.keys(overrides)) {
      if (!paths.has(name)) throw new Error(`Unknown skill in CLI source overrides: ${name}`);
    }

    const groups = new Map(
      config.groupings.flatMap(group => group.skills.map(name => [name, group.title]))
    );
    const catalog = [...paths].map(([name, relativePath]) => {
      const path = relativePath.slice(2);
      const file = readFileSync(join(root, path, 'SKILL.md'), 'utf8');
      const { description } = parse(file.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1]);
      if (typeof description !== 'string' || !description.trim()) {
        throw new Error(`Missing description: ${path}`);
      }
      const override = Object.hasOwn(overrides, name) ? overrides[name] : undefined;
      const source = variants.has(path) || override?.localReason
        ? undefined
        : override ?? upstream.get(path);
      return {
        name,
        group: groups.get(name) ?? 'Other',
        description: description.replace(/\s+/g, ' ').trim(),
        ...(source ?? { repo: 'fellipeutaka/leon', path }),
      };
    });
    const groupOrder = config.groupings.map(group => group.title).sort((a, b) => a.localeCompare(b));
    if (config.notGrouped === 'top') groupOrder.unshift('Other');
    else groupOrder.push('Other');
    catalog.sort((a, b) =>
      groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group) || a.name.localeCompare(b.name)
    );
    mkdirSync(join(root, 'dist'), { recursive: true });
    writeFileSync(join(root, 'dist/catalog.json'), JSON.stringify(catalog));
  } else if (args.includes('--stdout')) {
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
