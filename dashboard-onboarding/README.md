# Dashboard Onboarding — publicar no Google Apps Script

Este app foi montado do zero (não a partir dos arquivos de uma tentativa anterior,
que não chegaram a ser colados nesta conversa) seguindo à risca a especificação de
produto e a arquitetura de dados descritas no prompt original: schema de campos da
`[SF] On`/`[SF] VD`, dedup por Hotmart ID, campos calculados, as 5 telas, a
identidade visual Hotmart, e os 3 arquivos exigidos por requisito técnico
(`Código.gs`, `Index.html`, `appsscript.json`) — mais `Diagnostico.gs`, que não conta
como um 4º arquivo do app em si (não é referenciado pelo `doGet`), só ajuda você a
testar a configuração pelo editor antes de publicar.

Antes de qualquer coisa: **a prévia local** (`preview.html`, já enviada nesta
conversa) mostra a interface inteira com dados fictícios, sem tocar em nenhuma
planilha real — abra no navegador, senha `preview123`. Ela existe só pra você validar
o produto; **não é o arquivo que vai pro Apps Script**.

## 1. O que revisar antes de colar (não há divergência a resolver — é código novo)

Como não recebi os arquivos da tentativa anterior, não há um diff pra revisar contra
eles. O que importa checar é se este código bate com o que você já validou como
correto na sua tentativa anterior:

- **Mapeamento de colunas da `[SF] On`**: está em `Código.gs`, objeto `COL` (0-based,
  comentado com a letra da coluna ao lado). Se algo mudou na planilha desde a última
  vez, é só esse objeto que precisa de ajuste.
- **Nomes das abas**: `[SF] On` e `[SF] VD`, com colchetes literais, buscadas via
  `findSheetByName_` (normaliza caracteres invisíveis — ver comentário no código).
- **Dedup**: última linha de cada Hotmart ID vence — em `readPortfolioRows_`.
- **Campos calculados**: fórmulas de `amountReal`, `pctAtingido`, `pctAmount`,
  `diasAtivado` — mesma definição do prompt.

## 2. Decisão de arquitetura que fui obrigado a tomar (fora do que estava "confirmado")

A especificação de dados deixa claro que a `[SF] On`/`[SF] VD` são **só leitura**, sem
nenhum dado próprio do app gravado nelas. Mas a especificação de produto pede campos
que só existem dentro do app (observações, contrato assinado, brinde enviado, fotos
do cliente, e as missões da Rotina) — esses não têm de onde vir. Resolvi isso criando
duas abas **próprias**, numa planilha diferente (a planilha **vinculada a este
script**, não a `Gestão de carteira unificada`): `App - Overlay CRM` e
`App - Missões`, criadas automaticamente na primeira gravação. Isso preserva a regra
"nunca escrever na planilha do Salesforce" e ainda dá um lugar real pra esses dados
persistirem. Fotos ficam no Google Drive (pasta própria, criada automaticamente),
não na planilha — só o ID do arquivo fica salvo, e as imagens são servidas de volta
como base64 (nunca por um link público do Drive), pra não abrir uma superfície de
acesso nova.

Se isso não bater com o que você já tinha resolvido de outro jeito na tentativa
anterior, me fala qual era a solução de lá que eu ajusto.

## 3. A causa mais provável do travamento — e o que fazer antes de tentar publicar

Pelos sintomas descritos (funciona limpo no editor, trava em "Authorization
required"/"Revisar permissões" pra qualquer conta `@hotmart.com`, em qualquer
navegador, mesmo revogando e reconcedendo, mesmo com o código validado), e já
eliminadas as causas de extensão, popup, escopo do script, dados, política geral da
Hotmart e rótulo de DLP — o suspeito mais forte continua sendo o que você já
apontou: **o projeto Apps Script está rodando no projeto GCP "Padrão" (automático,
oculto)**, que:

- não expõe a Tela de Consentimento OAuth pra configuração nenhuma;
- normalmente fica em modo **"Externo" + "Teste"**, com um teto de 100 usuários de
  teste e uma tela de aviso extra ("app não verificado pelo Google") no meio do
  fluxo de autorização;
- é exatamente esse tipo de tela extra, dentro do iframe isolado que o Apps Script
  usa pra servir a página, que costuma travar sem avançar — é um padrão conhecido em
  vários relatos de outras empresas com a mesma configuração de Workspace.

**A correção**: migrar pra um projeto GCP **customizado** (criado por você, não o
automático), e configurar a Tela de Consentimento OAuth desse projeto como
**Interno** — disponível porque `hotmart.com` é uma organização Google Workspace.
Consentimento "Interno" não passa pela verificação do Google, não tem teto de 100
usuários, e não mostra a tela de aviso "app não verificado" — qualquer conta
`@hotmart.com` autoriza direto. O passo a passo completo está na seção 5.

### Uma causa nova, ainda não testada, que meu raciocínio aponta como bem provável

Você já tinha eliminado "Controle de Acesso a Apps no Admin Console do Workspace"
porque a TI da Hotmart verificou e disse que não era isso — **mas isso foi verificado
para o projeto GCP Padrão que vocês já tinham**. Um projeto GCP customizado novo (o
que a correção acima pede que você crie) gera um **Client ID OAuth diferente**, que
pro Google é literalmente um "app" diferente do ponto de vista dessa política. Se a
política do Workspace da Hotmart for `Restrito` em **Admin Console → Segurança →
Controles de API → Acesso a apps de terceiros** (ou o nome equivalente em
português/inglês, "Manage Third-Party App Access"), o app novo (o projeto GCP
customizado) pode precisar ser explicitamente adicionado à lista de apps confiáveis
por alguém da TI — mesmo que o app antigo já estivesse liberado. Vale pedir pra TI
conferir essa tela especificamente **depois** de você criar o projeto customizado
(seção 5, passo 2), com o Client ID novo em mãos, em vez de assumir que "já
verificamos isso antes" ainda cobre o projeto novo.

### Duas outras causas que você mencionou e ainda não tinha testado

- **Cookies de terceiros bloqueados**: o Apps Script serve a página dentro de um
  iframe cujo domínio é diferente do domínio da autorização OAuth
  (`accounts.google.com`) — se o Chrome estiver bloqueando cookies de terceiros
  globalmente, o handshake de autorização pode não fechar o ciclo. Teste em
  `chrome://settings/cookies` com "Todos os cookies permitidos" (ou uma exceção pra
  `[*.]google.com`), num perfil limpo.
- **Múltiplas contas Google logadas ao mesmo tempo**: se o navegador tiver mais de
  uma conta Google logada e a conta "ativa" no momento da autorização não for a conta
  `@hotmart.com` de teste, o fluxo pode confundir qual conta está autorizando. Teste
  num perfil do Chrome (ou janela anônima) com **só** a conta de teste logada, ou
  escolhendo explicitamente a conta em `accounts.google.com` antes de abrir o link.

## 4. Checklist definitivo antes de considerar o deploy "pronto pra testar"

Marque cada item, nesta ordem:

1. [ ] Rodei `diagnosticarConfiguracao` no editor — `PORTFOLIO_SHEET_ID` e
   `TEAM_PASSWORD` configuradas, planilha abre sem erro.
2. [ ] Rodei `diagnosticarAbas` — as duas abas (`[SF] On`, `[SF] VD`) foram
   encontradas pela comparação normalizada.
3. [ ] Rodei `testarLeituraPlanilha` — total de clientes lido é maior que zero (ou
   exatamente o esperado).
4. [ ] Rodei `testarDoGet` — executa sem lançar erro.
5. [ ] O projeto Apps Script está associado a um **projeto GCP customizado** (não o
   Padrão) — ver seção 5, passo 2.
6. [ ] A Tela de Consentimento OAuth desse projeto GCP está configurada como
   **Interno**, com as scopes `spreadsheets` e `drive.file` adicionadas.
7. [ ] Pedi pra TI da Hotmart confirmar, com o Client ID do projeto GCP customizado
   em mãos, que ele não está bloqueado em Controles de API do Admin Console.
8. [ ] Testei com cookies de terceiros permitidos e com uma única conta
   `@hotmart.com` logada no navegador de teste.
9. [ ] Só depois de tudo isso: fiz o Deploy (seção 5, passo 6) e testei o link
   `/exec` com uma conta de teste.

## 5. Passo a passo manual completo

### 1. Planilha de origem

Não precisa criar nada na planilha `Gestão de carteira unificada` — só copiar o ID
dela (o trecho da URL entre `/d/` e `/edit`).

### 2. Criar o projeto Apps Script com um projeto GCP customizado

1. Em [script.google.com](https://script.google.com), crie um projeto novo, nomeie
   "Dashboard Onboarding".
2. Cole `Código.gs`, `Index.html` e `appsscript.json` (veja a tabela abaixo de onde
   cola cada um) e `Diagnostico.gs`.
3. No menu lateral, ícone de **engrenagem** ("Configurações do projeto") → marque
   **"Mostrar arquivo de manifesto 'appsscript.json' no editor"**, se ainda não
   aparecer.
4. Ainda em Configurações do projeto, seção **"Projeto do Google Cloud Platform
   (GCP)"** → **"Alterar projeto"**.
5. Em outra aba, acesse [console.cloud.google.com](https://console.cloud.google.com),
   crie um projeto novo (não use um projeto Padrão do Apps Script) — nomeie algo como
   "dashboard-onboarding-hotmart". Anote o **Número do projeto** (não o nome).
6. Volte pro Apps Script, cole esse número em "Alterar projeto" → **Definir projeto**.
   Essa é a mudança que dá acesso à Tela de Consentimento OAuth de verdade.

| Arquivo deste repositório | Onde cola no editor do Apps Script |
| --- | --- |
| `Código.gs` | Arquivo de script `.gs`, chamado exatamente **Código** |
| `Index.html` | Arquivo HTML, chamado exatamente **Index** |
| `appsscript.json` | Editado direto no arquivo de manifesto (não crie um novo — substitua o conteúdo do que já existe) |
| `Diagnostico.gs` | Arquivo de script `.gs`, chamado exatamente **Diagnostico** |

### 3. Configurar a Tela de Consentimento OAuth como Interno

1. No [Google Cloud Console](https://console.cloud.google.com), com o projeto novo
   selecionado, vá em **APIs e Serviços → Tela de permissão OAuth**.
2. Escolha **Interno** (só aparece se a conta for de uma organização Google
   Workspace — `hotmart.com` deve qualificar). Se só aparecer "Externo", pare e avise
   — significa que a conta usada não está reconhecida como parte da organização
   Workspace, e vale confirmar com a TI antes de continuar.
3. Preencha nome do app ("Dashboard Onboarding"), e-mail de suporte, e-mail de
   contato do desenvolvedor (o seu). Salvar.
4. Na etapa **"Escopos"**, clique em **"Adicionar ou remover escopos"** e adicione:
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/drive.file`
5. Salvar e voltar ao painel — não precisa publicar/verificar nada além disso, tipo
   "Interno" não passa por revisão do Google.

### 4. Script Properties

1. No editor do Apps Script, engrenagem → **Script Properties** → **Add script
   property**:
   - `PORTFOLIO_SHEET_ID` = ID da planilha "Gestão de carteira unificada".
   - `TEAM_PASSWORD` = a senha que o time vai usar pra logar.

### 5. Rodar os diagnósticos (seção 4 do checklist acima)

No menu de funções do editor (ao lado do botão "Executar"), rode nesta ordem:
`diagnosticarConfiguracao` → `diagnosticarAbas` → `testarLeituraPlanilha` →
`testarDoGet`. Se o app for usar upload de fotos, rode também `autorizarDrive` — vai
pedir uma autorização (Revisar permissões → sua conta → Permitir), é esperado.

### 6. Publicar como Web App

1. Botão azul **Implantar** → **Nova implantação**.
2. Ícone de engrenagem ao lado de "Selecionar tipo" → **App da Web**.
3. **Executar como**: Eu (sua conta). **Quem pode acessar**: **Qualquer pessoa em
   hotmart.com** (ou o nome equivalente pro domínio de vocês).
4. **Implantar**. Na primeira vez, autorize (Revisar permissões → sua conta →
   Permitir) — com o consentimento Interno configurado, não deve aparecer a tela de
   "Google não verificou este app".
5. Copie a URL do Web App (`.../exec`).

### 7. Testar

Abra a URL copiada **numa conta `@hotmart.com` diferente da sua** (idealmente num
perfil de navegador só com essa conta logada, cookies de terceiros permitidos — ver
checklist item 8). Deve aparecer a tela de Login do time, não a de autorização do
Google.

## 6. Atualizando o app depois de mudanças no código

1. Copie o novo conteúdo de cada arquivo mudado pro arquivo correspondente no editor.
2. **Implantar → Gerenciar implantações** → ícone de lápis na implantação ativa →
   **Versão: Nova versão** → **Implantar**.

Sem o passo 2, a URL pública continua servindo a versão antiga.

## 7. Limitações desta primeira versão

- **Segurança da senha do time**: o `doGet` injeta os dados das 4 carteiras direto
  no HTML (requisito técnico do projeto), então qualquer conta `@hotmart.com` que
  abrir o link já recebe os dados na fonte da página, antes mesmo de digitar a
  senha — o domínio Google (`access: DOMAIN`) é o controle de acesso real; a senha do
  time é uma tela de UX/perfil, não um segredo de dados.
- **Fotos**: guardadas no Drive da conta que publicou o Web App, servidas por base64
  via `google.script.run` — sem link público, mas o armazenamento fica todo numa
  única conta.
- **Rotina (Semana/Diário/Checklist/Por tipo/Mensal)**: a especificação não detalhou
  os dados dessas sub-abas, então implementei versões funcionais e razoáveis (ver
  comentários no código) — mais fáceis de ajustar depois que o time usar e apontar o
  que falta.
- **Cronograma, % Ferramentas, Bônus, Analytics**: campos explicitamente marcados
  como ilustrativos na especificação continuam ilustrativos aqui (hash determinístico
  do Hotmart ID, nunca aleatório a cada carregamento).
