// Edge Function: demanda-publica
// Recebe as duas ações do formulário público (/nova-demanda):
//   - action "resolver_empresa": dado um slug, devolve so o nome da empresa
//     (nunca a lista completa, evita expor a carteira de clientes).
//   - action "criar": recebe os dados do formulário, valida, gera protocolo
//     e token, insere o ticket e dispara o e-mail de confirmação
//     reaproveitando a função "send-email" já existente.
//
// Segue o mesmo padrão das funções existentes (send-email, google-drive-folders):
// service role key, sem exigir Authorization do chamador (rota pública).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResolverEmpresaBody {
  action: "resolver_empresa";
  slug: string;
}

interface CriarDemandaBody {
  action: "criar";
  slug: string;
  solicitante_nome: string;
  solicitante_email: string;
  category: string; // um dos valores do enum ticket_category
  priority?: "baixa" | "media" | "alta" | "urgente";
  title: string;
  description: string;
}

type RequestBody = ResolverEmpresaBody | CriarDemandaBody;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();

    // ---------------------------------------------------------------
    // Ação 1: resolver o slug da URL para o nome da empresa a exibir
    // ---------------------------------------------------------------
    if (body.action === "resolver_empresa") {
      const { slug } = body;
      if (!slug) {
        return json({ error: "slug é obrigatório" }, 400);
      }

      const { data: company, error } = await supabase
        .from("companies")
        .select("id, name")
        .eq("slug", slug)
        .maybeSingle();

      if (error) {
        console.error("Erro ao resolver empresa:", error);
        return json({ error: "Erro ao buscar empresa" }, 500);
      }

      if (!company) {
        return json({ error: "Link inválido ou empresa não encontrada" }, 404);
      }

      // So o necessario para exibir no formulario, nunca a lista inteira.
      return json({ company_id: company.id, company_name: company.name });
    }

    // ---------------------------------------------------------------
    // Ação 2: criar a demanda
    // ---------------------------------------------------------------
    if (body.action === "criar") {
      const { slug, solicitante_nome, solicitante_email, category, priority, title, description } = body;

      if (!slug || !solicitante_nome || !solicitante_email || !category || !title || !description) {
        return json({ error: "Campos obrigatórios faltando" }, 400);
      }

      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("id, name")
        .eq("slug", slug)
        .maybeSingle();

      if (companyError || !company) {
        console.error("Empresa não encontrada para slug:", slug, companyError);
        return json({ error: "Link inválido ou empresa não encontrada" }, 404);
      }

      // Gera o protocolo (N-2026-0001, ...) via função do banco.
      const { data: protocoloData, error: protocoloError } = await supabase.rpc("generate_protocolo");
      if (protocoloError) {
        console.error("Erro ao gerar protocolo:", protocoloError);
        return json({ error: "Erro ao gerar protocolo" }, 500);
      }
      const protocolo = protocoloData as string;

      // description chega como texto simples do form publico; o restante do
      // sistema usa JSON do TipTap em description_json; empacota como um
      // documento TipTap minimo para ficar visivel igual a qualquer outra
      // demanda dentro do painel.
      const description_json = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: description }],
          },
        ],
      };

      const { data: ticket, error: insertError } = await supabase
        .from("tickets")
        .insert([
          {
            company_id: company.id,
            title,
            description_json,
            category,
            priority: priority || "media",
            status: "novo",
            origem: "formulario",
            protocolo,
            solicitante_nome,
            solicitante_email,
            created_by: null,
          },
        ])
        .select("id, token_acompanhamento")
        .single();

      if (insertError) {
        console.error("Erro ao criar ticket:", insertError);
        return json({ error: "Erro ao registrar demanda", details: insertError.message }, 500);
      }

      const trackingUrl = `${req.headers.get("origin") || ""}/acompanhar/${ticket.token_acompanhamento}`;

      // Reaproveita a funcao send-email ja existente, com um template dedicado.
      // Adicione o case "demanda_publica_criada" em supabase/functions/send-email/index.ts
      // (getEmailHtml e getSubject); ver nota no fim deste arquivo.
      const { error: emailError } = await supabase.functions.invoke("send-email", {
        body: {
          to: solicitante_email,
          template: "demanda_publica_criada",
          data: {
            ticket_title: title,
            company_name: company.name,
            user_name: solicitante_nome,
            message: protocolo,
            action_url: trackingUrl,
          },
        },
      });

      if (emailError) {
        // Nao falha a criacao da demanda por causa do e-mail; loga e segue.
        console.error("Falha ao enviar e-mail de confirmação:", emailError);
      }

      return json({
        protocolo,
        tracking_url: trackingUrl,
      });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (error: any) {
    console.error("Erro em demanda-publica:", error);
    return json({ error: error.message }, 500);
  }
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(handler);

/*
 * NOTA: adicionar em supabase/functions/send-email/index.ts:
 *
 * 1. No union type de `template` (EmailRequest["data"]) adicionar "demanda_publica_criada".
 * 2. Em getSubject():
 *      case "demanda_publica_criada":
 *        return `Demanda registrada - Protocolo ${data?.message}`;
 * 3. Em getEmailHtml(), um case reaproveitando o mesmo baseStyles das outras:
 *      case "demanda_publica_criada":
 *        return `
 *          <!DOCTYPE html><html><head>${baseStyles}</head><body>
 *            <div class="container">
 *              <div class="header"><h1>📋 Demanda registrada</h1></div>
 *              <div class="content">
 *                <p>Olá <strong>${data?.user_name}</strong>,</p>
 *                <p>Recebemos sua solicitação para <span class="highlight">${data?.company_name}</span>:</p>
 *                <div class="info-box"><strong>${data?.ticket_title}</strong></div>
 *                <p>Protocolo: <strong>${data?.message}</strong></p>
 *                ${data?.action_url ? `<a class="button" href="${data.action_url}">Acompanhar andamento</a>` : ""}
 *              </div>
 *              <div class="footer">N Coisas Digitais</div>
 *            </div>
 *          </body></html>`;
 *
 * Isso evita duplicar a logica de envio/HTML; a funcao demanda-publica so
 * invoca send-email com o template novo.
 */
