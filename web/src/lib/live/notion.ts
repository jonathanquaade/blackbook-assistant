import type { NotionPage } from "./projection";

const VERSION = "2022-06-28";
export const databaseId = () => process.env.NOTION_DATABASE_ID ?? "50cacdf6-02f6-4685-942a-55d26caa27a9";

/** Read-only Notion client: database query and page retrieve. It never writes. */
async function notion<T>(pathname: string, init: { method: "GET" | "POST"; body?: unknown }): Promise<T> {
  const token = process.env.NOTION_API_KEY;
  if (!token) throw new Error("NOTION_API_KEY is not set");
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`https://api.notion.com/v1/${pathname}`, {
      method: init.method,
      headers: { Authorization: `Bearer ${token}`, "Notion-Version": VERSION, "Content-Type": "application/json" },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
    if (response.status === 429 && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, Number(response.headers.get("retry-after") ?? 1) * 1000));
      continue;
    }
    if (!response.ok) throw new Error(`Notion ${pathname}: HTTP ${response.status}`);
    return response.json() as Promise<T>;
  }
}

/** Verified entries rated 4 or 5. The caller re-checks eligibility on each page. */
export async function queryEligiblePages() {
  const pages: NotionPage[] = [];
  let cursor: string | undefined;
  do {
    const result = await notion<{ results: NotionPage[]; has_more: boolean; next_cursor: string | null }>(
      `databases/${databaseId()}/query`,
      {
        method: "POST",
        body: {
          page_size: 100,
          start_cursor: cursor,
          filter: {
            and: [
              { property: "Entry Status", select: { equals: "Verified" } },
              { or: [{ property: "Rating", select: { equals: "4" } }, { property: "Rating", select: { equals: "5" } }] },
            ],
          },
        },
      },
    );
    pages.push(...result.results);
    cursor = result.has_more ? (result.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return pages;
}

export const retrievePage = (id: string) => notion<NotionPage>(`pages/${id}`, { method: "GET" });

export function pageTitle(page: NotionPage) {
  const title = Object.values(page.properties).find((property) => property.type === "title");
  const items = (title?.title as { plain_text: string }[] | undefined) ?? [];
  return items.map((item) => item.plain_text).join("").trim();
}
