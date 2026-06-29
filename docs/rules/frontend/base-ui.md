---
description: Base-UI component patterns (render prop, not Radix asChild)
globs: "**/*.tsx"
alwaysApply: false
---

# Base-UI 컴포넌트 패턴

이 프로젝트의 shadcn 컴포넌트들은 **Base-UI**를 기반으로 합니다 (Radix UI가 아님).

---

## 6. Base-UI 컴포넌트 패턴

### render prop 패턴 (asChild 대신)

Base-UI는 Radix의 `asChild` 대신 `render` prop을 사용합니다.

```typescript
// ✅ Base-UI 방식 - render prop 사용
import { Link } from "@tanstack/react-router";

<SidebarMenuButton render={<Link to="/admin/board" />}>
  <LayoutList />
  <span>게시판</span>
</SidebarMenuButton>

// ❌ Radix 방식 - Base-UI에서 동작하지 않음
<SidebarMenuButton asChild>
  <Link to="/admin/board">...</Link>
</SidebarMenuButton>
```

### DropdownMenuTrigger와 SidebarMenuButton 조합

DropdownMenu와 SidebarMenuButton을 함께 사용할 때 button 중첩 문제에 주의:

```typescript
// ✅ 올바른 방식 - SidebarMenuButton의 render prop 사용
<DropdownMenu>
  <SidebarMenuButton render={<DropdownMenuTrigger />} size="lg">
    <Avatar>...</Avatar>
    <span>User Name</span>
  </SidebarMenuButton>
  <DropdownMenuContent>...</DropdownMenuContent>
</DropdownMenu>

// ❌ 잘못된 방식 - button 중첩 발생 (hydration error)
<DropdownMenu>
  <DropdownMenuTrigger>           {/* button */}
    <SidebarMenuButton>           {/* button - 중첩! */}
      ...
    </SidebarMenuButton>
  </DropdownMenuTrigger>
</DropdownMenu>

// ❌ asChild는 Base-UI에서 동작하지 않음
<DropdownMenuTrigger asChild>     {/* asChild 무시됨 */}
  <SidebarMenuButton>...</SidebarMenuButton>
</DropdownMenuTrigger>
```

### tooltip과 render prop 충돌

`SidebarMenuButton`에서 `tooltip`과 `render` prop을 동시에 사용하면 `tooltip`이 우선됩니다:

```typescript
// ⚠️ tooltip이 render를 덮어씀 - Link가 적용되지 않음
<SidebarMenuButton
  render={<Link to="/admin" />}  // 무시됨
  tooltip="Dashboard"             // TooltipTrigger로 render 덮어씀
>
  <LayoutDashboard />
</SidebarMenuButton>

// ✅ 둘 중 하나만 사용
<SidebarMenuButton render={<Link to="/admin" />}>
  <LayoutDashboard />
  <span>Dashboard</span>
</SidebarMenuButton>
```

