import { Button } from "@repo/ui/shadcn/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/shadcn/card";

type Props = {};

export function CardCard({}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Card</CardTitle>
        <CardDescription>@repo/ui/shadcn/card</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section>
          <h4 className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
            Default
          </h4>
          <Card>
            <CardHeader>
              <CardTitle>Card Title</CardTitle>
              <CardDescription>Card description goes here.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">Card content with some text.</p>
            </CardContent>
            <CardFooter>
              <Button size="sm">Action</Button>
            </CardFooter>
          </Card>
        </section>
        <section>
          <h4 className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
            Small Size
          </h4>
          <Card size="sm">
            <CardHeader>
              <CardTitle>Small Card</CardTitle>
              <CardDescription>Compact card variant.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">Smaller padding and gaps.</p>
            </CardContent>
          </Card>
        </section>
      </CardContent>
    </Card>
  );
}
