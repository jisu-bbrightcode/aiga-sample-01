/**
 * TipTap 에디터 공통 확장 셋 팩토리
 */

import CharacterCount from "@tiptap/extension-character-count";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import type { Extensions } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { common, createLowlight } from "lowlight";
import type { EditorExtensionOptions } from "./types";

const lowlight = createLowlight(common);

/**
 * 공통 TipTap 확장 셋 생성
 * 에디터와 뷰어 모두 동일한 확장을 사용해야 렌더링이 일관됨
 */
export function createEditorExtensions(options: EditorExtensionOptions = {}): Extensions {
  const {
    placeholder = "",
    enableImage = true,
    enableCodeHighlight = true,
    characterLimit = 0,
  } = options;

  const extensions: Extensions = [
    StarterKit.configure({
      codeBlock: enableCodeHighlight ? false : undefined,
    }),
    TextAlign.configure({
      types: ["heading", "paragraph"],
    }),
    Highlight.configure({
      multicolor: true,
    }),
  ];

  if (placeholder) {
    extensions.push(Placeholder.configure({ placeholder }));
  }

  if (enableImage) {
    extensions.push(
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
    );
  }

  if (enableCodeHighlight) {
    extensions.push(
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: "javascript",
      }),
    );
  }

  if (characterLimit > 0) {
    extensions.push(CharacterCount.configure({ limit: characterLimit }));
  }

  return extensions;
}

/**
 * 뷰어용 확장 (placeholder 제외, 읽기 전용에 불필요한 확장 제외)
 */
export function createViewerExtensions(): Extensions {
  return createEditorExtensions({
    enableImage: true,
    enableCodeHighlight: true,
  });
}
