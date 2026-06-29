import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { Textarea } from "@repo/ui/shadcn/textarea";

type Props = {};

export function TextareaCard({}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Textarea</CardTitle>
        <CardDescription>@repo/ui/shadcn/textarea</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section>
          <h4 className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
            Default
          </h4>
          <Textarea placeholder="Enter your message..." />
        </section>
        <section>
          <h4 className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
            Disabled
          </h4>
          <Textarea disabled placeholder="Disabled textarea" />
        </section>
      </CardContent>
    </Card>
  );
}
