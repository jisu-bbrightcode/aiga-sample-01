---
description: "Service implementation patterns: queries, permissions, pagination, slug, soft-delete"
globs: "packages/features/**/service/*.ts"
alwaysApply: false
---

# Service Implementation Patterns

## 핵심 원칙

Service는 **모든 비즈니스 로직의 단일 진실 공급원**입니다.
Controller와 background worker는 동일한 Service를 사용합니다.

```typescript
@Injectable()
export class BlogService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}
}
```

---

## 페이지네이션 조회

```typescript
async findPublished(input: PaginationInput): Promise<PaginatedResult<PostWithAuthor>> {
  const { page, limit } = input;
  const offset = (page - 1) * limit;

  const whereCondition = and(
    eq(posts.isPublished, true),
    eq(posts.isDeleted, false)
  );

  const [data, totalResult] = await Promise.all([
    this.db.query.posts.findMany({
      where: whereCondition,
      limit,
      offset,
      orderBy: [desc(posts.createdAt)],
      with: { author: true },
    }),
    this.db.select({ count: count() }).from(posts).where(whereCondition),
  ]);

  const total = totalResult[0]?.count ?? 0;

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
```

### 규칙

- `Promise.all`로 데이터와 총 개수를 병렬 조회
- `PaginatedResult<T>` 타입으로 반환: `{ data, total, page, limit, totalPages }`
- 공개 목록은 `isPublished: true` + `isDeleted: false` 필터링
- Admin 목록은 `isDeleted: false`만 필터링

---

## Slug 기반 조회

```typescript
async findBySlug(slug: string): Promise<PostWithAuthor> {
  const post = await this.db.query.posts.findFirst({
    where: and(
      eq(posts.slug, slug),
      eq(posts.isPublished, true),
      eq(posts.isDeleted, false)
    ),
    with: { author: true },
  });

  if (!post) {
    throw new NotFoundException(`Post not found: ${slug}`);
  }

  return post;
}
```

### 규칙

- 존재하지 않으면 `NotFoundException` throw
- 공개 조회 시 `isPublished` + `isDeleted` 조건 추가
- `with: { author: true }` 등 relations 포함

---

## ID 기반 조회 (Admin)

```typescript
async findById(id: string): Promise<PostWithAuthor> {
  const post = await this.db.query.posts.findFirst({
    where: and(
      eq(posts.id, id),
      eq(posts.isDeleted, false)
    ),
    with: { author: true },
  });

  if (!post) {
    throw new NotFoundException(`Post not found: ${id}`);
  }

  return post;
}
```

### 규칙

- Admin용 조회는 `isPublished` 조건 없이 비공개 포함
- `isDeleted: false`는 항상 적용

---

## 생성 (Create)

```typescript
async create(input: CreatePostInput, authorId: string): Promise<PostWithAuthor> {
  const slug = this.generateSlug(input.title);

  // 슬러그 중복 체크
  const existing = await this.db.query.posts.findFirst({
    where: eq(posts.slug, slug),
  });

  if (existing) {
    throw new ConflictException(`Slug already exists: ${slug}`);
  }

  const [post] = await this.db
    .insert(posts)
    .values({ ...input, slug, authorId })
    .returning();

  return this.findById(post.id);
}
```

### 규칙

- 슬러그 중복 시 `ConflictException` throw
- `insert().values().returning()`으로 생성 후 반환
- 생성 후 `findById`로 relations 포함된 데이터 반환

---

## 수정 (Update)

```typescript
async update(id: string, input: Partial<CreatePostInput>): Promise<PostWithAuthor> {
  const existing = await this.findById(id);

  const updateData: Record<string, unknown> = { ...input };

  // 제목 변경 시 슬러그도 업데이트
  if (input.title && input.title !== existing.title) {
    updateData.slug = this.generateSlug(input.title);
  }

  await this.db
    .update(posts)
    .set(updateData)
    .where(eq(posts.id, id));

  return this.findById(id);
}
```

### 규칙

- 수정 전 `findById`로 존재 여부 확인
- 관련 필드 변경 시 파생 필드도 함께 업데이트 (예: title -> slug)
- 수정 후 `findById`로 최신 데이터 반환

---

## Soft Delete

```typescript
async delete(id: string): Promise<{ success: boolean }> {
  await this.findById(id); // 존재 여부 확인

  await this.db
    .update(posts)
    .set({ isDeleted: true, deletedAt: new Date() })
    .where(eq(posts.id, id));

  return { success: true };
}
```

### 규칙

- 물리 삭제 대신 `isDeleted: true` + `deletedAt` 설정
- 삭제 전 `findById`로 존재 여부 확인
- 반환값: `{ success: boolean }`

---

## 토글 패턴

```typescript
async togglePublish(id: string): Promise<PostWithAuthor> {
  const post = await this.findById(id);

  await this.db
    .update(posts)
    .set({ isPublished: !post.isPublished })
    .where(eq(posts.id, id));

  return this.findById(id);
}
```

---

## Slug 생성 유틸리티

```typescript
private generateSlug(title: string): string {
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/(^-|-$)/g, '');

  // 유니크 보장을 위해 타임스탬프 추가
  return `${baseSlug}-${Date.now().toString(36)}`;
}
```

---

## NestJS Exception 사용 기준

| Exception            | 사용 상황                  |
| -------------------- | -------------------------- |
| `NotFoundException`  | 리소스를 찾을 수 없음      |
| `ConflictException`  | 중복 (slug, unique 필드)   |
| `ForbiddenException` | 권한 없음                  |
| `BadRequestException`| 잘못된 입력                |
