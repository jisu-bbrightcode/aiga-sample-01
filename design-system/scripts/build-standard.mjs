// build-standard.mjs — raw/*/extract.json 합성 → 표준 산출물
//
// 출력:
//   origo/tokens/design-tokens.json  (시맨틱 토큰, 머신용)
//   origo/tokens/tokens.css          (CSS 변수, 외주 dev용)
//   origo/COLORS.md / TYPOGRAPHY.md / COMPONENTS.md
//   origo/assets/<file>.png          (썸네일)
//
// 사용: node build-standard.mjs

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const RAW = path.join(ROOT, "origo/raw");
const TOK = path.join(ROOT, "origo/tokens");
const ASSET = path.join(ROOT, "origo/assets");
fs.mkdirSync(TOK, { recursive: true });
fs.mkdirSync(ASSET, { recursive: true });

const files = fs.readdirSync(RAW).filter((d) => fs.existsSync(path.join(RAW, d, "extract.json")));
const data = Object.fromEntries(
  files.map((d) => [d, JSON.parse(fs.readFileSync(path.join(RAW, d, "extract.json"), "utf8"))]),
);

// 썸네일 복사
for (const d of files) {
  const t = path.join(RAW, d, "thumbnail.png");
  if (fs.existsSync(t)) fs.copyFileSync(t, path.join(ASSET, `${d}.png`));
}

// ---- 1) 시맨틱 토큰 (variables 우선) ----
// variable name "group/name" → 중첩 구조
const varAll = [];
for (const d of files) for (const v of data[d].variables) varAll.push(v);
// dedup by name
const seen = new Map();
for (const v of varAll) if (!seen.has(v.name)) seen.set(v.name, v);
const vars = [...seen.values()];

const tokenTree = {};
for (const v of vars) {
  const parts = v.name.split("/");
  let cur = tokenTree;
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] = cur[parts[i]] || {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = { value: v.value, type: (v.type || "").toLowerCase() };
}

// 타이포 스케일 (전 파일 합산, size 내림차순 유니크 by family|style|size|case)
const typoMap = new Map();
for (const d of files)
  for (const t of data[d].typography) {
    const k = `${t.family}|${t.style}|${t.fontSize}|${t.textCase}`;
    if (typoMap.has(k)) typoMap.get(k).count += t.count;
    else typoMap.set(k, { ...t });
  }
const typography = [...typoMap.values()].sort(
  (a, b) => b.fontSize - a.fontSize || b.count - a.count,
);
const fonts = [...new Set(typography.map((t) => t.family))];

// 색상 합산
const colorMap = new Map();
for (const d of files)
  for (const c of data[d].colors) colorMap.set(c.hex, (colorMap.get(c.hex) || 0) + c.count);
const colors = [...colorMap.entries()]
  .map(([hex, count]) => ({ hex, count }))
  .sort((a, b) => b.count - a.count);

// 그림자 합산 (box-shadow css 키, 빈도순)
const shadowMap = new Map();
for (const d of files)
  for (const s of data[d].shadows || [])
    shadowMap.set(s.css, (shadowMap.get(s.css) || 0) + s.count);
const shadows = [...shadowMap.entries()]
  .map(([css, count]) => ({ css, count }))
  .sort((a, b) => b.count - a.count);

// 그래디언트 합산 (type+stops 키, 빈도순; css는 첫 등장값)
const gradMap = new Map();
const gradCss = new Map();
for (const d of files)
  for (const g of data[d].gradients || []) {
    const key = `${g.type}|${g.stops.map((s) => `${s.color}@${s.position}`).join(",")}`;
    gradMap.set(key, (gradMap.get(key) || 0) + g.count);
    if (!gradCss.has(key)) gradCss.set(key, g.css);
  }
const gradients = [...gradMap.entries()]
  .map(([key, count]) => ({ css: gradCss.get(key), count }))
  .sort((a, b) => b.count - a.count);

// 컴포넌트 합산 (variant prop 제외한 base 이름)
const compSet = new Map(); // base name -> { variants:Set, files:Set }
const iconSet = new Set();
const ICON_STYLE = /\/(outline|fill|bold|color|linear|twotone|bulk|broken|stroke|regular)\//i;
const isIcon = (name) =>
  name.startsWith("Icon/") || // Icon/Outline/home
  name.startsWith("vuesax/") || // vuesax/outline/add
  ICON_STYLE.test(name) || // */outline/*, */bold/* 등 아이콘셋
  /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name); // tabler 소문자형 (menu, chevron-down)
const iconName = (name) => name.split("/").pop();
for (const d of files)
  for (const name of data[d].components) {
    if (isIcon(name)) {
      iconSet.add(iconName(name));
      continue;
    }
    const base = name.includes("=") ? name.split("=")[0].trim() : name;
    if (!compSet.has(base)) compSet.set(base, { variants: new Set(), files: new Set() });
    if (name.includes("=")) compSet.get(base).variants.add(name.split("=").slice(1).join("="));
    compSet.get(base).files.add(d);
  }

const designTokens = {
  $meta: {
    source: "Origo Design System (.fig)",
    files: files,
    generated: "static — regenerate via `npm run build` in design-system/scripts",
    fonts,
  },
  color: tokenTree,
  palette: Object.fromEntries(colors.slice(0, 40).map((c) => [c.hex, c.count])),
  typography: typography.map((t) => ({
    family: t.family,
    weight: t.style,
    size: t.fontSize,
    lineHeight: t.lineHeight,
    letterSpacing: t.letterSpacing,
    case: t.textCase,
    uses: t.count,
  })),
  shadow: Object.fromEntries(shadows.map((s, i) => [`shadow-${i + 1}`, s.css])),
  gradient: Object.fromEntries(gradients.map((g, i) => [`gradient-${i + 1}`, g.css])),
};
fs.writeFileSync(path.join(TOK, "design-tokens.json"), JSON.stringify(designTokens, null, 2));

// ---- 2) tokens.css ----
const cssVars = [];
const flat = (obj, prefix) => {
  for (const [k, val] of Object.entries(obj)) {
    if (val && typeof val === "object" && "value" in val) {
      cssVars.push(`  --${prefix}${k}: ${val.value};`.replace(/\/+/g, "-"));
    } else if (val && typeof val === "object") {
      flat(val, `${prefix}${k}-`);
    }
  }
};
flat(tokenTree, "");
const fxVars = [
  ...shadows.map((s, i) => `  --shadow-${i + 1}: ${s.css};`),
  ...gradients.map((g, i) => `  --gradient-${i + 1}: ${g.css};`),
];
const css = `/* Origo Design System — tokens.css (AUTO-GENERATED, do not edit by hand) */
/* regenerate: design-system/scripts \`npm run build\` */
:root {
${cssVars.join("\n")}
}

/* effects: 그림자 + 그래디언트 (빈도순 번호; gradient angle은 best-effort) */
:root {
${fxVars.join("\n")}
}
`;
fs.writeFileSync(path.join(TOK, "tokens.css"), css);

// ---- 2b) shadcn-theme.css (base-vega 변수 contract 매핑) ----
// 외주 프로젝트의 packages/ui (shadcn, baseColor neutral, cssVariables) 에 그대로 붙임.
// Origo semantic 토큰 → shadcn --background/--foreground/--primary/... 라이트 테마.
const T = Object.fromEntries(vars.map((v) => [v.name, v.value])); // name→hex
const pick = (...names) => {
  for (const n of names) if (T[n]) return T[n];
  return null;
};
const shadcnMap = {
  background: pick("bg/white-0", "neutral/0"),
  foreground: pick("text/main-900", "neutral/900"),
  card: pick("bg/white-0", "neutral/0"),
  "card-foreground": pick("text/main-900", "neutral/900"),
  popover: pick("bg/white-0", "neutral/0"),
  "popover-foreground": pick("text/main-900", "neutral/900"),
  primary: pick("Primary/800"),
  "primary-foreground": pick("text/white-0", "neutral/0"),
  secondary: pick("bg/weak-100", "neutral/100"),
  "secondary-foreground": pick("text/main-900", "neutral/900"),
  muted: pick("bg/weak-100", "neutral/100"),
  "muted-foreground": pick("text/sub-500", "neutral/500"),
  accent: pick("bg/soft-200", "neutral/200"),
  "accent-foreground": pick("text/main-900", "neutral/900"),
  destructive: pick("red/base"),
  "destructive-foreground": pick("text/white-0", "neutral/0"),
  border: pick("stroke/soft-200", "neutral/200"),
  input: pick("stroke/soft-200", "neutral/200"),
  ring: pick("text/soft-400", "neutral/400"),
  success: pick("green/base"),
};
const shLines = Object.entries(shadcnMap)
  .filter(([, v]) => v)
  .map(([k, v]) => `    --${k}: ${v};`);
const shadcnCss = `/* Origo → shadcn theme (base-vega/neutral, light) — AUTO-GENERATED */
/* 외주 프로젝트 packages/ui globals.css :root 에 병합. regenerate: design-system/scripts \`npm run build\` */
@layer base {
  :root {
${shLines.join("\n")}
    --radius: 0.5rem;
  }
}
`;
fs.writeFileSync(path.join(TOK, "shadcn-theme.css"), shadcnCss);

// ---- 3) COLORS.md ----
let md = `# Origo — 색상 팔레트\n\n> 자동 생성. 빈도순(전 4파일 fill+stroke SOLID 집계).\n\n`;
md += `## 시맨틱 토큰 (Figma Variables)\n\n| 토큰 | 값 |\n|------|-----|\n`;
for (const v of vars) md += `| \`${v.name}\` | ${v.value ?? "-"} |\n`;
md += `\n## 사용 빈도 상위 팔레트\n\n> ⚠️ 빈도 팔레트는 화면에서 자주 쓰인 픽셀색(fill+stroke 집계)이며 **시맨틱 토큰(Figma Variables)이 아니다.** 디자인 토큰은 위 표 참조.\n\n| Hex | 사용수 |\n|-----|-------|\n`;
for (const c of colors.slice(0, 30)) md += `| \`${c.hex}\` | ${c.count} |\n`;
md += `\n## 그림자 (box-shadow, 빈도순)\n\n| 토큰 | CSS | 사용수 |\n|------|-----|-------|\n`;
shadows.forEach((s, i) => {
  md += `| \`--shadow-${i + 1}\` | \`${s.css}\` | ${s.count} |\n`;
});
md += `\n## 그래디언트 (빈도순; angle은 best-effort, 시각 확인 권장)\n\n| 토큰 | CSS | 사용수 |\n|------|-----|-------|\n`;
gradients.forEach((g, i) => {
  md += `| \`--gradient-${i + 1}\` | \`${g.css}\` | ${g.count} |\n`;
});
fs.writeFileSync(path.join(ROOT, "origo/COLORS.md"), md);

// ---- 4) TYPOGRAPHY.md ----
let tmd = `# Origo — 타이포그래피\n\n> 자동 생성. 폰트: **${fonts.join(", ")}**\n\n`;
tmd += `폰트 다운로드: Inter / Manrope — Google Fonts.\n\n`;
tmd += `| Family | Weight | Size(px) | LineHeight | Case | 사용수 |\n|--------|--------|----------|------------|------|-------|\n`;
for (const t of typography)
  tmd += `| ${t.family} | ${t.style} | ${t.fontSize} | ${t.lineHeight ?? "-"} | ${t.textCase} | ${t.count} |\n`;
fs.writeFileSync(path.join(ROOT, "origo/TYPOGRAPHY.md"), tmd);

// ---- 5) COMPONENTS.md ----
let cmd = `# Origo — 컴포넌트 인벤토리\n\n> 자동 생성. SYMBOL(컴포넌트 정의) 기준.\n\n`;
cmd += `## 컴포넌트 (${compSet.size})\n\n| 컴포넌트 | Variants | 등장 파일 |\n|----------|----------|-----------|\n`;
for (const [name, info] of [...compSet.entries()].sort()) {
  const vs = [...info.variants].slice(0, 8).join(", ");
  cmd += `| **${name}** | ${vs || "-"} | ${info.files.size} |\n`;
}
cmd += `\n## 아이콘 세트 (${iconSet.size}, Tabler 계열)\n\n`;
cmd += `${[...iconSet]
  .sort()
  .map((i) => `\`${i}\``)
  .join(" ")}\n`;
fs.writeFileSync(path.join(ROOT, "origo/COMPONENTS.md"), cmd);

// ---- 요약 ----
console.log(
  JSON.stringify(
    {
      variables: vars.length,
      cssVars: cssVars.length,
      colors: colors.length,
      shadows: shadows.length,
      gradients: gradients.length,
      typoStyles: typography.length,
      fonts,
      components: compSet.size,
      icons: iconSet.size,
    },
    null,
    2,
  ),
);
