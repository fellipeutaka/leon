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

interface GitHubContent {
	name: string;
	path: string;
	sha: string;
	type: "file" | "dir";
	download_url: string | null;
}

const ROOT = join(import.meta.dir, "..");
const MANIFEST_PATH = join(ROOT, "upstream.json");
const newOnly = process.argv.includes("--new-only");

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
	const manifest: UpstreamManifest = await Bun.file(MANIFEST_PATH).json();

	const upstreams = newOnly
		? manifest.upstreams.filter(
				(u) =>
					u.skills.some((s) => !s.lastSync) ||
					u.references?.some((r) => !r.lastSync),
			)
		: manifest.upstreams;

	if (newOnly && upstreams.length === 0) {
		console.log("No new upstreams to sync.");
		process.exit(0);
	}

	for (const upstream of upstreams) {
		console.log(`\nUpstream: ${upstream.repo} (${upstream.branch})`);

		const skills = newOnly
			? upstream.skills.filter((s) => !s.lastSync)
			: upstream.skills;

		await Promise.all(
			skills.map(async (skill) => {
				const sha = await getPathSha(
					upstream.repo,
					upstream.branch,
					skill.remotePath,
				);
				console.log(`  ${skill.remotePath} SHA: ${sha.slice(0, 8)}`);
				await syncSkill(upstream, skill);
				skill.sha = sha;
				skill.lastSync = new Date().toISOString();
			}),
		);

		// Update references (track SHA only, no file sync)
		for (const ref of upstream.references ?? []) {
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
		}
	}

	await Bun.write(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
	console.log("\nManifest updated.");
} catch (err) {
	console.error("Sync failed:", err);
	process.exit(1);
}
