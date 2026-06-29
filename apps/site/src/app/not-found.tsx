import { Button } from "@repo/ui/shadcn/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <section className="flex flex-col items-start gap-5 py-16">
      <h1 className="text-foreground text-3xl font-semibold tracking-tight">
        페이지를 찾을 수 없습니다
      </h1>
      <p className="text-muted-foreground max-w-prose leading-relaxed">
        요청하신 주소가 변경되었거나 더 이상 존재하지 않습니다. 의사·병원 목록에서 다시 찾아보세요.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button render={<Link href="/doctors" />}>의사 둘러보기</Button>
        <Button variant="outline" render={<Link href="/hospitals" />}>
          병원 둘러보기
        </Button>
      </div>
    </section>
  );
}
