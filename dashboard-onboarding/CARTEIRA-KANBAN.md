# Carteira em Kanban — especificação pra implementar

Este documento é o handoff da funcionalidade "Kanban da Carteira", decidida em
conversa com o Pedro. O mockup visual aprovado está em
`mockup-carteira-kanban.html` — abra esse arquivo direto no navegador antes de
implementar. Ele reaproveita o CSS real de `Estilos.html` e reproduz fielmente
a tela de Carteira que já existe hoje (KPIs, toolbar, tabela) — a única coisa
nova é o botão "🗂 Kanban".

## 1. O que é

Um botão na barra de ferramentas da Carteira (ao lado de "🎛 Colunas") que
alterna a tabela de clientes para uma visão em kanban — uma coluna por etapa
do funil de onboarding, cada cliente como um card. **A tabela em si não
muda em nada** — KPIs, busca, filtros de Status/Closer/Marcos, "Somente em
alerta" e colunas configuráveis continuam exatamente como são hoje. O Kanban
é só uma segunda forma de olhar pros mesmos dados.

## 2. As colunas do Kanban já existem no código — não é um conceito novo

As 5 colunas são exatamente a constante `JORNADA_STATUS_VALUES` que já existe
hoje em `Script.html`:

```js
const JORNADA_STATUS_VALUES = ['Pre Onboarding','Welcome','Product Migration','Ready for Activation','Activation & Monitoring']
  .filter(v => ALL_STATUS_VALUES.includes(v));
```

Essa constante já é usada como filtro padrão de Status na Carteira hoje — o
Kanban só precisa agrupar `currentRows()` (ou o resultado de `applyFilters()`)
por `row['Status']`, na mesma ordem de `JORNADA_STATUS_VALUES`. Clientes cujo
`Status` é `Active`, `Accomplished`, `Unaccomplished` ou `New Onboarding` (fora
da jornada ativa) **não entram no Kanban** — isso é decisão de produto, não
limitação técnica: o Kanban é sobre onboarding em andamento, não sobre a
carteira inteira.

## 3. O que cada card mostra

Decidido com o Pedro: só as informações essenciais, sem tentar caber a tabela
inteira num card. Cada card tem:

1. **Nome** (`row['Nome']`)
2. **ID** (`row['Hotmart ID']`, formatado como `#${fmtId(id)}` — reaproveitar
   `fmtId` que já existe em `Script.html`)
3. **GMV** (`row['GMV']`, formatado com `fmtCurrency` — sempre mostrado, mesmo
   que seja `R$ 0` pra quem ainda não ativou)
4. Um **selo de dias na etapa atual**, com o mesmo limiar já definido na
   Central de Atenção (ver `SINAIS-PROATIVOS.md`, sinal 5): "atenção" a partir
   de 15 dias, "crítico" a partir de 30 dias quando a etapa é
   `Ready for Activation` (sinal 1). `Activation & Monitoring` nunca mostra
   selo de alerta — é a etapa final, fica mais tempo por design.
5. Se o cliente tiver algum sinal ativo da Central de Atenção, o mesmo
   **pontinho colorido** (`row-dot`) que já aparece na Carteira hoje — mesma
   cor de severidade, reaproveitando `_sinais` do registro (ver
   `SINAIS-PROATIVOS.md` seção 7 pra como esse campo é montado).

Clicar em qualquer card abre o perfil do cliente — mesma função `openPerfil`
que a linha da tabela já chama hoje (`onclick="openPerfil(${id}, 'carteira')"`).
Lembre-se da correção da seção 2 do `SINAIS-PROATIVOS.md`: o nav deve destacar
"Carteira" ao abrir esse perfil, não importa se veio da tabela ou de um card
do Kanban.

## 4. Onde implementar

- **`Script.html`**:
  - Um novo estado, algo como `state.carteiraView` (`'lista' | 'kanban'`),
    persistido só em memória (não precisa de localStorage — reinicia em
    `'lista'` a cada carregamento, igual o resto do estado de UI da Carteira).
  - O botão "🗂 Kanban" na toolbar de `renderCarteira()`, alternando
    `state.carteiraView` e re-renderizando.
  - Uma função nova, `renderCarteiraKanban(rows)`, que agrupa `rows` por
    `Status` seguindo `JORNADA_STATUS_VALUES`, gera as colunas e os cards.
    Reaproveite os helpers que já existem (`fmtId`, `fmtCurrency`,
    `activationCell` como referência pro selo de dias, `openPerfil`).
  - **Atenção ao bug documentado no README.md (seção 3):** ao montar os cards
    (um `.map()` por coluna, dentro de um `.map()` das colunas), não deixe um
    template literal (crase) aninhado dentro de outro no texto-fonte deste
    arquivo — extraia a função que gera o HTML de um card
    (`kanbanCardHtml(row)`) e a que gera uma coluna inteira
    (`kanbanColHtml(status, rows)`) como funções nomeadas separadas, nunca como
    arrow functions inline dentro de outro template literal.
- **`Estilos.html`**: as classes novas (`.kanban-board`, `.kanban-col`,
  `.kanban-card`, `.kanban-card-days.*` etc.) já estão prontas e testadas no
  `mockup-carteira-kanban.html` — pode copiar direto de lá, só ajustando se
  algo colidir com classe existente.

## 5. O que NÃO fazer

- Não recriar a tabela/KPIs/toolbar da Carteira — eles não mudam, só ganham o
  botão de alternar visão.
- Não incluir clientes fora da jornada ativa (`Active`, `Accomplished`,
  `Unaccomplished`, `New Onboarding`) nas colunas do Kanban.
- Não sobrecarregar o card com mais campos do que Nome, ID, GMV e o selo de
  dias — o Pedro foi específico sobre isso: são as 3 informações principais
  da carteira, mais o selo. Se quiser mais detalhe, é clicar no card e abrir
  o perfil.
