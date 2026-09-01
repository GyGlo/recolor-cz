import { list, put } from "@vercel/blob";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const fallbackPasswordHash = "f9eb3caedd5e975fe700b461e63a6cf3d75aa6657d9a6d049252077a2801e0fa";
const manifestPath = "concept/publications.json";
const staticManifestPath = path.join(process.cwd(), "publikace", "concept-publications.json");

const sendJson = (response, status, body) => {
  response.status(status).setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.json(body);
};

const hashValue = (value) => createHash("sha256").update(value || "").digest("hex");

const getPasswordHash = () => process.env.CONCEPT_EDITOR_PASSWORD_HASH || fallbackPasswordHash;

const isBlobPdfUrl = (value) => {
  if (!value) return true;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && /(^|\.)blob\.vercel-storage\.com$/i.test(url.hostname) && /\.pdf$/i.test(url.pathname);
  } catch {
    return false;
  }
};

const normalizePublication = (item) => {
  const title = String(item.title || "").trim();
  const date = String(item.date || "").trim();
  const file = String(item.file || "").trim();
  const folder = String(item.folder || "concept").trim();
  const cover = item.cover ? String(item.cover).trim() : "";
  const url = item.url ? String(item.url).trim() : "";
  const pages = Number.isFinite(Number(item.pages)) ? Number(item.pages) : undefined;

  if (!title) throw new Error("Publikaci chybí název.");
  if (!/^\d{4}-\d{2}$/.test(date)) throw new Error(`Publikace "${title}" má neplatný měsíc.`);
  if (!/^[a-zA-Z0-9._-]+_preview\.pdf$/i.test(file)) throw new Error(`Publikace "${title}" má neplatný název PDF.`);
  if (folder !== "concept") throw new Error(`Publikace "${title}" má neplatnou složku.`);
  if (!isBlobPdfUrl(url)) throw new Error(`Publikace "${title}" má neplatnou Blob URL.`);

  return {
    title,
    file,
    date,
    folder: "concept",
    ...(pages ? { pages } : {}),
    ...(cover ? { cover } : {}),
    ...(url ? { url } : {})
  };
};

const normalizePublications = (items) => {
  if (!Array.isArray(items)) throw new Error("Manifest musí být pole publikací.");
  return items.map(normalizePublication);
};

const readStaticManifest = async () => {
  const content = await readFile(staticManifestPath, "utf8");
  return JSON.parse(content);
};

const readBlobManifest = async () => {
  const result = await list({ prefix: manifestPath, limit: 1 });
  const blob = result.blobs.find((item) => item.pathname === manifestPath);
  if (!blob) return null;

  const response = await fetch(blob.url, { cache: "no-store" });
  if (!response.ok) throw new Error("Blob manifest se nepodařilo načíst.");
  return response.json();
};

const getBody = (request) => (typeof request.body === "string" ? JSON.parse(request.body) : request.body);

export default async function handler(request, response) {
  if (request.method === "GET") {
    try {
      const blobManifest = await readBlobManifest();
      if (blobManifest) return sendJson(response, 200, normalizePublications(blobManifest));
    } catch (error) {
      console.warn(`Blob manifest fallback: ${error.message}`);
    }

    try {
      return sendJson(response, 200, normalizePublications(await readStaticManifest()));
    } catch (error) {
      return sendJson(response, 500, { error: error.message || "Manifest publikací se nepodařilo načíst." });
    }
  }

  if (request.method === "PUT") {
    try {
      const body = getBody(request);

      if (hashValue(body.password) !== getPasswordHash()) {
        return sendJson(response, 401, { error: "Nesprávné heslo." });
      }

      const publications = normalizePublications(body.publications);
      const blob = await put(manifestPath, JSON.stringify(publications, null, 2), {
        access: "public",
        allowOverwrite: true,
        cacheControlMaxAge: 60,
        contentType: "application/json; charset=utf-8"
      });

      return sendJson(response, 200, { publications, blob });
    } catch (error) {
      return sendJson(response, 400, { error: error.message || "Manifest se nepodařilo uložit." });
    }
  }

  return sendJson(response, 405, { error: "Metoda není povolena." });
}
