# UI Components Reference

패키지: `@repo/ui` (`packages/ui/`)

## Brand Assets

| 자산          | 경로                            | 설명                                  |
| ------------- | ------------------------------- | ------------------------------------- |
| `logo.svg`    | `apps/app/public/logo.svg`      | 앱 public Product Builder 로고 원본           |
| `logo.svg`    | `apps/admin/public/logo.svg`    | admin public Product Builder 로고 원본        |
| `logo.svg`    | `packages/ui/src/assets/svg/logo.svg` | `@repo/ui` 공용 Product Builder 로고 원본 |
| `favicon.png` | `apps/app/public/favicon.png`   | `logo.svg` 에서 생성한 앱 favicon 원본 |
| `favicon.ico` | `apps/app/public/favicon.ico`   | `favicon.png` 에서 생성한 ICO fallback |
| `favicon.png` | `apps/admin/public/favicon.png` | 앱 favicon 과 동일한 admin favicon 원본 |
| `favicon.ico` | `apps/admin/public/favicon.ico` | 앱 favicon 과 동일한 admin ICO fallback |

앱/admin 의 로고와 favicon은 같은 Product Builder 로고 SVG에서 생성한다.
apps/app 에서 로고를 렌더링할 때는 `/logo.svg`를 직접 참조한다. 브라우저 탭 아이콘은 `/favicon.png`를
16/32px favicon 및 apple touch icon으로 선언하고, `/favicon.ico`는 같은 원본에서 만든 fallback으로 둔다.
브라우저 문서 title은 환경변수 치환에 실패해도 `%VITE_APP_NAME%` 같은 템플릿 토큰이 노출되지 않도록
HTML에서 `Product Builder`, admin HTML에서 `Product Builder Admin`을 직접 선언한다. 런타임 `project.name`의 기본값도
`Product Builder`로 유지한다.

## App Loading

로딩 UX 정책과 bootstrap 흐름은 [app-loading-strategy.md](./app-loading-strategy.md)를 기준으로 한다.

| 컴포넌트 / 자산 | 경로 | 설명 |
| ---------------- | ---- | ---- |
| `LoadingLottie` | `apps/app/src/components/app-loading.tsx` | `/loading/liquid-splats.lottie` 기반 공통 로딩 애니메이션. size token은 기존 대비 2배, 자산은 검정 모노톤 |
| `AppLoadingState` | `apps/app/src/components/app-loading.tsx` | 전체 화면 또는 사용자 조작을 막는 blocking 로딩용 Lottie 래퍼 |
| `AppQuietLoadingState` | `apps/app/src/components/app-loading.tsx` | 홈 목록, 캔버스 데이터 로딩처럼 화면 일부만 기다리는 조용한 페이지/영역 로딩 |
| `QuietLoadingIndicator` | `apps/app/src/components/app-loading.tsx` | 저장 중, 동기화 중, 모달 진행 상태처럼 작은 부분 로딩용 인라인 표시 |
| `AppAuthLoadingState` | `apps/app/src/components/app-loading.tsx` | 페이지 새로고침/세션 확인 시 `AuthGuard`에 넘기는 앱 전용 인증 fallback |
| `AppWorkspaceLoadingState` | `apps/app/src/components/app-loading.tsx` | 워크스페이스 확인/전환 중 사용하는 앱 전용 fullscreen fallback |
| `liquid-splats.lottie` | `apps/app/public/loading/liquid-splats.lottie` | 앱 공통 로딩 Lottie 자산 |

버튼 내부 로딩은 Lottie 적용 대상에서 제외한다. 버튼은 기존 텍스트 또는 버튼 전용 작은 스피너 패턴을 유지한다. 인증 가드와 워크스페이스 확인처럼 새로고침 중 앱 전체가 막히는 fullscreen fallback은 각각 `AppAuthLoadingState`, `AppWorkspaceLoadingState`를 넘겨 코어 기본 spinner가 보이지 않게 한다. fullscreen fallback은 화면 텍스트를 렌더링하지 않고 `loaderLabel` 접근성 라벨만 유지한다. `/` 홈 진입은 `DashboardLayout`에서 `project.list`를 먼저 prefetch해 인증 로딩 뒤 프로젝트 목록 로딩이 다시 뜨지 않게 한다. `/p/:projectId/*` Story 진입은 `WorkspacePage`에서 Story app shell과 현재 page chunk를 project bootstrap 중 미리 로드해 `페이지 로딩`과 project loading이 번갈아 나타나지 않게 한다. 페이지 내부 데이터 로딩과 저장/동기화 상태는 `AppQuietLoadingState` 또는 `QuietLoadingIndicator`를 사용해 전체 로딩 Lottie와 연속으로 겹쳐 보이지 않게 한다.

## App-local Project UI

| 컴포넌트 | 경로 | 설명 |
| -------- | ---- | ---- |
| `ProjectCard` | `apps/app/src/features/project/components/project-card.tsx` | 홈 프로젝트 카드. 하단 메타는 수정 시간과 owner만 표시하며, 콘텐츠 수/페이지 수는 목록 진입 성능을 위해 표시하지 않는다. |

## Design System Inventory

| 컴포넌트 / 파일 | 경로 | 설명 |
| ---------------- | ---- | ---- |
| `DesignSystemPage` | `apps/app/src/pages/designsystem/designsystem-page.tsx` | `/designsystem` standalone 개발자용 인벤토리. `packages/ui` 컴포넌트와 app 소비 패턴을 실제 app runtime에서 preview한다. Components에는 Buttons/Inputs/Custom Caret/Card/Paper Card/Checkbox/Radio Group/Switch/Toggle Group/Slider/Form/Navigation/Toolbar/Sidebar/Popover/Combobox/Command/Context Menu/Dropdown Menu/Table/Dialog/Empty State/Feedback/AI Components/Settings 조합을 노출하고, Patterns에는 `PageLayout`, 목록형 `Entity Page`, 상세형 `DetailPageShell` 조합을 노출한다. |
| `designsystem-registry` | `apps/app/src/pages/designsystem/designsystem-registry.tsx` | Foundation, Components, Patterns 섹션 metadata와 sourcePaths를 수동 관리한다. Code References에는 실제 컴포넌트/화면 파일 경로만 표시하고 usage rules는 두지 않는다. |

## Settings UI

| 컴포넌트 | 경로 | 설명 |
| -------- | ---- | ---- |
| `SettingItem` | `packages/ui/src/settings/SettingItem.tsx` | `/settings/*` 페이지의 기본 항목 구조. title/description/leading/control/footer/tone/layout 슬롯을 제공해 단일 입력, textarea, select, toggle group, switch, read-only badge/list/table, destructive action을 같은 리듬으로 렌더링한다. |
| `SettingsSidebarNav` | `packages/ui/src/settings/SettingsSidebarNav.tsx` | 설정 좌측 사이드바의 group/item/active 상태 표면. Router는 앱에서 `renderItem`으로 주입하고, hover는 `bg-muted`, active는 `bg-secondary`를 사용한다. 워크스페이스 설정에서는 프로젝트 그룹을 숨기고, 프로젝트 컨텍스트 설정에서는 `projectId` search param을 유지하면서 프로젝트 그룹 아래 현재 프로젝트명만 표시한다. |
| `SetListRow` | `packages/ui/src/settings/SetListRow.tsx` | 설정 item 내부의 멤버/언어/프로젝트 같은 읽기 중심 리스트 row. leading/title/sub/trailing 슬롯을 제공한다. |
| `SetDangerZone`, `SetConfirmDialog` | `packages/ui/src/settings/SetDangerZone.tsx`, `packages/ui/src/settings/SetConfirmDialog.tsx` | 삭제/해지 같은 위험 액션 표면과 confirm phrase 다이얼로그. 실제 profile/organization/project delete 흐름에서 사용한다. |

실제 소비자는 `apps/app/src/pages/settings/**`이다. 사이드바는 `SettingsSidebar`가 i18n과 TanStack Router `Link`만 연결하고, 표면은 `SettingsSidebarNav`가 관리한다. 프로젝트 화면의 설정 진입은 `/settings?projectId=:projectId`로 들어가며 `/settings/projects` 목록 라우트는 노출하지 않는다. Organization/Profile/Project detail/Billing 항목은 `SettingItem`을 기준으로 점진적으로 통일한다.

## Story Feature UI

| 컴포넌트 | 경로 | 설명 |
| -------- | ---- | ---- |
| `DraftIndexCardPreview` | `apps/app/src/features/story/components/draft-index-card.tsx` | Drafts.html 인덱스 카드 preview. 종이 질감, 28px ruled line, 좌측 red margin, 카드 밖 메타/태그 표시를 공통화한다. |
| `DraftIndexCardEditor` | `apps/app/src/features/story/components/draft-index-card.tsx` | Drafts.html 인덱스 카드 editor. 제목/본문 controlled 입력을 제공하고 저장 정책은 caller가 맡는다. 카드 내부 첫 줄 오른쪽에 hover/focus `...` 메뉴 액션을 둔다. |
| `EntitySubbar` | `packages/ui/src/components/entity-subbar.tsx` | Story 목록 공통 서브 툴바. 화면별 `viewTabs` allowlist 또는 `false`로 뷰 모드 영역 on/off를 제어하고, `allowViewModeOff`로 active 뷰 재클릭 시 선택 해제를 허용한다. `settingsSlot`으로 실제 설정 Popover를 query tool 영역에 주입한다. |
| `IconToggleButton`, `IconToggleGroup`, `IconMultiToggleGroup` | `packages/ui/src/components/icon-toggle.tsx` | shadcn Base `Toggle`/`ToggleGroup` 위에 `EntitySubbar` view tabs에서 쓰는 그룹형 24px 아이콘 토글 계약을 얹은 공통 컴포넌트. Story 상세 sidebar의 아이콘 토글 field도 같은 컴포넌트를 사용해 Toolbar와 동일한 grouped container, active/hover/size를 유지한다. |
| `ListViewSettingPopover` | `packages/ui/src/components/list-view-setting-popover.tsx` | 목록 설정 Popover. 표시 문구는 `labels` prop으로 주입받고, 그룹/정렬/최근 기간/하위 항목/표시 속성 토글을 controlled props로 받아 실제 list page 데이터 필터/정렬/컬럼 표시와 연결할 수 있다. |
| `StoryListTableView` | `apps/app/src/features/story/pages/story-list-table-view.tsx` | Story feature의 실제 목록 controller. `StoryListColumn` descriptor와 `settingsId`를 기반으로 `EntitySubbar`, `ListViewSettingPopover`, `EntityTable`을 연결해 페이지별 반복 state 없이 그룹/정렬/최근 기간/컬럼 표시를 제공한다. |
| `StorySplitDetailShell` | `apps/app/src/features/story/pages/story-split-detail-shell.tsx` | FLT-337 split list/detail layout. `story-split.rail`과 `story-split.detail` data-el 영역을 제공해 목록 URL에서 선택 상세를 즉시 보여준다. |
| `EntitySplitListPage` | `apps/app/src/features/story/pages/entity-split-list-page.tsx` | 세계/캐릭터/세력/코덱스 목록의 새 split controller. 왼쪽 rail은 `EntityTable` 기반 TanStack Table + react-virtual 경로를 쓰고, 오른쪽은 `EntityDetailPage embedded`를 렌더링한다. 기본 rail 폭은 240px이다. |
| `RelationPickerPanel` | `apps/app/src/features/story/components/relation-picker.tsx` | Story 사이드바 관계 추가에 쓰는 단일 관계 picker panel. 타입 칩, 검색, virtualized row, linked check, mention create row 계약을 한 곳에서 관리한다. 데이터는 `packages/data/hooks`의 `useStoryLoreEntityList`와 `getStoryLoreEntityListQueryOptions`를 통해서만 가져오며, 앱 레이어에서 query key, sort, limit을 따로 만들지 않는다. 빈 검색어는 `undefined`로 정규화해 캐릭터/세계/장소/세력/코덱스 목록 페이지와 같은 React Query cache key를 쓴다. |
| `QuestPickerPanel` | `apps/app/src/features/story/components/quest-picker.tsx` | Quest picker popover. 관계 picker와 같은 `PickerPanelHead`/`PickerSearchField`/`PickerVirtualList` chrome을 쓰고, 퀘스트 타입 필터와 검색을 제공한다. 데이터는 `packages/data/hooks`의 `useQuests(projectId, search)`만 사용하며, 빈 검색어는 `undefined`로 정규화해 퀘스트 목록 페이지와 같은 React Query cache key를 쓴다. |
| `PickerPanelHead`, `PickerSearchField`, `PickerVirtualList` | `apps/app/src/features/story/components/picker-popover-panel.tsx` | Story feature picker들이 공유하는 낮은 수준의 popover chrome primitive. 관계 picker와 퀘스트 picker가 같은 종이 표면/검색/virtualized list 리듬을 쓰되, 도메인 panel은 각각 유지한다. |
| `useStoryListViewSettings` | `apps/app/src/features/story/state/list-view-settings.ts` | Story 목록 뷰 설정 Jotai atom wrapper. `settingsId`별 localStorage key에 그룹/정렬/최근 기간/표시 속성/하위 항목 표시 상태를 저장하고 기본값과 병합한다. |
| `DetailPageShell` | `apps/app/src/features/story/layouts/detail-page-shell.tsx` | Story 상세 페이지 공통 shell. 캐릭터 상세를 기준으로 topbar, focus mode, page mode, editor card, 우측 meta rail을 제공하고 각 상세 페이지는 editor/sidebar 콘텐츠만 주입한다. 기본 editor card 폭은 캐릭터/세계관 상세와 같은 720px이다. |
| `MetaSection`, `SidebarItem`, `SidebarItemAdd` | `apps/app/src/features/story/layouts/detail-layout.tsx` | Story 상세 sidebar의 기본 섹션/읽기 row/추가 row 컴포넌트. |
| `SidebarInputField`, `SidebarTextareaField`, `SidebarNumberField`, `SidebarTimeField`, `SidebarSelectField`, `SidebarToggleField`, `SidebarToggleButtonField`, `SidebarChipToggleField`, `SidebarIconToggleField`, `SidebarIconMultiToggleField`, `SidebarAvatarField` | `apps/app/src/features/story/layouts/detail-layout.tsx` | Story 상세 sidebar 안에서 쓰는 입력/긴 입력/숫자/시간/선택/스위치/토글 버튼/칩 토글/아이콘 토글/아바타 field 컴포넌트. 페이지별 sidebar는 데이터와 handler만 넘기고 label/control 밀도는 공통 컴포넌트가 유지한다. |

## AI Components (`@repo/ui/ai/*`)

`packages/ui/src/components/ai/`는 shadcn.io AI registry에서 설치한 conversational AI 컴포넌트 50개를 보관한다. `canvas`, `connection`, `controls`, `edge`, `loader`, `mic-selector`, `node`, `panel`, `speech-input`, `toolbar`, `voice-selector`도 registry install로 추가됐다. 기존 Base UI shadcn primitive는 overwrite하지 않는다. `/designsystem`의 AI Components는 전체 목록을 평면 행으로 표시하고, 가벼운 demo는 본문에 바로 렌더링한다. `attachments`, `audio-player`, `canvas`, `edge`, `mic-selector`, `persona`, `speech-input`, `voice-selector`, `web-preview`는 우측 on-demand sidebar에서 선택한 항목 하나만 mount한다.

## Shadcn Components (`@repo/ui/shadcn/*`)

import 패턴: `import { Button } from "@repo/ui/shadcn/button";`

### 입력 (Input)

| 컴포넌트                                                                                                                 | 경로                 | 설명                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `Button`, `buttonVariants`                                                                                               | `shadcn/button`      | 버튼 (variant: default/destructive/outline/secondary/ghost/link, size: default/sm/lg/icon-sm/icon-xs/icon-lg) |
| `Input`                                                                                                                  | `shadcn/input`       | 텍스트 입력 필드                                                                                              |
| `Textarea`                                                                                                               | `shadcn/textarea`    | 멀티라인 텍스트 입력                                                                                          |
| `Checkbox`                                                                                                               | `shadcn/checkbox`    | 체크박스                                                                                                      |
| `RadioGroup`, `RadioGroupItem`                                                                                           | `shadcn/radio-group` | 라디오 그룹 (base-ui Radio)                                                                                   |
| `Switch`                                                                                                                 | `shadcn/switch`      | 토글 스위치 (size: sm/default)                                                                                |
| `Slider`                                                                                                                 | `shadcn/slider`      | 슬라이더                                                                                                      |
| `Label`                                                                                                                  | `shadcn/label`       | 폼 라벨                                                                                                       |
| `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `SelectGroup`, `SelectLabel`, `SelectSeparator` | `shadcn/select`      | 셀렉트 드롭다운                                                                                               |
| `Calendar`, `CalendarDayButton`                                                                                          | `shadcn/calendar`    | 달력                                                                                                          |

### 데이터 표시 (Display)

| 컴포넌트                                                                                                 | 경로               | 설명                                                  |
| -------------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------- |
| `Avatar`, `AvatarImage`, `AvatarFallback`, `AvatarBadge`, `AvatarGroup`, `AvatarGroupCount`              | `shadcn/avatar`    | 아바타 (size: sm/default/lg)                          |
| `Badge`, `badgeVariants`                                                                                 | `shadcn/badge`     | 배지 (variant: default/secondary/destructive/outline) |
| `Skeleton`                                                                                               | `shadcn/skeleton`  | 로딩 스켈레톤                                         |
| `Spinner`                                                                                                | `shadcn/spinner`   | 로딩 스피너                                           |
| `Progress`, `ProgressTrack`, `ProgressIndicator`, `ProgressLabel`, `ProgressValue`                       | `shadcn/progress`  | 프로그레스 바                                         |
| `Separator`                                                                                              | `shadcn/separator` | 구분선                                                |
| `Kbd`, `KbdGroup`                                                                                        | `shadcn/kbd`       | 키보드 단축키 표시                                    |
| `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableHead`, `TableRow`, `TableCell`, `TableCaption` | `shadcn/table`     | 테이블                                                |

### 레이아웃 (Layout)

| 컴포넌트                                                                                                                                    | 경로                 | 설명          |
| ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------- |
| `Card`, `CardHeader`, `CardFooter`, `CardTitle`, `CardAction`, `CardDescription`, `CardContent`                                             | `shadcn/card`        | 카드 컨테이너 |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`                                                                                            | `shadcn/tabs`        | 탭 네비게이션 |
| `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`                                                                        | `shadcn/accordion`   | 아코디언      |
| `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`                                                                                   | `shadcn/collapsible` | 접기/펼치기   |
| `ScrollArea`, `ScrollBar`                                                                                                                   | `shadcn/scroll-area` | 스크롤 영역   |
| `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle`                                                                                  | `shadcn/resizable`   | 리사이즈 패널 |
| `Carousel`, `CarouselContent`, `CarouselItem`, `CarouselPrevious`, `CarouselNext`                                                           | `shadcn/carousel`    | 캐러셀        |
| `SidebarProvider`, `useSidebar` + 관련 컴포넌트                                                                                             | `shadcn/sidebar`     | 사이드바      |
| `Item`, `ItemMedia`, `ItemContent`, `ItemActions`, `ItemGroup`, `ItemSeparator`, `ItemTitle`, `ItemDescription`, `ItemHeader`, `ItemFooter` | `shadcn/item`        | 리스트 아이템 |

### 오버레이 (Overlay)

| 컴포넌트                                                                                                                                                                                    | 경로                  | 설명                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ---------------------------------------------- |
| `Dialog`, `DialogTrigger`, `DialogClose`, `DialogPortal`, `DialogOverlay`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`                              | `shadcn/dialog`       | 모달 다이얼로그                                |
| `AlertDialog`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogFooter`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogAction`, `AlertDialogCancel` | `shadcn/alert-dialog` | 확인 다이얼로그 (base-ui — `render` prop 사용) |
| `Sheet`, `SheetTrigger`, `SheetClose`, `SheetContent`, `SheetHeader`, `SheetFooter`, `SheetTitle`, `SheetDescription`                                                                       | `shadcn/sheet`        | 슬라이드 패널                                  |
| `Drawer`, `DrawerTrigger`, `DrawerClose`, `DrawerContent`, `DrawerHeader`, `DrawerFooter`, `DrawerTitle`, `DrawerDescription`                                                               | `shadcn/drawer`       | 하단 드로어                                    |
| `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverHeader`, `PopoverTitle`, `PopoverDescription`                                                                                        | `shadcn/popover`      | 팝오버                                         |
| `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`                                                                                                                            | `shadcn/tooltip`      | 툴팁                                           |

### 메뉴 (Menu)

| 컴포넌트                                                                                                                                                                                                                                                                                                  | 경로                   | 설명                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------- |
| `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`, `DropdownMenuGroup`, `DropdownMenuLabel`, `DropdownMenuCheckboxItem`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`, `DropdownMenuSub`, `DropdownMenuSubTrigger`, `DropdownMenuSubContent` | `shadcn/dropdown-menu` | 드롭다운 메뉴        |
| `ContextMenu`, `ContextMenuTrigger`, `ContextMenuContent`, `ContextMenuItem`, `ContextMenuSub`, `ContextMenuSubTrigger`, `ContextMenuSubContent`, `ContextMenuCheckboxItem`, `ContextMenuRadioGroup`, `ContextMenuRadioItem`, `ContextMenuSeparator`                                                      | `shadcn/context-menu`  | 우클릭 컨텍스트 메뉴 |
| `Command`, `CommandDialog`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem`, `CommandShortcut`, `CommandSeparator`                                                                                                                                                           | `shadcn/command`       | 커맨드 팔레트. hover는 `muted`, cmdk selected 상태는 별도 active 배경 없이 유지 |
| `Menubar`, `MenubarMenu`, `MenubarTrigger`, `MenubarContent` + 관련                                                                                                                                                                                                                                       | `shadcn/menubar`       | 메뉴바               |

Dropdown/Context Menu/Command 계열의 hover/focus/highlight 표면은 `/designsystem` 사이드바 item hover와 같은 `bg-muted` / `text-foreground` 기준을 따른다. selected/open/checked 같은 선택 상태는 `bg-secondary` / `text-secondary-foreground`를 쓴다. `--sidebar-accent`는 secondary alias로 유지하지만 hover 용도로 쓰지 않는다. Command는 cmdk selected 상태를 시각적 active로 보이지 않게 유지하고, 실제 pointer hover에서만 hover 배경을 보여준다.

### 폼 (Form)

| 컴포넌트                                                                                                                                         | 경로                  | 설명                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- | ----------------------- |
| `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`, `useFormField`                                    | `shadcn/form`         | React Hook Form 통합 폼 |
| `Field`, `FieldLabel`, `FieldDescription`, `FieldError`, `FieldGroup`, `FieldLegend`, `FieldSeparator`, `FieldSet`, `FieldContent`, `FieldTitle` | `shadcn/field`        | 독립 폼 필드            |
| `InputGroup`, `InputGroupAddon`, `InputGroupButton`, `InputGroupText`, `InputGroupInput`, `InputGroupTextarea`                                   | `shadcn/input-group`  | 입력 그룹               |
| `Combobox`, `ComboboxInput`, `ComboboxContent`, `ComboboxList`, `ComboboxItem`, `ComboboxChips`, `ComboboxChip`, `ComboboxValue`                 | `shadcn/combobox`     | 검색 가능한 선택 입력. hover/highlight는 `muted`, selected는 `secondary` 표면을 사용 |
| `ButtonGroup`, `ButtonGroupSeparator`, `ButtonGroupText`                                                                                         | `shadcn/button-group` | 버튼 그룹               |

### 피드백 (Feedback)

| 컴포넌트                                  | 경로            | 설명                      |
| ----------------------------------------- | --------------- | ------------------------- |
| `Alert`, `AlertTitle`, `AlertDescription` | `shadcn/alert`  | 인라인 알림               |
| `Toaster`                                 | `shadcn/sonner` | 토스트 알림 (sonner 기반) |

### 토글 (Toggle)

| 컴포넌트                         | 경로                  | 설명      |
| -------------------------------- | --------------------- | --------- |
| `Toggle`, `toggleVariants`       | `shadcn/toggle`       | 토글 버튼 |
| `ToggleGroup`, `ToggleGroupItem` | `shadcn/toggle-group` | 토글 그룹 |

### 네비게이션 (Navigation)

| 컴포넌트                                                                                                                          | 경로                | 설명       |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ---------- |
| `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink`, `BreadcrumbPage`, `BreadcrumbSeparator`, `BreadcrumbEllipsis` | `shadcn/breadcrumb` | 브레드크럼 |

## Calendar Components (`@repo/ui/calendars/*`)

import 패턴: `import { MonthCalendar } from "@repo/ui/calendars/month-calendar";`

| 컴포넌트            | 경로                            | 설명                                                                                       |
| ------------------- | ------------------------------- | ------------------------------------------------------------------------------------------ |
| `MonthCalendar<T>`  | `calendars/month-calendar`      | Google Calendar 스타일 월간 그리드 (제네릭, 오늘 원형 강조, +N 더 보기, 요일 색상)         |
| `DayTimeline<T>`    | `calendars/day-timeline`        | 시간대 기반 가로 스크롤 타임라인 (X축: 날짜, Y축: 시간, 무한 스크롤, 현재 시각 인디케이터) |
| `CalendarEventChip` | `calendars/calendar-event-chip` | 이벤트 칩 (color: default/blue/green/yellow/red/purple, startTime + label)                 |

### MonthCalendar Props

| Prop                | 타입                                     | 설명                                 |
| ------------------- | ---------------------------------------- | ------------------------------------ |
| `events`            | `T[]`                                    | 이벤트 배열 (`id`, `date` 필수)      |
| `isLoading`         | `boolean`                                | 로딩 시 스켈레톤                     |
| `currentDate`       | `Date`                                   | 현재 표시 월                         |
| `onMonthChange`     | `(date: Date) => void`                   | 월 변경 콜백                         |
| `onDayClick`        | `(dateStr: string) => void`              | 날짜 클릭 콜백                       |
| `renderEvent?`      | `(event: T) => ReactNode`                | 이벤트 커스텀 렌더링 (미지정 시 dot) |
| `maxVisibleEvents?` | `number`                                 | 날짜 셀당 최대 표시 수 (기본 3)      |
| `onEventClick?`     | `(event: T) => void`                     | 이벤트 클릭 콜백                     |
| `onMoreClick?`      | `(dateStr: string, events: T[]) => void` | "+N 더 보기" 클릭 콜백               |

### DayTimeline Props

| Prop                      | 타입                                      | 설명                                                    |
| ------------------------- | ----------------------------------------- | ------------------------------------------------------- |
| `events`                  | `T[]`                                     | 이벤트 배열 (`id`, `date`, `startTime`, `endTime` 필수) |
| `baseDate`                | `string`                                  | 기준 날짜 (YYYY-MM-DD)                                  |
| `dayCount`                | `number`                                  | 표시 날짜 수                                            |
| `onLoadMore?`             | `() => void`                              | 우측 끝 도달 시 추가 로드                               |
| `renderEvent`             | `(event: T) => ReactNode`                 | 이벤트 렌더링 (필수)                                    |
| `onEmptySlotDoubleClick?` | `(dateStr: string, hour: number) => void` | 빈 슬롯 더블클릭                                        |
| `scrollToTodayRef?`       | `MutableRefObject`                        | 오늘 스크롤 함수 ref                                    |

### 헬퍼 함수

| 함수                               | 위치                       | 설명                        |
| ---------------------------------- | -------------------------- | --------------------------- |
| `formatDateStr(date)`              | `calendars/month-calendar` | Date → "YYYY-MM-DD"         |
| `getMonthStart(date)`              | `calendars/month-calendar` | 월 시작 날짜                |
| `getMonthEnd(date)`                | `calendars/month-calendar` | 월 마지막 날짜              |
| `getDatesFromBase(dateStr, count)` | `calendars/day-timeline`   | 기준일-3일부터 count일 배열 |
| `toDateString(date)`               | `calendars/day-timeline`   | Date → "YYYY-MM-DD"         |

### Booking Feature 래퍼

| 래퍼                 | 위치                | 설명                                                                   |
| -------------------- | ------------------- | ---------------------------------------------------------------------- |
| `BookingCalendar`    | `@features/booking` | MonthCalendar + CalendarEventChip (sessionDate→date 매핑, 상태별 색상) |
| `BookingDayTimeline` | `@features/booking` | DayTimeline (sessionDate→date 매핑)                                    |

## Custom Components (`packages/ui/src/components/`)

| 컴포넌트                                     | 경로                                | 설명                                                                     |
| -------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------ |
| `Typography`                                 | `components/typography`             | 타이포그래피                                                             |
| `Image`                                      | `components/image`                  | 이미지                                                                   |
| `FileList`, `FileListItem`                   | `components/file-list`              | 파일 목록 (grid/list 뷰, 선택/삭제 지원)                                 |
| `FileUploader`                               | `components/file-uploader`          | 드래그 앤 드롭 파일 업로더 (Base — `onUpload` prop으로 업로드 함수 주입) |
| `PageHeader`                                 | `components/page-header`            | 페이지 헤더 (title, description, icon, actions)                          |
| `TipTapEditor`                               | `editor/tiptap-editor`              | TipTap 리치 텍스트 에디터 (toolbar: full/minimal)                        |
| `TipTapViewer`                               | `editor/tiptap-viewer`              | TipTap JSON 읽기전용 뷰어 (prose 스타일)                                 |
| `MatterButton`                               | `components/ui/matter-button`       | 물리 버튼 (Matter.js)                                                    |
| `MotionPreset`                               | `components/ui/motion-preset`       | 모션 프리셋 (fade/slide/zoom/blur)                                       |
| `BorderBeam`                                 | `components/ui/border-beam`         | 보더 빔 애니메이션                                                       |
| `MotionToggleGroup`, `MotionToggleGroupItem` | `components/ui/motion-toggle-group` | 모션 토글 그룹 (Radix + motion)                                          |

## Product Data Components (`@repo/ui/components/*`)

| 컴포넌트 | 경로 | 설명 |
| -------- | ---- | ---- |
| `EntityTable` | `components/entity-table` | Story 목록 공통 TanStack Table + react-virtual 테이블. 목록 영역의 좌우 inset은 8px이며, 기본 row height는 28px이고 `rowClassName`으로 검색 화면처럼 row text density를 조정할 수 있다 |
| `NameCell`, `StatusPill`, `TagChip`, `AssigneeStack` | `components/entity-table` | `EntityTable` 셀 구성용 공통 primitive. `NameCell` title이 `#`로 시작하면 리스트 아이템 텍스트만 기본보다 한 단계 큰 `text-lg`와 한 단계 굵은 `font-medium`으로 표시한다 |

### FileList / FileUploader 참고

두 컴포넌트는 hook 의존 없는 순수 Base 컴포넌트. Base 직접 사용(`@repo/ui/components/file-uploader`)하거나 앱 래퍼(`@features/file-manager`)로 bucket만 지정하여 사용.

## App-local Auth UI (`apps/app/src/pages/auth/`)

인증 화면은 앱 로컬 컴포넌트와 공용 `@repo/ui/shadcn/*` primitive로 구성한다. backend/API 계약은 변경하지 않는다.

| 컴포넌트                                             | 경로                         | 설명                                                                            |
| ---------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------- |
| `AuthShell`                                          | `pages/auth/auth-layout.tsx` | 인증 화면 전체 배경/중앙 정렬/하단 링크. 디자인 배경 asset과 Tailwind 유틸 사용 |
| `AuthCard`                                           | `pages/auth/auth-layout.tsx` | shadcn `Card` 기반 인증 카드                                                    |
| `AuthBrand`                                          | `pages/auth/auth-layout.tsx` | 앱 public 단일 로고(`/logo.svg`) 렌더링. favicon 도 같은 원본에서 생성          |
| `AuthField`, `AuthPasswordField`                     | `pages/auth/auth-layout.tsx` | shadcn `Input`/`Label` 기반 아이콘 필드와 비밀번호 보기 토글                    |
| `AuthPrimaryButton`, `AuthTextButton`, `AuthDivider` | `pages/auth/auth-layout.tsx` | 인증 화면 버튼/텍스트 버튼/구분선                                               |
| `AcceptInvitationPage`                               | `pages/accept-invitation.tsx` | 워크스페이스 초대 링크 수락 화면. `AuthShell`/`AuthCard` 기반으로 로그인/가입 callback 보존 |
| `WorkspaceSelectPage`                                | `pages/workspace-select.tsx` | 워크스페이스 선택 카드. Better Auth organization 선택 UI. 긴 organization 목록은 카드 내부 목록 영역에서만 스크롤 |
| `CreateWorkspacePage`                                | `pages/create-workspace.tsx` | 새 워크스페이스 3단계 wizard. organization 생성/active 설정, 초대, 첫 프로젝트 생성 UI |

## Chat Components (`@repo/ui/chat/*`)

AI 채팅/스트리밍 UI를 위한 공유 컴포넌트. agent, agent-desk 등 여러 feature에서 공통 사용.

| 컴포넌트      | 경로                | 설명                                                                            |
| ------------- | ------------------- | ------------------------------------------------------------------------------- |
| `ChatMessage` | `chat/chat-message` | 메시지 버블 (variant: user/assistant, 아바타, 스트리밍 커서, 타이핑 애니메이션) |
| `ChatInput`   | `chat/chat-input`   | 채팅 입력 (send/stop 버튼, Enter 전송, Shift+Enter 줄바꿈, leftSlot 확장)       |
| `ChatStream`  | `chat/chat-stream`  | 메시지 목록 컨테이너 (자동 스크롤, userRoles 설정, emptyState 커스텀)           |
| `TypingDots`  | `chat/typing-dots`  | 타이핑 점 애니메이션 (bounce 3개, 독립 사용 가능)                               |

### ChatMessage Props

| Prop          | 타입                    | 기본값          | 설명                                   |
| ------------- | ----------------------- | --------------- | -------------------------------------- |
| `content`     | `string`                | —               | 메시지 내용                            |
| `variant`     | `"user" \| "assistant"` | `"assistant"`   | 사용자/어시스턴트 스타일 결정          |
| `isStreaming` | `boolean`               | `false`         | 스트리밍 중 표시 (커서 또는 타이핑 점) |
| `showAvatar`  | `boolean`               | `true`          | 아바타 표시 여부                       |
| `avatarIcon`  | `ReactNode`             | Bot/User 아이콘 | 커스텀 아바타 아이콘                   |

### ChatInput Props

| Prop          | 타입                        | 기본값                     | 설명                           |
| ------------- | --------------------------- | -------------------------- | ------------------------------ |
| `onSend`      | `(message: string) => void` | —                          | 전송 콜백                      |
| `onStop`      | `() => void`                | —                          | 스트리밍 중지 콜백             |
| `isStreaming` | `boolean`                   | —                          | 스트리밍 상태 (send↔stop 전환) |
| `disabled`    | `boolean`                   | `false`                    | 비활성 상태                    |
| `placeholder` | `string`                    | `"메시지를 입력하세요..."` | 입력 placeholder               |
| `leftSlot`    | `ReactNode`                 | —                          | 입력 좌측 슬롯 (파일 버튼 등)  |

### ChatStream Props

| Prop          | 타입                                                   | 기본값       | 설명                            |
| ------------- | ------------------------------------------------------ | ------------ | ------------------------------- |
| `messages`    | `Array<{ id: string; role: string; content: string }>` | —            | 메시지 배열                     |
| `isStreaming` | `boolean`                                              | —            | 마지막 assistant 메시지에 적용  |
| `userRoles`   | `string[]`                                             | `["user"]`   | user variant로 표시할 role 목록 |
| `emptyState`  | `ReactNode`                                            | 기본 안내 UI | 메시지 없을 때 표시             |

## Hooks (`@repo/ui/hooks/*`)

| 훅              | 경로                    | 설명                                                                   |
| --------------- | ----------------------- | ---------------------------------------------------------------------- |
| `useSseStream`  | `hooks/use-sse-stream`  | 범용 SSE 스트리밍 훅 (fetch → TextDecoder → SSE 파싱, AbortController) |
| `useAsync`      | `hooks/use-async`       | 비동기 작업 상태 관리                                                  |
| `useEffectOnce` | `hooks/use-effect-once` | 마운트 시 1회 실행                                                     |
| `useMobile`     | `hooks/use-mobile`      | 모바일 여부 감지                                                       |
| `useMounted`    | `hooks/use-mounted`     | 마운트 여부 확인                                                       |
| `useFileUpload` | `hooks/use-file-upload` | 범용 파일 업로드 (Base)                                                |

### useSseStream 인터페이스

`useSseStream<TEvent>(options)` — SSE 엔드포인트에 POST 요청 후 이벤트 스트림 파싱

- `options.url`: SSE 엔드포인트 URL
- `options.getHeaders`: 인증 헤더 등 동적 헤더 팩토리
- 반환: `{ send, abort, isStreaming }`
- `send({ body, onEvent, onComplete, onError })`: 스트리밍 시작, 이벤트마다 `onEvent` 콜백 호출

## Utility

| 이름   | 경로                 | 설명                                  |
| ------ | -------------------- | ------------------------------------- |
| `cn()` | `@repo/ui/lib/utils` | clsx + tailwind-merge 클래스 유틸리티 |

## 참고

- base-ui 기반 컴포넌트 (`AlertDialog`, `Popover` 등)는 `render` prop 패턴 사용 (`asChild` 대신 `render={<Component />}`)
- Avatar는 `size` prop 지원: `sm`, `default`, `lg`
- Button은 `size` prop: `default`, `sm`, `lg`, `icon-sm`, `icon-xs`, `icon-lg`
