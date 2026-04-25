import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type PrepSectionProps = {
  title: string;
  items: string[];
  icon: LucideIcon;
};

export function PrepSection({ title, items, icon: Icon }: PrepSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items.map((item) => (
            <li className="rounded-md border bg-background px-3 py-2 text-sm leading-6" key={item}>
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
