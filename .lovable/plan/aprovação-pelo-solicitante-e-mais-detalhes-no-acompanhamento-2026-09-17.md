# Aprovação pelo solicitante e mais detalhes no acompanhamento

## 1. Mais informações na tela de acompanhamento
- Novo bloco **Checklist**: itens da demanda em modo leitura, com barra de progresso e contagem (ex.: 3/5 concluídos).
- Novo bloco **Demandas vinculadas**: protocolo, título e etapa (com as cores do Kanban) de cada demanda ligada a esta. Sem link para dados internos.
- Tudo entregue pelo mesmo caminho protegido por token já usado pelos anexos.

## 2. Prazo de aprovação (lado da equipe)
- Ao mover a demanda para **Aguardando aprovação**, quem atende informa o prazo para o cliente responder (data e hora).
- O prazo aparece na tela interna da demanda e pode ser alterado enquanto a demanda estiver aguardando aprovação.
- Se o prazo passar sem resposta, a demanda é automaticamente marcada como **Concluído**, com registro no histórico ("Aprovação automática por decurso de prazo"). A verificação roda de hora em hora no servidor.

## 3. Aprovação pelo solicitante na tela de acompanhamento
Quando a demanda estiver em "Aguardando aprovação", aparece um painel de aprovação:
1. O solicitante escolhe **Aprovar** ou **Solicitar ajustes** (com observação obrigatória).
2. Clica em "Enviar código": um código de 6 dígitos é enviado para o e-mail cadastrado na abertura da demanda, válido por 30 minutos.
3. Ao digitar o código correto, a decisão é registrada: aprovar move para **Aprovado**; solicitar ajustes volta para **Em andamento** com a observação no histórico.
- Cada decisão fica registrada com data, hora, e-mail confirmado e código usado, e gera uma mensagem no histórico visível para as duas partes.
- Código errado ou expirado mostra mensagem clara; máximo de 5 tentativas por código.
- Fora da etapa de aprovação, o painel mostra apenas o resultado já registrado.

## Detalhes técnicos
- Migração: `tickets.approval_deadline timestamptz`, `tickets.auto_approved_at timestamptz`; nova tabela `ticket_approval_codes` (ticket_id, email, code_hash, expires_at, attempts, used_at) com RLS restrita (somente service_role/admin), GRANTs explícitos; nova tabela ou reuso de `approvals` para gravar a decisão do solicitante; função + job pg_cron horário para concluir demandas com prazo vencido em `aguardando_aprovacao`.
- Edge function `demanda-publica`: novas ações `detalhes` (checklist + demandas vinculadas), `solicitar_codigo_aprovacao` (gera código, envia por `send-email` com template novo) e `registrar_aprovacao` (valida código/tentativas/expiração, atualiza status, insere comentário e `ticket_activities`).
- `get_ticket_by_token` estendida para devolver `approval_deadline` e a última decisão registrada.
- Front: novos blocos em `src/pages/AcompanharDemanda.tsx` (checklist, vinculadas, painel de aprovação) e campo de prazo de aprovação em `src/components/TicketDetailModal.tsx`.
- O código nunca é armazenado em texto puro; apenas hash.

## Validação
- Demanda em aprovação: pedir código, testar código inválido, expirado e válido; conferir mudança de etapa e histórico.
- Demanda com e sem checklist e com e sem vínculos.
- Prazo vencido: conferir conclusão automática e registro no histórico.
