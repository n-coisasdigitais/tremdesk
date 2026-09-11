// Edge Function: demanda-publica
// Recebe as duas acoes do formulario publico (/nova-demanda):
//   - action "resolver_empresa": dado um slug, devolve o nome da empresa
//     (nunca a lista completa, evita expor a carteira de clientes) e a
//     lista de categorias ativas cadastradas em Admin > Categorias.
//   - action "criar": recebe os dados do formulario, valida, gera protocolo
//     e token, insere o ticket, associa a categoria escolhida, sobe o anexo
//     (se houver) e dispara o e-mail de confirmacao reaproveitando a funcao
//     "send-email" ja existente.
//
// Segue o mesmo padrao das funcoes existentes (send-email, google-drive-folders):
// service role key, sem exigir Authorization do chamador (rota publica).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Limite de tamanho do anexo (em base64). ~7.000.000 caracteres equivale a
// aproximadamente 5MB de arquivo decodificado. Edge Functions do Supabase
// tem limite de tamanho de payload; manter uma margem de seguranca evita
// erro de timeout/memoria numa funcao que roda em Deno, nao num servidor
// dedicado.
const MAX_ATTACHMENT_BASE64_LENGTH = 7_000_000;

interface ResolverEmpresaBody {
  action: "resolver_empresa";
  slug: string;
}

interface AttachmentPayload {
  file_name: string;
  file_type: string;
  file_base64: string;
}

interface CriarDemandaBody {
  action: "criar";
  slug: string;
  solicitante_nome: string;
  solicitante_email: string;
  category_id?: string; // id de ticket_categories (Admin > Categorias)
  priority?: "baixa" | "media" | "alta" | "urgente";
  title: string;
  description: string;
  attachment?: AttachmentPayload;
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
    // Acao 1: resolver o slug da URL para o nome da empresa a exibir,
    // e devolver junto a lista de categorias ativas (Admin > Categorias).
    // ---------------------------------------------------------------
    if (body.action === "resolver_empresa") {
      const { slug } = body;
      if (!slug) {
        return json({ error: "slug e obrigatorio" }, 400);
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
        return json({ error: "Link invalido ou empresa nao encontrada" }, 404);
      }

      // So o necessario para exibir no formulario, nunca a lista inteira.
      const { data: categories, error: catError } = await supabase
        .from("ticket_categories")
        .select("id, name, icon, color")
        .eq("active", true)
        .order("name");

      if (catError) {
        // Nao falha a resolucao da empresa por causa disso; o formulario
        // simplesmente mostra a etapa de categoria vazia.
        console.error("Erro ao buscar categorias:", catError);
      }

      return json({
        company_id: company.id,
        company_name: company.name,
        categories: categories || [],
      });
    }

    // ---------------------------------------------------------------
    // Acao 2: criar a demanda
    // ---------------------------------------------------------------
    if (body.action === "criar") {
      const { slug, solicitante_nome, solicitante_email, category_id, priority, title, description, attachment } = body;

      if (!slug || !solicitante_nome || !solicitante_email || !title || !description) {
        return json({ error: "Campos obrigatorios faltando" }, 400);
      }

      if (attachment?.file_base64 && attachment.file_base64.length > MAX_ATTACHMENT_BASE64_LENGTH) {
        return json({ error: "Arquivo muito grande (maximo 5MB)" }, 400);
      }

      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("id, name")
        .eq("slug", slug)
        .maybeSingle();

      if (companyError || !company) {
        console.error("Empresa nao encontrada para slug:", slug, companyError);
        return json({ error: "Link invalido ou empresa nao encontrada" }, 404);
      }

      // Gera o protocolo (N-2026-0001, ...) via funcao do banco.
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

      // "category" (enum legado do banco) continua NOT NULL na tabela
      // tickets por compatibilidade com o restante do sistema (Kanban,
      // NewTicketModal), mas deixou de ser a categorizacao "de verdade":
      // quem categoriza mesmo agora e ticket_categories, gerenciada em
      // Admin > Categorias e associada logo abaixo via
      // ticket_category_assignments. "outro" aqui e so um valor valido
      // de preenchimento, nunca aparece pro usuario.
      const { data: ticket, error: insertError } = await supabase
        .from("tickets")
        .insert([
          {
            company_id: company.id,
            title,
            description_json,
            category: "outro",
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

      // Associa a categoria escolhida (Admin > Categorias) ao ticket recem-
      // criado. Roda com service role, entao nao esbarra na RLS de
      // ticket_category_assignments (que normalmente exige admin/team_member).
      if (category_id) {
        const { error: catAssignError } = await supabase
          .from("ticket_category_assignments")
          .insert([{ ticket_id: ticket.id, category_id }]);

        if (catAssignError) {
          // Nao falha a criacao da demanda por causa disso; a demanda fica
          // sem categoria visivel, mas registrada e visivel no Kanban.
          console.error("Erro ao associar categoria:", catAssignError);
        }
      }

      // Anexo (opcional). Sobe direto pro bucket "attachments" do Supabase
      // Storage com service role (mesmo bucket usado por TicketAttachments.tsx
      // no painel interno) e registra a linha em ticket_attachments.
      if (attachment?.file_base64) {
        try {
          const fileExt = attachment.file_name.split(".").pop() || "bin";
          const storagePath = `${ticket.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const bytes = base64ToUint8Array(attachment.file_base64);

          const { error: uploadError } = await supabase.storage.from("attachments").upload(storagePath, bytes, {
            contentType: attachment.file_type || "application/octet-stream",
          });

          if (uploadError) throw uploadError;

          const { error: attError } = await supabase.from("ticket_attachments").insert([
            {
              ticket_id: ticket.id,
              file_name: attachment.file_name,
              file_type: attachment.file_type,
              file_url: storagePath,
              uploaded_by: null,
            },
          ]);

          if (attError) throw attError;
        } catch (attErr: any) {
          // Nao falha a criacao da demanda por causa do anexo; loga e segue
          // (mesmo padrao ja usado pro envio de e-mail, abaixo).
          console.error("Erro ao anexar arquivo do formulario publico:", attErr);
        }
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
        console.error("Falha ao enviar e-mail de confirmacao:", emailError);
      }

      return json({
        protocolo,
        tracking_url: trackingUrl,
      });
    }

    return json({ error: "Acao invalida" }, 400);
  } catch (error: any) {
    console.error("Erro em demanda-publica:", error);
    return json({ error: error.message }, 500);
  }
};

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

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
 *                <p>Ola <strong>${data?.user_name}</strong>,</p>
 *                <p>Recebemos sua solicitacao para <span class="highlight">${data?.company_name}</span>:</p>
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
