import { handleUpload } from "@vercel/blob/client";
import { createHash } from "node:crypto";

const fallbackPasswordHash = "f9eb3caedd5e975fe700b461e63a6cf3d75aa6657d9a6d049252077a2801e0fa";
const maxUploadSize = 250 * 1024 * 1024;

const sendJson = (response, status, body) => {
  response.status(status).setHeader("content-type", "application/json; charset=utf-8");
  response.json(body);
};

const hashValue = (value) => createHash("sha256").update(value || "").digest("hex");

const getPasswordHash = () => process.env.CONCEPT_EDITOR_PASSWORD_HASH || fallbackPasswordHash;

const isSafePathname = (pathname) => /^concept\/[a-zA-Z0-9._-]+_preview\.pdf$/i.test(pathname);

const getBody = (request) => (typeof request.body === "string" ? JSON.parse(request.body) : request.body);

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return sendJson(response, 405, { error: "Metoda není povolena." });
  }

  try {
    const body = getBody(request);
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = clientPayload ? JSON.parse(clientPayload) : {};

        if (hashValue(payload.password) !== getPasswordHash()) {
          throw new Error("Nesprávné heslo.");
        }

        if (!isSafePathname(pathname)) {
          throw new Error("Neplatný název PDF.");
        }

        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: maxUploadSize,
          addRandomSuffix: false,
          allowOverwrite: true,
          tokenPayload: JSON.stringify({ pathname })
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log(`CONCEPT PDF uploaded: ${blob.pathname}`);
      }
    });

    return sendJson(response, 200, result);
  } catch (error) {
    return sendJson(response, 400, { error: error.message || "PDF se nepodařilo nahrát." });
  }
}
