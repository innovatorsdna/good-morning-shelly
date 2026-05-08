import "server-only";

import { createHash, createHmac } from "node:crypto";

import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

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
  if (
    !env.S3_BUCKET ||
    !env.S3_REGION ||
    !env.S3_ACCESS_KEY_ID ||
    !env.S3_SECRET_ACCESS_KEY
  ) {
    throw new Error(
      "S3 is not configured. Set S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY.",
    );
  }

  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");

  const safe = safeFilename(filename) || "upload";
  // Add a short random prefix so concurrent uploads with the same name don't
  // overwrite each other.
  const rand = Math.random().toString(36).slice(2, 8);
  const key = `uploads/${yyyy}/${mm}/${rand}-${safe}`;

  const uploadUrl = presignS3PutUrl({
    region: env.S3_REGION,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    bucket: env.S3_BUCKET,
    key,
    contentType,
    expiresInSeconds: 60 * 5,
    now,
  });

  return {
    uploadUrl,
    publicPath: `/${key}`,
  };
}

// ---- AWS SigV4 PUT presigner --------------------------------------------
// Self-contained so we don't pull in @aws-sdk/s3-request-presigner. Mirrors
// the headers the SDK signs for a PutObjectCommand with a ContentType: the
// uploader must send the same `Content-Type` header it asked us to sign.

function rfc3986Encode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

function presignS3PutUrl({
  region,
  accessKeyId,
  secretAccessKey,
  bucket,
  key,
  contentType,
  expiresInSeconds,
  now,
}: {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  key: string;
  contentType: string;
  expiresInSeconds: number;
  now: Date;
}): string {
  const host = `${bucket}.s3.${region}.amazonaws.com`;
  const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const signedHeaders = "content-type;host";

  const canonicalUri =
    "/" + key.split("/").map(rfc3986Encode).join("/");

  const queryPairs: [string, string][] = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${accessKeyId}/${credentialScope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expiresInSeconds)],
    ["X-Amz-SignedHeaders", signedHeaders],
  ];
  const canonicalQuery = queryPairs
    .slice()
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${rfc3986Encode(k)}=${rfc3986Encode(v)}`)
    .join("&");

  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`;
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning)
    .update(stringToSign, "utf8")
    .digest("hex");

  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
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
