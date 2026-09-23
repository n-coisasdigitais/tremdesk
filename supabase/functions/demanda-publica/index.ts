// Edge Function: demanda-publica
// Recebe as duas acoes do formulario publico (/nova-demanda):
//   - action "resolver_empresa": dado um slug, devolve o nome da empresa
//     (nunca a lista completa, evita expor a carteira de clientes) e a
//     lista de categorias ativas cadastradas em Admin > Categorias.
//   - action "criar": recebe os dados do formulario, valida, gera protocolo
//     e token, insere o ticket, associa a categoria escolhida, envia o anexo
//     ao Google Drive da empresa (se houver) e dispara o e-mail de confirmacao reaproveitando a funcao
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

interface ListarAnexosBody {
  action: "listar_anexos";
  token: string;
}

interface AbrirAnexoBody {
  action: "abrir_anexo";
  token: string;
  attachment_id: string;
}

interface DetalhesBody {
  action: "detalhes";
  token: string;
}

interface SolicitarCodigoBody {
  action: "solicitar_codigo_aprovacao";
  token: string;
  decision: "aprovado" | "changes_requested";
  feedback?: string;
}

interface RegistrarAprovacaoBody {
  action: "registrar_aprovacao";
  token: string;
  code: string;
}

type RequestBody =
  | ResolverEmpresaBody
  | CriarDemandaBody
  | ListarAnexosBody
  | AbrirAnexoBody
  | DetalhesBody
  | SolicitarCodigoBody
  | RegistrarAprovacaoBody;

// Hash do codigo de aprovacao. O codigo em texto puro nunca e gravado.
async function hashCode(ticketId: string, code: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${ticketId}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function comentarioTipTap(text: string) {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

function mascararEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  const visivel = user.slice(0, 2);
  return `${visivel}${"*".repeat(Math.max(user.length - 2, 1))}@${domain}`;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();

    // Lista somente os metadados dos anexos ligados ao token informado.
    // O caminho interno do arquivo nunca e devolvido ao navegador.
    if (body.action === "listar_anexos") {
      if (!body.token) return json({ error: "token e obrigatorio" }, 400);

      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .select("id")
        .eq("token_acompanhamento", body.token)
        .maybeSingle();

      if (ticketError || !ticket) return json({ error: "Demanda nao encontrada" }, 404);

      const { data: attachments, error: attachmentsError } = await supabase
        .from("ticket_attachments")
        .select("id, file_name, file_type, created_at")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: false });

      if (attachmentsError) {
        console.error("Erro ao listar anexos:", attachmentsError);
        return json({ error: "Erro ao carregar anexos" }, 500);
      }

      return json({ attachments: attachments || [] });
    }

    // Valida novamente o token e o anexo antes de entregar um link. Arquivos
    // locais recebem uma URL assinada curta; links externos sao devolvidos
    // somente depois da mesma validacao.
    if (body.action === "abrir_anexo") {
      if (!body.token || !body.attachment_id) {
        return json({ error: "token e attachment_id sao obrigatorios" }, 400);
      }

      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .select("id")
        .eq("token_acompanhamento", body.token)
        .maybeSingle();

      if (ticketError || !ticket) return json({ error: "Demanda nao encontrada" }, 404);

      const { data: attachment, error: attachmentError } = await supabase
        .from("ticket_attachments")
        .select("file_url")
        .eq("id", body.attachment_id)
        .eq("ticket_id", ticket.id)
        .maybeSingle();

      if (attachmentError || !attachment) return json({ error: "Anexo nao encontrado" }, 404);

      if (/^https?:\/\//i.test(attachment.file_url)) {
        return json({ url: attachment.file_url });
      }

      const { data: signed, error: signedError } = await supabase.storage
        .from("attachments")
        .createSignedUrl(attachment.file_url, 300);

      if (signedError || !signed?.signedUrl) {
        console.error("Erro ao assinar anexo:", signedError);
        return json({ error: "Nao foi possivel abrir o anexo" }, 500);
      }

      return json({ url: signed.signedUrl });
    }

    // Checklist e demandas vinculadas, sempre validando o token primeiro e
    // devolvendo apenas o minimo necessario para exibir no portal.
    if (body.action === "detalhes") {
      if (!body.token) return json({ error: "token e obrigatorio" }, 400);

      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .select("id, solicitante_nome, solicitante_email")
        .eq("token_acompanhamento", body.token)
        .maybeSingle();

      if (ticketError || !ticket) return json({ error: "Demanda nao encontrada" }, 404);

      const { data: checklist } = await supabase
        .from("ticket_checklist_items")
        .select("id, content, is_completed, position")
        .eq("ticket_id", ticket.id)
        .order("position", { ascending: true });

      const { data: links } = await supabase
        .from("ticket_links")
        .select("source_ticket_id, target_ticket_id, link_type")
        .or(`source_ticket_id.eq.${ticket.id},target_ticket_id.eq.${ticket.id}`);

      const relatedIds = (links || [])
        .map((l) => (l.source_ticket_id === ticket.id ? l.target_ticket_id : l.source_ticket_id))
        .filter((id, index, arr) => arr.indexOf(id) === index);

      let linked: unknown[] = [];
      if (relatedIds.length > 0) {
        const { data: relatedTickets } = await supabase
          .from("tickets")
          .select("id, protocolo, title, status")
          .in("id", relatedIds);
        linked = (relatedTickets || []).map((t) => ({
          protocolo: t.protocolo,
          title: t.title,
          status: t.status,
        }));
      }

      return json({
        checklist: checklist || [],
        linked,
        solicitante: {
          nome: ticket.solicitante_nome || null,
          email: ticket.solicitante_email || null,
        },
      });
    }

    // Envia um codigo de 6 digitos para o e-mail cadastrado na abertura da
    // demanda. O codigo e guardado somente como hash.
    if (body.action === "solicitar_codigo_aprovacao") {
      if (!body.token || !body.decision) return json({ error: "Dados obrigatorios faltando" }, 400);
      if (body.decision !== "aprovado" && body.decision !== "changes_requested") {
        return json({ error: "Decisao invalida" }, 400);
      }
      const feedback = (body.feedback || "").trim().slice(0, 2000);
      if (body.decision === "changes_requested" && !feedback) {
        return json({ error: "Descreva os ajustes necessarios" }, 400);
      }

      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .select("id, title, status, solicitante_email, solicitante_nome, company_id")
        .eq("token_acompanhamento", body.token)
        .maybeSingle();

      if (ticketError || !ticket) return json({ error: "Demanda nao encontrada" }, 404);
      if (ticket.status !== "aguardando_aprovacao") {
        return json({ error: "Esta demanda nao esta aguardando aprovacao" }, 400);
      }
      if (!ticket.solicitante_email) {
        return json({ error: "Esta demanda nao tem e-mail de solicitante cadastrado" }, 400);
      }

      const code = String(Math.floor(100000 + Math.random() * 900000));
      const code_hash = await hashCode(ticket.id, code);

      // Invalida codigos anteriores ainda abertos para a mesma demanda.
      await supabase
        .from("ticket_approval_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("ticket_id", ticket.id)
        .is("used_at", null);

      const { error: codeError } = await supabase.from("ticket_approval_codes").insert([
        {
          ticket_id: ticket.id,
          email: ticket.solicitante_email,
          code_hash,
          decision: body.decision,
          feedback: feedback || null,
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        },
      ]);

      if (codeError) {
        console.error("Erro ao gerar codigo de aprovacao:", codeError);
        return json({ error: "Nao foi possivel gerar o codigo" }, 500);
      }

      const { error: emailError } = await supabase.functions.invoke("send-email", {
        body: {
          to: ticket.solicitante_email,
          template: "custom",
          subject: `Código de confirmação — ${ticket.title}`,
          data: {
            message: `<p>Olá <strong>${ticket.solicitante_nome || ""}</strong>,</p>
              <p>Use o código abaixo para confirmar sua decisão sobre a demanda <strong>${ticket.title}</strong>:</p>
              <div class="info-box" style="font-size:26px;letter-spacing:6px;text-align:center;"><strong>${code}</strong></div>
              <p>O código é válido por 30 minutos.</p>`,
          },
        },
      });

      if (emailError) {
        console.error("Erro ao enviar codigo por e-mail:", emailError);
        return json({ error: "Nao foi possivel enviar o e-mail com o codigo" }, 502);
      }

      return json({ sent_to: mascararEmail(ticket.solicitante_email) });
    }

    // Valida o codigo e registra a decisao do solicitante.
    if (body.action === "registrar_aprovacao") {
      if (!body.token || !body.code) return json({ error: "Dados obrigatorios faltando" }, 400);

      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .select("id, title, status, solicitante_nome, solicitante_email")
        .eq("token_acompanhamento", body.token)
        .maybeSingle();

      if (ticketError || !ticket) return json({ error: "Demanda nao encontrada" }, 404);
      if (ticket.status !== "aguardando_aprovacao") {
        return json({ error: "Esta demanda nao esta aguardando aprovacao" }, 400);
      }

      const { data: codeRow } = await supabase
        .from("ticket_approval_codes")
        .select("id, code_hash, decision, feedback, expires_at, attempts, email")
        .eq("ticket_id", ticket.id)
        .is("used_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!codeRow) return json({ error: "Nenhum codigo pendente. Solicite um novo codigo." }, 400);

      if (new Date(codeRow.expires_at).getTime() < Date.now()) {
        return json({ error: "Codigo expirado. Solicite um novo codigo." }, 400);
      }

      if (codeRow.attempts >= 5) {
        await supabase
          .from("ticket_approval_codes")
          .update({ used_at: new Date().toISOString() })
          .eq("id", codeRow.id);
        return json({ error: "Muitas tentativas. Solicite um novo codigo." }, 429);
      }

      const informado = await hashCode(ticket.id, String(body.code).trim());
      if (informado !== codeRow.code_hash) {
        await supabase
          .from("ticket_approval_codes")
          .update({ attempts: codeRow.attempts + 1 })
          .eq("id", codeRow.id);
        return json({ error: "Codigo incorreto", attempts_left: Math.max(4 - codeRow.attempts, 0) }, 400);
      }

      await supabase
        .from("ticket_approval_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("id", codeRow.id);

      const aprovado = codeRow.decision === "aprovado";
      const novoStatus = aprovado ? "aprovado" : "em_andamento";

      const { error: statusError } = await supabase
        .from("tickets")
        .update({ status: novoStatus, updated_at: new Date().toISOString() })
        .eq("id", ticket.id);

      if (statusError) {
        console.error("Erro ao registrar decisao:", statusError);
        return json({ error: "Nao foi possivel registrar sua decisao" }, 500);
      }

      await supabase.from("approvals").insert([
        {
          ticket_id: ticket.id,
          approved_by: null,
          status: aprovado ? "approved" : "changes_requested",
          feedback_json: {
            feedback: codeRow.feedback || null,
            email: codeRow.email,
            confirmed_at: new Date().toISOString(),
            source: "portal_solicitante",
          },
        },
      ]);

      await supabase.from("ticket_comments").insert([
        {
          ticket_id: ticket.id,
          user_id: null,
          content_json: comentarioTipTap(
            aprovado
              ? `Demanda aprovada pelo solicitante (${codeRow.email}), com confirmacao por codigo enviado por e-mail.`
              : `Ajustes solicitados pelo solicitante (${codeRow.email}): ${codeRow.feedback}`,
          ),
        },
      ]);

      await supabase.from("ticket_activities").insert([
        {
          ticket_id: ticket.id,
          user_id: null,
          action_type: aprovado ? "approved_by_requester" : "changes_requested_by_requester",
          metadata_json: { email: codeRow.email, feedback: codeRow.feedback },
        },
      ]);

      return json({ status: novoStatus, decision: codeRow.decision });
    }


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
        .select("id, name, logo_url")
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
        company_logo_url: company.logo_url,
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
        .select("id, name, google_drive_folder_id")
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

      // Anexo (opcional). O arquivo segue exclusivamente para a pasta da
      // demanda no Google Drive da empresa. Nao ha fallback para Storage.
      if (attachment?.file_base64) {
        try {
          const { data: driveUpload, error: uploadError } = await supabase.functions.invoke("google-drive-folders", {
            body: {
              action: "upload_file",
              company_id: company.id,
              demand_id: ticket.id,
              file_name: attachment.file_name,
              file_type: attachment.file_type || "application/octet-stream",
              file_content: attachment.file_base64,
            },
          });

          if (uploadError || driveUpload?.error || !driveUpload?.file_id || !driveUpload?.file_url) {
            throw new Error(driveUpload?.error || uploadError?.message || "Falha no envio para o Google Drive");
          }

          const { error: attError } = await supabase.from("ticket_attachments").insert([
            {
              ticket_id: ticket.id,
              file_name: attachment.file_name,
              file_type: attachment.file_type,
              file_url: driveUpload.file_url,
              uploaded_by: null,
              google_drive_file_id: driveUpload.file_id,
              google_drive_folder_id: driveUpload.folder_id,
            },
          ]);

          if (attError) throw attError;
        } catch (attErr: any) {
          console.error("Erro ao anexar arquivo no Google Drive:", attErr);
          // Evita confirmar uma demanda cujo anexo solicitado nao foi salvo.
          // A limpeza inclui a categoria antes do ticket para funcionar mesmo
          // em instalacoes antigas sem ON DELETE CASCADE nessa relacao.
          await supabase.from("ticket_category_assignments").delete().eq("ticket_id", ticket.id);
          const { error: cleanupError } = await supabase.from("tickets").delete().eq("id", ticket.id);
          if (cleanupError) console.error("Erro ao desfazer demanda apos falha no Drive:", cleanupError);
          return json({ error: "Nao foi possivel salvar o anexo no Google Drive. A demanda nao foi enviada." }, 502);
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
