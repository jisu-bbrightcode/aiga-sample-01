/**
 * 커뮤니티 수정 권한 정책 단위 테스트 (PB-COMM-SPACE-API-UPDATE-001 / BBR-589).
 * DB 없이 항상 실행되며 AC#1(역할별 수정 가능 필드 분리)을 직접 검증한다.
 */

import {
  buildSettingsChanges,
  evaluateCommunityUpdate,
  OWNER_ADMIN_ONLY_FIELDS,
} from "./update-policy";

describe("evaluateCommunityUpdate (AC#1 역할별 필드 분리)", () => {
  it("owner 는 owner/admin 전용 필드를 포함해 모든 필드를 변경할 수 있다", () => {
    const result = evaluateCommunityUpdate("owner", ["name", "type", "description", "bannedWords"]);
    expect(result.allowed).toBe(true);
    expect(result.forbiddenFields).toEqual([]);
  });

  it("admin 도 모든 필드를 변경할 수 있다", () => {
    const result = evaluateCommunityUpdate("admin", ["name", "type", "automodConfig"]);
    expect(result.allowed).toBe(true);
    expect(result.forbiddenFields).toEqual([]);
  });

  it("moderator 는 운영 설정은 변경 가능하다", () => {
    const result = evaluateCommunityUpdate("moderator", [
      "description",
      "iconUrl",
      "bannerUrl",
      "automodConfig",
      "bannedWords",
      "isNsfw",
    ]);
    expect(result.allowed).toBe(true);
    expect(result.forbiddenFields).toEqual([]);
  });

  it("moderator 는 name(정체성)을 변경할 수 없다", () => {
    const result = evaluateCommunityUpdate("moderator", ["name", "description"]);
    expect(result.allowed).toBe(true);
    expect(result.forbiddenFields).toEqual(["name"]);
  });

  it("moderator 는 type(공개 상태)을 변경할 수 없다", () => {
    const result = evaluateCommunityUpdate("moderator", ["type"]);
    expect(result.allowed).toBe(true);
    expect(result.forbiddenFields).toEqual(["type"]);
  });

  it("moderator 가 name+type 둘 다 시도하면 둘 다 금지 필드로 반환된다", () => {
    const result = evaluateCommunityUpdate("moderator", ["name", "type", "description"]);
    expect(result.forbiddenFields).toEqual(["name", "type"]);
  });

  it("member 는 어떤 필드도 변경할 수 없다", () => {
    const result = evaluateCommunityUpdate("member", ["description"]);
    expect(result.allowed).toBe(false);
    expect(result.forbiddenFields).toEqual([]);
  });

  it("비멤버(null, 차단 포함)는 변경할 수 없다", () => {
    const result = evaluateCommunityUpdate(null, ["description"]);
    expect(result.allowed).toBe(false);
  });

  it("OWNER_ADMIN_ONLY_FIELDS 는 name 과 type 이다", () => {
    expect([...OWNER_ADMIN_ONLY_FIELDS].sort()).toEqual(["name", "type"]);
  });
});

describe("buildSettingsChanges (AC#2 감사 로그 diff)", () => {
  const before = {
    name: "old-name",
    description: "old desc",
    type: "public",
    isNsfw: false,
    bannedWords: ["a", "b"],
    automodConfig: { enableSpamFilter: true, minKarmaToPost: 0 },
  };

  it("바뀐 스칼라 필드만 from/to 로 기록한다", () => {
    const changes = buildSettingsChanges(before, { description: "new desc" });
    expect(changes).toEqual({ description: { from: "old desc", to: "new desc" } });
  });

  it("값이 같으면 변경으로 보지 않는다", () => {
    const changes = buildSettingsChanges(before, { description: "old desc", type: "public" });
    expect(changes).toEqual({});
  });

  it("undefined(미포함) 필드는 무시한다", () => {
    const changes = buildSettingsChanges(before, { description: undefined, name: "new-name" });
    expect(Object.keys(changes)).toEqual(["name"]);
    expect(changes.name).toEqual({ from: "old-name", to: "new-name" });
  });

  it("배열 변경을 감지한다", () => {
    const changes = buildSettingsChanges(before, { bannedWords: ["a", "b", "c"] });
    expect(changes.bannedWords).toEqual({ from: ["a", "b"], to: ["a", "b", "c"] });
  });

  it("동일 배열(같은 내용)은 변경으로 보지 않는다", () => {
    const changes = buildSettingsChanges(before, { bannedWords: ["a", "b"] });
    expect(changes).toEqual({});
  });

  it("중첩 객체 변경을 키 순서 무관하게 감지한다", () => {
    const same = buildSettingsChanges(before, {
      automodConfig: { minKarmaToPost: 0, enableSpamFilter: true },
    });
    expect(same).toEqual({});

    const diff = buildSettingsChanges(before, {
      automodConfig: { enableSpamFilter: false, minKarmaToPost: 0 },
    });
    expect(diff.automodConfig).toBeDefined();
  });

  it("이전 값이 null/undefined 이면 from 을 null 로 정규화한다", () => {
    const changes = buildSettingsChanges({}, { description: "first" });
    expect(changes.description).toEqual({ from: null, to: "first" });
  });
});
