# Feature Definition

Feature는 사용자가 인식하는 독립 기능 단위이며, backend service/REST contract/frontend hook/docs를 함께 가진다.

## Backend Shape

```
packages/features/{feature}/
├── controller/
├── dto/
├── service/
├── {feature}.module.ts
└── index.ts
```

## Frontend Shape

```
apps/app/src/features/{feature}/
├── components/
├── hooks/
├── pages/
└── index.ts
```

## Contract

- 서버 계약은 REST/OpenAPI다.
- client type은 generated OpenAPI client에서 온다.
- feature service는 transport와 분리한다.
- docs/reference와 Obsidian feature index를 변경과 함께 갱신한다.

## Widget 변환 기준

다른 feature/app에서 반복 사용되고, `targetType + targetId` 같은 다형 target을 받으며, 독립 URL이 필요 없다면 widget 후보로 본다.
