import { NextResponse } from "next/server";

import { getSession } from "~/server/better-auth/server";
import { buildUploadKey, putObject } from "~/server/s3";

// Photos are buffered in memory before being forwarded to S3, so make sure the
// runtime is Node (not Edge) and keep the ceiling in sync with the presign
// flow's validation.
export const runtime = "nodejs";
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Server-side proxy upload for Love Diary photos.
 *
 * The composer used to PUT the file straight to S3 from the browser using a
 * presigned URL. That cross-origin PUT requires a CORS policy on the bucket;
 * without one the browser blocks it and reports the opaque "Failed to fetch"
 * (Chrome) / "Load failed" (Safari) errors. Streaming through this same-origin
 * route sidesteps CORS entirely and keeps S3 credentials on the server.
 */
export async function POST(request: Request) {
  const session = await getSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data." },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const contentType = file.type || "application/octet-stream";
  if (!contentType.startsWith("image/")) {
    return NextResponse.json(
      { error: "Only image uploads are allowed." },
      { status: 415 },
    );
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image must be between 1 byte and 20 MB." },
      { status: 413 },
    );
  }

  const { key, publicPath } = buildUploadKey(file.name || "upload");

  try {
    const body = Buffer.from(await file.arrayBuffer());
    await putObject({ key, body, contentType });
  } catch (err) {
    console.error("Diary upload failed", err);
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({ publicPath });
}
