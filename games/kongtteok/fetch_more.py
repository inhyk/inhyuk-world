import json, sys, time, urllib.request, urllib.parse, os
out = sys.argv[1]
UA = "inhyuk-world-video/1.0"
items = [(20, "Korenwolf in graanveld-Stichting Natuurbeelden-171343.webm"), (21, "ノーマルの親子.ogv"), (22, "ノーマルの赤ちゃんの映像.ogv"),
 (23, "パイド親子１.ogv"), (24, "パイド親子３.ogv"), (25, "ピュアホワイトの親子１.ogv"), (26, "ピュアホワイトの親子２.ogv"),
 (27, "スーパーホワイトの子供の映像.ogv"), (28, "ダークパイド(ピュアホワイト＋イザベラホワイト)＋イザベラホワイトの子供.ogv"),
 (29, "ヘッドスポットの映像.ogv"), (30, "ホワイトフェイスの映像２.ogv"), (31, "ライト、ダークパイドの映像.ogv"), (32, "両個体の映像(ホワイトフェイスとノーマル).ogv"),
 (33, "赤ちゃんと母親(ダークパイド)４.ogv"), (34, "ピュアホワイトとイザベラホワイトの赤ちゃんとイザベラホワイトの母親.ogv"), (35, "Gait-of-healthy-Hamster.ogv")]
def get(url, tries=3):
    for i in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=120).read()
        except Exception as e:
            print("retry", i, url[-50:], e, flush=True)
            if "404" in str(e): return None
            time.sleep(20 * (i + 1))
    return None
dbp = os.path.join(os.path.dirname(os.path.abspath(__file__)), "credits_db.json"); db = json.load(open(dbp))
import re, html
for n, title in items:
    fn = f"c{n:02d}.webm"
    if os.path.exists(os.path.join(out, fn)): continue
    q = urllib.parse.urlencode({"action": "query", "format": "json", "titles": "File:" + title, "prop": "imageinfo",
                                "iiprop": "url|extmetadata", "iiextmetadatafilter": "LicenseShortName|Artist"})
    d = json.loads(get("https://commons.wikimedia.org/w/api.php?" + q))
    ii = list(d["query"]["pages"].values())[0]["imageinfo"][0]
    url = ii["url"].split("?")[0]; name = url.rsplit("/", 1)[1]
    base = url.replace("/wikipedia/commons/", "/wikipedia/commons/transcoded/") + f"/{name}."
    data = None
    for size in ["480p", "360p", "240p"]:
        data = get(base + size + ".vp9.webm")
        if data: break
    if not data and url.endswith(".webm"):
        data = get(url)
    if not data: print("FAILED", title, flush=True); continue
    open(os.path.join(out, fn), "wb").write(data)
    m = ii.get("extmetadata", {})
    db[fn] = {"title": title, "artist": html.unescape(re.sub("<[^>]+>", "", m.get("Artist", {}).get("value", ""))).strip(),
              "license": m.get("LicenseShortName", {}).get("value", "")}
    json.dump(db, open(dbp, "w"), ensure_ascii=False, indent=1)
    print(fn, len(data) // 1024, "KB", db[fn]["license"], title, flush=True)
    time.sleep(4)
print("ALL DONE", flush=True)
