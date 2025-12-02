import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Trem Desk branded email template
function getPasswordRecoveryEmail(data: {
  token_hash: string;
  redirect_to: string;
  site_url: string;
  user_email: string;
}): string {
  // Use the configured site URL or fallback
  const resetUrl = `${data.site_url}/auth/reset-password#access_token=${data.token_hash}&type=recovery`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          margin: 0; 
          padding: 0;
          background-color: #f5f5f5;
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          padding: 20px; 
        }
        .header { 
          background: linear-gradient(135deg, #434343 0%, #2d2d2d 100%);
          color: white; 
          padding: 30px; 
          text-align: center; 
          border-radius: 12px 12px 0 0;
        }
        .logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 10px;
        }
        .logo-icon {
          font-size: 32px;
        }
        .logo-text {
          font-size: 28px;
          font-weight: 700;
          color: #C7D423;
        }
        .header-subtitle {
          font-size: 14px;
          opacity: 0.9;
          margin-top: 5px;
        }
        .content { 
          background: #ffffff; 
          padding: 40px 30px; 
          border: 1px solid #e5e7eb; 
          border-top: none; 
        }
        .content h2 {
          color: #434343;
          margin-top: 0;
          font-size: 20px;
        }
        .content p {
          color: #666;
          font-size: 15px;
        }
        .button { 
          display: inline-block; 
          background: linear-gradient(135deg, #C7D423 0%, #a8b31c 100%);
          color: #434343 !important; 
          padding: 14px 32px; 
          border-radius: 8px; 
          text-decoration: none; 
          font-weight: 600; 
          margin: 25px 0;
          font-size: 16px;
          box-shadow: 0 4px 12px rgba(199, 212, 35, 0.3);
        }
        .button:hover { 
          background: linear-gradient(135deg, #d4e126 0%, #C7D423 100%);
        }
        .info-box { 
          background: #f9fafb; 
          padding: 15px; 
          border-radius: 8px; 
          margin: 20px 0;
          border-left: 4px solid #C7D423;
        }
        .info-box p {
          margin: 0;
          font-size: 13px;
          color: #666;
        }
        .footer { 
          background: #f9fafb; 
          padding: 25px; 
          text-align: center; 
          font-size: 12px; 
          color: #6b7280; 
          border: 1px solid #e5e7eb; 
          border-top: none; 
          border-radius: 0 0 12px 12px;
        }
        .footer a {
          color: #C7D423;
          text-decoration: none;
        }
        .divider {
          height: 1px;
          background: #e5e7eb;
          margin: 25px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">
            <span class="logo-icon">🚂</span>
            <span class="logo-text">Trem Desk</span>
          </div>
          <div class="header-subtitle">Sistema de Gestão de Demandas</div>
        </div>
        <div class="content">
          <h2>Redefinição de Senha</h2>
          <p>Olá,</p>
          <p>Recebemos uma solicitação para redefinir a senha da sua conta associada ao email <strong>${data.user_email}</strong>.</p>
          <p>Clique no botão abaixo para criar uma nova senha:</p>
          
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Redefinir Minha Senha</a>
          </div>
          
          <div class="info-box">
            <p>⏰ Este link expira em <strong>1 hora</strong>.</p>
            <p style="margin-top: 8px;">🔒 Se você não solicitou esta redefinição, ignore este email. Sua senha permanecerá inalterada.</p>
          </div>
          
          <div class="divider"></div>
          
          <p style="font-size: 13px; color: #888;">Se o botão não funcionar, copie e cole este link no seu navegador:</p>
          <p style="font-size: 12px; word-break: break-all; color: #999; background: #f5f5f5; padding: 10px; border-radius: 4px;">${resetUrl}</p>
        </div>
        <div class="footer">
          <p>Este é um email automático enviado pelo <strong>Trem Desk</strong>.</p>
          <p style="margin-top: 10px;">by <a href="https://ncoisas.digital" target="_blank">N Coisas Digitais</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log("Auth email hook received:", JSON.stringify(payload, null, 2));

    const { 
      user, 
      email_data 
    } = payload;

    // Only handle recovery emails
    if (email_data?.email_action_type !== "recovery") {
      console.log("Not a recovery email, skipping custom handling");
      return new Response(JSON.stringify({ success: true, handled: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get settings from database
    const { data: settings } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["resend_api_key", "resend_from_email", "resend_from_name", "site_url"]);

    const settingsMap = Object.fromEntries(settings?.map(s => [s.key, s.value]) || []);
    const resendApiKey = settingsMap["resend_api_key"];
    const fromEmail = settingsMap["resend_from_email"] || "onboarding@resend.dev";
    const fromName = settingsMap["resend_from_name"] || "Trem Desk";
    
    // Use configured site URL or the redirect_to from the request
    const siteUrl = settingsMap["site_url"] || email_data?.redirect_to?.split('/auth')[0] || "https://f1808f3b-a2f2-422f-ac3d-79ee4012689c.lovableproject.com";

    if (!resendApiKey) {
      console.error("Resend API key not configured - using default Supabase email");
      return new Response(JSON.stringify({ success: false, error: "Resend not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resend = new Resend(resendApiKey);

    const html = getPasswordRecoveryEmail({
      token_hash: email_data.token_hash,
      redirect_to: email_data.redirect_to,
      site_url: siteUrl,
      user_email: user.email,
    });

    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [user.email],
      subject: "🔒 Redefinição de Senha - Trem Desk",
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      throw new Error(error.message);
    }

    console.log("Recovery email sent successfully:", data);

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in auth-email-hook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
