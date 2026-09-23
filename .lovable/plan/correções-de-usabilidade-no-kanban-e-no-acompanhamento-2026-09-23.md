# Correções de usabilidade no Kanban e no acompanhamento

Ajustes de experiência: a tela passa a refletir imediatamente tudo que já é salvo, a navegação horizontal do Kanban fica sempre acessível, e quem comenta pelo link externo passa a ser identificado pelo nome.

## 1. Comentário no card

Hoje o texto continua no campo depois de enviar, porque o editor não é limpo de fato.

- Ao enviar com sucesso, o editor é recriado vazio (o campo fica limpo na hora).
- O comentário novo já aparece na lista do histórico sem fechar o card (o histórico já é recarregado; passa a funcionar junto com a limpeza do campo).
- Botão fica desabilitado enquanto envia e volta ao normal ao final.

## 2 e 3. Status e prazos atualizando na hora

Causa: o card aberto recebe os dados da lista do Kanban. Depois de salvar, a lista é recarregada, mas o card aberto continua exibindo a versão antiga que recebeu quando foi aberto.

- O Kanban passa a guardar apenas o identificador da demanda aberta e a montar o card sempre a partir da lista já atualizada.
- Assim, status, previsão de conclusão, conclusão real e prazo de aprovação aparecem imediatamente após salvar, sem fechar/reabrir nem recarregar a página.
- Nada muda na forma de salvar os dados.

## 4. Datas de abertura e última atualização

- No card aberto: duas informações discretas no topo — "Aberta em dd/MM/yyyy HH:mm" e "Última atualização dd/MM/yyyy HH:mm".
- No cartão do Kanban: a data de abertura junto às demais informações, para controle rápido.

## 5. Barra de rolagem horizontal fixa no Kanban

- A área das colunas passa a ter altura própria dentro da tela, com rolagem vertical dos cartões dentro de cada coluna.
- A barra horizontal fica junto à base da área visível do Kanban, acessível a qualquer momento, sem descer a página.
- Colunas e cartões mantêm o comportamento atual (inclusive arrastar e soltar).

## 6. Identificação de quem comenta pelo link externo

- Na primeira vez que a pessoa vai comentar naquele link, ela informa o nome (e-mail opcional).
- Se o link já tiver solicitante cadastrado, o nome vem preenchido automaticamente e ela só confirma.
- A identificação fica guardada no navegador para aquele link, então não é pedida de novo.
- O comentário passa a aparecer como "Carlos" (e não "Sistema"), tanto no acompanhamento externo quanto no histórico do card interno.

## Detalhes técnicos

**Banco**
- `ticket_comments`: novas colunas `author_name text` e `author_email text` (nulas, aditivas).
- Nova função `add_public_ticket_comment(p_token uuid, p_content text, p_author_name text, p_author_email text)` (SECURITY DEFINER, EXECUTE para anon/authenticated), com as mesmas validações da atual (não vazio, ≤5000) gravando o autor. A `add_ticket_comment_by_token` atual fica marcada como deprecada via `COMMENT ON FUNCTION`, sem ser removida.
- `get_ticket_history_by_token`: drop + recreate (é SECURITY DEFINER) para retornar também `author_name` vindo de `COALESCE(profiles.full_name, ticket_comments.author_name, tickets.solicitante_nome, 'Solicitante')`.

**Frontend**
- `src/components/TipTapEditor.tsx`: tratar `content` nulo/vazio limpando o editor (`clearContent`) no `useEffect`, para o `setNewComment(null)` funcionar.
- `src/components/TicketDetailModal.tsx`: badges de `created_at`/`updated_at`; no histórico usar `item.author_name` como alternativa a `item.user?.full_name` antes de "Sistema".
- `src/pages/Kanban.tsx`: trocar `selectedTicket` por `selectedTicketId` + `tickets.find(...)`; wrapper das colunas com `h-[calc(100vh-…)]`, `overflow-x-auto` no contêiner de altura fixa e `overflow-y-auto` na lista de cada coluna; exibir `created_at` no cartão.
- `src/pages/AcompanharDemanda.tsx`: estado de identificação persistido em `localStorage` (`acompanhar:autor:{token}`), formulário de nome/e-mail antes do primeiro envio, e chamada de `add_public_ticket_comment`.
