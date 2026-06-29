import { Button } from "@repo/ui/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@repo/ui/shadcn/drawer";
import { useState } from "react";

type Props = {};

export function DrawerCard({}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Drawer</CardTitle>
        <CardDescription>@repo/ui/shadcn/drawer</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section>
          <h4 className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
            Default (Bottom)
          </h4>
          <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
              <Button variant="outline">Open Drawer</Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Drawer Title</DrawerTitle>
                <DrawerDescription>Drawer content slides up from the bottom.</DrawerDescription>
              </DrawerHeader>
              <div className="p-4">
                <p className="text-sm">Drawer content goes here.</p>
              </div>
              <DrawerFooter>
                <Button onClick={() => setOpen(false)}>Close</Button>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </section>
      </CardContent>
    </Card>
  );
}
