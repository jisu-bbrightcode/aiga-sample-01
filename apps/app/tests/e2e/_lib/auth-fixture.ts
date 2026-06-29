/**
 * better-auth session/org/member mock fixture 팩토리.
 *
 * 5+ spec 이 동일 shape 의 `user/session/organization/member` 객체를 각자
 * 다시 선언했음. 이 팩토리는 식별자/이메일/이름/슬러그만 받아서 그 4 객체
 * + helper 를 함께 만들어준다.
 *
 * `getSession()` / `getActiveMember()` / `getActiveMemberRole()` / `setActive`
 * 등 모든 mock route 가 같은 데이터를 참조하도록 한 곳에서 일관성 보장.
 */

const now = () => new Date().toISOString();

export interface AuthFixtureInput {
  /** id suffix — user-/session-/member- 프리픽스 뒤에 붙는다. */
  slug: string;
  email: string;
  name: string;
  /** organization 의 표시 이름. */
  organizationName: string;
  organizationId: string;
  /** organization.slug. 생략 시 `slug` 재사용. */
  organizationSlug?: string;
  /** session.user.session.token. 기본 `session-token-${slug}`. */
  sessionToken?: string;
  /** member 가 `organization.members` 배열에 포함될지. 기본 false. */
  embedMemberInOrganization?: boolean;
}

export interface AuthFixture {
  user: {
    id: string;
    email: string;
    name: string;
    image: null;
    createdAt: string;
    updatedAt: string;
  };
  session: {
    user: AuthFixture["user"];
    session: {
      id: string;
      token: string;
      userId: string;
      activeOrganizationId: string;
      expiresAt: string;
      createdAt: string;
      updatedAt: string;
    };
  };
  member: {
    id: string;
    userId: string;
    organizationId: string;
    role: "owner";
    createdAt: string;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    logo: null;
    metadata: null;
    createdAt: string;
    members: AuthFixture["member"][];
    invitations: never[];
  };
}

export function createAuthFixture(input: AuthFixtureInput): AuthFixture {
  const ts = now();
  const user = {
    id: `user-${input.slug}`,
    email: input.email,
    name: input.name,
    image: null,
    createdAt: ts,
    updatedAt: ts,
  };
  const member = {
    id: `member-${input.slug}`,
    userId: user.id,
    organizationId: input.organizationId,
    role: "owner" as const,
    createdAt: ts,
  };
  const organization = {
    id: input.organizationId,
    name: input.organizationName,
    slug: input.organizationSlug ?? input.slug,
    logo: null,
    metadata: null,
    createdAt: ts,
    members: input.embedMemberInOrganization ? [member] : [],
    invitations: [] as never[],
  };
  const session = {
    user,
    session: {
      id: `session-${input.slug}`,
      token: input.sessionToken ?? `session-token-${input.slug}`,
      userId: user.id,
      activeOrganizationId: input.organizationId,
      expiresAt: "2030-01-01T00:00:00.000Z",
      createdAt: ts,
      updatedAt: ts,
    },
  };
  return { user, session, member, organization };
}
