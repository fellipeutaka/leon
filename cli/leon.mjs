#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { detectAgents, getSupportedAgents, installSkills, resolveSource } from 'skills';
import { pc } from './vendor/color.mjs';
import { searchMultiselect } from './vendor/search-multiselect.mjs';

const help = `Usage: leon add [options]

  --list                  List skills and their sources by category
  --skill <name>          Select a skill by name (repeatable, '*' selects all)
  --agent <id>            Install for this agent (repeatable)
  -g, --global            Install in the user's global skills directories
  -y, --yes               Use the detected agents without prompting
  -h, --help              Show this help`;

const interactive = process.stdin.isTTY && process.stdout.isTTY;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      list: { type: 'boolean' },
      skill: { type: 'string', multiple: true },
      agent: { type: 'string', multiple: true },
      global: { type: 'boolean', short: 'g' },
      yes: { type: 'boolean', short: 'y' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help || process.argv.length === 2) {
    console.log(help);
    return;
  }
  if (positionals.length !== 1 || positionals[0] !== 'add') {
    throw new Error('Expected leon add. Run leon --help for usage.');
  }

  const catalog = JSON.parse(readFileSync(new URL('../dist/catalog.json', import.meta.url), 'utf8'));
  const requested = new Set(values.skill);
  const known = new Set(catalog.map(skill => skill.name));
  const unknown = [...requested].filter(name => name !== '*' && !known.has(name));
  if (unknown.length) throw new Error(`Unknown skills: ${unknown.join(', ')}`);
  const candidates = requested.size && !requested.has('*')
    ? catalog.filter(skill => requested.has(skill.name))
    : catalog;
  if (values.list) {
    let group;
    for (const skill of candidates) {
      if (group !== skill.group) {
        group = skill.group;
        console.log(pc.bold(group));
      }
      console.log(`  ${skill.name}  ${pc.dim(skill.repo)}`);
    }
    return;
  }

  const scope = values.global ? 'global' : 'project';
  const supported = getSupportedAgents().filter(agent => !values.global || agent.globalSkillsDir);
  const invalidAgents = (values.agent ?? []).filter(id => !supported.some(agent => agent.id === id));
  if (invalidAgents.length) throw new Error(`Unsupported agents for ${scope} install: ${invalidAgents.join(', ')}`);
  if (!requested.size && !interactive) {
    throw new Error('A terminal is required for the picker. Pass --skill <name> for a non-interactive install.');
  }

  const selected = requested.size ? candidates : await searchMultiselect({
    message: `Select skills to install ${pc.dim('(space to toggle)')}`,
    items: candidates.map(skill => ({
      value: skill,
      label: skill.name,
      group: skill.group,
      detail: `${skill.repo} · ${skill.description}`,
    })),
    required: true,
    maxVisible: 20,
    searchable: false,
    showDetail: true,
    showSelectedSummary: false,
    selectGroups: true,
    selectAll: true,
  });
  if (typeof selected === 'symbol') return;

  let agents = values.agent;
  if (!agents) {
    const { agents: detected } = await detectAgents();
    const available = new Set(supported.map(agent => agent.id));
    const defaults = detected.map(agent => agent.id).filter(id => available.has(id));
    if (!defaults.length) defaults.push('universal');
    agents = values.yes || !interactive ? defaults : await searchMultiselect({
      message: 'Which agents do you want to install to?',
      items: supported.map(agent => ({
        value: agent.id,
        label: agent.name,
        hint: values.global ? agent.globalSkillsDir : agent.projectSkillsDir,
      })),
      initialSelected: defaults,
      required: true,
    });
  }
  if (typeof agents === 'symbol') return;

  const batches = new Map();
  for (const skill of selected) {
    const key = JSON.stringify([skill.repo, skill.ref]);
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(skill);
  }

  // The upstream installer writes the shared project lockfile. Finish each
  // source before starting another so the writes within this run stay ordered.
  for (const batch of batches.values()) {
    const [{ repo, ref }] = batch;
    try {
      await installBatch(batch, { repo, ref, scope, agents });
    } catch (error) {
      console.error(`${repo}: ${error.message}`);
      process.exitCode = 1;
    }
  }
}

async function installBatch(batch, { repo, ref, scope, agents }) {
  const commonPath = batch[0].path.split('/');
  for (const { path } of batch.slice(1)) {
    const parts = path.split('/');
    const mismatch = commonPath.findIndex((segment, index) => segment !== parts[index]);
    if (mismatch !== -1) commonPath.length = mismatch;
  }
  const source = commonPath.length && commonPath[0] !== '.' ? `${repo}/${commonPath.join('/')}` : repo;
  console.log(pc.dim(`Resolving ${repo}${ref ? `@${ref}` : ''}…`));
  const resolved = await resolveSource(source, { ref });
  try {
    const sourceNames = [];
    const renames = [];
    for (const skill of batch) {
      const match = resolved.skills.find(candidate => candidate.path === skill.path);
      if (!match) throw new Error(`Skill ${skill.name} is unavailable at ${skill.path}/SKILL.md`);
      sourceNames.push(match.name);
      if (match.name !== skill.name) renames.push([match.name, skill.name]);
    }
    const result = await installSkills(resolved, {
      skills: sourceNames,
      rename: Object.fromEntries(renames),
      duplicates: 'error',
      scope,
      agents,
      onWarning: warning => console.error(`${repo}: ${warning.message}`),
    });
    for (const name of new Set(result.installed.map(target => target.skill))) {
      console.log(`${pc.green('✓')} ${name} ${pc.dim(`(${repo})`)}`);
    }
    for (const { skill, agent, message } of result.failed) {
      console.error(`${repo}: ${skill} (${agent}): ${message}`);
      process.exitCode = 1;
    }
    for (const { skill, agent, reason } of result.skipped) {
      console.error(`${repo}: skipped ${skill} (${agent}): ${reason}`);
      process.exitCode = 1;
    }
  } finally {
    await resolved.dispose();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
