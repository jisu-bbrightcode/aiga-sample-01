import { Button } from "@repo/ui/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { toast } from "sonner";

type Props = {};

export function SonnerCard({}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sonner (Toast)</CardTitle>
        <CardDescription>@repo/ui/shadcn/sonner</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section>
          <h4 className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
            Toast Types
          </h4>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => toast("Default toast")}>
              Default
            </Button>
            <Button variant="outline" onClick={() => toast.success("Success toast")}>
              Success
            </Button>
            <Button variant="outline" onClick={() => toast.error("Error toast")}>
              Error
            </Button>
            <Button variant="outline" onClick={() => toast.warning("Warning toast")}>
              Warning
            </Button>
            <Button variant="outline" onClick={() => toast.info("Info toast")}>
              Info
            </Button>
          </div>
        </section>
        <section>
          <h4 className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
            With Description
          </h4>
          <Button
            variant="outline"
            onClick={() =>
              toast("Event created", {
                description: "Your event has been scheduled successfully.",
              })
            }
          >
            Show Toast
          </Button>
        </section>
      </CardContent>
    </Card>
  );
}
