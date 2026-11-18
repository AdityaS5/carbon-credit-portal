/** Citations: readable label ("BM EN01.001 v1.0, p.6, para 9") + link to the publisher page (sources.json). */
import { cite as engineCite } from "@/engine-ts/src/explain.ts";
import type { Source } from "@/engine-ts/src/types.ts";
import { ROWS, SOURCES } from "./data.ts";

export interface Citation { label: string; href: string | null; publisherPage: string | null; verify: boolean }

export function citation(src: Source | null | undefined): Citation {
  const s = src ?? {};
  const doc = s.doc ?? null;
  const entry = doc ? SOURCES[doc] : undefined;
  const url = (s.url as string | undefined) ?? entry?.url ?? null;
  let label = s.url ? String(doc ?? "web page") : engineCite(s, ROWS);
  if (!label) label = doc ?? "source";
  // A link to the document itself can jump to the cited page; publisher pages and lists can't.
  const href = url && entry?.kind === "document" && s.page && /\.pdf($|\?)/i.test(url) ? `${url}#page=${s.page}` : url;
  return { label, href, publisherPage: entry?.title ?? null, verify: Boolean(s.verify) };
}
