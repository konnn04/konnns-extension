// Generates release notes from git commits.
// - If DEEPSEEK_API_KEY is set, an AI writes a clean, grouped changelog.
// - Otherwise it falls back to a plain, grouped list of commit subjects.
// Output goes to stdout (the workflow pipes it into RELEASE_NOTES.md).

import { execSync } from "node:child_process";

const isBeta = process.env.BETA === "1";
const newVersion = process.env.NEW_VERSION || "";

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

// last existing release tag (the version bump for this run isn't tagged yet)
const prevTag = sh("git describe --tags --abbrev=0 --match 'v*'");
const range = prevTag ? `${prevTag}..HEAD` : "HEAD~100..HEAD";

const raw = sh(`git log ${range} --no-merges --pretty=format:%s`);
const commits = raw
  .split("\n")
  .map((s) => s.trim())
  .filter((s) => s && !/\[skip ci\]|chore\(release\)/i.test(s));

if (commits.length === 0) commits.push("Minor updates and maintenance.");

/** Group commits by conventional-commit type for the fallback. */
function groupFallback(list) {
  const groups = { "✨ Tính năng": [], "🐛 Sửa lỗi": [], "🔧 Khác": [] };
  for (const c of list) {
    if (/^feat/i.test(c)) groups["✨ Tính năng"].push(c.replace(/^feat(\(.*?\))?:\s*/i, ""));
    else if (/^fix/i.test(c)) groups["🐛 Sửa lỗi"].push(c.replace(/^fix(\(.*?\))?:\s*/i, ""));
    else groups["🔧 Khác"].push(c.replace(/^\w+(\(.*?\))?:\s*/i, ""));
  }
  let out = "";
  for (const [title, items] of Object.entries(groups)) {
    if (items.length === 0) continue;
    out += `\n### ${title}\n` + items.map((i) => `- ${i}`).join("\n") + "\n";
  }
  return out.trim();
}

async function aiChangelog(list) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  const prompt =
    `Bạn là trợ lý viết changelog cho một extension trình duyệt.\n` +
    `Từ danh sách commit dưới đây, viết changelog Markdown NGẮN GỌN, thân thiện với người dùng cuối, bằng TIẾNG VIỆT.\n` +
    `Nhóm theo mục: "### ✨ Tính năng", "### 🐛 Sửa lỗi", "### 🔧 Cải thiện". Bỏ nhóm nào rỗng.\n` +
    `Gộp/viết lại cho dễ hiểu, bỏ chi tiết kỹ thuật vụn vặt, KHÔNG bịa nội dung không có trong commit.\n\n` +
    `Commits:\n${list.map((c) => `- ${c}`).join("\n")}`;
  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0.3,
        messages: [
          { role: "system", content: "You write concise, accurate release notes." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

const body = (await aiChangelog(commits)) ?? groupFallback(commits);

const header = isBeta
  ? `> ⚠️ **Bản Beta (dev)** — chưa chính thức, có thể bị ghi đè bất cứ lúc nào.\n`
  : "";
const compare =
  prevTag && !isBeta
    ? `\n\n**So sánh:** \`${prevTag}\` → \`v${newVersion}\``
    : "";

process.stdout.write(`${header}${body}${compare}\n`);
