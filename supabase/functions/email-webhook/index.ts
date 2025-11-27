import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailWebhookPayload {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
  }>;
  headers?: Record<string, string>;
  // Reference to original ticket (from In-Reply-To or References header)
  inReplyTo?: string;
  references?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: EmailWebhookPayload = await req.json();
    console.log("Received email webhook:", JSON.stringify(payload, null, 2));

    // Extract ticket ID from email subject or references
    // Format: [Demanda #ticket-id] or from In-Reply-To header
    let ticketId: string | null = null;

    // Try to extract from subject
    const subjectMatch = payload.subject?.match(/\[Demanda #([a-f0-9-]+)\]/i);
    if (subjectMatch) {
      ticketId = subjectMatch[1];
    }

    // Try to extract from In-Reply-To header (message-id format: ticket-{id}@domain)
    if (!ticketId && payload.inReplyTo) {
      const replyMatch = payload.inReplyTo.match(/ticket-([a-f0-9-]+)@/i);
      if (replyMatch) {
        ticketId = replyMatch[1];
      }
    }

    // Try references header as fallback
    if (!ticketId && payload.references) {
      const refMatch = payload.references.match(/ticket-([a-f0-9-]+)@/i);
      if (refMatch) {
        ticketId = refMatch[1];
      }
    }

    if (!ticketId) {
      console.log("Could not extract ticket ID from email");
      return new Response(
        JSON.stringify({ error: "Could not identify ticket from email" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify ticket exists
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("id, company_id, assigned_to, created_by")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) {
      console.log("Ticket not found:", ticketId);
      return new Response(
        JSON.stringify({ error: "Ticket not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Find user by email
    const senderEmail = payload.from.match(/<(.+)>/)?.[1] || payload.from;
    
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id")
      .limit(100);

    // Try to find user in auth.users by email (using service role)
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const sender = authUsers?.users?.find(u => u.email === senderEmail);

    const senderId = sender?.id || null;

    // Create comment from email content
    const commentContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: `📧 Resposta por email de ${payload.from}:`,
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: payload.text || payload.html?.replace(/<[^>]*>/g, "") || "(sem conteúdo)",
            },
          ],
        },
      ],
    };

    // Insert comment
    const { data: comment, error: commentError } = await supabase
      .from("ticket_comments")
      .insert({
        ticket_id: ticketId,
        user_id: senderId,
        content_json: commentContent,
      })
      .select()
      .single();

    if (commentError) {
      console.error("Error creating comment:", commentError);
      throw commentError;
    }

    // Log activity
    await supabase.from("ticket_activities").insert({
      ticket_id: ticketId,
      user_id: senderId,
      action_type: "email_reply",
      metadata_json: {
        from: payload.from,
        subject: payload.subject,
      },
    });

    // Notify relevant users
    const usersToNotify = new Set<string>();
    
    if (ticket.assigned_to && ticket.assigned_to !== senderId) {
      usersToNotify.add(ticket.assigned_to);
    }
    if (ticket.created_by && ticket.created_by !== senderId) {
      usersToNotify.add(ticket.created_by);
    }

    for (const userId of usersToNotify) {
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "email_reply",
        ticket_id: ticketId,
        reference_id: comment.id,
      });
    }

    // Handle attachments if present
    if (payload.attachments && payload.attachments.length > 0) {
      for (const attachment of payload.attachments) {
        try {
          // Decode base64 content
          const fileContent = Uint8Array.from(atob(attachment.content), c => c.charCodeAt(0));
          
          const filePath = `${ticketId}/${Date.now()}-${attachment.filename}`;
          
          const { error: uploadError } = await supabase.storage
            .from("attachments")
            .upload(filePath, fileContent, {
              contentType: attachment.contentType,
            });

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from("attachments")
              .getPublicUrl(filePath);

            await supabase.from("ticket_attachments").insert({
              ticket_id: ticketId,
              file_name: attachment.filename,
              file_url: publicUrl,
              file_type: attachment.contentType,
              uploaded_by: senderId,
            });
          }
        } catch (attachError) {
          console.error("Error processing attachment:", attachError);
        }
      }
    }

    console.log("Email processed successfully for ticket:", ticketId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        ticketId, 
        commentId: comment.id 
      }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  } catch (error: any) {
    console.error("Error processing email webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  }
});
