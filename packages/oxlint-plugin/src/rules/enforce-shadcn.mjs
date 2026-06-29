/**
 * enforce-shadcn
 *
 * Force apps/widgets to use shadcn components instead of native HTML controls,
 * hand-rolled ARIA widgets, or browser dialog APIs.
 *
 * Detects:
 *   1. Raw lowercase JSX tags:
 *        button, input, textarea, select, option, optgroup,
 *        form, label, fieldset, legend,
 *        progress, meter, datalist, output, dialog
 *      <input> is narrowed by its `type` attribute so the message points to
 *      the right shadcn component (Checkbox, RadioGroupItem, Switch, Slider, …).
 *
 *   2. ARIA role usage on host elements:
 *        role="tab" | "tablist" | "tabpanel" | "switch" | "checkbox" | "radio"
 *        role="slider" | "progressbar" | "combobox" | "listbox"
 *        role="menu" | "menubar" | "menuitem"
 *        role="dialog" | "alertdialog" | "tooltip" | "toolbar" | "alert" | "status"
 *
 *   3. ARIA state attributes that almost always mean "I am rebuilding a
 *      shadcn-provided widget":
 *        aria-pressed, aria-selected, aria-expanded, aria-checked, aria-haspopup
 *
 *   4. Browser dialog APIs:
 *        alert / confirm / prompt  (bare or via window/globalThis/self)
 *
 * Path scope:
 *   - JSX checks: `apps/**` and `packages/widgets/**` (`.tsx` only)
 *   - API checks: same paths, `.ts` and `.tsx`
 *
 * Exempt:
 *   - shadcn primitives (`packages/ui/src/_shadcn/**`) — they own raw rendering
 *   - `scripts/**` for API checks
 */

const TARGET_PATH_TSX = /[\\/](apps|packages[\\/]widgets)[\\/].*\.tsx$/;
const TARGET_PATH_ANY = /[\\/](apps|packages[\\/]widgets)[\\/].*\.(ts|tsx)$/;
const EXEMPT_SHADCN = /[\\/]packages[\\/]ui[\\/]src[\\/]_shadcn[\\/]/;
const EXEMPT_SCRIPTS = /[\\/]scripts[\\/]/;

const TAG_REPLACEMENT = {
  button: "Button (from @repo/ui)",
  textarea: "Textarea (from @repo/ui)",
  select: "Select + SelectTrigger + SelectValue + SelectContent (from @repo/ui)",
  option: "SelectItem (from @repo/ui)",
  optgroup: "SelectGroup + SelectLabel (from @repo/ui)",
  form: "Form + FormField + FormItem (from @repo/ui)",
  label: "Label (from @repo/ui)  ※ 폼 안에서는 FormLabel / FieldLabel 권장",
  fieldset: "FieldSet (from @repo/ui)",
  legend: "FieldLegend (from @repo/ui)",
  progress: "Progress (from @repo/ui)",
  meter: "Progress (from @repo/ui)",
  datalist: "Combobox (from @repo/ui)",
  output: "plain <span> 또는 FormDescription (from @repo/ui)",
  dialog: "Dialog + DialogTrigger + DialogContent / AlertDialog / Drawer / Sheet (from @repo/ui)",
};

const INPUT_TYPE_REPLACEMENT = {
  checkbox: "Checkbox (from @repo/ui)",
  radio: "RadioGroup + RadioGroupItem (from @repo/ui)",
  range: "Slider (from @repo/ui)",
  file: "Input type='file' 대신 Input (from @repo/ui) + 별도 업로드 트리거. 또는 Dropzone 위젯 사용.",
  color: "Input (from @repo/ui) 또는 color picker 위젯",
  date: "DatePicker / Calendar (from @repo/ui)",
  datetime: "DatePicker / Calendar (from @repo/ui)",
  "datetime-local": "DatePicker / Calendar (from @repo/ui)",
  month: "DatePicker / Calendar (from @repo/ui)",
  week: "DatePicker / Calendar (from @repo/ui)",
  time: "DatePicker / Calendar (from @repo/ui)",
  search: "Input (from @repo/ui) + InputGroup with search icon",
  text: "Input (from @repo/ui)",
  email: "Input (from @repo/ui)",
  password: "Input (from @repo/ui)",
  url: "Input (from @repo/ui)",
  tel: "Input (from @repo/ui)",
  number: "Input (from @repo/ui)",
  hidden: "react-hook-form 의 hidden register, 또는 form state 로 처리",
  submit: "Button type='submit' (from @repo/ui)",
  reset: "Button (from @repo/ui)",
  button: "Button (from @repo/ui)",
  image: "Button (from @repo/ui) + <img>",
};

const ROLE_REPLACEMENT = {
  tab: "Tabs + TabsList + TabsTrigger (from @repo/ui)",
  tablist: "TabsList (from @repo/ui)",
  tabpanel: "TabsContent (from @repo/ui)",
  switch: "Switch (from @repo/ui)",
  checkbox: "Checkbox (from @repo/ui)",
  radio: "RadioGroupItem (from @repo/ui)",
  radiogroup: "RadioGroup (from @repo/ui)",
  slider: "Slider (from @repo/ui)",
  progressbar: "Progress (from @repo/ui)",
  combobox: "Combobox (from @repo/ui)",
  listbox: "Select / Combobox (from @repo/ui)",
  menu: "DropdownMenu / Menubar / ContextMenu (from @repo/ui)",
  menubar: "Menubar (from @repo/ui)",
  menuitem: "DropdownMenuItem / MenubarItem (from @repo/ui)",
  dialog: "Dialog + DialogContent / AlertDialog (from @repo/ui)",
  alertdialog: "AlertDialog (from @repo/ui)",
  tooltip: "Tooltip (from @repo/ui)",
  toolbar: "Toolbar / ButtonGroup (from @repo/ui)",
  alert: "Alert (from @repo/ui)",
  // role="status" is intentionally NOT here — it pairs with aria-live to form
  // a live region (loading announcements, sync state). shadcn's Alert variant
  // does not replace that semantics; flagging it is a false positive.
};

const ARIA_ATTR_REPLACEMENT = {
  "aria-pressed": "Toggle / ToggleGroup (from @repo/ui)",
  "aria-selected": "TabsTrigger / SelectItem (from @repo/ui)",
  "aria-expanded":
    "Accordion / Collapsible / DropdownMenu / Popover (from @repo/ui) — built-in 상태 관리",
  "aria-checked": "Checkbox / Switch / RadioGroupItem (from @repo/ui)",
  "aria-haspopup": "DropdownMenu / Popover / Menubar (from @repo/ui)",
};

const DIALOG_API_REPLACEMENT = {
  alert: "AlertDialog (from @repo/ui) 또는 toast.error / toast.info (from sonner)",
  confirm: "AlertDialog with AlertDialogAction + AlertDialogCancel (from @repo/ui)",
  prompt: "Dialog + Input + Form (from @repo/ui)",
};

const GLOBAL_OBJECTS = new Set(["window", "globalThis", "self"]);

const enforceShadcn = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Use shadcn components instead of raw HTML controls, hand-rolled ARIA widgets, or browser dialog APIs.",
    },
    messages: {
      rawTag:
        "Do not use raw <{{tag}}>. Use {{replacement}}. Rule: docs/rules/frontend/ui-components.md.",
      rawInput:
        'Do not use raw <input type="{{type}}">. Use {{replacement}}. Rule: docs/rules/frontend/ui-components.md.',
      ariaRole:
        'Do not hand-roll role="{{role}}". Use {{replacement}}. Rule: docs/rules/frontend/ui-components.md.',
      ariaAttr:
        "Do not hand-roll {{attr}}. Use {{replacement}}. Rule: docs/rules/frontend/ui-components.md.",
      dialogApi:
        "Do not call {{name}}(). Use {{replacement}}. Rule: docs/rules/frontend/ui-components.md.",
    },
    schema: [],
  },
  createOnce(context) {
    const isTagTarget = () => {
      const f = getPhysicalFilename(context);
      return TARGET_PATH_TSX.test(f) && !EXEMPT_SHADCN.test(f);
    };
    const isApiTarget = () => {
      const f = getPhysicalFilename(context);
      return TARGET_PATH_ANY.test(f) && !EXEMPT_SHADCN.test(f) && !EXEMPT_SCRIPTS.test(f);
    };

    return {
      JSXOpeningElement(node) {
        if (!isTagTarget()) return;
        const name = node.name;
        if (!name || name.type !== "JSXIdentifier") return;
        const tag = name.name;
        const isHostElement = tag === tag.toLowerCase();

        // ARIA role / state attribute checks — only on host (lowercase) elements.
        //
        // aria-* attributes alone are noisy (custom tree views, live regions,
        // accessible custom widgets that have no shadcn equivalent like role=
        // "treeitem" all legitimately use them). To reduce false positives we
        // ONLY flag an aria-* attribute when the same element also carries a
        // role that maps to a shadcn primitive — i.e. "you are hand-rolling a
        // widget we already ship".
        if (isHostElement) {
          let roleAttr = null;
          let roleValue = null;
          const ariaAttrs = [];
          for (const attr of node.attributes ?? []) {
            if (attr.type !== "JSXAttribute") continue;
            const attrName = attr.name?.type === "JSXIdentifier" ? attr.name.name : null;
            if (!attrName) continue;
            if (attrName === "role") {
              roleAttr = attr;
              roleValue = readStringAttr(attr)?.toLowerCase() ?? null;
            } else if (ARIA_ATTR_REPLACEMENT[attrName]) {
              ariaAttrs.push(attr);
            }
          }

          const roleReplacement = roleValue ? ROLE_REPLACEMENT[roleValue] : null;
          if (roleReplacement && roleAttr) {
            context.report({
              node: roleAttr,
              messageId: "ariaRole",
              data: { role: roleValue, replacement: roleReplacement },
            });
          }

          // Flag aria-* only if the element already declares a shadcn-mappable
          // role. This skips role="treeitem", role="status", or no role at all.
          if (roleReplacement) {
            for (const attr of ariaAttrs) {
              const attrName = attr.name.name;
              context.report({
                node: attr,
                messageId: "ariaAttr",
                data: { attr: attrName, replacement: ARIA_ATTR_REPLACEMENT[attrName] },
              });
            }
          }
        }

        // Raw HTML control tag check.
        if (tag === "input") {
          const type = readInputType(node);
          const replacement = INPUT_TYPE_REPLACEMENT[type] ?? INPUT_TYPE_REPLACEMENT.text;
          context.report({
            node: name,
            messageId: "rawInput",
            data: { type: type ?? "text", replacement },
          });
          return;
        }

        const replacement = TAG_REPLACEMENT[tag];
        if (!replacement) return;
        context.report({
          node: name,
          messageId: "rawTag",
          data: { tag, replacement },
        });
      },
      CallExpression(node) {
        if (!isApiTarget()) return;
        const name = getDialogApiName(node.callee);
        if (!name) return;
        context.report({
          node: node.callee,
          messageId: "dialogApi",
          data: { name, replacement: DIALOG_API_REPLACEMENT[name] },
        });
      },
    };
  },
};

export { enforceShadcn };

/* ----------------------------------------------------------------------------------------------- */

function readInputType(openingElement) {
  for (const attr of openingElement.attributes ?? []) {
    if (attr.type !== "JSXAttribute") continue;
    if (attr.name?.type !== "JSXIdentifier" || attr.name.name !== "type") continue;
    const v = readStringAttr(attr);
    return v ? v.toLowerCase() : null;
  }
  return null;
}

function readStringAttr(attr) {
  const v = attr.value;
  if (!v) return null;
  if (v.type === "Literal" && typeof v.value === "string") return v.value;
  if (v.type === "JSXExpressionContainer") {
    const expr = v.expression;
    if (expr?.type === "Literal" && typeof expr.value === "string") return expr.value;
    if (expr?.type === "TemplateLiteral" && expr.quasis?.length === 1) {
      return expr.quasis[0].value?.cooked ?? null;
    }
  }
  return null;
}

function getDialogApiName(callee) {
  if (!callee) return null;
  if (callee.type === "Identifier" && DIALOG_API_REPLACEMENT[callee.name]) return callee.name;
  if (callee.type === "MemberExpression" && callee.property?.type === "Identifier") {
    const prop = callee.property.name;
    if (!DIALOG_API_REPLACEMENT[prop]) return null;
    const obj = callee.object;
    if (obj?.type === "Identifier" && GLOBAL_OBJECTS.has(obj.name)) return prop;
  }
  return null;
}

function getPhysicalFilename(context) {
  return (
    context.getPhysicalFilename?.() ??
    context.physicalFilename ??
    context.filename ??
    ""
  ).replaceAll("\\", "/");
}
