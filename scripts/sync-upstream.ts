import { join } from "node:path";

interface SkillEntry {
  remotePath: string;
  localPath: string;
  sha?: string;
  lastSync?: string;
}

interface UpstreamEntry {
  repo: string;
  branch: string;
  skills: SkillEntry[];
}

interface UpstreamManifest {
  upstreams: UpstreamEntry[];
}

interface GitHubContent {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url: string | null;
}

const ROOT = join(import.meta.dir, "..");
const MANIFEST_PATH = join(ROOT, "upstream.json");

async function fetchDirectory(
  repo: string,
  branch: string,
  dirPath: string
): Promise<{ path: string; content: string }[]> {
  const url = `https://api.github.com/repos/${repo}/contents/${dirPath}?ref=${branch}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      ...(process.env.GITHUB_TOKEN && {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      }),
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }

  const items: GitHubContent[] = await res.json();
  const files: { path: string; content: string }[] = [];

  for (const item of items) {
    if (item.type === "file" && item.download_url) {
      const content = await fetch(item.download_url).then((r) => r.text());
      files.push({ path: item.path, content });
    } else if (item.type === "dir") {
      const subFiles = await fetchDirectory(repo, branch, item.path);
      files.push(...subFiles);
    }
  }

  return files;
}

async function getLatestSha(repo: string, branch: string): Promise<string> {
  const url = `https://api.github.com/repos/${repo}/commits/${branch}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      ...(process.env.GITHUB_TOKEN && {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      }),
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to get latest SHA: ${res.status}`);
  }

  const data = await res.json();
  return data.sha;
}

async function syncSkill(
  upstream: UpstreamEntry,
  skill: SkillEntry
): Promise<void> {
  console.log(`  Syncing ${skill.remotePath} -> ${skill.localPath}`);

  const files = await fetchDirectory(
    upstream.repo,
    upstream.branch,
    skill.remotePath
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

  for (const upstream of manifest.upstreams) {
    console.log(`\nUpstream: ${upstream.repo} (${upstream.branch})`);

    const sha = await getLatestSha(upstream.repo, upstream.branch);
    console.log(`  Latest SHA: ${sha.slice(0, 8)}`);

    for (const skill of upstream.skills) {
      await syncSkill(upstream, skill);
      skill.sha = sha;
      skill.lastSync = new Date().toISOString();
    }
  }

  await Bun.write(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  console.log("\nManifest updated.");
} catch (err) {
  console.error("Sync failed:", err);
  process.exit(1);
}
