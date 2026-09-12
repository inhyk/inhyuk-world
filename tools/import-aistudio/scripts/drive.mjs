#!/usr/bin/env node
// Google Drive에서 AI Studio 앱 zip을 내려받습니다.
//
// 파일 내용이 대화 컨텍스트를 거치지 않고 디스크로 바로 떨어지기 때문에
// 큰 파일도 안전하게(중간에 잘리지 않고) 받을 수 있습니다.
//
// 사용법:
//   node drive.mjs login                    최초 1회 브라우저 승인
//   node drive.mjs get <fileId> <저장경로>   한 개 받기
//   node drive.mjs batch <목록파일.tsv>      여러 개 받기 (열: id<TAB>저장이름)

import { createServer } from "node:http";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";

const CREDS_DIR = path.join(os.homedir(), ".claude", ".creds");
const CLIENT_PATH = path.join(CREDS_DIR, "oauth_client.json");
const TOKEN_PATH = path.join(CREDS_DIR, "drive_token.json");
const SCOPE = "https://www.googleapis.com/auth/drive.readonly";

function loadClient() {
  if (!existsSync(CLIENT_PATH)) {
    throw new Error(`OAuth 클라이언트 파일이 없습니다: ${CLIENT_PATH}`);
  }
  const raw = JSON.parse(readFileSync(CLIENT_PATH, "utf8"));
  return raw.installed || raw.web;
}

async function login() {
  const client = loadClient();

  // 빈 포트에 loopback 서버를 띄우고, 승인 후 돌아오는 code를 받습니다.
  const { server, port } = await new Promise((resolve, reject) => {
    const s = createServer();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => resolve({ server: s, port: s.address().port }));
  });

  const redirectUri = `http://127.0.0.1:${port}`;
  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: client.client_id,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPE,
      access_type: "offline",
      prompt: "consent",
    });

  console.log("\n브라우저에서 구글 계정 승인이 필요합니다.");
  console.log("아래 주소가 자동으로 열립니다. 열리지 않으면 직접 복사해서 여세요.\n");
  console.log(authUrl + "\n");
  console.log("※ 게임이 들어 있는 계정(아빠 kubony@gmail.com)으로 로그인하세요.\n");

  spawn("open", [authUrl], { stdio: "ignore", detached: true }).unref();

  const code = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("시간이 초과됐습니다(5분).")), 300000);
    server.on("request", (req, res) => {
      const url = new URL(req.url, redirectUri);
      const c = url.searchParams.get("code");
      const err = url.searchParams.get("error");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        `<meta charset="utf-8"><body style="font-family:system-ui;padding:40px">
         <h2>${c ? "승인됐습니다" : "승인이 취소됐습니다"}</h2>
         <p>이 창을 닫고 터미널로 돌아가세요.</p></body>`
      );
      clearTimeout(timer);
      server.close();
      c ? resolve(c) : reject(new Error(err || "코드를 받지 못했습니다."));
    });
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: client.client_id,
      client_secret: client.client_secret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tok = await res.json();
  if (!res.ok) throw new Error(`토큰 발급 실패: ${JSON.stringify(tok)}`);

  mkdirSync(CREDS_DIR, { recursive: true });
  writeFileSync(
    TOKEN_PATH,
    JSON.stringify({ ...tok, obtained_at: Date.now() }, null, 2)
  );
  console.log(`토큰을 저장했습니다: ${TOKEN_PATH}`);
}

async function accessToken() {
  if (!existsSync(TOKEN_PATH)) {
    throw new Error("먼저 `node drive.mjs login` 으로 승인해 주세요.");
  }
  const tok = JSON.parse(readFileSync(TOKEN_PATH, "utf8"));
  const age = (Date.now() - tok.obtained_at) / 1000;

  if (age < (tok.expires_in || 3600) - 120) return tok.access_token;

  const client = loadClient();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: tok.refresh_token,
      client_id: client.client_id,
      client_secret: client.client_secret,
      grant_type: "refresh_token",
    }),
  });
  const fresh = await res.json();
  if (!res.ok) throw new Error(`토큰 갱신 실패: ${JSON.stringify(fresh)}`);

  writeFileSync(
    TOKEN_PATH,
    JSON.stringify({ ...tok, ...fresh, obtained_at: Date.now() }, null, 2)
  );
  return fresh.access_token;
}

async function get(fileId, outPath) {
  const token = await accessToken();
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    throw new Error(`다운로드 실패 (${res.status}): ${await res.text()}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, buf);
  return buf.length;
}

const [cmd, ...rest] = process.argv.slice(2);

try {
  if (cmd === "login") {
    await login();
  } else if (cmd === "get") {
    const [fileId, outPath] = rest;
    if (!fileId || !outPath) throw new Error("사용법: drive.mjs get <fileId> <저장경로>");
    const n = await get(fileId, path.resolve(outPath));
    console.log(`${outPath} (${n.toLocaleString()} bytes)`);
  } else if (cmd === "batch") {
    const [listPath] = rest;
    if (!listPath) throw new Error("사용법: drive.mjs batch <목록파일.tsv>");

    const rows = readFileSync(path.resolve(listPath), "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => l.split("\t"));

    console.log(`${rows.length}개를 내려받습니다.\n`);
    let ok = 0;
    const failed = [];

    for (const [fileId, name] of rows) {
      process.stdout.write(`  ${name} ... `);
      try {
        const n = await get(fileId, path.resolve(path.dirname(listPath), "zips", `${name}.zip`));
        console.log(`${n.toLocaleString()} bytes`);
        ok++;
      } catch (e) {
        console.log("실패");
        failed.push({ name, msg: e.message });
      }
    }

    console.log(`\n성공 ${ok}개 / 실패 ${failed.length}개`);
    for (const f of failed) console.log(`  [${f.name}] ${f.msg}`);
    if (failed.length) process.exit(1);
  } else {
    console.log(
      "사용법:\n" +
        "  node drive.mjs login\n" +
        "  node drive.mjs get <fileId> <저장경로>\n" +
        "  node drive.mjs batch <목록파일.tsv>"
    );
    process.exit(1);
  }
} catch (e) {
  console.error(`\n오류: ${e.message}`);
  process.exit(1);
}
