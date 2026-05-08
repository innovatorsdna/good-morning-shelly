import "server-only";

import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "~/env";

let cached: S3Client | null = null;

function getClient(): S3Client {
  if (cached) return cached;
  if (!env.S3_REGION || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    throw new Error(
      "S3 credentials are not configured. Set S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY.",
    );
  }
  cached = new S3Client({
    region: env.S3_REGION,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
  return cached;
}

function safeFilename(filename: string): string {
  // Match the pattern used by the existing /uploads/YYYY/MM/ tree.
  return filename
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 100);
}

export interface PresignParams {
  filename: string;
  contentType: string;
}

export interface PresignResult {
  /** Pre-signed URL the client uploads to with PUT. */
  uploadUrl: string;
  /** Stable site path to store in the post body (e.g. "/uploads/2026/05/foo.jpg"). */
  publicPath: string;
}

export async function presignUpload({
  filename,
  contentType,
}: PresignParams): Promise<PresignResult> {
  if (!env.S3_BUCKET) {
    throw new Error("S3_BUCKET is not configured.");
  }

  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");

  const safe = safeFilename(filename) || "upload";
  // Add a short random prefix so concurrent uploads with the same name don't
  // overwrite each other.
  const rand = Math.random().toString(36).slice(2, 8);
  const key = `uploads/${yyyy}/${mm}/${rand}-${safe}`;

  const params: PutObjectCommandInput = {
    Bucket: env.S3_BUCKET,
    Key: key,
    ContentType: contentType,
  };

  const uploadUrl = await getSignedUrl(getClient(), new PutObjectCommand(params), {
    expiresIn: 60 * 5,
  });

  return {
    uploadUrl,
    publicPath: `/${key}`,
  };
}

export interface MediaObject {
  /** S3 object key, e.g. "uploads/2026/05/abc123-foo.jpg". */
  key: string;
  /** Stable site path used in post bodies, e.g. "/uploads/2026/05/...". */
  publicPath: string;
  size: number;
  lastModified: string | null;
}

export interface ListMediaResult {
  objects: MediaObject[];
  nextCursor: string | null;
}

export async function listMediaObjects({
  continuationToken,
  limit = 50,
}: {
  continuationToken?: string;
  limit?: number;
}): Promise<ListMediaResult> {
  if (!env.S3_BUCKET) {
    throw new Error("S3_BUCKET is not configured.");
  }
  const res = await getClient().send(
    new ListObjectsV2Command({
      Bucket: env.S3_BUCKET,
      Prefix: "uploads/",
      MaxKeys: limit,
      ContinuationToken: continuationToken,
    }),
  );
  const objects: MediaObject[] = (res.Contents ?? [])
    .filter((c) => typeof c.Key === "string" && !c.Key.endsWith("/"))
    .map((c) => ({
      key: c.Key!,
      publicPath: `/${c.Key}`,
      size: c.Size ?? 0,
      lastModified: c.LastModified
        ? c.LastModified.toISOString()
        : null,
    }))
    // Newest first.
    .sort((a, b) => (a.lastModified ?? "") < (b.lastModified ?? "") ? 1 : -1);

  return {
    objects,
    nextCursor: res.IsTruncated ? res.NextContinuationToken ?? null : null,
  };
}

export async function deleteMediaObject(key: string): Promise<void> {
  if (!env.S3_BUCKET) {
    throw new Error("S3_BUCKET is not configured.");
  }
  await getClient().send(
    new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
  );
}
