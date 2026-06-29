/**
 * StarCraft 캐릭터 seed — M5 품질 시나리오 테스트용
 *
 * 짐레이너, 사라캐리건, 제라툴을 특정 프로젝트에 생성한다.
 *
 * 사용:
 *   npx tsx scripts/seed-starcraft-characters.ts <projectId>
 */

import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: resolve(__dirname, "../../../.env.local") });

const projectId = process.argv[2];
if (!projectId) {
  console.error("Usage: npx tsx scripts/seed-starcraft-characters.ts <projectId>");
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");
const sql = postgres(dbUrl);

// qa+e2e 계정 owner_id
const ownerId = "mv16WrolCPEfIvxCtDCoy0vqIMMWw5FZ";

const characters = [
  {
    id: randomUUID(),
    name: "Jim Raynor",
    description:
      "전직 마샬, 현 반란군 Raiders 지휘관. 테란 도미니온에 맞서 정의를 위해 싸운다. 남부 텍산 사투리, 거칠지만 따뜻한 심성. 사라 캐리건이 저그로 변이된 것에 대한 죄책감과 사랑이 공존한다.",
    body: `짐 레이너는 코프룰루 섹터에서 가장 유명한 반란군 지도자다.

마샬 시절 카락스 식민지에서 근무하다 자 신이 봉사하던 체제의 부패를 목격하고 등을 돌렸다. 이후 반란군 Raiders를 이끌며 Hyperion 전함을 기지로 삼아 도미니온에 맞서 싸운다.

사라 캐리건이 아이어에서 저그에게 붙잡혀 변이된 것에 대해 깊은 죄책감을 느끼며, 언젠가 그녀를 구할 것을 다짐한다. 이 죄책감과 사랑은 그의 가장 큰 약점이자 동력이다.

말투: 텍산 억양, "Hell, it's about time." 류의 직설적이고 거친 표현. 감정을 직접 드러내지 않지만 행동으로 보여준다.`,
    personality: "거칠지만 따뜻함, 정의감, 유머, 캐리건에 대한 복잡한 감정, 리더십",
    occupation: "Raiders 지휘관",
    age: "40대 초반",
  },
  {
    id: randomUUID(),
    name: "Sarah Kerrigan",
    description:
      "전직 유령 요원, 저그 군주의 여왕(Queen of Blades). 아이어에서 레이너에게 버려진 후 저그에게 감염되어 저그 군주가 됐다. 냉혹하고 강력하지만 인간성의 흔적이 남아 있다.",
    body: `사라 케리건은 코프룰루 섹터에서 가장 강력한 사이오닉 존재다.

어린 시절 강력한 사이오닉 능력을 보여 연방에 의해 유령 프로그램에 강제 편입됐다. 유령 요원으로 활동하며 짐 레이너와 관계를 맺었으나, 아이어 공략 작전에서 레이너에게 버려진 후 저그 오버마인드에 포획됐다.

저그로 변이된 이후 "칼날의 여왕"으로 불리며 저그 군주가 됐다. 냉혹하고 계산적이지만, 레이너와의 과거가 가끔 그녀를 흔든다.

말투: 차갑고 위압적, 감정을 드러내지 않으려 하지만 레이너 관련 주제에서 균열이 생긴다.`,
    personality: "냉혹함, 강인함, 억눌린 인간성, 레이너에 대한 복잡한 감정, 전략적 사고",
    occupation: "저그 군주",
    age: "30대 초반",
  },
  {
    id: randomUUID(),
    name: "Zeratul",
    description:
      "다크 템플러 대사제. 수천 년의 지혜를 가진 예언자. 수수께끼 같고 철학적인 말투. 젤나가 예언을 통해 코프룰루 섹터의 운명을 본다.",
    body: `제라툴은 아이어가 함락되기 이전부터 존재한 다크 템플러 대사제다.

아이어에서 추방된 다크 템플러의 후예로, 수천 년간 그림자 속에서 싸워왔다. 젤나가의 예언을 연구하며 코프룰루 섹터의 운명에 대한 통찰을 얻었다.

하이버드의 위협을 처음 발견하고 레이너에게 경고를 전달했다. 칼날의 여왕을 창조하는 데 의도치 않게 일조한 것에 대해 깊은 책임감을 느낀다.

말투: 고대적이고 철학적, "어둠 속에서도 빛을 찾을 수 있다" 류의 은유. 직접적으로 답하기보다 질문으로 돌려보낸다.`,
    personality: "고대의 지혜, 철학적, 예언자적 시각, 고독함, 희생 정신, 수수께끼 같음",
    occupation: "다크 템플러 대사제",
    age: "수백 년",
  },
];

async function seed() {
  console.log(`Seeding StarCraft characters into project: ${projectId}`);

  for (const char of characters) {
    const existing = await sql`
      SELECT id FROM story_characters
      WHERE project_id = ${projectId} AND name = ${char.name} AND is_deleted = false
      LIMIT 1
    `;

    if (existing.length > 0) {
      console.log(`  skip (already exists): ${char.name}`);
      continue;
    }

    await sql`
      INSERT INTO story_characters (
        id, project_id, owner_id, name, description, body,
        personality, occupation, age,
        created_at, updated_at, is_deleted
      ) VALUES (
        ${char.id}, ${projectId}, ${ownerId}, ${char.name}, ${char.description}, ${char.body},
        ${char.personality}, ${char.occupation}, ${char.age},
        now(), now(), false
      )
    `;
    console.log(`  created: ${char.name} (${char.id})`);
  }

  await sql.end();
  console.log("Done.");
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
