# i18n Translation Workflow

ko 마스터 → en/ja/zh 자동 번역. Anthropic SDK 직접 호출.

## 전제

- `ANTHROPIC_API_KEY` 환경변수 (또는 `.env.local`) 가 설정되어 있어야 한다.
- 모델: `claude-sonnet-4-6` (속도/품질/비용 균형).
- system prompt (톤 가이드 + glossary) 는 prompt cache 활용.

## 흐름

```
[작가/개발자]
  ko.json 에 새 키 추가 (한글 텍스트)
       ↓
[pnpm i18n:translate --feature {name}]
  scripts/i18n/translate.ts
    1. {feature}/locales/ko.json 읽음
    2. en/ja/zh.json 읽음 (없으면 빈 객체)
    3. 누락 키 + ko 값 변경된 키만 골라냄
    4. Anthropic SDK 호출 (배치)
         - system: 톤 가이드 + scripts/i18n/glossary.json
         - user:   { ko: {...누락 키들...}, target: "en" | "ja" | "zh" }
    5. en/ja/zh.json 갱신 (기존 번역 보존)
       ↓
[git diff]
  3개 언어 파일 변경 확인 → 사람 검토 → 커밋
```

## 명령

```bash
pnpm i18n:translate                    # 전체 누락 채움
pnpm i18n:translate --feature auth     # 단일 feature
pnpm i18n:translate --key "signIn.title"   # 특정 키만
pnpm i18n:translate --force            # 기존 번역 덮어쓰기 (전면 재번역, 주의)
pnpm i18n:translate --dry              # 호출하지 않고 대상 키 목록만 출력
```

## glossary

`scripts/i18n/glossary.json` 은 Product Builder 고유 용어의 정식 번역을 고정한다. 신규 용어 등장 시 작가/PM에게 확인 후 추가.

```json
{
  "Product Builder": { "en": "Product Builder", "ja": "Product Builder", "zh": "Product Builder" },
  "스토리": { "en": "Story", "ja": "ストーリー", "zh": "故事" },
  "캔버스": { "en": "Canvas", "ja": "キャンバス", "zh": "画布" }
}
```

## 톤 가이드 (system prompt)

```
당신은 Product Builder (SaaS product-building platform) 의 UI 번역가입니다.
- 사용자 = SaaS 빌더 / 제품 운영자
- 한국어 ko 가 마스터, en/ja/zh 번역
- 톤: 친근하지만 전문적, 군더더기 없이 명확
- 기술 용어는 필요한 만큼만 쓰고 제품 빌더가 이해하기 쉬운 표현 우선
- SaaS, 운영, 빌더 도구 맥락의 표준 용어 사용
- UI 요소: button label 짧게, tooltip/description 한 문장
- glossary 의 고유 명사는 반드시 매핑된 번역 사용
- Placeholder ({{name}}, {{count}}) 그대로 보존
```

## 검토 룰

- 자동 번역 산출물은 **반드시 사람이 git diff 로 검토**한 뒤 커밋한다.
- 짧은 button label / nav label 은 의역 OK.
- 긴 description / error 메시지는 원문 의미 보존 + 자연스러운 표현 우선.
- 의심스러우면 작가에게 확인.

## 비용 추정

- 5,000 키 × 3 언어 ≈ $1–3 (1회 전체 번역, prompt cache 적용 가정).
- 이후 incremental 호출은 키 수 × ~$0.0001 수준.
