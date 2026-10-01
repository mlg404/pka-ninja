function fileName(href: string): string {
  const bare = href.split("?")[0];
  let decoded = bare;
  try {
    decoded = decodeURIComponent(bare);
  } catch {
    decoded = bare;
  }
  return decoded.replaceAll("\\", "/").split("/").pop() ?? "";
}

function namesFromListing(text: string, contentType: string): string[] {
  if (contentType.includes("json")) {
    try {
      const payload = JSON.parse(text) as unknown;
      if (Array.isArray(payload)) {
        return payload.flatMap((row) => {
          if (typeof row === "string") return [fileName(row)];
          if (row && typeof row === "object" && typeof (row as { name?: unknown }).name === "string") {
            return [fileName((row as { name: string }).name)];
          }
          return [];
        });
      }
    } catch {
      return [];
    }
  }
  return [...text.matchAll(/href=["']([^"']+)["']/gi)].map((match) => fileName(match[1]));
}

export async function listDataFiles(prefix: string): Promise<string[]> {
  const res = await fetch("/data/", { cache: "no-store" });
  if (!res.ok) return [];
  const names = namesFromListing(await res.text(), res.headers.get("content-type") ?? "");
  return [...new Set(names.filter((name) => name.startsWith(prefix) && name.endsWith(".json")))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
}
