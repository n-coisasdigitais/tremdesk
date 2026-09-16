# Acompanhamento de demanda personalizado

## O que será feito
- Reorganizar a página de acompanhamento em um visual de portal, inspirado no Pipefy: cabeçalho da empresa, resumo da demanda, progresso e área de conversa.
- Mostrar a etapa atual com as mesmas cores usadas no Kanban e uma linha visual das etapas principais.
- Exibir os anexos existentes em uma seção própria, com nome, tipo, data e botão para abrir.
- Mostrar o nome e a logo da empresa em um canto do cabeçalho; quando não houver logo, usar as iniciais da empresa.
- Manter a previsão, conclusão real, histórico e envio de mensagens já existentes, reorganizados para melhorar leitura e uso em celular e computador.

## Segurança e dados
- Ampliar somente a consulta pública protegida pelo token da demanda para retornar a logo da empresa e a lista de anexos daquela demanda.
- Para arquivos do armazenamento privado, gerar links temporários pelo fluxo protegido; links do Google Drive continuam abrindo na origem.
- Não expor IDs internos, dados de outras demandas ou controles administrativos.

## Validação
- Conferir demanda com e sem logo, com e sem anexos, em computador e celular.
- Validar abertura dos anexos e envio de uma nova mensagem no histórico.
