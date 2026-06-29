---
name: block-demo-internal-logic
enabled: true
event: file
conditions:
  - field: file_path
    operator: regex_match
    pattern: (playground|demo|example).*\.(tsx?|jsx?)$
  - field: new_text
    operator: regex_match
    pattern: (createCursor|createTESelection|state\.tr\(\)|\.delete\(|\.insertText\(|prevContentOffset|nextContentOffset|positionToOffset|offsetToPosition|_ctrl.*ForNav)
action: block
---

**PF-2**: 데모/playground에서 엔진 내부 API 직접 사용 차단. 엔진 기능은 엔진 패키지에 구현하세요.
See: `docs/rules/engine/engine-dev-process-constraints.md` § PF-2
