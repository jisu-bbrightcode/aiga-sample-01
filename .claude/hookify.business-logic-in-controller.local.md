---
name: block-business-logic-in-controller
enabled: true
event: file
action: block
conditions:
  - field: file_path
    operator: regex_match
    pattern: packages/features/.*(controller|\.router)\.(ts|tsx)$
  - field: new_text
    operator: regex_match
    pattern: (this\.db\.|\.query\.|\.insert\(|\.update\(|\.delete\(|\.select\()
---

🚫 **Service Layer 위반 — Controller/Router에서 DB 직접 접근 차단**

Controller에서 데이터베이스를 직접 조작하고 있습니다.

**원칙:** Service가 모든 비즈니스 로직의 단일 진실 공급원. Controller는 Service를 호출만 한다.
**규칙:** `docs/rules/backend/service-impl.md`

**올바른 방법:**
```typescript
// ❌ Controller에서 DB 직접 접근
@Get()
async findAll() {
  return this.db.query.posts.findMany()  // 금지
}

// ✅ Service를 통한 접근
@Get()
async findAll(@Query('page') page: number) {
  return this.blogService.findPublished({ page, limit: 10 })
}
```

**Controller = 라우팅 + 인증 + 응답 포맷. 비즈니스 로직 = Service.**
