// gta6-meme-x-01 — entrypoint.
// Job: hand the X post over to make.fun. It reads POST.json from this
// repository, drops an identical copy into the output directory the
// harness gives us, and prints a short summary of the post so a human
// can see at a glance which post this entry names.
// Nothing here is judged: the house reads the post itself from X.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The play code this entry's post carries in its text. POST.json holds
// only the post URL (the bounty rules fix that shape), so the code lives
// here as a plain constant — it is not a secret, and the house checks it
// against the post itself, not against this file.
const ENTRY_PLAY_CODE = "makefun-latch-compost-tundra";

const POST_FILE = "POST.json";
const URL_FIELDS = ["url", "post_url", "postUrl", "tweet_url", "tweetUrl"];
const CODE_FIELDS = ["play_code", "playCode", "code", "playcode"];

const X_STATUS = /https?:\/\/(?:www\.|mobile\.)?(?:x\.com|twitter\.com)\/[^/\s]+\/status\/(\d+)/;
const PLAY_CODE = /makefun-[a-z]+-[a-z]+-[a-z]+/;

function repoRoot(): string {
  const fromEnv = process.env.MAKEFUN_BOT_DIR;
  if (fromEnv && fromEnv.trim() !== "") return resolve(fromEnv);
  return dirname(fileURLToPath(import.meta.url));
}

function outputDir(root: string): string {
  const fromEnv = process.env.MAKEFUN_OUTPUT_DIR;
  if (fromEnv && fromEnv.trim() !== "") return resolve(fromEnv);
  return join(root, "out");
}

function firstString(record: unknown, names: string[]): string | null {
  if (typeof record !== "object" || record === null) return null;
  const obj = record as Record<string, unknown>;
  for (const name of names) {
    const value = obj[name];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return null;
}

function pickUrl(raw: string, parsed: unknown): string {
  const fromField = firstString(parsed, URL_FIELDS);
  if (fromField) return fromField;
  const found = raw.match(X_STATUS);
  if (found) return found[0];
  throw new Error("POST.json carries no X post URL");
}

function pickPlayCode(raw: string, parsed: unknown): string {
  const fromField = firstString(parsed, CODE_FIELDS);
  if (fromField) return fromField;
  const found = raw.match(PLAY_CODE);
  if (found) return found[0];
  return ENTRY_PLAY_CODE;
}

function tweetIdOf(url: string): string {
  const found = url.match(/\/status\/(\d+)/);
  return found ? found[1] : "(unknown)";
}

// Refuse a URL that is not an X post address. The house reads the post
// from X, so a bad URL here means the entry cannot be graded — fail
// loudly now instead of shipping a broken POST.json.
function checkUrl(url: string): void {
  if (!X_STATUS.test(url)) {
    throw new Error(
      `POST.json url is not an X post address: ${url} ` +
        `(expected https://x.com/<handle>/status/<digits>)`,
    );
  }
}

function main(): void {
  const root = repoRoot();
  const out = outputDir(root);
  const postPath = join(root, POST_FILE);

  const raw = readFileSync(postPath, "utf8");
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // A malformed POST.json still gets copied verbatim; the URL and code
    // are pulled out of the raw text below instead of the parsed object.
    parsed = null;
  }

  const url = pickUrl(raw, parsed);
  checkUrl(url);
  const playCode = pickPlayCode(raw, parsed);

  mkdirSync(out, { recursive: true });
  const dest = join(out, POST_FILE);
  writeFileSync(dest, raw);

  console.log("gta6-meme-x-01 entry");
  console.log(`post url : ${url} (valid X post address)`);
  console.log(`tweet id : ${tweetIdOf(url)}`);
  console.log(`play code: ${playCode}`);
  console.log(`copied   : ${dest}`);
}

main();
