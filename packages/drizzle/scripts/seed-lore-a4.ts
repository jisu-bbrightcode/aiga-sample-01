/**
 * Lore A4 seed
 *
 * Story 서버 권위 데이터 경로의 대량 데이터 검증용 시드.
 * 대상 프로젝트에 세계/캐릭터/장소/세력을 count 개씩 넣고,
 * 각 body 를 A4 1장 수준(기본 2000자 이상)으로 생성한다.
 *
 * 기본 동작은 기존 4개 테이블 내용을 교체한다.
 *
 * 사용:
 *   pnpm --filter @repo/drizzle db:seed:lore-a4 -- --project <projectId>
 *   pnpm --filter @repo/drizzle db:seed:lore-a4 -- --project <projectId> --count 300
 *   pnpm --filter @repo/drizzle db:seed:lore-a4 -- --project <projectId> --keep-existing
 */

import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: resolve(__dirname, "../../../.env.local") });

const DEFAULT_COUNT = 1000;
const DEFAULT_MIN_CHARS = 2000;
const DEFAULT_BATCH = 200;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LoreEntityType = "world" | "character" | "location" | "faction";

const regions = ["북방 설원", "황금 평원", "검은 해안", "유리 사막", "은빛 군도", "심연 협곡"];
const climates = ["혹한", "건조", "온난", "계절풍", "안개 많음", "화산성"];
const genres = ["하이 판타지", "다크 판타지", "스페이스 오페라", "정치 스릴러", "문명 서사"];
const occupations = ["정찰대장", "학자", "외교관", "기사", "상인", "마도공병"];
const personalities = [
  "침착하지만 집요함",
  "유쾌하지만 계산적임",
  "과묵하지만 책임감이 강함",
  "냉정하지만 동료를 끝까지 지킴",
  "이상주의적이지만 실무 감각이 뛰어남",
];
const voices = ["낮고 단정한 어조", "빠르고 날카로운 어조", "부드럽지만 단호한 어조", "유머를 섞는 설득형 어조"];
const goals = ["교역로 장악", "고대 유산 확보", "국경 안정화", "독립 선언", "종교 개혁", "신기술 독점"];
const influences = ["변방 도시 의회", "왕실 보급망", "항만 길드 연합", "학술원 네트워크", "용병 시장", "성직자 회의"];
const institutions = ["도시의회", "항만청", "북방 군단", "황실 학술원", "자치 길드", "신탁 사원"];
const tensions = ["곡물 가격 급등", "보급선 파괴", "왕위 계승 분쟁", "이민자 유입 갈등", "금지 마법 재등장", "조세 저항"];
const resources = ["에테르 광맥", "심해 소금", "발광 버섯", "고대 룬석", "철목재", "폭풍 결정"];
const landmarks = ["부서진 관문", "백야 탑", "침묵의 정원", "열주 분화구", "거울 호수", "사자문 성채"];
const ethics = ["질서와 계약", "기억의 보존", "실용적 확장", "피의 복수", "공동 생존", "예언의 실현"];
const rumors = [
  "지도층 내부에 이중 첩자가 있다",
  "봉인된 유적이 이미 열렸다",
  "주요 항로가 다음 달 폐쇄된다",
  "의회가 비밀리에 용병단과 협상 중이다",
];

function usage(): void {
  console.log(`
Usage:
  pnpm --filter @repo/drizzle db:seed:lore-a4 -- --project <projectId> [options]

Options:
  --project <uuid>       target project id (required)
  --count <number>       rows per entity type (default: ${DEFAULT_COUNT})
  --min-chars <number>   minimum body length (default: ${DEFAULT_MIN_CHARS})
  --keep-existing        append instead of replacing existing lore rows
  --help                 show this message
`);
}

function getArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function parsePositiveInt(value: string | undefined, fallback: number, label: string): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return parsed;
}

function assertUuid(value: string): void {
  if (!UUID_RE.test(value)) {
    throw new Error(`project id is not a valid UUID: ${value}`);
  }
}

function esc(value: string): string {
  return value.replace(/'/g, "''");
}

function pick(list: readonly string[], seed: number): string {
  const fallback = list[0] ?? "";
  return list[((seed % list.length) + list.length) % list.length] ?? fallback;
}

function makeName(type: LoreEntityType, index: number): string {
  const n = String(index + 1).padStart(4, "0");
  if (type === "world") return `세계 ${n}`;
  if (type === "character") return `캐릭터 ${n}`;
  if (type === "location") return `장소 ${n}`;
  return `세력 ${n}`;
}

function makeDescription(type: LoreEntityType, index: number): string {
  const region = pick(regions, index);
  const tension = pick(tensions, index + 2);
  const resource = pick(resources, index + 4);

  if (type === "world") {
    return `${region}을 중심으로 성장한 문명권으로, 현재 ${tension} 때문에 질서가 흔들리고 있다.`;
  }
  if (type === "character") {
    return `${region} 출신 인물로 ${tension} 국면에서 중요한 판단을 떠안고 있다.`;
  }
  if (type === "location") {
    return `${resource} 생산과 물류의 거점이지만, 최근 ${tension} 때문에 긴장이 높아졌다.`;
  }
  return `${resource}과 인력 흐름을 통제하며 ${tension} 속에서 영향력을 넓히는 조직이다.`;
}

function paragraphWorld(index: number, step: number): string {
  return `${makeName("world", index)}는 ${pick(genres, index + step * 3)} 분위기를 바탕으로 형성된 거대 권역이다. 핵심 생활권은 ${pick(regions, index + step)}에 집중되어 있으며 기후는 ${pick(climates, index + step * 2)}에 가깝다. 주민들은 ${pick(resources, index + step * 6)} 확보를 생존 전략의 최우선에 두고, 평시에도 물류와 방어를 한 묶음으로 관리한다. 이 세계의 정치적 무게중심은 ${pick(institutions, index + step * 4)}이 쥐고 있으며, 공식 규범은 ${pick(ethics, index + step * 8)}을 강조하지만 실제 현장에서는 타협과 거래가 더 자주 작동한다. 최근에는 ${pick(tensions, index + step * 5)}이 장기화되면서 행정 체계가 피로를 드러내고 있다. 특히 ${pick(landmarks, index + step * 7)} 주변에서 발생한 사건 이후 지역 간 신뢰가 급격히 낮아졌고, 상인과 병력의 이동도 검문 절차 때문에 느려졌다. 표면적으로는 안정이 유지되지만 내부 보고서에서는 ${pick(rumors, index + step * 9)}라는 소문이 반복적으로 등장한다. 이 때문에 이 세계의 주요 인물들은 대전환이 오기 전에 누가 먼저 질서를 재편할지 계산하며 움직이고 있다.`;
}

function paragraphCharacter(index: number, step: number): string {
  return `${makeName("character", index)}는 ${pick(regions, index + step * 4)}에서 성장한 ${pick(occupations, index + step)}이다. 겉으로 드러나는 인상은 ${pick(personalities, index + step * 2)}이며, 대화를 시작하면 ${pick(voices, index + step * 3)}가 뚜렷하게 느껴진다. 이 인물은 개인적 성공보다 ${pick(goals, index + step * 5)} 같은 구조적 과제를 더 중요하게 여기지만, 실제 행동은 언제나 주변 사람들의 안전과 직접 연결되어 있다. 그래서 ${pick(tensions, index + step * 6)}이 심해질수록 더욱 중심에 서게 되고, 반대로 그만큼 의심도 많이 받는다. ${pick(landmarks, index + step * 7)}에서 일어난 사건을 계기로 이 인물은 단순한 실무자가 아니라 상황을 뒤집을 변수로 주목받기 시작했다. 내부적으로는 오래전부터 누적된 실패와 미련을 품고 있으며, 겉으로는 침착해 보여도 중요한 결정 앞에서는 계산과 죄책감이 동시에 작동한다. 최근에는 ${pick(rumors, index + step * 8)}라는 정보가 사실일 가능성을 염두에 두고 독자적인 조사선을 운용하고 있다. 그 결과 동료와 상관 양쪽 모두에게 필요하지만 불편한 사람으로 남아 있다.`;
}

function paragraphLocation(index: number, step: number): string {
  return `${makeName("location", index)}는 ${pick(regions, index + step)} 경계에 놓인 전략 거점으로, 멀리서 보면 ${pick(landmarks, index + step * 3)}이 가장 먼저 시야를 장악한다. 이 지역의 공기는 ${pick(climates, index + step * 2)} 특성 때문에 늘 무겁거나 선명하게 갈리고, 주민들은 날씨 변화 자체를 일정 관리의 일부로 받아들인다. 경제의 핵심은 ${pick(resources, index + step * 4)} 생산과 환적에 있으며, 이를 조정하는 실무 기관은 ${pick(institutions, index + step * 5)}이다. 문제는 최근 ${pick(tensions, index + step * 6)}이 반복되면서 공공 시설과 민간 창고가 동시에 압박을 받고 있다는 점이다. 낮에는 장터와 선적장이 분주하게 돌아가지만, 해가 지면 경비선과 통행 규칙이 급격히 강화된다. 방문자는 활기와 불안을 같은 거리에서 동시에 느끼게 된다. 현지 기록관들은 이미 몇 달 전부터 ${pick(rumors, index + step * 7)}라는 보고를 축적해 왔고, 이 때문에 상층부는 겉으로는 침착한 척하면서도 실제로는 비상 계획을 여러 벌 준비해 두었다. 이 장소는 그래서 단순한 배경이 아니라, 사건이 방향을 바꾸는 압축 지점으로 기능한다.`;
}

function paragraphFaction(index: number, step: number): string {
  return `${makeName("faction", index)}은 ${pick(goals, index + step)}을 장기 전략으로 채택한 조직이다. 표면적 명분은 공공 안정이나 공동 번영이지만, 실제 운영 문서를 보면 ${pick(influences, index + step * 2)}에 대한 통제권을 확대하는 데 더 집요하다. 이 세력은 구성원 교육에서 ${pick(ethics, index + step * 3)}을 핵심 가치로 주입하고, 조직 결속을 위해 ${pick(resources, index + step * 4)} 유통과 보상 체계를 정교하게 설계한다. 공식 지휘선은 ${pick(institutions, index + step * 5)}와 협력한다고 말하지만, 실무 현장에서는 독자적 판단과 우회 거래가 빈번하다. 최근 ${pick(tensions, index + step * 6)}이 장기화되면서 이 조직은 외부에는 구원자처럼 보이고 내부에는 압박 기계처럼 기능하기 시작했다. 지도부는 공포를 드러내지 않지만 회의록에서는 이미 비용 증가와 충성도 저하가 반복적으로 언급된다. 더 큰 문제는 ${pick(rumors, index + step * 7)} 같은 풍문이 조직 내부에서도 설득력을 얻고 있다는 점이다. 그래서 이 세력은 앞으로 사건을 진정시키는 주체가 될 수도 있고, 반대로 위기를 가속하는 촉매가 될 수도 있다.`;
}

function makeBody(type: LoreEntityType, index: number, minChars: number): string {
  const parts: string[] = [];
  let step = 0;

  while (parts.join("\n\n").length < minChars) {
    if (type === "world") parts.push(paragraphWorld(index, step));
    if (type === "character") parts.push(paragraphCharacter(index, step));
    if (type === "location") parts.push(paragraphLocation(index, step));
    if (type === "faction") parts.push(paragraphFaction(index, step));
    step += 1;
  }

  return parts.join("\n\n");
}

function entityIdUnion(projectId: string): string {
  return [
    `SELECT id FROM story_worlds WHERE project_id = '${projectId}'`,
    `SELECT id FROM story_characters WHERE project_id = '${projectId}'`,
    `SELECT id FROM story_locations WHERE project_id = '${projectId}'`,
    `SELECT id FROM story_factions WHERE project_id = '${projectId}'`,
  ].join(" UNION ALL ");
}

interface InsertBatchInput {
  tx: postgres.TransactionSql;
  projectId: string;
  ownerId: string;
  start: number;
  end: number;
  minChars: number;
}

async function insertBatch(input: InsertBatchInput): Promise<void> {
  const { tx, projectId, ownerId, start, end, minChars } = input;
  const worlds: string[] = [];
  const characters: string[] = [];
  const locationsRows: string[] = [];
  const factions: string[] = [];

  for (let index = start; index < end; index += 1) {
    worlds.push(
      `('${randomUUID()}', '${projectId}', '${esc(makeName("world", index))}', '${esc(makeDescription("world", index))}', '${esc(makeBody("world", index, minChars))}', '${esc(pick(genres, index))}', '${ownerId}')`,
    );
    characters.push(
      `('${randomUUID()}', '${projectId}', '${esc(makeName("character", index))}', '${esc(makeDescription("character", index))}', '${esc(makeBody("character", index, minChars))}', '${esc(pick(occupations, index))}', '${esc(pick(personalities, index))}', '${esc(pick(voices, index))}', '${ownerId}')`,
    );
    locationsRows.push(
      `('${randomUUID()}', '${projectId}', '${esc(makeName("location", index))}', '${esc(makeDescription("location", index))}', '${esc(makeBody("location", index, minChars))}', '${esc(pick(regions, index))}', '${esc(pick(climates, index))}', '${ownerId}')`,
    );
    factions.push(
      `('${randomUUID()}', '${projectId}', '${esc(makeName("faction", index))}', '${esc(makeDescription("faction", index))}', '${esc(makeBody("faction", index, minChars))}', '${esc(pick(goals, index))}', '${esc(pick(influences, index))}', '${ownerId}')`,
    );
  }

  await tx.unsafe(
    `INSERT INTO story_worlds (id, project_id, name, description, body, genre, owner_id) VALUES ${worlds.join(",")}`,
  );
  await tx.unsafe(
    `INSERT INTO story_characters (id, project_id, name, description, body, occupation, personality, voice, owner_id) VALUES ${characters.join(",")}`,
  );
  await tx.unsafe(
    `INSERT INTO story_locations (id, project_id, name, description, body, region, climate, owner_id) VALUES ${locationsRows.join(",")}`,
  );
  await tx.unsafe(
    `INSERT INTO story_factions (id, project_id, name, description, body, goal, influence, owner_id) VALUES ${factions.join(",")}`,
  );
}

async function main(): Promise<void> {
  if (hasFlag("--help")) {
    usage();
    return;
  }

  const projectId = getArg("--project");
  if (!projectId) {
    usage();
    throw new Error("--project is required");
  }

  assertUuid(projectId);

  const count = parsePositiveInt(getArg("--count"), DEFAULT_COUNT, "count");
  const minChars = parsePositiveInt(getArg("--min-chars"), DEFAULT_MIN_CHARS, "min-chars");
  const keepExisting = hasFlag("--keep-existing");

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1 });

  try {
    const projectRows = await sql`
      SELECT id, name, owner_id
      FROM project_projects
      WHERE id = ${projectId}
      LIMIT 1
    `;

    if (projectRows.length === 0) {
      throw new Error(`project not found: ${projectId}`);
    }

    const ownerId = projectRows[0].owner_id;
    const projectName = projectRows[0].name;

    console.log(`[seed-lore-a4] project: ${projectName} (${projectId})`);
    console.log(`  owner: ${ownerId}`);
    console.log(`  count/type: ${count}`);
    console.log(`  min chars: ${minChars}`);
    console.log(`  mode: ${keepExisting ? "append" : "replace"}`);

    await sql.begin(async (tx) => {
      if (!keepExisting) {
        const ids = entityIdUnion(projectId);

        await tx.unsafe(`DELETE FROM story_entity_tags WHERE entity_id IN (${ids})`);
        await tx.unsafe(`DELETE FROM story_entity_properties WHERE entity_id IN (${ids})`);
        await tx.unsafe(`DELETE FROM story_relations WHERE source_id IN (${ids}) OR target_id IN (${ids})`);
        await tx`DELETE FROM story_worlds WHERE project_id = ${projectId}`;
        await tx`DELETE FROM story_characters WHERE project_id = ${projectId}`;
        await tx`DELETE FROM story_locations WHERE project_id = ${projectId}`;
        await tx`DELETE FROM story_factions WHERE project_id = ${projectId}`;
      }

      for (let start = 0; start < count; start += DEFAULT_BATCH) {
        const end = Math.min(start + DEFAULT_BATCH, count);
        await insertBatch({ tx, projectId, ownerId, start, end, minChars });
        console.log(`  batch ${String(start + 1).padStart(4, "0")}..${String(end).padStart(4, "0")}`);
      }
    });

    const stats = await sql.unsafe(`
      SELECT 'worlds' AS type, COUNT(*)::int AS count, COALESCE(AVG(char_length(body))::int, 0) AS avg_body
      FROM story_worlds WHERE project_id = '${projectId}'
      UNION ALL
      SELECT 'characters' AS type, COUNT(*)::int AS count, COALESCE(AVG(char_length(body))::int, 0) AS avg_body
      FROM story_characters WHERE project_id = '${projectId}'
      UNION ALL
      SELECT 'locations' AS type, COUNT(*)::int AS count, COALESCE(AVG(char_length(body))::int, 0) AS avg_body
      FROM story_locations WHERE project_id = '${projectId}'
      UNION ALL
      SELECT 'factions' AS type, COUNT(*)::int AS count, COALESCE(AVG(char_length(body))::int, 0) AS avg_body
      FROM story_factions WHERE project_id = '${projectId}'
    `);

    console.log("[seed-lore-a4] result");
    console.log(JSON.stringify(stats, null, 2));
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("[seed-lore-a4] failed");
  console.error(error);
  process.exit(1);
});
