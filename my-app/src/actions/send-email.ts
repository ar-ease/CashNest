import React from "react";
import { Resend } from "resend";

export async function sendEmail({
  to,
  subject,
  react,
}: {
  to: string;
  subject: string;
  react: React.ReactNode;
}) {
  // Validate the API key exists
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Missing RESEND_API_KEY environment variable");
    return { success: false, error: "Missing API key" };
  }

  const resend = new Resend(apiKey);

  try {
    // Log email attempt
    console.log(`Attempting to send email to ${to} with subject "${subject}"`);

    const data = await resend.emails.send({
      from: "Finance App <onboarding@resend.dev>",
      to,
      subject,
      react,
    });

    if (data.error) {
      console.error("Resend API returned error:", data.error);
      return {
        success: false,
        error: data.error.message || "Failed to send email",
      };
    }

    console.log(`Email sent successfully: ${data.data?.id}`);
    return { success: true, data };
  } catch (error) {
    // Log the full error for debugging
    console.error("Error sending email:", error);

    // Return a structured error response
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}
