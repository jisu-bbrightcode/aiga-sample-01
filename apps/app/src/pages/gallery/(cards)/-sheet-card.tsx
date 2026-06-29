import { Button } from "@repo/ui/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui/shadcn/sheet";
import { useState } from "react";

type Props = {};

export function SheetCard({}: Props) {
  const [openRight, setOpenRight] = useState(false);
  const [openLeft, setOpenLeft] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sheet</CardTitle>
        <CardDescription>@repo/ui/shadcn/sheet</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section>
          <h4 className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
            Sides
          </h4>
          <div className="flex flex-wrap gap-2">
            <Sheet open={openRight} onOpenChange={setOpenRight}>
              <SheetTrigger render={<Button variant="outline" />}>Right</SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>Right Sheet</SheetTitle>
                  <SheetDescription>Sheet content slides in from the right.</SheetDescription>
                </SheetHeader>
                <div className="p-4">
                  <p className="text-sm">Content goes here.</p>
                </div>
                <SheetFooter>
                  <Button onClick={() => setOpenRight(false)}>Close</Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
            <Sheet open={openLeft} onOpenChange={setOpenLeft}>
              <SheetTrigger render={<Button variant="outline" />}>Left</SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>Left Sheet</SheetTitle>
                  <SheetDescription>Sheet content slides in from the left.</SheetDescription>
                </SheetHeader>
                <div className="p-4">
                  <p className="text-sm">Content goes here.</p>
                </div>
                <SheetFooter>
                  <Button onClick={() => setOpenLeft(false)}>Close</Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
