// fig-extract.mjs — Origo .fig 오프라인 추출기
//
// .fig (ZIP) → canvas.fig(fig-kiwi) → [deflate schema] + [zstd data] → kiwi 디코드
//   → variables(토큰) / colors / typography / components / images 추출
//
// 사용: node fig-extract.mjs "<file.fig>" <outDir>
// 의존: kiwi-schema, node>=22 (zlib.zstdDecompressSync 내장)

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import * as kiwi from "kiwi-schema";

// ---- .fig ZIP 엔트리 읽기 (system unzip 사용, 의존 0) ----
function readZipEntry(figPath, entry) {
  return execFileSync("unzip", ["-p", figPath, entry], { maxBuffer: 1 << 30 });
}
function listZip(figPath) {
  const out = execFileSync("unzip", ["-Z1", figPath], { encoding: "utf8" });
  return out.split("\n").filter(Boolean);
}

// ---- canvas.fig (fig-kiwi) 디코드 ----
function decodeCanvas(canvasBuf) {
  if (canvasBuf.slice(0, 8).toString() !== "fig-kiwi") {
    throw new Error(`not fig-kiwi: ${canvasBuf.slice(0, 8).toString()}`);
  }
  let off = 8;
  off += 4; // version uint32
  // block0 = deflate schema
  const slen = canvasBuf.readUInt32LE(off);
  off += 4;
  const schemaRaw = zlib.inflateRawSync(canvasBuf.slice(off, off + slen));
  off += slen;
  const schema = kiwi.decodeBinarySchema(schemaRaw);
  // block1 = zstd data
  const dlen = canvasBuf.readUInt32LE(off);
  off += 4;
  const dataComp = canvasBuf.slice(off, off + dlen);
  off += dlen;
  const data = zstdDecompress(dataComp);
  const root = kiwi.compileSchema(schema).decodeMessage(data);
  return root;
}
function zstdDecompress(buf) {
  if (typeof zlib.zstdDecompressSync === "function") return zlib.zstdDecompressSync(buf);
  // fallback: zstd cli
  const tmp = path.join(process.env.TMPDIR || "/tmp", `figz_${process.pid}.zst`);
  fs.writeFileSync(tmp, buf);
  const out = execFileSync("zstd", ["-d", "-q", "-c", tmp], { maxBuffer: 1 << 30 });
  fs.unlinkSync(tmp);
  return out;
}

// ---- color helpers ----
const ch = (x) => Math.round(Math.max(0, Math.min(1, x)) * 255);
function toHex(c) {
  if (!c) return null;
  const a = c.a == null ? 1 : c.a;
  const base = `#${ch(c.r).toString(16).padStart(2, "0")}${ch(c.g).toString(16).padStart(2, "0")}${ch(c.b).toString(16).padStart(2, "0")}`;
  if (a >= 0.999) return base.toUpperCase();
  return (base + ch(a).toString(16).padStart(2, "0")).toUpperCase();
}

// ---- 노드 트리 → 추출 ----
function extract(root) {
  const nc = root.nodeChanges || [];

  // 1) Variables = 디자인 토큰 (alias resolve + 다중모드 인식)
  const varNodes = nc.filter((n) => n.type === "VARIABLE");
  const byKey = new Map();
  for (const n of varNodes) if (n.key) byKey.set(n.key, n);
  // 모드 ID → 이름 (VARIABLE_SET.variableSetModes), 다크/테마 모드 식별용
  const modeName = new Map();
  for (const s of nc) {
    for (const m of s.variableSetModes || []) {
      if (m?.id) modeName.set(`${m.id.sessionID}:${m.id.localID}`, m.name);
    }
  }
  const modeKey = (id) => (id ? `${id.sessionID}:${id.localID}` : null);
  const entriesOf = (n) => n?.variableDataValues?.entries || [];
  // variableData.value 해석 — color/float/text/bool/alias 재귀
  function resolveData(val, depth = 0) {
    if (!val || depth > 10) return null;
    if (val.colorValue) return toHex(val.colorValue);
    if (val.floatValue != null) return val.floatValue;
    if (val.textValue != null) return val.textValue;
    if (val.boolValue != null) return val.boolValue;
    if (val.alias?.assetRef?.key) {
      const target = byKey.get(val.alias.assetRef.key);
      return target ? resolveData(entriesOf(target)[0]?.variableData?.value, depth + 1) : null;
    }
    return null;
  }
  const variables = [];
  for (const n of varNodes) {
    const entries = entriesOf(n);
    const e0 = entries[0]?.variableData?.value;
    const aliasOf = e0?.alias?.assetRef?.key
      ? byKey.get(e0.alias.assetRef.key)?.name || null
      : null;
    const v = {
      name: n.name,
      type: n.variableResolvedType || null,
      value: resolveData(e0),
      aliasOf,
    };
    // 다중모드(다크/테마)면 모드별 값 보존 — silent first-mode-only 방지
    if (entries.length > 1) {
      v.modes = {};
      for (const e of entries) {
        const k = modeName.get(modeKey(e.modeID)) || modeKey(e.modeID) || `mode-${Object.keys(v.modes).length}`;
        v.modes[k] = resolveData(e.variableData?.value);
      }
    }
    variables.push(v);
  }

  // 2) 색상 팔레트 (fill + stroke SOLID 전수 집계)
  const colorCount = new Map();
  const addSolid = (paints) => {
    for (const p of paints || []) {
      if (p.type === "SOLID" && p.color && p.visible !== false) {
        const hex = toHex({
          ...p.color,
          a: p.color.a == null ? (p.opacity == null ? 1 : p.opacity) : p.color.a,
        });
        if (hex) colorCount.set(hex, (colorCount.get(hex) || 0) + 1);
      }
    }
  };
  for (const n of nc) {
    addSolid(n.fillPaints);
    addSolid(n.strokePaints);
  }
  const colors = [...colorCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([hex, count]) => ({ hex, count }));

  // 2b) 그림자 (DROP_SHADOW / INNER_SHADOW effects → box-shadow)
  const shadowCount = new Map();
  const shadowMeta = new Map();
  for (const n of nc) {
    for (const e of n.effects || []) {
      if (
        (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW") &&
        e.color &&
        e.visible !== false
      ) {
        const inset = e.type === "INNER_SHADOW";
        const x = round(e.offset?.x || 0),
          y = round(e.offset?.y || 0);
        const blur = round(e.radius || 0),
          spread = round(e.spread || 0);
        const color = toHex(e.color);
        const css = `${inset ? "inset " : ""}${x}px ${y}px ${blur}px ${spread}px ${color}`;
        shadowCount.set(css, (shadowCount.get(css) || 0) + 1);
        if (!shadowMeta.has(css)) shadowMeta.set(css, { x, y, blur, spread, color, inset });
      }
    }
  }
  const shadows = [...shadowCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([css, count]) => ({ ...shadowMeta.get(css), css, count }));

  // 2c) 그래디언트 (GRADIENT_* fillPaints → linear-gradient, angle best-effort)
  const gradAngle = (t) => {
    if (!t) return 180;
    const deg = Math.round((Math.atan2(t.m10 || 0, t.m00 || 0) * 180) / Math.PI) + 90;
    return ((deg % 360) + 360) % 360;
  };
  const gradCount = new Map();
  const gradMeta = new Map();
  for (const n of nc) {
    for (const p of n.fillPaints || []) {
      if (
        typeof p.type === "string" &&
        p.type.startsWith("GRADIENT") &&
        Array.isArray(p.stops) &&
        p.visible !== false
      ) {
        const stops = p.stops.map((s) => ({ color: toHex(s.color), position: round(s.position) }));
        const key = `${p.type}|${stops.map((s) => `${s.color}@${s.position}`).join(",")}`;
        gradCount.set(key, (gradCount.get(key) || 0) + 1);
        if (!gradMeta.has(key)) {
          const deg = gradAngle(p.transform);
          const stopCss = stops
            .map((s) => `${s.color} ${Math.round(s.position * 100)}%`)
            .join(", ");
          gradMeta.set(key, {
            type: p.type,
            angle: deg,
            stops,
            css: `linear-gradient(${deg}deg, ${stopCss})`,
          });
        }
      }
    }
  }
  const gradients = [...gradCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ ...gradMeta.get(key), count }));

  // 3) 타이포그래피 (TEXT 노드 스타일 유니크)
  const typoMap = new Map();
  for (const n of nc) {
    if (n.type !== "TEXT" || !n.fontName) continue;
    const fam = n.fontName.family,
      style = n.fontName.style;
    const size = n.fontSize,
      lh = n.lineHeight?.value,
      lhU = n.lineHeight?.units;
    const ls = n.letterSpacing?.value,
      tcase = n.textCase || "ORIGINAL";
    const key = `${fam}|${style}|${size}|${tcase}`;
    if (!typoMap.has(key)) {
      typoMap.set(key, {
        family: fam,
        style,
        fontSize: size,
        lineHeight: lh == null ? null : `${round(lh)}${lhU === "PERCENT" ? "%" : ""}`,
        letterSpacing: ls == null ? null : round(ls),
        textCase: tcase,
        count: 0,
      });
    }
    typoMap.get(key).count++;
  }
  const typography = [...typoMap.values()].sort((a, b) => b.count - a.count);
  const fonts = [...new Set(typography.map((t) => t.family))];

  // 4) 컴포넌트 (SYMBOL = 컴포넌트 정의)
  const components = nc
    .filter((n) => n.type === "SYMBOL")
    .map((n) => ({ name: n.name }))
    .filter((c) => c.name);
  // variant prop 후보 (이름에 = 포함)
  const variantProps = {};
  for (const c of components) {
    if (c.name.includes("=")) {
      const [prop] = c.name.split("=");
      variantProps[prop.trim()] = (variantProps[prop.trim()] || 0) + 1;
    }
  }

  // 5) frame/page 구조 요약
  const frames = nc.filter((n) => n.type === "FRAME" && n.name).length;
  const instances = nc.filter((n) => n.type === "INSTANCE").length;

  return {
    stats: {
      nodes: nc.length,
      frames,
      instances,
      symbols: components.length,
      variables: variables.length,
      shadows: shadows.length,
      gradients: gradients.length,
    },
    variables,
    colors,
    shadows,
    gradients,
    typography,
    fonts,
    components: components.map((c) => c.name),
    variantProps,
  };
}
const round = (x) => Math.round(x * 100) / 100;

// ---- main ----
function main() {
  const [figPath, outDir] = process.argv.slice(2);
  if (!figPath || !outDir) {
    console.error('usage: node fig-extract.mjs "<file.fig>" <outDir>');
    process.exit(1);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const imgDir = path.join(outDir, "images");
  fs.mkdirSync(imgDir, { recursive: true });

  // canvas + meta + thumbnail + images 추출
  const canvasBuf = readZipEntry(figPath, "canvas.fig");
  const root = decodeCanvas(canvasBuf);
  const data = extract(root);

  // meta + thumbnail
  try {
    fs.writeFileSync(path.join(outDir, "thumbnail.png"), readZipEntry(figPath, "thumbnail.png"));
  } catch {}
  let meta = {};
  try {
    meta = JSON.parse(readZipEntry(figPath, "meta.json").toString());
  } catch {}
  data.meta = { fileName: meta.file_name, render: meta.client_meta?.render_coordinates };

  // images
  const entries = listZip(figPath).filter((e) => e.startsWith("images/") && !e.endsWith("/"));
  let imgN = 0;
  for (const e of entries) {
    try {
      const b = readZipEntry(figPath, e);
      const sig = b.slice(0, 4).toString("hex");
      const ext = sig.startsWith("89504e47")
        ? "png"
        : sig.startsWith("ffd8ff")
          ? "jpg"
          : sig.startsWith("52494646")
            ? "webp"
            : "bin";
      fs.writeFileSync(path.join(imgDir, `${path.basename(e)}.${ext}`), b);
      imgN++;
    } catch {}
  }
  data.stats.images = imgN;

  fs.writeFileSync(path.join(outDir, "extract.json"), JSON.stringify(data, null, 2));
  console.log(`[ok] ${path.basename(figPath)} -> ${outDir}`);
  console.log(`     ${JSON.stringify(data.stats)}`);
}
main();
