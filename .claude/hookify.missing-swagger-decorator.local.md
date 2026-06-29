---
name: warn-missing-swagger-decorator
enabled: true
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: packages/features/.*/controller.*\.ts$
  - field: new_text
    operator: not_contains
    pattern: "@ApiOperation"
---

⚠️ **API Strategy 위반 — Controller에 Swagger 데코레이터 누락**

Controller 파일에 `@ApiOperation` 데코레이터가 없습니다.

**원칙:** REST Controller는 Swagger/OpenAPI schema를 반드시 노출한다.
**규칙:** `docs/rules/backend/api-strategy.md`, `docs/rules/backend/swagger.md`

**필수 데코레이터:**
```typescript
@ApiTags('Blog')
@Controller('blog')
export class BlogController {
  @Get()
  @ApiOperation({ summary: '게시물 목록 조회' })
  @ApiResponse({ status: 200, description: '게시물 목록 반환' })
  async findAll() { ... }
}
```
