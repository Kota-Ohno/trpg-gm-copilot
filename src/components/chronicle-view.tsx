import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import type { Chronicle } from "../types";

const statusLabels = {
  known: "PL既知",
  partial: "一部既知",
  hidden: "GM秘密",
};

export function ChronicleView({ chronicle }: { chronicle: Chronicle }) {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>手がかり</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {chronicle.clues.map((clue) => (
            <div className="rounded-md border p-3" key={`${clue.title}-${clue.detail}`}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{clue.title}</p>
                <Badge variant={clue.status === "hidden" ? "secondary" : "outline"}>{statusLabels[clue.status]}</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{clue.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>NPC</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {chronicle.npcs.map((npc) => (
              <div className="rounded-md border p-3" key={npc.name}>
                <p className="font-medium">{npc.name}</p>
                <p className="text-sm text-muted-foreground">{npc.role}</p>
                <p className="mt-2 text-sm leading-6">{npc.publicKnowledge}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>伏線</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {chronicle.threads.map((thread) => (
              <div className="rounded-md border p-3" key={thread.title}>
                <p className="font-medium">{thread.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{thread.detail}</p>
                <p className="mt-2 text-sm leading-6">{thread.nextMove}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
