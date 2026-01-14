import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DayLogEmailRequest {
  day_log_id: string;
  recipients: string[];
  include_pdf?: boolean;
}

interface DayLog {
  id: string;
  date: string;
  description: string | null;
  work_done: string;
  work_pending: string | null;
  next_steps: string | null;
  tags: string[] | null;
  transcription_url: string | null;
  ai_assistant_url: string | null;
  meeting_notes: string | null;
  user_id: string;
  company_id: string | null;
  profiles?: { full_name: string; avatar_url: string | null };
  companies?: { name: string; logo_url: string | null };
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function generateDayLogHtml(dayLog: DayLog, senderName: string): string {
  const tagColors: Record<string, { bg: string; text: string }> = {
    'Reunião': { bg: '#dbeafe', text: '#1e40af' },
    'Estratégia': { bg: '#dcfce7', text: '#166534' },
    'Análise': { bg: '#fef3c7', text: '#92400e' },
    'Planejamento': { bg: '#e0e7ff', text: '#3730a3' },
    'Otimização': { bg: '#ede9fe', text: '#5b21b6' },
    'Criação': { bg: '#fce7f3', text: '#9d174d' },
    'Suporte': { bg: '#cffafe', text: '#0e7490' },
    'Relatório': { bg: '#fee2e2', text: '#991b1b' },
  };

  const getTagStyle = (tag: string) => {
    const colors = tagColors[tag] || { bg: '#f3f4f6', text: '#374151' };
    return `background-color: ${colors.bg}; color: ${colors.text}; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; display: inline-block; margin: 2px;`;
  };

  const companyName = dayLog.companies?.name || '';
  const companyLogo = dayLog.companies?.logo_url || '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>DayLog - ${formatDate(dayLog.date)}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; line-height: 1.6;">
      <div style="max-width: 640px; margin: 0 auto; padding: 20px;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0; padding: 32px; text-align: center;">
          ${companyLogo ? `<img src="${companyLogo}" alt="${companyName}" style="max-height: 50px; margin-bottom: 16px;">` : ''}
          <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700;">📋 DayLog</h1>
          <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">${formatDate(dayLog.date)}</p>
        </div>

        <!-- Main Content -->
        <div style="background: white; padding: 32px; border: 1px solid #e2e8f0; border-top: none;">
          
          <!-- Author -->
          <div style="display: flex; align-items: center; margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid #e2e8f0;">
            <div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 16px; margin-right: 12px;">
              ${senderName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p style="margin: 0; font-weight: 600; color: #1e293b;">${senderName}</p>
              ${companyName ? `<p style="margin: 0; font-size: 14px; color: #64748b;">${companyName}</p>` : ''}
            </div>
          </div>

          ${dayLog.description ? `
          <!-- Description -->
          <div style="margin-bottom: 24px;">
            <h2 style="margin: 0 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600;">Resumo do dia</h2>
            <p style="margin: 0; font-size: 18px; color: #1e293b; font-weight: 500;">${dayLog.description}</p>
          </div>
          ` : ''}

          <!-- Work Done -->
          <div style="margin-bottom: 24px; padding: 20px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #22c55e;">
            <h2 style="margin: 0 0 12px; font-size: 16px; color: #166534; display: flex; align-items: center;">
              ✅ O que foi feito
            </h2>
            <div style="color: #1e293b; white-space: pre-wrap;">${dayLog.work_done}</div>
          </div>

          ${dayLog.work_pending ? `
          <!-- Work Pending -->
          <div style="margin-bottom: 24px; padding: 20px; background: #fefce8; border-radius: 8px; border-left: 4px solid #eab308;">
            <h2 style="margin: 0 0 12px; font-size: 16px; color: #854d0e; display: flex; align-items: center;">
              ⏳ O que ficou pendente
            </h2>
            <div style="color: #1e293b; white-space: pre-wrap;">${dayLog.work_pending}</div>
          </div>
          ` : ''}

          ${dayLog.next_steps ? `
          <!-- Next Steps -->
          <div style="margin-bottom: 24px; padding: 20px; background: #eff6ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
            <h2 style="margin: 0 0 12px; font-size: 16px; color: #1e40af; display: flex; align-items: center;">
              🎯 Próximos passos
            </h2>
            <div style="color: #1e293b; white-space: pre-wrap;">${dayLog.next_steps}</div>
          </div>
          ` : ''}

          ${dayLog.tags && dayLog.tags.length > 0 ? `
          <!-- Tags -->
          <div style="margin-bottom: 24px;">
            <h2 style="margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600;">Tags</h2>
            <div>
              ${dayLog.tags.map(tag => `<span style="${getTagStyle(tag)}">${tag}</span>`).join(' ')}
            </div>
          </div>
          ` : ''}

          ${dayLog.meeting_notes ? `
          <!-- Meeting Notes -->
          <div style="margin-bottom: 24px; padding: 20px; background: #f8fafc; border-radius: 8px;">
            <h2 style="margin: 0 0 12px; font-size: 16px; color: #475569;">📝 Notas de reunião</h2>
            <div style="color: #1e293b; white-space: pre-wrap;">${dayLog.meeting_notes}</div>
          </div>
          ` : ''}

          ${(dayLog.transcription_url || dayLog.ai_assistant_url) ? `
          <!-- External Links -->
          <div style="margin-bottom: 24px;">
            <h2 style="margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600;">Links</h2>
            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
              ${dayLog.transcription_url ? `
              <a href="${dayLog.transcription_url}" target="_blank" style="display: inline-flex; align-items: center; padding: 8px 16px; background: #f1f5f9; color: #475569; text-decoration: none; border-radius: 6px; font-size: 14px;">
                📄 Transcrição
              </a>
              ` : ''}
              ${dayLog.ai_assistant_url ? `
              <a href="${dayLog.ai_assistant_url}" target="_blank" style="display: inline-flex; align-items: center; padding: 8px 16px; background: #f1f5f9; color: #475569; text-decoration: none; border-radius: 6px; font-size: 14px;">
                🤖 IA/Assistente
              </a>
              ` : ''}
            </div>
          </div>
          ` : ''}

        </div>

        <!-- Footer -->
        <div style="background: #f8fafc; padding: 24px; text-align: center; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="margin: 0; font-size: 12px; color: #94a3b8;">
            Este email foi enviado pelo Sistema de Demandas.<br>
            Relatório gerado automaticamente em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.
          </p>
        </div>

      </div>
    </body>
    </html>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting send-daylog-email function");

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth header for user identification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header required");
    }

    // Decode the JWT to get user info
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Invalid authentication");
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const senderName = profile?.full_name || "Usuário";

    // Get settings from database
    const { data: settings, error: settingsError } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["resend_api_key", "resend_from_email", "resend_from_name"]);

    if (settingsError) {
      console.error("Error fetching settings:", settingsError);
      throw new Error("Failed to fetch settings");
    }

    const settingsMap = Object.fromEntries(settings?.map(s => [s.key, s.value]) || []);
    const resendApiKey = settingsMap["resend_api_key"];
    const fromEmail = settingsMap["resend_from_email"] || "onboarding@resend.dev";
    const fromName = settingsMap["resend_from_name"] || "Sistema de Demandas";

    if (!resendApiKey) {
      console.error("Resend API key not configured");
      return new Response(
        JSON.stringify({ error: "Resend não configurado. Configure a API Key nas configurações." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);
    const body: DayLogEmailRequest = await req.json();

    console.log("Request body:", body);

    if (!body.day_log_id || !body.recipients || body.recipients.length === 0) {
      throw new Error("day_log_id and recipients are required");
    }

    // Fetch the DayLog with company
    const { data: dayLog, error: dayLogError } = await supabase
      .from("day_logs")
      .select(`
        *,
        companies:company_id (name, logo_url)
      `)
      .eq("id", body.day_log_id)
      .single();

    if (dayLogError || !dayLog) {
      console.error("Error fetching daylog:", dayLogError);
      throw new Error("DayLog not found");
    }

    console.log("DayLog fetched:", dayLog.id);

    // Fetch the profile separately since there's no FK relationship
    const { data: authorProfile } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", dayLog.user_id)
      .single();

    // Merge profile data into dayLog object
    const dayLogWithProfile = {
      ...dayLog,
      profiles: authorProfile || { full_name: senderName, avatar_url: null }
    };

    // Generate HTML email
    const html = generateDayLogHtml(dayLogWithProfile as DayLog, senderName);
    const dateFormatted = new Date(dayLog.date).toLocaleDateString('pt-BR');
    const subject = `📋 DayLog de ${senderName} - ${dateFormatted}`;

    console.log("Sending email to:", body.recipients);

    // Send email
    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: body.recipients,
      subject,
      html,
    });

    if (emailError) {
      console.error("Resend error:", emailError);
      throw new Error(emailError.message);
    }

    console.log("Email sent successfully:", emailResult);

    // Log the email send
    const { error: logError } = await supabase
      .from("daylog_email_sends")
      .insert({
        day_log_id: body.day_log_id,
        sent_by: user.id,
        sent_to: body.recipients,
        subject,
      });

    if (logError) {
      console.error("Error logging email send:", logError);
      // Don't throw, just log
    }

    return new Response(
      JSON.stringify({ success: true, data: emailResult }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-daylog-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
