import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/shadcn/card";

type Props = {};

export function ItemCard({}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Item</CardTitle>
        <CardDescription>@repo/ui/shadcn/item</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section>
          <h4 className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
            Description
          </h4>
          <div className="border-border flex h-24 items-center justify-center rounded-md border border-dashed">
            <p className="text-muted-foreground text-sm">Item component</p>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            A generic item component that can be used in lists, menus, and other contexts.
          </p>
        </section>
      </CardContent>
    </Card>
  );
}
