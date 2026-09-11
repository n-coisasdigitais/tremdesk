import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to?: string | string[];
  recipient_user_ids?: string[];
  subject?: string;
  template:
    | "ticket_created"
    | "ticket_updated"
    | "ticket_approved"
    | "ticket_rejected"
    | "mention"
    | "custom"
    | "demanda_publica_criada";
  data?: {
    ticket_id?: string;
    ticket_title?: string;
    company_name?: string;
    user_name?: string;
    message?: string;
    action_url?: string;
    html?: string;
  };
}

// Email templates
function getEmailHtml(template: string, data: EmailRequest["data"]): string {
  const baseStyles = `
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
      .header h1 { margin: 0; font-size: 24px; }
      .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
      .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
      .button { display: inline-block; background: #667eea; color: white !important; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; margin: 20px 0; }
      .button:hover { background: #5a67d8; }
      .info-box { background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 15px 0; }
      .highlight { color: #667eea; font-weight: 600; }
    </style>
  `;

  switch (template) {
    case "ticket_created":
      return `
        <!DOCTYPE html>
        <html>
        <head>${baseStyles}</head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📋 Nova Demanda Criada</h1>
            </div>
            <div class="content">
              <p>Olá <strong>${data?.user_name || "Usuário"}</strong>,</p>
              <p>Uma nova demanda foi criada para <span class="highlight">${data?.company_name || "sua empresa"}</span>:</p>
              <div class="info-box">
                <strong>${data?.ticket_title || "Demanda"}</strong>
              </div>
              <p>Acesse o sistema para ver os detalhes e acompanhar o andamento.</p>
              ${data?.action_url ? `<a href="${data.action_url}" class="button">Ver Demanda</a>` : ""}
            </div>
            <div class="footer">
              <p>Sistema de Demandas - Este é um email automático.</p>
            </div>
          </div>
        </body>
        </html>
      `;

    case "ticket_updated":
      return `
        <!DOCTYPE html>
        <html>
        <head>${baseStyles}</head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔄 Demanda Atualizada</h1>
            </div>
            <div class="content">
              <p>Olá <strong>${data?.user_name || "Usuário"}</strong>,</p>
              <p>A demanda <span class="highlight">"${data?.ticket_title || "Demanda"}"</span> foi atualizada.</p>
              ${data?.message ? `<div class="info-box">${data.message}</div>` : ""}
              ${data?.action_url ? `<a href="${data.action_url}" class="button">Ver Atualizações</a>` : ""}
            </div>
            <div class="footer">
              <p>Sistema de Demandas - Este é um email automático.</p>
            </div>
          </div>
        </body>
        </html>
      `;

    case "ticket_approved":
      return `
        <!DOCTYPE html>
        <html>
        <head>${baseStyles}</head>
        <body>
          <div class="container">
            <div class="header" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
              <h1>✅ Demanda Aprovada</h1>
            </div>
            <div class="content">
              <p>Olá <strong>${data?.user_name || "Usuário"}</strong>,</p>
              <p>A demanda <span class="highlight">"${data?.ticket_title || "Demanda"}"</span> foi <strong style="color: #10b981;">aprovada</strong>!</p>
              ${data?.message ? `<div class="info-box"><strong>Feedback:</strong><br>${data.message}</div>` : ""}
              ${data?.action_url ? `<a href="${data.action_url}" class="button" style="background: #10b981;">Ver Demanda</a>` : ""}
            </div>
            <div class="footer">
              <p>Sistema de Demandas - Este é um email automático.</p>
            </div>
          </div>
        </body>
        </html>
      `;

    case "ticket_rejected":
      return `
        <!DOCTYPE html>
        <html>
        <head>${baseStyles}</head>
        <body>
          <div class="container">
            <div class="header" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);">
              <h1>🔄 Alterações Solicitadas</h1>
            </div>
            <div class="content">
              <p>Olá <strong>${data?.user_name || "Usuário"}</strong>,</p>
              <p>A demanda <span class="highlight">"${data?.ticket_title || "Demanda"}"</span> necessita de alterações.</p>
              ${data?.message ? `<div class="info-box"><strong>Feedback do cliente:</strong><br>${data.message}</div>` : ""}
              ${data?.action_url ? `<a href="${data.action_url}" class="button" style="background: #ef4444;">Ver Solicitação</a>` : ""}
            </div>
            <div class="footer">
              <p>Sistema de Demandas - Este é um email automático.</p>
            </div>
          </div>
        </body>
        </html>
      `;

    case "mention":
      return `
        <!DOCTYPE html>
        <html>
        <head>${baseStyles}</head>
        <body>
          <div class="container">
            <div class="header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
              <h1>📣 Você foi mencionado</h1>
            </div>
            <div class="content">
              <p>Olá <strong>${data?.user_name || "Usuário"}</strong>,</p>
              <p>Você foi mencionado na demanda <span class="highlight">"${data?.ticket_title || "Demanda"}"</span>.</p>
              ${data?.message ? `<div class="info-box">${data.message}</div>` : ""}
              ${data?.action_url ? `<a href="${data.action_url}" class="button" style="background: #f59e0b;">Ver Menção</a>` : ""}
            </div>
            <div class="footer">
              <p>Sistema de Demandas - Este é um email automático.</p>
            </div>
          </div>
        </body>
        </html>
      `;

    // NOVO — confirmação de demanda aberta pelo formulário público (/nova-demanda),
    // usa data.message para o protocolo e data.action_url para o link de acompanhamento.
    case "demanda_publica_criada":
      return `
        <!DOCTYPE html>
        <html>
        <head>${baseStyles}</head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📋 Demanda registrada</h1>
            </div>
            <div class="content">
              <p>Olá <strong>${data?.user_name || "Usuário"}</strong>,</p>
              <p>Recebemos sua solicitação para <span class="highlight">${data?.company_name || "sua empresa"}</span>:</p>
              <div class="info-box">
                <strong>${data?.ticket_title || "Demanda"}</strong>
              </div>
              <p>Protocolo: <strong>${data?.message || ""}</strong></p>
              ${data?.action_url ? `<a href="${data.action_url}" class="button">Acompanhar andamento</a>` : ""}
            </div>
            <div class="footer">
              <p>N Coisas Digitais - Este é um email automático.</p>
            </div>
          </div>
        </body>
        </html>
      `;

    case "custom":
      return (
        data?.html ||
        `
        <!DOCTYPE html>
        <html>
        <head>${baseStyles}</head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Sistema de Demandas</h1>
            </div>
            <div class="content">
              ${data?.message || "<p>Mensagem não especificada.</p>"}
            </div>
            <div class="footer">
              <p>Sistema de Demandas - Este é um email automático.</p>
            </div>
          </div>
        </body>
        </html>
      `
      );

    default:
      return `<p>${data?.message || "Mensagem não especificada."}</p>`;
  }
}

function getSubject(template: string, data: EmailRequest["data"]): string {
  switch (template) {
    case "ticket_created":
      return `Nova Demanda: ${data?.ticket_title || "Demanda criada"}`;
    case "ticket_updated":
      return `Atualização: ${data?.ticket_title || "Demanda atualizada"}`;
    case "ticket_approved":
      return `✅ Aprovada: ${data?.ticket_title || "Demanda aprovada"}`;
    case "ticket_rejected":
      return `🔄 Alterações: ${data?.ticket_title || "Alterações solicitadas"}`;
    case "mention":
      return `📣 Você foi mencionado: ${data?.ticket_title || "Nova menção"}`;
    // NOVO
    case "demanda_publica_criada":
      return `Demanda registrada — Protocolo ${data?.message || ""}`;
    default:
      return "Sistema de Demandas";
  }
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get settings from database
    const { data: settings, error: settingsError } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["resend_api_key", "resend_from_email", "resend_from_name"]);

    if (settingsError) {
      console.error("Error fetching settings:", settingsError);
      throw new Error("Failed to fetch settings");
    }

    const settingsMap = Object.fromEntries(settings?.map((s) => [s.key, s.value]) || []);
    const resendApiKey = settingsMap["resend_api_key"];
    const fromEmail = settingsMap["resend_from_email"] || "onboarding@resend.dev";
    const fromName = settingsMap["resend_from_name"] || "Sistema de Demandas";

    if (!resendApiKey) {
      console.error("Resend API key not configured");
      return new Response(JSON.stringify({ error: "Resend não configurado. Configure a API Key nas configurações." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resend = new Resend(resendApiKey);
    const body: EmailRequest = await req.json();

    // Resolve emails from user IDs if provided
    let toEmails: string[] = [];

    if (body.recipient_user_ids && body.recipient_user_ids.length > 0) {
      // Fetch emails from auth.users using service role
      const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

      if (authError) {
        console.error("Error fetching users:", authError);
      } else if (authData?.users) {
        toEmails = authData.users
          .filter((u) => body.recipient_user_ids!.includes(u.id) && u.email)
          .map((u) => u.email!)
          .filter(Boolean);
      }
    } else if (body.to) {
      toEmails = Array.isArray(body.to)
        ? (body.to.filter(Boolean) as string[])
        : ([body.to].filter(Boolean) as string[]);
    }

    if (toEmails.length === 0) {
      console.log("No valid recipients found");
      return new Response(JSON.stringify({ warning: "No valid recipients found", skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Sending email:", {
      to: toEmails,
      template: body.template,
      subject: body.subject,
    });

    const html = getEmailHtml(body.template, body.data);
    const subject = body.subject || getSubject(body.template, body.data);

    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: toEmails,
      subject,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      throw new Error(error.message);
    }

    console.log("Email sent successfully:", data);

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in send-email function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
