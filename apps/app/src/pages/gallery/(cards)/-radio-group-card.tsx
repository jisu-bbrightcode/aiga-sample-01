import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { Label } from "@repo/ui/shadcn/label";
import { RadioGroup, RadioGroupItem } from "@repo/ui/shadcn/radio-group";

type Props = {};

export function RadioGroupCard({}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Radio Group</CardTitle>
        <CardDescription>@repo/ui/shadcn/radio-group</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section>
          <h4 className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
            Default
          </h4>
          <RadioGroup defaultValue="option1">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="option1" id="option1" />
              <Label htmlFor="option1">Option 1</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="option2" id="option2" />
              <Label htmlFor="option2">Option 2</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="option3" id="option3" />
              <Label htmlFor="option3">Option 3</Label>
            </div>
          </RadioGroup>
        </section>
      </CardContent>
    </Card>
  );
}
