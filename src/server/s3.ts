import "server-only";

import {
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
