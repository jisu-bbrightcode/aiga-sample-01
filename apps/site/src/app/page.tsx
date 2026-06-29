import { GatedCta } from "@/components/gated-cta";

export default function HomePage() {
  return (
    <section className="flex flex-col items-start gap-5">
      <h1 className="text-foreground text-3xl font-semibold tracking-tight">웹 서비스</h1>
      <p className="text-muted-foreground max-w-prose leading-relaxed">
        공개 콘텐츠는 서버에서 렌더되어 검색·생성형 엔진에 그대로 노출됩니다. 인증이 필요한
        동작은 페이지 이동 없이 모달로 로그인·회원가입을 처리합니다. 우측 상단 버튼 또는 아래
        버튼으로 시작하세요.
      </p>
      <GatedCta />
    </section>
  );
}
