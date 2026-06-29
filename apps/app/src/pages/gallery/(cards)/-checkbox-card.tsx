import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { Checkbox } from "@repo/ui/shadcn/checkbox";
import { Label } from "@repo/ui/shadcn/label";
import { useState } from "react";

type Props = {};

export function CheckboxCard({}: Props) {
  const [checked, setChecked] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Checkbox</CardTitle>
        <CardDescription>@repo/ui/shadcn/checkbox</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section>
          <h4 className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
            Default
          </h4>
          <div className="flex items-center gap-2">
            <Checkbox id="checkbox-default" checked={checked} onCheckedChange={setChecked} />
            <Label htmlFor="checkbox-default">{checked ? "Checked" : "Unchecked"}</Label>
          </div>
        </section>
        <section>
          <h4 className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
            States
          </h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox id="checkbox-checked" defaultChecked />
              <Label htmlFor="checkbox-checked">Checked by default</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="checkbox-disabled" disabled />
              <Label htmlFor="checkbox-disabled">Disabled</Label>
            </div>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
