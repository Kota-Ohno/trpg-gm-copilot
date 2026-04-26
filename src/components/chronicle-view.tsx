import { useMemo, useState } from "react";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import type { Chronicle } from "../types";

const statusLabels = {
  known: "PL既知",
  partial: "一部既知",
  hidden: "GM秘密",
};

export function ChronicleView({ chronicle }: { chronicle: Chronicle }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredChronicle = useMemo(() => {
    if (!normalizedQuery) {
      return chronicle;
    }

    const includesQuery = (values: string[]) =>
      values.some((value) => value.toLowerCase().includes(normalizedQuery));

    return {
      events: chronicle.events.filter((event) => includesQuery([event])),
      npcs: chronicle.npcs.filter((npc) =>
        includesQuery([npc.name, npc.role, npc.publicKnowledge, npc.gmSecret, npc.attitude]),
      ),
      clues: chronicle.clues.filter((clue) => includesQuery([clue.title, clue.detail, statusLabels[clue.status]])),
      locations: chronicle.locations.filter((location) => includesQuery([location.name, location.detail])),
      threads: chronicle.threads.filter((thread) => includesQuery([thread.title, thread.detail, thread.nextMove])),
    };
  }, [chronicle, normalizedQuery]);

  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="py-3">
          <Input
            aria-label="キャンペーン記憶を検索"
            placeholder="記憶を検索"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>出来事</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {filteredChronicle.events.map((event, index) => (
            <div className="rounded-md border p-3" key={`${event}-${index}`}>
              <p className="text-sm leading-6">{event}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>手がかり</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {filteredChronicle.clues.map((clue) => (
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
            {filteredChronicle.npcs.map((npc) => (
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
            <CardTitle>場所</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredChronicle.locations.map((location) => (
              <div className="rounded-md border p-3" key={location.name}>
                <p className="font-medium">{location.name}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{location.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>伏線</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredChronicle.threads.map((thread) => (
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
