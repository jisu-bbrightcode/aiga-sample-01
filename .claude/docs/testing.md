# Unit Test Rules

> Jest + NestJS TestingModule 기반 Server Feature 단위 테스트 규칙

---

## 테스트 파일 위치

```
packages/features/{feature-name}/
├── service/
│   └── {feature-name}.service.spec.ts    # Service 단위 테스트
├── middleware/
│   └── {name}.middleware.spec.ts         # Middleware 테스트
├── provider/
│   └── {name}.provider.spec.ts           # Provider 테스트
└── controller/
    └── {name}.controller.spec.ts         # Controller 테스트 (선택)
```

---

## 공유 테스트 유틸

**위치**: `packages/features/__test-utils__/`

| 파일 | 용도 |
|------|------|
| `mock-db.ts` | Chainable Drizzle ORM mock (queue-based) |
| `mock-logger.ts` | `createLogger()` mock |
| `mock-schema.ts` | drizzle-orm 함수 + @repo/drizzle mock 헬퍼 |
| `constants.ts` | 공통 테스트 상수 (TEST_USER 등) |
| `index.ts` | 전체 re-export |

### Import 패턴

```typescript
// ✅ 공유 유틸 import
import { createMockDb, TEST_USER } from "../../__test-utils__";

// ❌ 다른 feature 유틸 직접 import 금지
import { createMockDb } from "../../payment/__test-utils__";
```

---

## Mock 패턴

### 1. Drizzle ORM 함수 Mock (필수)

모든 spec 파일 상단에 `drizzle-orm`을 mock합니다. Service에서 사용하는 함수만 포함합니다.

```typescript
jest.mock("drizzle-orm", () => ({
  eq: jest.fn((field: any, value: any) => ({ field, value, type: "eq" })),
  and: jest.fn((...conditions: any[]) => ({ conditions, type: "and" })),
  or: jest.fn((...conditions: any[]) => ({ conditions, type: "or" })),
  desc: jest.fn((field: any) => ({ field, type: "desc" })),
  asc: jest.fn((field: any) => ({ field, type: "asc" })),
  count: jest.fn(() => ({ type: "count" })),
  sql: jest.fn((strings: any, ...values: any[]) => ({ strings, values, type: "sql" })),
  isNull: jest.fn((field: any) => ({ field, type: "isNull" })),
  like: jest.fn((field: any, pattern: any) => ({ field, pattern, type: "like" })),
  inArray: jest.fn((field: any, values: any) => ({ field, values, type: "inArray" })),
}));
```

### 2. Schema Tables Mock (필수)

각 feature의 테이블 컬럼을 `{ name: "column_name" }` 형식으로 mock합니다.

```typescript
jest.mock("@repo/drizzle", () => {
  const { Inject } = jest.requireActual("@nestjs/common");
  return {
    DRIZZLE: "DRIZZLE_TOKEN",
    InjectDrizzle: () => Inject("DRIZZLE_TOKEN"),
    blogPosts: {
      id: { name: "id" },
      title: { name: "title" },
      authorId: { name: "author_id" },
      isPublished: { name: "is_published" },
      createdAt: { name: "created_at" },
    },
  };
});
```

### 3. Logger Mock (필수)

```typescript
jest.mock("@repo/core/logger", () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));
```

### 4. Mock DB 사용 (createMockDb)

Queue-based chainable mock으로 Drizzle ORM의 메서드 체이닝을 시뮬레이션합니다.

```typescript
import { createMockDb } from "../../__test-utils__";

let mockDb: ReturnType<typeof createMockDb>;

beforeEach(() => {
  mockDb = createMockDb();
});

afterEach(() => {
  jest.clearAllMocks();
  mockDb._resetQueue();
});

// db.query 사용
it("should find item", async () => {
  mockDb.query.posts.findFirst.mockResolvedValue(mockPost);
  const result = await service.findById("id-123");
  expect(result).toEqual(mockPost);
});

// 체인 메서드 결과 설정
it("should create item", async () => {
  mockDb._queueResolve("returning", [{ id: "new-id", ...mockInput }]);
  const result = await service.create(mockInput);
  expect(mockDb.insert).toHaveBeenCalled();
});
```

---

## 테스트 구조

### describe/it 패턴

```typescript
describe("BlogService", () => {
  let service: BlogService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(async () => {
    mockDb = createMockDb();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogService,
        { provide: DRIZZLE, useValue: mockDb },
      ],
    }).compile();
    service = module.get<BlogService>(BlogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockDb._resetQueue();
  });

  // =========================================================================
  // findAll
  // =========================================================================
  describe("findAll", () => {
    it("게시물 목록을 반환한다", async () => {
      mockDb.query.posts.findMany.mockResolvedValue([mockPost]);
      const result = await service.findAll();
      expect(result).toHaveLength(1);
    });
  });
});
```

### 규칙

| 규칙 | 설명 |
|------|------|
| **메서드별 describe** | Service의 각 public 메서드마다 별도 `describe` 블록 |
| **한글 테스트명** | `it("게시물을 생성한다", ...)` |
| **구분 주석** | 메서드 describe 앞에 `// ====` 구분선 |
| **Arrange-Act-Assert** | 각 테스트 내부 3단계 구조 |
| **정상 + 에러 케이스** | 각 메서드마다 성공 + 예외 시나리오 |
| **beforeEach setup** | NestJS TestingModule로 서비스 인스턴스 생성 |
| **afterEach cleanup** | `jest.clearAllMocks()` + `mockDb._resetQueue()` |

---

## 에러 케이스 테스트

```typescript
it("존재하지 않는 게시물 조회 시 NotFoundException을 던진다", async () => {
  mockDb.query.posts.findFirst.mockResolvedValue(null);
  await expect(service.findById("nonexistent-id"))
    .rejects.toThrow(NotFoundException);
});

it("중복 slug 시 구체적인 에러 메시지를 포함한다", async () => {
  mockDb.query.posts.findFirst.mockResolvedValue(existingPost);
  await expect(service.create({ title: "Duplicate" }))
    .rejects.toThrow('Slug already exists: duplicate');
});
```

---

## 테스트 계정 (고정)

| 항목 | 값 |
|------|-----|
| **Email** | `qa@test.com` |
| **Password** | `q1w2e3r45t` |
| **Name** | `QA Tester` |
| **ID** | `2b6527ac-c020-47b3-bcf3-33cb8e43bd7c` |

공유 상수에서 import: `import { TEST_USER } from "../../__test-utils__";`

---

## 테스트 실행

```bash
# 전체 feature 테스트
pnpm -F @repo/features test

# 특정 feature만
pnpm -F @repo/features test -- --testPathPattern="blog"

# 커버리지
pnpm -F @repo/features test:cov

# Root에서 전체 실행
pnpm test
```

---

## 커버리지 요구사항

| 항목 | 최소 기준 |
|------|----------|
| Statements | 80% |
| Branches | 70% |
| Functions | 80% |
| Lines | 80% |

---

## Feature 테스트 작성 체크리스트

- [ ] `jest.mock("drizzle-orm", ...)` 선언
- [ ] `jest.mock("@repo/drizzle", ...)` 선언 (해당 feature 테이블)
- [ ] `jest.mock("@repo/core/logger", ...)` 선언
- [ ] `createMockDb()` 사용 (`__test-utils__/`)
- [ ] `TEST_USER` 등 공유 상수 사용
- [ ] 각 Service 메서드마다 `describe` 블록
- [ ] 정상 케이스 + 에러 케이스 포함
- [ ] `beforeEach`에 NestJS TestingModule setup
- [ ] `afterEach`에 cleanup (`clearAllMocks` + `_resetQueue`)
- [ ] `pnpm -F @repo/features test` 통과
