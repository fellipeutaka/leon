import { join } from "node:path";

interface SkillEntry {
	remotePath: string;
	localPath: string;
	sha?: string;
	lastSync?: string;
}

interface ReferenceEntry {
	remotePath: string;
	description: string;
	sha?: string;
	lastSync?: string;
}

interface UpstreamEntry {
	repo: string;
	branch: string;
	skills: SkillEntry[];
	references?: ReferenceEntry[];
}

interface UpstreamManifest {
	upstreams: UpstreamEntry[];
}

interface CliOptions {
	newOnly: boolean;
	repo?: string;
	skill?: string;
	help: boolean;
}

interface GitHubContent {
	name: string;
	path: string;
	sha: string;
	type: "file" | "dir";
	download_url: string | null;
}

const ROOT = join(import.meta.dir, "..");
const MANIFEST_PATH = join(ROOT, "upstream.json");

function parseArgs(args: string[]): CliOptions {
	const options: CliOptions = { newOnly: false, help: false };

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		if (arg === "--new-only") {
			options.newOnly = true;
			continue;
		}

		if (arg === "--help" || arg === "-h") {
			options.help = true;
			continue;
		}

		if (arg === "--repo" || arg === "--skill") {
			const value = args[i + 1];
			if (!value || value.startsWith("--")) {
				throw new Error(`${arg} requires a value`);
			}

			if (arg === "--repo") options.repo = value;
			else options.skill = value;
			i++;
			continue;
		}

		throw new Error(`Unknown option: ${arg}`);
	}

	return options;
}

function printHelp(): void {
	console.log(
		[
			"Usage: bun sync [--new-only] [--repo <owner/repo>] [--skill <name-or-path>]",
			"",
			"Options:",
			"  --new-only              Sync only entries without lastSync",
			"  --repo <owner/repo>     Sync only one upstream repository",
			"  --skill <name-or-path>  Sync only a matching skill",
			"  -h, --help              Show this help",
		].join("\n"),
	);
}

function matchesSkill(skill: SkillEntry, selector: string): boolean {
	return [skill.remotePath, skill.localPath].some(
		(path) => path === selector || path.split("/").at(-1) === selector,
	);
}

const ghHeaders = {
	Accept: "application/vnd.github.v3+json",
	...(process.env.GITHUB_TOKEN && {
		Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
	}),
};

async function getPathSha(
	repo: string,
	branch: string,
	dirPath: string,
): Promise<string> {
	const lastSlash = dirPath.lastIndexOf("/");
	const parentPath = lastSlash === -1 ? "" : dirPath.slice(0, lastSlash);
	const name = dirPath.slice(lastSlash + 1);

	const url =
		parentPath === ""
			? `https://api.github.com/repos/${repo}/contents?ref=${branch}`
			: `https://api.github.com/repos/${repo}/contents/${parentPath}?ref=${branch}`;

	const res = await fetch(url, { headers: ghHeaders });

	if (!res.ok) {
		throw new Error(`Failed to get path SHA: ${res.status} ${res.statusText}`);
	}

	const items: GitHubContent[] = await res.json();
	const entry = items.find((i) => i.name === name);
	if (!entry) throw new Error(`Path not found in repo: ${dirPath}`);
	return entry.sha;
}

async function fetchDirectory(
	repo: string,
	branch: string,
	dirPath: string,
): Promise<{ path: string; content: string }[]> {
	const url = `https://api.github.com/repos/${repo}/contents/${dirPath}?ref=${branch}`;
	const res = await fetch(url, { headers: ghHeaders });

	if (!res.ok) {
		throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
	}

	const items: GitHubContent[] = await res.json();

	const results = await Promise.all(
		items.map(async (item) => {
			if (item.type === "file" && item.download_url) {
				return await fetch(item.download_url)
					.then((r) => r.text())
					.then((content) => [{ path: item.path, content }]);
			}
			if (item.type === "dir") {
				return await fetchDirectory(repo, branch, item.path);
			}
			return [];
		}),
	);

	return results.flat();
}

async function syncSkill(
	upstream: UpstreamEntry,
	skill: SkillEntry,
): Promise<void> {
	console.log(`  Syncing ${skill.remotePath} -> ${skill.localPath}`);

	const files = await fetchDirectory(
		upstream.repo,
		upstream.branch,
		skill.remotePath,
	);

	for (const file of files) {
		const relativePath = file.path.slice(skill.remotePath.length);
		const fullPath = join(ROOT, skill.localPath, relativePath);
		await Bun.write(fullPath, file.content);
		console.log(`    wrote ${skill.localPath}${relativePath}`);
	}
}

try {
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		printHelp();
		process.exit(0);
	}
	const skillSelector = options.skill;

	const manifest: UpstreamManifest = await Bun.file(MANIFEST_PATH).json();
	const repoCandidates = manifest.upstreams.filter(
		(upstream) => !options.repo || upstream.repo === options.repo,
	);

	if (options.repo && repoCandidates.length === 0) {
		throw new Error(`Upstream repository not found: ${options.repo}`);
	}

	if (
		skillSelector &&
		!repoCandidates.some((upstream) =>
			upstream.skills.some((skill) => matchesSkill(skill, skillSelector)),
		)
	) {
		const scope = options.repo ? ` in ${options.repo}` : "";
		throw new Error(`Skill not found${scope}: ${skillSelector}`);
	}

	const upstreams = repoCandidates.filter((upstream) => {
		const matchingSkills = upstream.skills.filter(
			(skill) => !skillSelector || matchesSkill(skill, skillSelector),
		);
		const matchingReferences = skillSelector ? [] : (upstream.references ?? []);

		return (
			matchingSkills.length > 0 || matchingReferences.length > 0
		) &&
			(!options.newOnly ||
				matchingSkills.some((skill) => !skill.lastSync) ||
				matchingReferences.some((reference) => !reference.lastSync));
	});

	if (upstreams.length === 0) {
		console.log(
			options.newOnly
				? "No new matching upstreams to sync."
				: "No matching upstreams to sync.",
		);
		process.exit(0);
	}

	for (const upstream of upstreams) {
		console.log(`\nUpstream: ${upstream.repo} (${upstream.branch})`);

		const matchingSkills = upstream.skills.filter(
			(skill) => !skillSelector || matchesSkill(skill, skillSelector),
		);
		const skills = options.newOnly
			? matchingSkills.filter((skill) => !skill.lastSync)
			: matchingSkills;

		await Promise.all(
			skills.map(async (skill) => {
				try {
					const sha = await getPathSha(
						upstream.repo,
						upstream.branch,
						skill.remotePath,
					);
					console.log(`  ${skill.remotePath} SHA: ${sha.slice(0, 8)}`);
					await syncSkill(upstream, skill);
					skill.sha = sha;
					skill.lastSync = new Date().toISOString();
				} catch (err) {
					console.error(
						`  ✗ Failed to sync ${skill.remotePath}: ${err instanceof Error ? err.message : err}`,
					);
				}
			}),
		);

		// Update references (track SHA only, no file sync)
		const matchingReferences = skillSelector ? [] : (upstream.references ?? []);
		const references = options.newOnly
			? matchingReferences.filter((reference) => !reference.lastSync)
			: matchingReferences;

		for (const ref of references) {
			try {
				const sha = await getPathSha(
					upstream.repo,
					upstream.branch,
					ref.remotePath,
				);
				ref.sha = sha;
				ref.lastSync = new Date().toISOString();
				console.log(
					`  Reference updated: ${ref.remotePath} (${sha.slice(0, 8)})`,
				);
			} catch (err) {
				console.error(
					`  ✗ Failed to update reference ${ref.remotePath}: ${err instanceof Error ? err.message : err}`,
				);
			}
		}
	}

	await Bun.write(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
	console.log("\nManifest updated.");
} catch (err) {
	console.error("Sync failed:", err);
	process.exit(1);
}
