/**
 * P13 Modal pattern: overlay bg var(--overlay), box bg var(--surface),
 * max-width 400px, radius 8px, shadow 0 16px 48px.
 * data-el: loc-add-lang.search, loc-add-lang.lang-option, loc-add-lang.close-btn
 */

import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/shadcn/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@repo/ui/shadcn/dialog";
import { useState } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addedLanguages: string[];
  onAddLanguage: (code: string) => void;
}

export function AddLanguageDialog({ open, onOpenChange, addedLanguages, onAddLanguage }: Props) {
  const [search, setSearch] = useState("");

  const filteredLanguages = LANGUAGE_LIST.filter(
    (lang) =>
      lang.name.toLowerCase().includes(search.toLowerCase()) ||
      lang.code.toLowerCase().includes(search.toLowerCase()),
  );

  const addedSet = new Set(addedLanguages);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[400px] sm:max-w-[400px] bg-popover p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            언어 추가
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <input
          data-el="loc-add-lang.search"
          type="text"
          className="mb-2 w-full rounded-md border border-border bg-background px-4 py-2 text-base text-foreground outline-none transition-colors focus:border-primary"
          placeholder="언어 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Language list */}
        <div className="flex max-h-[400px] flex-col gap-0.5 overflow-y-auto">
          {/* Added languages first */}
          {filteredLanguages
            .filter((lang) => addedSet.has(lang.code))
            .map((lang) => (
              <LanguageOption key={lang.code} flag={lang.flag} name={lang.name} isAdded />
            ))}

          {/* Separator if there are added languages */}
          {filteredLanguages.some((lang) => addedSet.has(lang.code)) &&
          filteredLanguages.some((lang) => !addedSet.has(lang.code)) ? (
            <div className="my-1 h-px bg-border-subtle" />
          ) : null}

          {/* Available languages */}
          {filteredLanguages
            .filter((lang) => !addedSet.has(lang.code))
            .map((lang) => (
              <LanguageOption
                key={lang.code}
                flag={lang.flag}
                name={lang.name}
                onClick={() => onAddLanguage(lang.code)}
              />
            ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border-subtle pt-4">
          <Button
            variant="ghost"
            data-el="loc-add-lang.close-btn"
            onClick={() => onOpenChange(false)}
            className="text-base text-muted-foreground"
          >
            닫기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* Components */

interface LanguageOptionProps {
  flag: string;
  name: string;
  isAdded?: boolean;
  onClick?: () => void;
}

function LanguageOption({ flag, name, isAdded, onClick }: LanguageOptionProps) {
  return (
    <button
      type="button"
      data-el="loc-add-lang.lang-option"
      onClick={isAdded ? undefined : onClick}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-2 text-base transition-colors duration-75",
        isAdded
          ? "cursor-default text-muted-foreground"
          : "cursor-pointer text-foreground hover:bg-muted",
      )}
    >
      <span className="w-6 text-center text-lg">{flag}</span>
      <span className="flex-1 text-left">{name}</span>
      {isAdded ? (
        <span className="rounded-full bg-emerald-500/15 px-1.5 py-px text-base text-emerald-700 dark:text-emerald-300">
          추가됨
        </span>
      ) : null}
    </button>
  );
}

/* Constants */

const LANGUAGE_LIST = [
  { code: "en", name: "English", flag: "\u{1F1FA}\u{1F1F8}" },
  { code: "ja", name: "\u65E5\u672C\u8A9E", flag: "\u{1F1EF}\u{1F1F5}" },
  { code: "zh-CN", name: "\u4E2D\u6587 (\u7B80\u4F53)", flag: "\u{1F1E8}\u{1F1F3}" },
  { code: "fr", name: "Fran\u00E7ais", flag: "\u{1F1EB}\u{1F1F7}" },
  { code: "de", name: "Deutsch", flag: "\u{1F1E9}\u{1F1EA}" },
  { code: "es", name: "Espa\u00F1ol", flag: "\u{1F1EA}\u{1F1F8}" },
  { code: "pt", name: "Portugu\u00EAs", flag: "\u{1F1F5}\u{1F1F9}" },
  { code: "ru", name: "\u0420\u0443\u0441\u0441\u043A\u0438\u0439", flag: "\u{1F1F7}\u{1F1FA}" },
  { code: "th", name: "\u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22", flag: "\u{1F1F9}\u{1F1ED}" },
  { code: "id", name: "Bahasa Indonesia", flag: "\u{1F1EE}\u{1F1E9}" },
  { code: "ko", name: "\uD55C\uAD6D\uC5B4", flag: "\u{1F1F0}\u{1F1F7}" },
  { code: "vi", name: "Ti\u1EBFng Vi\u1EC7t", flag: "\u{1F1FB}\u{1F1F3}" },
  { code: "ar", name: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629", flag: "\u{1F1F8}\u{1F1E6}" },
  { code: "hi", name: "\u0939\u093F\u0928\u094D\u0926\u0940", flag: "\u{1F1EE}\u{1F1F3}" },
];
