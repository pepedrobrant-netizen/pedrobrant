# Dashboard Onboarding — publicar no Google Apps Script

Este app foi montado seguindo à risca a especificação de produto e a arquitetura de
dados originais (schema de campos da `SF On`/`SF VD`, dedup por Hotmart ID,
campos calculados, as 5 telas, identidade visual Hotmart) e, depois, **redesenhado
em cima de um mockup de UI/UX aprovado** que você enviou — mesma folha de estilo,
estrutura de telas e componentes do mockup, com a fiação de dados trocada pra
`Código.gs`/`google.script.run` de verdade em vez de dados estáticos em memória.
São 6 arquivos: `Código.gs`, `Index.html`, `Estilos.html`, `Script.html` e
`appsscript.json` compõem o app; `Diagnostico.gs` não é referenciado pelo `doGet`,
só ajuda a testar a configuração pelo editor antes de publicar. O `Index.html` foi
dividido em três (`Index`/`Estilos`/`Script`) porque o Apps Script trava (tela
branca) quando um arquivo processado como template fica grande demais — ver seção 3
pra entender por quê e o que ainda falta investigar.

O mockup trouxe uma amostra de dados reais da planilha, o que confirmou os nomes de
campo exatos — em português, com espaços e acentos (`"Hotmart ID"`, `"GMV"`,
`"Amount real*"` etc.) — em vez das chaves em camelCase que eu tinha usado numa
primeira versão. `Código.gs` já usa esses nomes exatos na saída de
`getFullPortfolioData_`, então o front-end lê os campos direto, sem nenhuma camada de
tradução no meio.

Antes de qualquer coisa: **a prévia local** (`preview.html`, já enviada nesta
conversa) mostra a interface inteira com dados fictícios, sem tocar em nenhuma
planilha real — abra no navegador, senha `preview123`. Ela existe só pra você validar
o produto; **não é o arquivo que vai pro Apps Script**.

## 1. Mapeamento de campos (confirmado pelo mockup)

- **Mapeamento de colunas da `SF On`**: está em `Código.gs`, objeto `COL` (0-based,
  comentado com a letra da coluna ao lado). Se algo mudou na planilha desde a última
  vez, é só esse objeto que precisa de ajuste.
- **Nomes das abas**: `SF On` e `SF VD` — **sem colchetes** (a especificação original
  dizia `[SF] On`/`[SF] VD`, mas ao abrir a planilha real "Gestão de carteira
  unificada" pelo link que você mandou, as abas estão nomeadas só `SF On`/`SF VD`,
  sem colchetes; já ajustei o `CONFIG.SHEET_ON`/`CONFIG.SHEET_VD` do `Código.gs` pra
  bater com isso). A busca continua passando por `findSheetByName_`, que normaliza
  caracteres invisíveis — útil se o nome ganhar um espaço extra no futuro, mas não
  teria resolvido essa diferença de colchetes sozinha.
- **Dedup**: última linha de cada Hotmart ID vence — em `readPortfolioRows_`.
- **Campos calculados**: fórmulas de `"Amount real*"`, `"% atingido"`, `"% amount"`,
  `"Dias ativado"` — mesma definição de sempre, só a chave de saída mudou de
  `amountReal`/`pctAtingido`/... pra essas strings exatas.
- **Campo novo**: `"Responsavel"` — nome do consultor (Madu/Pedro/Josiane/Ilana),
  preenchido automaticamente por `getFullPortfolioData_` a partir do grupo em que o
  registro caiu (o mesmo `Owner First Name` que já era usado só pro filtro).

### Validado direto contra a planilha real

Você compartilhou o link da "Gestão de carteira unificada" e eu baixei uma cópia
(via Google Drive) só pra conferir a estrutura — não gravei nada nela, e não guardei
os dados dos clientes em nenhum lugar deste repositório. Resultado:

- As 27 colunas mapeadas em `COL` (`Código.gs`) batem **exatamente** com os
  cabeçalhos reais da aba `SF On` (`Hotmart ID`, `Onboarding: Name`, `GMV BRL after
  closed won`, `Closed Date`, ..., `Owner First Name` na coluna AB) — nenhum ajuste
  de índice foi necessário.
- `Owner First Name` tem só os 4 valores esperados: `Madu`, `Pedro`, `Josiane`,
  `Ilana` — o agrupamento por carteira funciona sem "sobras".
- Existem **26 Hotmart IDs duplicados** na planilha real (oportunidades reabertas) —
  confirma que a regra "última linha vence" em `readPortfolioRows_` é necessária, não
  só uma precaução teórica.
- Os valores de `Status` incluem dois que não estavam na lista original —
  `New Onboarding` e `Active` — além dos que já eram esperados. Não fazem parte da
  "jornada ativa" (`STATUS_JORNADA_ATIVA`), então não mudam o filtro padrão, mas
  aparecem nas opções de filtro de Status normalmente.
- **A única divergência real**: os nomes das abas não têm colchetes (ver item acima).
  Foi a única correção de fato necessária depois de testar contra os dados reais.

Não validei ainda a aba `App - Overlay CRM`/`App - Missões` contra nada (elas são
criadas do zero pelo próprio app, na planilha vinculada ao script, não na "Gestão de
carteira unificada") nem testei a leitura ao vivo via Apps Script propriamente dita
(isso só dá pra confirmar depois de publicar e rodar `testarLeituraPlanilha` — ver
checklist abaixo) — o que fiz aqui foi conferir a estrutura da planilha de origem
com uma ferramenta de fora do Apps Script.

## 2. CRM e Missões — redesenhados pro schema do mockup

O mockup define um CRM bem mais rico do que a primeira versão deste app tinha:
telefone, e-mail, endereço, aniversário, "vai a evento", contrato, brinde, meta de
faturamento, Hotmart Cast (+ data/hora), equipe do cliente (contatos além do
responsável/SDR), histórico de ações (somativo, computado dos campos reais da
planilha) e ações de relacionamento (notas livres com data). Nenhum desses campos
existe na `SF On`/`SF VD` — como antes, ficam numa aba própria (`App - Overlay
CRM`), na planilha **vinculada a este script** (não na `Gestão de carteira
unificada`), criada automaticamente na primeira gravação. Isso preserva a regra
"nunca escrever na planilha do Salesforce" e dá um lugar real pra esses dados
persistirem. Fotos ficam no Google Drive (pasta própria, criada automaticamente), não
na planilha — só o ID do arquivo fica salvo, e as imagens são servidas de volta como
base64 (nunca por um link público do Drive), pra não abrir uma superfície de acesso
nova.

Missões também mudaram de formato: cada missão tem um `destinatario` (`"todos"` ou o
nome de um onboarder) e um mapa `completions` (`{ "Madu": true, ... }`) — mais simples
que o modelo anterior de lista de atribuições, e permite desmarcar uma missão
concluída por engano (o mockup faz isso).

## 3. Estado atual da investigação do "travamento em tela branca" (31/ago)

**Isto substitui qualquer teoria anterior sobre GCP customizado, Tela de
Consentimento OAuth, Controle de Acesso a Apps, cookies de terceiros ou múltiplas
contas — todas foram testadas e descartadas nesta sessão.** Ficam registradas aqui só
pra não repetir esse trabalho.

### O que foi definitivamente descartado (testado, não é isso)

- Extensão de navegador, pop-up bloqueado, política de TI da máquina, DevTools
  desabilitado — testado em computador da empresa, computador/celular pessoal, e
  com outra pessoa (usando cópia própria do código, conta própria): mesmo resultado
  em todos.
- Bloqueio geral do Workspace a apps não verificados — descartado porque projetos
  de teste **menores**, na mesma conta/domínio, publicam e abrem normalmente.
- Escopo do Google Drive (upload de fotos) — descartado com um teste específico
  (app sem nenhuma chamada a `DriveApp`, mesmo resultado).
- Acesso à planilha (`SpreadsheetApp.openById`) isolado — funciona perfeitamente
  sozinho, inclusive com os 1102 registros reais.
- A ponte `google.script.run` isolada — funciona perfeitamente sozinha.
- Demora de execução do `doGet` (~15s pra montar a página) — testado com
  `Utilities.sleep(15000)` forçado, não é isso.
- Tamanho puro da resposta HTML — testado com 60KB+ de HTML estático
  (`HtmlService.createHtmlOutput`), funciona sem problema.
- Projeto Apps Script "corrompido" por várias reimplantações — descartado: um
  projeto **novo, do zero**, com os mesmos 4 arquivos, reproduz o mesmo travamento.
- Nomes das abas de origem: **são `[SF] On` / `[SF] VD`, COM colchetes** — a versão
  anterior deste README dizia o contrário (`SF On`/`SF VD` sem colchetes); isso
  estava errado e já foi corrigido em `Código.gs` (`CONFIG.SHEET_ON`/`SHEET_VD`).
  Não mexer nisso de novo sem reconferir a planilha real primeiro.
- `getOverlaySheet_`/`getMissoesSheet_` usavam `SpreadsheetApp.getActiveSpreadsheet()`,
  que retorna `null` num script avulso (não vinculado a uma planilha) — bug real,
  já corrigido: agora usam a mesma planilha aberta por `PORTFOLIO_SHEET_ID`
  (`getPortfolioSpreadsheet_()`). Não é a causa do travamento, mas precisava ser
  corrigido de qualquer forma.

### Um bug real, confirmado e corrigido: template literals aninhados

Usando testes de controle (mesmo conteúdo, mesmo tamanho em bytes, variando só uma
coisa por vez, e comparando resultado de implantações reais no Apps Script — não só
teoria), foi isolado e comprovado: **o `HtmlService` do Apps Script quebra
silenciosamente (tela branca, sem nenhum erro visível, nem no console do
navegador) quando o arquivo processado por `createTemplateFromFile`/`evaluate()`
contém, em algum lugar do seu texto-fonte, um template literal (crase) aninhado
dentro de outro** — por exemplo:

```js
// QUEBRA o Apps Script (crase de dentro aninhada dentro da crase de fora):
el.innerHTML = `<div>${arr.map(x => `<span>${x}</span>`).join('')}</div>`;

// Não quebra (mesma saída final, sem aninhamento no texto-fonte):
function itemHtml(x) { return `<span>${x}</span>`; }
el.innerHTML = `<div>${arr.map(itemHtml).join('')}</div>`;
```

Isso foi comprovado com um teste de tamanho igual (mesmos bytes, um com
aninhamento e outro sem) — só a versão aninhada travava. O `Script.html` tinha 45
ocorrências desse padrão (espalhadas em telas de Rotina, Missões, Carteira, Meta
etc.) — todas foram corrigidas nesta sessão, extraindo cada trecho aninhado pra uma
função nomeada separada (`profileCardHtml`, `rotinaDayCardHtml`, `carteiraRowHtml`
etc.), sem nenhum aninhamento restante (validado com `node --check` e um scanner
próprio de profundidade de aninhamento).

**Essa correção é real e deve ficar** — mas sozinha **não resolveu** o travamento.

### O mistério que ainda falta resolver: um segundo limite, esse de tamanho puro

Depois da correção acima, o app completo (`Código.gs` real + `Index.html` +
`Estilos.html` + `Script.html` de ~119KB, sem nenhum aninhamento) **ainda trava em
tela branca** — tanto com dados reais da planilha quanto com dados vazios
forçados (então não são os dados). Isolando o `Script.html` sozinho (sem depender
do `Índex.html` de produção, usando um `Índex.html` de diagnóstico mínimo que só
inclui `Script.html` e define `PORTFOLIOS`/`OVERLAY_DATA`/`missions`/`BOOT_ERROR`
vazios na mão, publicado como Web App de verdade — não é suficiente testar local):

| Tamanho do `Script.html` testado | Resultado |
| --- | --- |
| ~5,4 KB (94 linhas) | ✅ funciona |
| ~9,7 KB (194 linhas) | ✅ funciona |
| ~10,8 KB (218 linhas, mas essa tinha aninhamento — já corrigido) | ❌ (motivo já resolvido) |
| ~11 KB, sem aninhamento (controle) | ✅ funciona |
| **~27,5 KB (531 linhas, arquivo já corrigido)** | **⏳ teste pendente — foi disparado mas o resultado nunca voltou** |
| ~58 KB (1105 linhas, arquivo já corrigido) | ❌ trava (tela branca, sem erro) |
| ~119 KB (arquivo inteiro, 2132 linhas, já corrigido) | ❌ trava (tela branca, sem erro) |

Ou seja: existe um limite em algum ponto **entre ~11 KB e ~58 KB** de JavaScript
processado por `createTemplateFromFile`/`evaluate()` (seja direto no arquivo, seja
via `<?!= include(...) ?>` — ambos os caminhos foram testados e dão o mesmo
resultado) que ainda não foi encontrado. Não é limite de tamanho de *saída* html
(60KB de HTML estático funciona linear); parece ser específico de conteúdo
JavaScript processado como template.

**Próximo passo recomendado**: repetir a bisseção por tamanho (mesmo método usado
pra achar o bug do aninhamento — cortar o arquivo ao meio repetidamente, sempre
terminando num ponto sintaticamente válido, tipo `head -n N Script.html`, validando
com `node --check` antes de implantar) entre 11 KB e 58 KB, publicando de verdade
como Web App a cada corte (testar local/preview.html não reproduz o bug — só
acontece no Apps Script publicado de verdade) até achar o ponto exato da virada.
Depois, examinar o que tem exatamente ali (mesma abordagem que achou os template
literals aninhados: comparar duas versões de MESMO tamanho em bytes, uma logo antes
e outra logo depois do limite, pra isolar o que exatamente muda).

### Uma pista adicional (via DevTools, Network + Elements)

Inspecionando a página travada com o DevTools (funciona em "Inspecionar" mesmo
quando F12 direto está bloqueado por política de TI): a requisição principal
(`.../exec`) retorna 200 OK. Só que o conteúdo real do app nunca chega a aparecer —
existe um `<iframe id="userHtmlFrame" src="/blank">` (nunca atualizado pra a URL de
conteúdo real) e um `<dialog id="oauth-dialog">` (tela de "Autorização necessária"
do próprio Google) que nunca ganha o atributo `open` — ou seja, o próprio mecanismo
do Google decide não avançar (nem pedir autorização visivelmente, nem carregar o
conteúdo), sem lançar nenhum erro de JavaScript visível no console. Isso bate com
"o `Script.html` grande trava de um jeito que não gera uma exceção capturável do
lado do cliente" — reforça que o próximo passo é achar o tamanho exato da virada
(pode ser mais fácil de diagnosticar uma vez isolado num arquivo bem menor).

## 4. Checklist antes de considerar o deploy "pronto pra testar"

1. [ ] Rodei `diagnosticarConfiguracao` no editor — `PORTFOLIO_SHEET_ID` e
   `TEAM_PASSWORD` configuradas, planilha abre sem erro.
2. [ ] Rodei `diagnosticarAbas` — as duas abas (`[SF] On`, `[SF] VD`, com
   colchetes) foram encontradas pela comparação normalizada.
3. [ ] Rodei `testarLeituraPlanilha` — total de clientes lido bate com o esperado
   (madu: 154, pedro: 469, josiane: 444, ilana: 35 — 1102 no total, confirmado
   contra a planilha real).
4. [ ] Rodei `testarDoGet` — executa sem lançar erro.
5. [ ] **Resolvi o mistério da seção 3 acima** (achar e corrigir o segundo limite
   de tamanho) — sem isso, o Web App publicado fica em tela branca não importa o
   que mais esteja certo.
6. [ ] Só depois disso: fiz o Deploy (seção 5, passo 6) e testei o link `/exec`
   com uma conta de teste, **publicado de verdade** (testar local/preview.html não
   reproduz esse bug).

## 5. Passo a passo manual completo

Não precisa de projeto GCP customizado nem de Tela de Consentimento OAuth
configurada manualmente — a configuração **Padrão** do Apps Script funciona (já
confirmado: outros apps da Hotmart publicam assim, e nossos próprios testes
menores publicaram e abriram normalmente com essa configuração).

### 1. Planilha de origem

Não precisa criar nada na planilha `Gestão de carteira unificada` — só copiar o ID
dela (o trecho da URL entre `/d/` e `/edit`).

### 2. Criar o projeto Apps Script e colar os arquivos

1. Em [script.google.com](https://script.google.com), crie um projeto novo, nomeie
   "Dashboard Onboarding".
2. Cole cada arquivo deste repositório no lugar certo (tabela abaixo).

| Arquivo deste repositório | Onde cola no editor do Apps Script |
| --- | --- |
| `Código.gs` | Arquivo de script `.gs`, chamado exatamente **Código** |
| `Diagnostico.gs` | Arquivo de script `.gs`, chamado exatamente **Diagnostico** |
| `Index.html` | Arquivo HTML, chamado exatamente **Index** |
| `Estilos.html` | Arquivo HTML, chamado exatamente **Estilos** |
| `Script.html` | Arquivo HTML, chamado exatamente **Script** |
| `appsscript.json` | Engrenagem (Configurações do projeto) → marcar "Mostrar arquivo de manifesto" → editar direto o que já existe (não criar um novo) |

`Índex.html` é só um esqueleto pequeno que faz `<?!= include('Estilos') ?>` e
`<?!= include('Script') ?>` — não precisa (nem deve) colar todo o CSS/JS ali junto;
é exatamente por causa disso que os três arquivos são separados (ver seção 3).

### 3. Script Properties

No editor do Apps Script, engrenagem → **Script Properties** → **Add script
property**:
- `PORTFOLIO_SHEET_ID` = ID da planilha "Gestão de carteira unificada".
- `TEAM_PASSWORD` = a senha que o time vai usar pra logar.

### 4. Rodar os diagnósticos (seção 4 do checklist acima)

No menu de funções do editor (ao lado do botão "Executar"), rode nesta ordem:
`diagnosticarConfiguracao` → `diagnosticarAbas` → `testarLeituraPlanilha` →
`testarDoGet`. Se o app for usar upload de fotos, rode também `autorizarDrive` — vai
pedir uma autorização (Revisar permissões → sua conta → Permitir), é esperado.

### 5. Publicar como Web App

1. Botão azul **Implantar** → **Nova implantação**.
2. Ícone de engrenagem ao lado de "Selecionar tipo" → **App da Web**.
3. **Executar como**: Eu (sua conta). **Quem pode acessar**: **Qualquer pessoa em
   hotmart.com** (ou o nome equivalente pro domínio de vocês).
4. **Implantar**. Na primeira vez, autorize (Revisar permissões → sua conta →
   Permitir).
5. Copie a URL do Web App (`.../exec`).

**Antes de comemorar**: abra o link de verdade e confira se a tela de Login
aparece — se der tela branca, é o bug descrito na seção 3, não um erro de
configuração deste passo a passo.

### 6. Testar

Abra a URL copiada. Deve aparecer a tela de Login do time. Se quiser confirmar que
funciona pra outras pessoas, peça pra alguém com conta `@hotmart.com` diferente
abrir o mesmo link.

## 6. Atualizando o app depois de mudanças no código

1. Copie o novo conteúdo de cada arquivo mudado pro arquivo correspondente no editor.
2. **Implantar → Gerenciar implantações** → ícone de lápis na implantação ativa →
   **Versão: Nova versão** → **Implantar**.

Sem o passo 2, a URL pública continua servindo a versão antiga.

## 7. Limitações desta versão

- **Segurança da senha do time**: o `doGet` injeta os dados das 4 carteiras direto
  no HTML (requisito técnico do projeto, e também como o mockup funciona), então
  qualquer conta `@hotmart.com` que abrir o link já recebe os dados na fonte da
  página, antes mesmo de digitar a senha — o domínio Google (`access: DOMAIN`) é o
  controle de acesso real; a senha do time é uma tela de UX/perfil, não um segredo de
  dados.
- **Fotos**: guardadas no Drive da conta que publicou o Web App, servidas por base64
  via `google.script.run` — sem link público, mas o armazenamento fica todo numa
  única conta.
- **Cronograma (datas de fase/tarefa)**: como no mockup, o progresto de cada fase vem
  do campo ilustrativo `_cronogramaProgress`; já as datas que o time agenda por fase/
  tarefa (com o "lembrete simulado") ficam só no `localStorage` do navegador — não são
  gravadas na planilha nem persistem entre computadores diferentes. Se o time quiser
  um cronograma de datas real e compartilhado entre todo mundo, dá pra mover isso pra
  uma aba própria (mesmo padrão do overlay de CRM) numa próxima rodada.
- **Rotina — Semana/Mensal**: os itens editáveis (tema do dia, itens da semana, lista
  mensal) ficam no `localStorage` por perfil, não na planilha — é a rotina de cada
  pessoa, não um dado do cliente. Diário/Checklist semanal/Por tipo de cliente usam o
  conteúdo fixo do mockup (baseado no processo real de onboarding descrito por vocês).
- **% Ferramentas, Bônus, Analytics**: campos explicitamente marcados como
  ilustrativos (🧪) no mockup continuam ilustrativos aqui (hash determinístico do
  Hotmart ID/mês, nunca aleatório a cada carregamento) — ver a caixa de "Integração
  com o Power BI"/"Protótipo visual" em cada tela.
