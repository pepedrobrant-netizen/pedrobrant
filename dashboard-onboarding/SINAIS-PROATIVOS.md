# Central de Atenção — especificação pra implementar

Este documento é o handoff completo da funcionalidade "Central de Atenção"
(sinais proativos), decidida em conversa com o Pedro. **Leia isto inteiro antes de
escrever qualquer código** — tem decisões de produto, não só de UI, e várias delas
mudam a arquitetura de navegação atual.

O mockup visual aprovado está em `mockup-central-atencao.html` — abra esse arquivo
direto no navegador (é estático, com um toggle funcional em JS puro) antes de
implementar, pra ver exatamente o resultado esperado. Ele reaproveita o CSS real de
`Estilos.html`, então a aparência já bate com o app de verdade.

## 1. O que é

Uma tela nova que resume, pra cada onboarder, quem da carteira dele precisa de uma
ação **agora** — calculado a partir de regras sobre os dados reais (não é uma lista
manual). Cada cliente com pelo menos um sinal ativo aparece como **um card**,
agrupado visualmente por severidade (Crítico / Atenção / Oportunidade).

## 2. Mudança na navegação (decisão de produto, não só visual)

**A aba "Perfil do Cliente" deixa de ser uma galeria de fotos como tela padrão.**
Ela virou redundante: clicar num cliente na Carteira já abre o perfil dele
diretamente (Cronograma/CRM/Saúde) — não precisa de uma segunda tela só pra
"escolher" um cliente antes de ver os dados.

A solução, decidida com o Pedro: a aba que hoje é "👤 Perfil do Cliente" na
navegação vira **"🔔 Central de Atenção"**, mesma posição (2ª aba). O conteúdo dela:

- **Por padrão**, mostra a Central de Atenção (a grade de cards de sinais).
- Um **toggle no topo** ("🔔 Central de Atenção" / "🔍 Buscar cliente") alterna pra
  a galeria antiga (grid de fotos + busca), que continua existindo — só deixou de
  ser o que abre primeiro.
- Clicar num card da Central de Atenção, ou num cliente da galeria, abre o mesmo
  destino de sempre: o perfil detalhado (as abas Cronograma/CRM/Saúde que já
  existem hoje em `Script.html`/`Estilos.html`).

A Carteira (`renderCarteira`/tabela) continua existindo like hoje, sem mudança
estrutural — só ganha um indicador visual leve (ver seção 4).

**Correção importante (decidida com o Pedro depois do mockup): o perfil do
cliente NÃO pertence à Central de Atenção.** Ele pertence à Carteira — todo
cliente tem perfil (Cronograma/CRM/Saúde), tenha sinal ativo ou não. Se o
destaque de navegação ficar preso em "Central de Atenção" toda vez que um
perfil é aberto, fica repetitivo (o perfil já mostra os sinais dele, não
precisa duplicar o contexto) e fica sem sentido pra um cliente sem nenhum
sinal ativo — ele não é "sobre atenção".

Regra de destaque do nav ao abrir um perfil, **não importa a origem**:
- Cliente aberto pela Carteira → nav destaca **Carteira**.
- Cliente aberto por um card da Central de Atenção → nav destaca **Carteira**
  também, não "Central de Atenção" — o perfil é conteúdo da Carteira, a
  Central de Atenção só foi o caminho até ele.
- "Central de Atenção" como aba só fica destacada enquanto a pessoa está na
  própria grade de sinais (ou na galeria "Buscar cliente"), nunca dentro de
  um perfil aberto.

Na prática, isso é só o estado de qual `nav-tab` recebe a classe `.active` —
não muda o conteúdo do perfil em si, nem duplica nada. O bug a evitar é: não
existe um estado tipo `state.screen === 'atencao'` cobrindo tanto a grade
quanto o perfil aberto a partir dela — são dois estados de tela diferentes
(`'atencao'` para a grade, `'perfil'`/o que já existir para o perfil), e o
`nav-tab` que fica ativo depende só de qual dos dois é o estado atual.

## 3. Regra de agregação: 1 card por cliente, nunca por sinal

Um cliente pode ter mais de um sinal ativo ao mesmo tempo (ex: meta em risco **e**
aniversário chegando). **Nunca duplicar o cliente em vários cards.** Regra:

- A **cor da borda e a tag** do card (`Crítico`/`Atenção`/`Oportunidade`) refletem
  sempre o **sinal mais grave** que o cliente tem (Crítico > Atenção > Oportunidade).
- O sinal principal (o mais grave) vira o texto de destaque do card.
- Sinais adicionais (menos graves) entram como linhas extras, empilhadas, separadas
  por uma linha pontilhada, cada uma com um pontinho colorido próprio — ver o card
  da "Ana Beatriz Ferreira" no mockup (tem os dois sinais dela juntos).
- O contador de resumo ("5 clientes", "Crítico · 2" etc.) conta **clientes com
  aquele sinal como o mais grave** (ou pelo menos como presença — a implementação
  específica de contagem pode ser: cada pill conta quantos clientes têm PELO MENOS
  um sinal daquela severidade, e o "Todos" é a união, não a soma).

## 4. Onde os sinais aparecem (3 lugares, mesmo dado)

1. **Central de Atenção** (tela nova): grade de cards, como descrito acima.
2. **Carteira** (tabela existente): um pontinho colorido de 8px ao lado do nome do
   cliente na coluna de nome — mesma cor de severidade, com `title` explicando o
   motivo no hover. Sem pontinho = sem sinal ativo. Ver a tabela no mockup.
3. **Perfil do Cliente** (tela de detalhe, já existente): os sinais do cliente
   aparecem como cards expandidos, com uma descrição completa e um botão de ação
   sugerida (ex: "Registrar ação de recuperação"). Isso pode entrar como uma nova
   seção no topo do perfil, antes das abas Cronograma/CRM/Saúde, ou como uma aba
   nova — critério de vocês, o mockup só mostra o conteúdo, não decide onde
   encaixar estruturalmente.

## 5. As regras de cada sinal (decidido com o Pedro)

Todos os campos citados como "SF On"/calculados já existem hoje em
`readPortfolioRows_`/`getFullPortfolioData_` em `Código.gs`. Os campos de "CRM" já
existem no schema do Overlay (`OVERLAY_HEADERS`). Os de "SF VD" precisam de uma
extensão (ver seção 6 — **gaps de dado**, leia antes de implementar os sinais 3 e 8).

| # | Sinal | Severidade | Regra | Fonte |
|---|---|---|---|---|
| 1 | Não ativou a tempo | 🔴 Crítico | `Status == "Ready for Activation"` e `Days carteira > 30` | SF On |
| 2 | Fora do ritmo da meta | 🔴 Crítico | Já ativado (tem `Ativação` preenchida) e `% atingido` < metade do ritmo esperado, onde ritmo esperado = `Dias ativado ÷ 90`. Ex: aos 60 dias o ritmo esperado é 66%; crítico se `% atingido` < 33% | SF On (calculado) |
| 3 | Sem contato | 🔴 Crítico | Mais de 14 dias desde a data em `Last Activity` (aba `[SF] VD`) | SF VD — **gap, ver seção 6** |
| 4 | Brinde não enviado | 🔴 Crítico | O cliente já passou da fase Welcome (`Status` é `Product Migration`, `Ready for Activation`, `Activation & Monitoring`, `Active` ou `Accomplished` — **não** `Pre Onboarding`/`New Onboarding`/`Welcome`) **e** o campo `brinde` do CRM está vazio | CRM (`brinde`) |
| 5 | Parado na etapa | 🟡 Atenção | `Days carteira > 15` **no mesmo Status atual**, **exceto** quando `Status == "Activation & Monitoring"` (é a etapa final, fica mais tempo por design, não é sinal de problema) | SF On — **gap parcial, ver seção 6** |
| 6 | Vendas caindo 🧪 | 🟡 Atenção (**ilustrativo**) | Ainda não há dado real (viria de uma integração futura com o Astrobox). Por enquanto, gerar de forma **determinística** (mesmo padrão de `simpleHash_`/`illustrativeFields_` que já existe em `Código.gs` pra outros campos ilustrativos — nunca aleatório a cada carregamento) e **marcar visualmente como protótipo** (🧪), igual já é feito na aba Analytics hoje, pra ninguém confundir com dado real | Ilustrativo |
| 7 | Aniversário | 🔵 Oportunidade | `aniversario` (CRM) cai nos próximos 7 dias a partir de hoje | CRM |
| 8 | Ação de relacionamento agendada | 🔵 Oportunidade | Existe uma entrada em `relacExtra` (CRM — a lista de "Ações de relacionamento") com **data futura**, a 3 dias ou menos de acontecer | CRM (`relacExtra`) |
| 9 | Marco de dias | 🔵 Oportunidade | `Dias ativado` bate exatamente (ou no dia da checagem) em 30, 60 ou 90 | SF On (calculado) |
| 10 | Case de sucesso | 🔵 Oportunidade | `% atingido` bem acima do ritmo esperado — mesma lógica do sinal 2, mas invertida: ex. 90%+ de `% atingido` já aos 60 `Dias ativado` (ritmo esperado seria 66%) | SF On (calculado) |

## 6. Gaps de dado — resolver antes de implementar os sinais 3 e 5

- **Sinal 3 (sem contato)**: hoje `readVdCounts_` em `Código.gs` só **conta** linhas
  da aba `[SF] VD` por Hotmart ID (`sheet.getRange(2, 1, lastRow - 1, 1)` — só lê a
  coluna A). Precisa ser estendido pra também ler a coluna **`Last Activity`** dessa
  aba e guardar, por Hotmart ID, a **data mais recente** (não só a contagem).
  **Antes de codar**: confirme com o Pedro (ou olhando a planilha real) qual é o
  índice/letra exata da coluna `Last Activity` na aba `[SF] VD` — não estava mapeada
  até agora, só a coluna A (Hotmart ID) é usada hoje.
- **Sinal 5 (parado na etapa)**: não existe hoje um campo "há quantos dias está no
  Status atual" — só `Days carteira` (desde que entrou na carteira) e
  `Dias ativado` (desde a ativação). Pro sinal 1 e pro sinal 5, a decisão foi usar
  `Days carteira` como aproximação (razoável pras fases antes da ativação, já que
  nelas o cliente ainda não tem `Dias ativado` preenchido). O Pedro confirmou que
  esse número (15 dias) é provisório — ele vai extrair dados reais de duração por
  etapa depois e ajustar. Deixe o limiar como uma constante fácil de achar (ex.
  `SINAL_PARADO_ETAPA_DIAS = 15` no topo do arquivo), não espalhado no código.

## 7. Onde implementar

- **`Código.gs`**: uma função nova, algo como `calcularSinais_(registro, hoje)`,
  chamada dentro de `getFullPortfolioData_` (ou logo depois, iterando o resultado
  dela) — recebe um registro de cliente (o mesmo objeto que `readPortfolioRows_` já
  monta) mais o overlay de CRM dele (`getOverlayData_()[hotmartId]`), e devolve uma
  lista de sinais ativos (`[{ severidade, tipo, titulo, detalhe, ilustrativo }]`,
  por exemplo). Isso populam um novo campo no registro, tipo `"_sinais"`, que o
  front-end usa pra: (a) montar os cards da Central de Atenção, (b) decidir a cor do
  pontinho na Carteira, (c) montar os cards de sinal no Perfil do Cliente.
- **`Script.html`**: função de render nova pra tela Central de Atenção (grade de
  cards + toggle pra galeria), reaproveitando os padrões de card já existentes no
  arquivo (ver `perfilGaleriaCardHtml`, `carteiraRowHtml` como referência de estilo
  de função). **Lembre-se do bug documentado no README.md (seção 3): nunca escrever
  um template literal (crase) aninhado dentro de outro no texto-fonte deste
  arquivo** — extraia qualquer `.map(x => \`...\`)` que fique dentro de outro
  template literal pra uma função nomeada separada, senão o Apps Script quebra em
  produção (tela branca, sem erro visível).
- **`Estilos.html`**: as classes novas de CSS (`.attn-*`, `.row-dot`, `.signal-*`,
  `.view-toggle`, `.galeria-*` etc.) já estão prontas e testadas no
  `mockup-central-atencao.html` — pode copiar direto de lá pro `Estilos.html` real,
  só ajustando se algo colidir com uma classe existente (confira antes, o arquivo
  real já é grande).
- **Navegação** (`Index.html`/`Script.html`, onde quer que os nav-tabs sejam
  montados hoje): trocar o rótulo/roteamento da 2ª aba de "Perfil do Cliente" pra
  "Central de Atenção", com a lógica de toggle interno descrita na seção 2.

## 8. O que NÃO fazer

- Não misturar o sinal ilustrativo (vendas caindo) com os reais sem marcação visual
  — isso quebra a confiança no resto do painel.
- Não remover a capacidade de buscar/abrir qualquer cliente da carteira (a galeria
  antiga continua existindo, só não é mais a tela padrão).
- Não hardcodar os limiares (14 dias, 15 dias, 30 dias, 7 dias) espalhados pelo
  código — centralize como constantes, o Pedro já avisou que vai querer ajustar
  pelo menos o de "parado na etapa" assim que tiver os dados reais de duração.
