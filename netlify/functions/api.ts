import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { appState, scheduleItems, videos } from "../../db/schema.js";
import { eq, asc, sql } from "drizzle-orm";

const POINTS_KEY = "points";

async function getPoints(): Promise<number> {
  const [row] = await db.select().from(appState).where(eq(appState.key, POINTS_KEY));
  return row ? parseInt(row.value, 10) || 0 : 0;
}

export default async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\//, "").replace(/\/$/, "");
  let parts = path.split("/").filter(Boolean);

  try {
    if (req.method === "GET" && parts[0] === "state") {
      const [points, schedule, vids] = await Promise.all([
        getPoints(),
        db.select().from(scheduleItems).orderBy(asc(scheduleItems.position)),
        db.select().from(videos).orderBy(asc(videos.position)),
      ]);
      return Response.json({ points, schedule, videos: vids });
    }

    if (parts[0] === "points" && req.method === "GET") {
      return Response.json({ points: await getPoints() });
    }

    if (req.method === "POST" && parts[0] === "points") {
      const { delta } = await req.json();
      const current = await getPoints();
      const next = Math.max(0, current + (Number(delta) || 0));
      await db
        .insert(appState)
        .values({ key: POINTS_KEY, value: String(next) })
        .onConflictDoUpdate({
          target: appState.key,
          set: { value: String(next), updatedAt: sql`now()` },
        });
      return Response.json({ points: next });
    }

    if (parts[0] === "schedule") {
      if (req.method === "POST" && parts.length === 1) {
        const body = await req.json();
        const maxPos = await db
          .select({ max: sql<number>`coalesce(max(${scheduleItems.position}), -1)` })
          .from(scheduleItems);
        const [row] = await db
          .insert(scheduleItems)
          .values({
            id: String(Date.now()),
            time: body.t || "0:00–0:00",
            spanish: body.es || "Nueva Actividad",
            english: body.en || "New Activity",
            position: (maxPos[0]?.max ?? -1) + 1,
          })
          .returning();
        return Response.json(row, { status: 201 });
      }
      if (req.method === "PUT" && parts[1] === "reorder") {
        const { items } = await req.json();
        for (let i = 0; i < items.length; i++) {
          await db
            .update(scheduleItems)
            .set({ position: i })
            .where(eq(scheduleItems.id, items[i].id));
        }
        return Response.json({ ok: true });
      }
      if (req.method === "PUT" && parts.length === 2) {
        const body = await req.json();
        await db
          .update(scheduleItems)
          .set({ time: body.t, spanish: body.es, english: body.en, position: body.position })
          .where(eq(scheduleItems.id, parts[1]));
        return Response.json({ ok: true });
      }
      if (req.method === "DELETE" && parts.length === 2) {
        await db.delete(scheduleItems).where(eq(scheduleItems.id, parts[1]));
        return Response.json({ ok: true });
      }
    }

    if (parts[0] === "videos") {
      if (req.method === "POST" && parts.length === 1) {
        const body = await req.json();
        const maxPos = await db
          .select({ max: sql<number>`coalesce(max(${videos.position}), -1)` })
          .from(videos);
        const [row] = await db
          .insert(videos)
          .values({
            id: body.id,
            title: body.title || "New Added Video",
            category: body.cat,
            position: (maxPos[0]?.max ?? -1) + 1,
          })
          .returning();
        return Response.json(row, { status: 201 });
      }
      if (req.method === "DELETE" && parts.length === 2) {
        await db.delete(videos).where(eq(videos.id, parts[1]));
        return Response.json({ ok: true });
      }
    }

    return new Response("Not found", { status: 404 });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/*",
};
