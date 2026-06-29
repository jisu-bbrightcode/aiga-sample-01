import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/shadcn/card";

type Props = {};

export function MenubarCard({}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Menubar</CardTitle>
        <CardDescription>@repo/ui/shadcn/menubar</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section>
          <h4 className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
            Description
          </h4>
          <div className="border-border flex h-24 items-center justify-center rounded-md border border-dashed">
            <p className="text-muted-foreground text-sm">Menubar component</p>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            A visually persistent menu common in desktop applications that provides quick access to
            a consistent set of commands.
          </p>
        </section>
      </CardContent>
    </Card>
  );
}
