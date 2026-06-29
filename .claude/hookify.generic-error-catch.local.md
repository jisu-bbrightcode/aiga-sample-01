---
name: warn-generic-error-catch
enabled: true
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: packages/(features|core)/.+\.ts$
  - field: new_text
    operator: regex_match
    pattern: catch\s*\(\s*(e|err|error)\s*\)\s*\{[^}]*(throw\s+new\s+Error\(|throw\s+e|throw\s+err)
---

⚠️ **에러 핸들링 경고 — 제네릭 에러 재throw 감지**

`catch (e) { throw new Error(...) }` — 원본 에러를 제네릭 Error로 덮어쓰고 있습니다.

**원칙:** NestJS Exception 타입 사용. 제네릭 Error 금지.
**규칙:** `docs/rules/backend/service-impl.md` NestJS Exception 사용 기준

**올바른 방법:**
```typescript
// ❌ 제네릭
catch (error) {
  throw new Error('Something went wrong')
}

// ✅ 구체적 NestJS Exception
import { NotFoundException, ConflictException } from '@nestjs/common'

catch (error) {
  if (error instanceof NotFoundException) throw error
  throw new ConflictException(`Slug already exists: ${slug}`)
}
```

| Exception | 사용 상황 |
|-----------|----------|
| `NotFoundException` | 리소스 없음 |
| `ConflictException` | 중복 |
| `ForbiddenException` | 권한 없음 |
| `BadRequestException` | 잘못된 입력 |
