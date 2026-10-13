import { existsSync, readdirSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const root = dirname(fileURLToPath(import.meta.url));

const INDEX_NAMES = new Set(["manifest.json", "item-images.json"]);

function marketDataPlugin(): Plugin {
  const dataDir = resolve(root, "public/data");

  function collectFiles(): string[] {
    if (!existsSync(dataDir)) return [];
    return readdirSync(dataDir)
      .filter((name) => name.endsWith(".json") && !INDEX_NAMES.has(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  function listingHtml(): string {
    const links = collectFiles()
      .map((name) => `<a href="${name}">${name}</a>`)
      .join("\n");
    return `<html><head><title>Index of /data/</title></head><body><h1>Index of /data/</h1><hr><pre><a href="../">../</a>\n${links}\n</pre><hr></body></html>`;
  }

  function listingMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
    const url = req.url?.split("?")[0];
    if (url !== "/data" && url !== "/data/") {
      next();
      return;
    }
    const files = collectFiles();
    console.log(`[market] ${files.length} dump(s) in /data/`);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(listingHtml());
  }

  function attachListing(server: { middlewares: { use: (fn: typeof listingMiddleware) => void }; watcher?: { add: (path: string) => void } }) {
    server.middlewares.use(listingMiddleware);
    server.watcher?.add(dataDir);
  }

  return {
    name: "market-data-listing",
    configureServer: attachListing,
    configurePreviewServer: attachListing,
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), marketDataPlugin()],
  server: { port: 5174 },
});
