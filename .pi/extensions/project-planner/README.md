# Project Planner Extension

`/project` collects a project description, asks the model to produce phases and issues, and registers the result in Linear through `register_project_plan`.

## Linear dependency support

`register_project_plan` accepts dependency declarations and applies them to Linear after all issues are created.

Supported issue-level fields:

```ts
{
  key: "api",
  dependsOn: ["db"],   // alias of blockedBy
  blockedBy: ["db"],
  blocks: ["qa"]
}
```

Supported top-level shape:

```ts
{
  dependencies: [
    { issue: "api", blockedBy: ["db"] },
    { issue: "api", blocks: ["qa"] },
    { from: "api", to: "qa", type: "blocks" }
  ]
}
```

The extension normalizes all relationships into Linear `blockedBy` updates via `linear_save_issue` after issue creation. New project descriptions also include an auto-generated `## Dependency graph` section so the plan is visible even outside Linear's relation UI.
