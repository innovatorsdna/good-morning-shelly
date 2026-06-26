import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { env } from "~/env";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

// Where contact-form submissions are delivered.
const CONTACT_RECIPIENT = "shellymarchant@gmail.com";
// Resend's shared sender, used when RESEND_FROM_EMAIL isn't configured. Note
// this only delivers to the Resend account owner's own address, so production
// should set RESEND_FROM_EMAIL to a verified-domain sender.
const DEFAULT_FROM = "Good Morning Shelly <onboarding@resend.dev>";

const sendInput = z.object({
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address.")
    .max(255),
  message: z.string().trim().min(1, "Message can't be empty.").max(5000),
});

export const contactRouter = createTRPCRouter({
  /**
   * Send a contact-form submission to the site owner via Resend. The
   * submitter's address is set as the reply-to so replies go straight back
   * to them.
   */
  send: publicProcedure.input(sendInput).mutation(async ({ input }) => {
    if (!env.RESEND_API_KEY) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Email sending isn't configured. Please try again later.",
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL ?? DEFAULT_FROM,
        to: [CONTACT_RECIPIENT],
        reply_to: input.email,
        subject: `New contact form message from ${input.email}`,
        text: `From: ${input.email}\n\n${input.message}`,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[contact] Resend send failed (${res.status}): ${detail}`);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "We couldn't send your message. Please try again later.",
      });
    }

    return { ok: true as const };
  }),
});
