// 젤리 타워 친구 우체통 API. 게임(사이트·아이폰 앱)이 친구에게 보낸 편지를 맡기고 받아 간다.
// 저장소: Upstash Redis(KV_REST_API_URL/TOKEN)가 있으면 그것, 없으면 Vercel Blob(BLOB_READ_WRITE_TOKEN, 비공개).
// 둘 다 없으면 { ok: false, error: "off" }를 돌려주고, 게임은 둘 다 켜 두었을 때만 되는 직접 연결 채팅으로 돌아간다.
// (브라우저 콘솔에 빨간 줄이 생기지 않게 200으로 알린다)
import { blobStore, createMailbox, memoryStore, upstashStore } from "@/lib/jelly-mail/mailbox.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Store = ReturnType<typeof upstashStore> | ReturnType<typeof blobStore>;
// 같은 서버가 계속 살아 있는 동안 저장소(열쇠 기억·보내기 한도)를 다시 만들지 않는다
const cache = globalThis as typeof globalThis & { __jellyMailMemory?: Store; __jellyMailBlob?: Store };

async function store(): Promise<Store | null> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return upstashStore(url, token);
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    if (!cache.__jellyMailBlob) cache.__jellyMailBlob = blobStore(await import("@vercel/blob"));
    return cache.__jellyMailBlob;
  }
  // 개발·테스트용 메모리 우체통 (서버를 끄면 사라진다). 사이트에서는 쓰지 않는다.
  if (process.env.JELLY_MAIL_MEMORY === "1") return (cache.__jellyMailMemory ??= memoryStore());
  return null;
}

// 사이트(seonn.dev)와 아이폰 앱(capacitor://localhost), 개발용 localhost만 부를 수 있다
const ORIGINS = [/^https:\/\/(www\.)?seonn\.dev$/, /^(capacitor|ionic):\/\/localhost$/, /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
function cors(origin: string | null): HeadersInit {
  const headers: Record<string, string> = { "Cache-Control": "no-store", Vary: "Origin" };
  if (origin && ORIGINS.some((re) => re.test(origin))) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
    headers["Access-Control-Max-Age"] = "86400";
  }
  return headers;
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: cors(request.headers.get("origin")) });
}

// 우체통이 켜져 있는지 알려 준다 (편지 내용은 없음).
// ?cleanup=1 은 하루 한 번 Vercel 크론이 부른다: 7일 넘게 받아 가지 않은 우체통을 지운다 (CRON_SECRET 필요)
export async function GET(request: Request) {
  const headers = cors(request.headers.get("origin"));
  const mailStore = await store();
  if (new URL(request.url).searchParams.has("cleanup")) {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ ok: false, error: "auth" }, { status: 401, headers });
    if (!mailStore) return Response.json({ ok: true, removed: 0 }, { headers });
    try {
      return Response.json({ ok: true, removed: await createMailbox(mailStore).cleanup() }, { headers });
    } catch (error) {
      console.error("jelly-mail cleanup", error);
      return Response.json({ ok: false, error: "store" }, { status: 502, headers });
    }
  }
  return Response.json({ ok: true, mail: mailStore ? "on" : "off", store: mailStore?.kind ?? null }, { headers });
}

export async function POST(request: Request) {
  const headers = cors(request.headers.get("origin"));
  const mailStore = await store();
  if (!mailStore) return Response.json({ ok: false, error: "off" }, { headers });
  const text = await request.text();
  if (text.length > 4000) return Response.json({ ok: false, error: "big" }, { status: 413, headers });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ ok: false, error: "bad" }, { status: 400, headers });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  try {
    const result = await createMailbox(mailStore).handle(body as Record<string, unknown>, { ip });
    return Response.json(result.body, { status: result.status, headers });
  } catch (error) {
    console.error("jelly-mail", error);
    return Response.json({ ok: false, error: "store" }, { status: 502, headers });
  }
}
