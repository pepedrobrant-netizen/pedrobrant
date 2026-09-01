# Calendário do Time — especificação pra implementar

Este documento é o handoff completo da funcionalidade "Calendário do Time",
decidida em conversa com o Pedro. **Leia isto inteiro antes de escrever
qualquer código** — tem decisões de produto e de permissão, não só de UI.

O mockup visual aprovado está em `mockup-calendario-time.html` — abra esse
arquivo direto no navegador (é estático, com JS puro renderizando o calendário
e os modais) antes de implementar, pra ver exatamente o resultado esperado.
Ele reaproveita o CSS real de `Estilos.html`, então a aparência já bate com o
app de verdade.

**Atenção:** o mockup tem uma barra amarela no topo ("👁 Modo de visualização")
com dois botões (Visão Liderança / Visão Time) — isso é **só uma ferramenta de
comparação pro mockup**, não faz parte da tela final. Ela existe apenas pra
mostrar as duas visões lado a lado durante a aprovação do design. Não replicar
essa barra no app real.

## 1. O que é

Uma tela nova de calendário mensal com os eventos do time (reuniões, 1:1s,
treinamentos, fechamento de meta, eventos gerais). **Visível pra todo mundo**
(onboarders e admins) — só a **criação** de eventos é restrita aos admins
(Amanda e Julia). Quando um evento precisa que alguém preencha uma planilha de
controle, o evento carrega um **link direto** pra essa planilha, mostrado ao
clicar no evento.

## 2. Nova aba de navegação

Nova aba na navegação principal: **"📅 Calendário do Time"**, visível a todos
os usuários (onboarders e admins), sem restrição de acesso — só o conteúdo
interno (botão de criar evento) muda conforme o perfil.

## 3. Modelo de permissão — visão compartilhada, criação restrita

Isso é o ponto mais importante da funcionalidade, e foi corrigido em conversa
depois de uma primeira versão errada (que escondia a aba inteira do time):

- **Todo mundo vê o calendário e todos os eventos do mês**, com os mesmos
  detalhes (título, data, hora, categoria, descrição, link quando houver).
- **Só admins (`CONFIG.ADMINS` → Amanda e Julia) veem o botão "+ Novo
  evento"** e conseguem abrir o formulário de criação. Onboarders (Ilana,
  Pedro, Josiane, Madu) veem o calendário normalmente, sem esse botão.
- Isso é **exatamente o mesmo padrão** já usado hoje em `createMissao` (ver
  `Código.gs`): a função de escrita confere
  `CONFIG.ADMINS.indexOf(autorNome) === -1` e bloqueia quem não é admin; a
  leitura é liberada pra todos. Replicar esse padrão aqui — não inventar um
  mecanismo novo de permissão.
- No mockup, isso é simulado pela função `setViewer('admin'|'time', btn)`,
  que só mostra/esconde o botão `#addEventBtn` e troca a tag da página
  (`#pageTag`). No app real, isso vem do usuário logado de verdade
  (mesma lógica que já decide `autorNome`/admin em outras telas), não de um
  toggle manual.

## 4. Estrutura visual da tela

Duas colunas (`.cal-layout`, grid):

1. **`.cal-card`** (calendário em si):
   - Header com navegação de mês (ex: "◀ Setembro 2026 ▶").
   - Botão "+ Novo evento" (só admin) acima da grade.
   - Grade de dias do mês (`.cal-grid`), com dias vazios de padding no início
     (`leadingEmpty`), o dia de hoje destacado, o dia selecionado destacado
     diferente, e um ou mais pontinhos coloridos (`.cal-dot`) por dia que tem
     evento — uma cor por categoria (ver seção 6).
   - Legenda das categorias abaixo da grade.
2. **`.agenda-card`** ("Próximos eventos"):
   - Lista dos eventos futuros em ordem cronológica, cada linha clicável,
     mostrando dia, título e categoria — clicar abre o mesmo modal de detalhe
     do evento (ver seção 5).

Clicar num dia do calendário com evento(s) também deve mostrar os eventos
daquele dia (no mockup, `onDayClick(day)` seleciona o dia; o comportamento de
"abrir o(s) evento(s) daquele dia" pode reaproveitar o mesmo modal de detalhe
— se houver mais de um evento no dia, listar os dois antes de abrir o
detalhe, ou abrir direto se só houver um).

## 5. Modal de detalhe do evento (clique em qualquer evento)

Ao clicar num evento (seja pela grade do calendário, seja pela lista de
"Próximos eventos"), abre um modal (`#eventModalOverlay` no mockup) com:

- Badge da categoria (cor + label, ex: "🟠 Reunião de time").
- Título do evento.
- Data (e hora, se houver).
- Descrição (se houver).
- **Link da planilha — só aparece se o evento tiver um link cadastrado.**
  Quando não tem, essa seção do modal simplesmente não é renderizada (não
  mostrar um campo vazio ou "sem link"). No mockup isso é o bloco
  `#evLinkBox`, escondido/mostrado conforme `e.link` ser `null` ou um objeto
  `{label, url}`.

Esse comportamento condicional é o motivo de existir um campo de link no
evento — nem todo evento precisa de planilha (ex: "Reunião de time" semanal
não precisa, mas "Fechamento parcial de metas" precisa do link da planilha de
controle de metas).

## 6. Categorias (decidido com o Pedro)

Uma categoria genérica **"Evento"** substitui o que antes seria "Hotmart
Cast" — a categoria não deve ser hiperespecífica a um tipo de evento
recorrente, e sim um balde genérico pra eventos que não se encaixam nas
outras quatro. O nome do evento específico (ex: "Hotmart Cast — Trend Moda
Feminina") continua indo no campo **Título**, só a categoria que é genérica.

| Categoria | Cor | Uso |
|---|---|---|
| Reunião de time | 🟠 laranja | Reuniões recorrentes do time todo |
| 1:1 | ⚪ cinza/neutro | Conversas individuais |
| Evento | 🔵 azul | Qualquer evento pontual (lives, cast, treinamento externo etc. que não seja treinamento interno formal) |
| Fechamento-Meta | 🟢 verde | Datas de fechamento de metas/período |
| Treinamento | 🟣 roxo | Treinamentos internos do time |

As cores exatas (`--status-*` ou variáveis dedicadas) já estão validadas no
CSS do mockup (classes `.cal-dot.reuniao`, `.cal-dot.um-a-um`,
`.cal-dot.evento`, `.cal-dot.meta`, `.cal-dot.treinamento` — nomear conforme o
que já está no mockup, ajustando se colidir com algo existente em
`Estilos.html`).

## 7. Formulário de criação de evento (só admin)

Modal separado (`#newEventOverlay` no mockup), acessível só pelo botão "+
Novo evento" (que só aparece pra admin — seção 3). Campos:

- **Título** (texto, obrigatório).
- **Data** e **Hora** (hora é opcional — nem todo evento tem horário fixo).
- **Categoria** (select com as 5 opções da seção 6).
- **Descrição** (textarea, opcional).
- **Link da planilha** (campo url, **opcional**, com texto de apoio
  explicando que é o link pra planilha de controle daquele evento, quando
  aplicável — ex: fechamento de meta, relatório mensal). Este é o campo que
  alimenta a seção condicional do modal de detalhe (seção 5).
- Botão "Salvar evento".

## 8. Dado removido — não recriar

Uma versão anterior do mockup tinha uma seção separada "Planilhas de
controle" (grid de cards com links fixos, fora do calendário). **O Pedro
pediu pra remover** ("Pode tirar, não gostei") depois de questionar pra que
servia — a decisão final foi que o link por evento (seção 5) já cobre esse
caso de uso, sem precisar de uma seção redundante. **Não recriar essa seção**
ao implementar.

## 9. Onde implementar

- **`Código.gs`**:
  - Uma aba nova na planilha pra guardar os eventos (seguindo o padrão já
    usado pra Missões/Overlay CRM — uma aba dedicada, uma linha por evento,
    colunas: `id`, `titulo`, `data`, `hora`, `categoria`, `descricao`,
    `linkLabel`, `linkUrl`, `autor`, `criadoEm`).
  - `getEventosData_()`: lê a aba e devolve a lista de eventos — **sem
    restrição de leitura**, qualquer usuário autenticado pode chamar.
  - `createEvento_(dados, autorNome)`: grava um evento novo — **gated por
    admin**, mesmo padrão de `createMissao`:
    ```js
    if (CONFIG.ADMINS.indexOf(autorNome) === -1) {
      throw new Error('Apenas administradores podem criar eventos.');
    }
    ```
  - Validar que `data` é uma data válida e que `linkUrl`, se preenchido, é
    uma URL (validação simples, não precisa ser rígida).
- **`Script.html`**:
  - Função de render do calendário mensal (grade de dias, navegação de mês,
    pontinhos por categoria) e da lista "Próximos eventos" — reaproveitar os
    padrões de card/modal já existentes no arquivo.
  - Os dois modais (detalhe do evento e criação de evento), reaproveitando o
    padrão `.modal-overlay`/`.modal-card` já usado em outras telas.
  - Lógica de mostrar/esconder o botão "+ Novo evento" conforme o usuário
    logado ser admin (mesma checagem que já existe hoje pra outras ações
    restritas a admin).
  - **Lembre-se do bug documentado no README.md (seção 3): nunca escrever um
    template literal (crase) aninhado dentro de outro no texto-fonte deste
    arquivo** — extraia qualquer `.map(x => \`...\`)` que fique dentro de
    outro template literal (por exemplo, ao montar as células do calendário
    ou a lista de eventos do dia) pra uma função nomeada separada, senão o
    Apps Script quebra em produção (tela branca, sem erro visível).
- **`Estilos.html`**: as classes novas de CSS (`.cal-layout`, `.cal-card`,
  `.cal-grid`, `.cal-dot.*`, `.cal-add-btn`, `.agenda-card`, `.agenda-list`,
  `.agenda-row` etc.) já estão prontas e testadas no
  `mockup-calendario-time.html` — pode copiar direto de lá pro `Estilos.html`
  real, só ajustando se algo colidir com uma classe existente (confira antes,
  o arquivo real já é grande).
- **Navegação** (`Index.html`/`Script.html`, onde quer que os nav-tabs sejam
  montados hoje): adicionar a aba "📅 Calendário do Time" à lista de abas,
  sem restrição de visibilidade (visível a todos os perfis).

## 10. O que NÃO fazer

- Não esconder a aba do calendário pra quem não é admin — só o botão de
  criar evento é restrito, a visualização é de todo o time.
- Não recriar a seção "Planilhas de controle" separada (seção 8) — o link
  por evento já cobre isso.
- Não mostrar a seção de link no modal de detalhe quando o evento não tem
  link cadastrado (nada de campo vazio ou placeholder "sem link").
- Não usar "Hotmart Cast" como categoria — é "Evento" (genérico); o nome
  específico do evento vai no título.
- Não replicar a barra amarela "Modo de visualização" do mockup — ela é só
  uma ferramenta de comparação pra aprovação do design, não faz parte do
  app real (a visão certa vem do usuário logado).
