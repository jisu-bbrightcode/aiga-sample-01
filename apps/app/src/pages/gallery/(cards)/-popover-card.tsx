import { Button } from "@repo/ui/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@repo/ui/shadcn/popover";

type Props = {};

export function PopoverCard({}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Popover</CardTitle>
        <CardDescription>@repo/ui/shadcn/popover</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section>
          <h4 className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
            Default
          </h4>
          <Popover>
            <PopoverTrigger render={<Button variant="outline" />}>Open Popover</PopoverTrigger>
            <PopoverContent>
              <PopoverHeader>
                <PopoverTitle>Popover Title</PopoverTitle>
                <PopoverDescription>This is a popover description.</PopoverDescription>
              </PopoverHeader>
              <p className="text-sm">Popover content goes here.</p>
            </PopoverContent>
          </Popover>
        </section>
      </CardContent>
    </Card>
  );
}
