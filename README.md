# Cronograma de Onboarding — 8 Fases

Acompanha o onboarding de clientes em **8 fases**, com a identidade visual da Hotmart.
Cada cliente acompanha seu próprio cronograma através de um **link único, sem precisar
de login**; só o time precisa autenticar para editar.

**Publicação atual: Google Apps Script.** Por orientação interna da Hotmart, o app é
publicado como um Web App do Google Apps Script (dados numa Planilha Google), em vez de
hospedagem estática externa — ver a pasta [`google-apps-script/`](google-apps-script/)
para o código e o [passo a passo de publicação](google-apps-script/README.md).

> Este repositório também tem uma versão anterior (site estático + banco Supabase, em
> `index.html`/`assets/`/`sql/`) de quando essa era a arquitetura prevista. Ela ficou
> **em espera** por causa da restrição de usar só Google Apps Script — o código
> continua aqui como referência, caso a política mude no futuro, mas **não é o que
> está publicado hoje**. A partir daqui, este README descreve a versão em uso: Apps
> Script + Planilha.

## Como funciona

- Os dados (clientes, fases/tarefas, CRM) ficam numa **Planilha Google**, lida e
  gravada pelo `google-apps-script/Code.gs` — abas **Clientes** e **CRM**, criadas
  automaticamente. Uma mudança feita por qualquer pessoa do time aparece pra todo
  mundo, em qualquer navegador/dispositivo, sem precisar de "Exportar dados" nem
  republicar nada.
- Cada cliente é acessado pela URL do Web App + `?cliente=<slug>`, por exemplo:
  `https://script.google.com/macros/s/AKfycb.../exec?cliente=acme-cursos`. Esse link
  não exige senha do time — quem só tem o link vê o cronograma daquele cliente
  específico, em modo leitura (não dá pra marcar tarefas nem editar nada por ali).
  ⚠️ Mas, se a política do Google Workspace da Hotmart estiver restringindo o deploy a
  "Qualquer pessoa em Hotmart" (em vez de "Qualquer pessoa"), esse link só abre para
  quem tem conta `@hotmart.com` — um cliente externo não consegue acessá-lo. Nesse
  caso, use o botão **"Baixar PDF do cliente"** (ao lado de "Copiar link do cliente")
  para gerar um PDF estático do cronograma e enviar por e-mail/WhatsApp — não atualiza
  sozinho, mas funciona para qualquer pessoa, sem depender de conta Google. Detalhes em
  [`google-apps-script/README.md`](google-apps-script/README.md#7-compartilhar-o-link-de-um-cliente).
- Sem o parâmetro `cliente`, a página pede login do time antes de mostrar a lista de
  clientes, o botão **"+ Novo cliente"** ou o Analytics — essas telas são só para quem
  está logado (ver "Login do time" abaixo).
- **Diferença importante em relação a um site normal**: como o Apps Script roda a
  página dentro de um iframe isolado do Google, a navegação interna do app (clicar num
  cliente, voltar para a lista, etc.) acontece **toda em memória** (sem mudar a URL do
  navegador) — só o link que você compartilha (`?cliente=slug`) importa, para a
  primeira abertura da página. O botão "voltar" do navegador não acompanha a navegação
  interna; use os links "← Voltar" da própria interface.

## Login do time (senha única)

- Ao abrir a página sem um link de cliente específico, aparece a tela **"Login do
  time"** — pede a senha do time (configurada nas Script Properties do projeto, chave
  `TEAM_PASSWORD` — nunca fica escrita em nenhum arquivo de código).
- É uma senha compartilhada (não contas individuais) — qualquer pessoa com a senha tem
  acesso de leitura/escrita total (não há hoje o conceito de "só o responsável edita o
  próprio cliente").
- A sessão dura até 6 horas (limite técnico do `CacheService` do Apps Script), depois
  disso pede login de novo.
- Depois de logado, o botão **"Sair"** aparece na barra superior para encerrar a sessão.
- O link direto de um cliente (`?cliente=slug`) **nunca exige login** — continua
  funcionando normalmente para quem só tem o link, sempre em modo leitura.

## Perfis (Ilana, Pedro, Josiane, Madu, Administrador)

- Depois de fazer login, a página pergunta **"Quem é você?"** — a pessoa escolhe seu
  nome numa lista e isso fica salvo no `localStorage` daquele navegador, só como
  preferência de exibição. A partir daí, a lista de clientes e o Analytics mostram só os
  clientes daquele responsável.
- **Administrador** mostra **todos** os clientes, de todos os responsáveis, sem filtro.
- Diferente de antes, essa escolha de nome **não é mais o controle de acesso** — quem
  chegou até essa tela já passou pelo login real. O nome é só para filtrar a lista/
  Analytics, não decide quem pode editar o quê.
- Para trocar de perfil (ex.: outra pessoa usando o mesmo login/navegador), use o botão
  com o nome atual no canto superior direito ("👤 Nome · trocar").
- O campo **"Responsável pela fase"**, no rodapé de cada fase, é preenchido
  automaticamente com o perfil que **criou** aquele cliente (`criadoPor`) — o mesmo nome
  aparece em todas as 8 fases, já que é o criador do cronograma, não um dono por fase.
  Não é editável pela interface.

## As 8 fases

1. Setup de Conta
2. Treinamento: Configurações Básicas
3. Treinamento: Club (Área de Membros)
4. Acabamentos e Configurações Finais
5. Checklist Pré-venda
6. Ativação
7. Relatórios Gerenciais (pós-ativação)
8. Acompanhamento

A fase "em andamento" é sempre a primeira que ainda não tem 100% das tarefas ativas
concluídas — não precisa ser marcada manualmente, ela é recalculada a cada mudança.

Dentro de cada fase, o botão **"+ Adicionar tarefa"** cria uma tarefa extra só para
aquele cliente (com checkbox, data e um ícone **×** para remover, igual às tarefas
padrão) — útil para casos específicos que não estão no modelo. Tarefas extras, depois de
removidas, ganham uma opção a mais na seção "Tarefas removidas": **"Excluir
definitivamente"** — apaga a tarefa de vez (pede confirmação, pois não pode ser
desfeito). Tarefas do modelo padrão que forem removidas só podem ser restauradas, não
excluídas — continuam fazendo parte da estrutura das 8 fases.

Na própria página do cliente, ao lado de "← Voltar para clientes", o botão **"Excluir
cliente"** apaga o cliente inteiro (pede confirmação explícita antes, com o nome do
cliente na mensagem — ação irreversível).

## Foto do cliente

No avatar do cabeçalho do cliente, o ícone de câmera (canto inferior direito do círculo)
abre o seletor de arquivo do sistema. A imagem escolhida é redimensionada no próprio
navegador (canvas, ~240px no lado maior, JPEG) antes de ser salva como `foto` (data URL)
no cliente — isso evita inflar o `localStorage` com fotos em resolução alta. Sem foto
cadastrada, o círculo mostra as iniciais do nome (como já era). Com foto, aparece também
um link **"Remover foto"** para voltar às iniciais. A mesma lógica (foto ou iniciais)
aparece no avatar da lista de clientes na tela inicial.

## CRM (dados internos, restrito ao time)

Na página de cada cliente, o botão **"CRM"** (ao lado de "Excluir cliente") abre um
formulário com dados sensíveis/internos que não fazem parte do cronograma que o cliente
vê:

- ID do cliente (identificador próprio do CRM, separado do nome/slug usados no link)
- Telefone principal (WhatsApp)
- E-mail do cliente (separado do e-mail de cada pessoa da equipe, ver abaixo)
- Endereço completo (para envio de brindes)
- Data de aniversário
- Se vai participar de algum evento (sim/não + qual evento)
- Se tem contrato assinado (sim/não)
- Se o brinde já foi enviado (sim/não)
- Meta de faturamento
- **Equipe do cliente**: lista de pessoas do lado do cliente, cada uma com Nome, Cargo,
  Telefone e E-mail. O botão **"+ Adicionar pessoa"** cria quantos cartões forem
  necessários, e o **×** no canto de cada um remove aquela pessoa.
- **Ações de relacionamento**: histórico de interações com o cliente (ex.: "almoço com
  o cliente", "visita presencial ao escritório"), cada entrada com Data e Descrição
  livre. O botão **"+ Registrar ação"** adiciona quantas entradas forem necessárias ao
  longo do tempo; a lista é exibida da mais recente para a mais antiga, e o **×** remove
  uma entrada específica.

Cada campo salva sozinho ao sair dele (sem botão "salvar" separado).

### Aniversariantes do mês

Dentro da aba **Analytics**, um card lista todos os clientes com data de aniversário
cadastrada no CRM que caia no mês selecionado, ordenados por dia. Como depende da mesma
chave de `localStorage` do CRM, esse card só aparece para quem tem um perfil do time
ativo — mesma restrição de visibilidade do CRM em si. Para o Administrador, a lista
considera todos os clientes, sem depender dos chips de filtro de onboarding; para os
demais perfis, considera só os clientes daquele responsável.

Por padrão o card mostra o **mês vigente**. As setas ao lado do título navegam para
outros meses (para frente ou para trás), e um link **"Mês atual"** aparece assim que
você sai do mês vigente, para voltar direto a ele. Essa navegação fica só na memória da
página — ao sair da tela de Analytics e voltar (ou recarregar a página), o card sempre
volta a mostrar o mês vigente; nada disso é salvo no `localStorage`.

**Como a restrição funciona de verdade, não só visualmente:**

- O botão "CRM" só aparece para quem está com **login do time ativo** (token de
  sessão válido). Sem login — que é sempre o caso de quem abre o link do cliente
  direto, já que esse link nunca exige login — o botão não é renderizado.
- A rota (`?cliente=slug&view=crm`) também é protegida no roteamento: sem sessão, esse
  parâmetro é ignorado e a página cai na tela normal (leitura) do cliente, sem revelar
  que a aba existe.
- Mais importante, a proteção não é só de interface: as funções do servidor
  (`google-apps-script/Code.gs`) que leem/gravam a aba **CRM** exigem um token de
  sessão válido (`requireSession_`) — mesmo alguém tentando chamar essas funções
  diretamente, sem passar pela tela de login, recebe erro. O link público do cliente só
  consegue chamar `getPublicClient(slug)`, que só devolve dados da aba **Clientes**, e
  só o registro daquele slug — nunca a aba CRM.
- Como os dados agora ficam numa planilha compartilhada, CRM preenchido por qualquer
  pessoa do time aparece para todo o time, em qualquer navegador/dispositivo.

## Adicionar um novo cliente

Pelo botão **"+ Novo cliente"** na barra superior (só visível logado): preenche nome,
empresa, ID da conta e data de início, e o cliente já nasce com as 8 fases padrão (ver
`TEMPLATE_FASES` em `google-apps-script/JavaScript.html`) prontas para ajustar, direto
na Planilha — já aparece pra todo o time.

- `responsavelCliente` aceita `"Ilana"`, `"Pedro"`, `"Josiane"` ou `"Madu"` — define quem
  vê esse cliente na lista/Analytics quando filtrado por perfil.
- `criadoPor` é o que aparece como "Responsável pela fase" em todas as 8 fases — é
  preenchido sozinho com o perfil escolhido por quem está criando o cliente.
- Cada fase tem `titulo`, `descricao`, `responsavel` (interno, não exibido na UI — ver
  `criadoPor` acima) e uma lista de `tarefas`.
- Cada tarefa tem `id` (estável, usado pelos controles de UI), `nome`, `pilares`
  (array com `"relacionamento"`, `"estrategia"` e/ou `"capacitacao"` — usado no gráfico
  de pilares do Analytics; tarefas extras não têm esse campo), `concluida`, `data`
  (agendada/realizada, por tarefa — não existe mais data por fase), `removida` e,
  quando criada pelo botão "+ Adicionar tarefa", `custom: true` (habilita a opção de
  excluir definitivamente).
- Uma tarefa com `removida: true` não conta no cálculo de progresso (nem no numerador
  nem no denominador) daquele cliente, mas continua salva — dá pra restaurar a qualquer
  momento pela interface (seção "Tarefas removidas" dentro de cada fase).

`data/clients.json` continua no repositório como referência do formato de dados e dos
3 clientes de demonstração originais, mas **não é mais lido pelo app** — os dados reais
vivem só na Planilha Google agora.

## Analytics

O botão **"Analytics"** na barra superior mostra um gráfico de barras com o % de
progresso de cada cliente. Cada barra é um link direto para o cronograma daquele
cliente.

- Para um onboarding individual (Ilana, Pedro, Josiane ou Madu), o escopo segue o mesmo
  filtro de perfil da tela inicial: só os próprios clientes, sem opção de filtro
  adicional (não há outros onboardings para comparar).
- Para o **Administrador**, a tela mostra dois níveis de informação: (1) um resumo fixo
  no topo com o progresso médio de **todos** os clientes, de todos os responsáveis
  (não muda com o filtro), e (2) chips para selecionar um ou mais onboardings — ao
  selecionar, aparece o progresso médio de cada um deles e o gráfico de barras é
  filtrado só aos clientes desses onboardings selecionados. "Selecionar todos"/"Limpar"
  ajustam a seleção de uma vez.

### Pilares

Cada tarefa do modelo padrão é classificada com um ou mais dos 3 pilares base —
🟢 Relacionamento, 🔵 Estratégia, 🟡 Capacitação — e a combinação deles forma 7
categorias (legenda completa mostrada na própria aba Analytics, com nome e objetivo de
cada uma: Relacionamento/Construir confiança, Estratégia/Direcionar,
Capacitação/Desenvolver, Inteligência do Cliente 🟢🔵/Personalizar, Enablement
Estratégico 🔵🟡/Preparar, Customer Enablement 🟢🟡/Engajar, Customer Success
🟢🔵🟡/Gerar resultado).

Abaixo do gráfico de progresso, o Analytics mostra um card por cliente (dentro do
filtro/escopo atual) com um mini gráfico de barras das **7 combinações da legenda**,
contando apenas tarefas **ativas e concluídas**. Cada tarefa concluída soma 1 para a
combinação exata dos seus pilares — uma tarefa 🔵🟡 soma na barra "Enablement
Estratégico", não meio ponto em "Estratégia" e meio em "Capacitação" separadamente.
Categorias de pilar único (Relacionamento, Estratégia, Capacitação) usam a cor sólida
do pilar; as 4 combinações usam um gradiente das cores dos pilares envolvidos, para
diferenciar visualmente sem inventar cores novas. Tarefas extras adicionadas por "+
Adicionar tarefa" não têm pilar definido, então não entram nessa contagem.

## Publicar / rodar

A publicação é feita direto no editor do Google Apps Script, não por git push nem
servidor próprio — ver o passo a passo completo em
[`google-apps-script/README.md`](google-apps-script/README.md). Resumo:

1. Cria uma Google Sheet (vira o banco de dados).
2. Extensões → Apps Script, cola `Code.gs`, `Index.html`, `Stylesheet.html` e
   `JavaScript.html`.
3. Configura a senha do time em Script Properties (`TEAM_PASSWORD`).
4. Deploy → New deployment → Web app (Execute as: Me, Access: Anyone).
5. A URL do deployment (`.../exec`) é a URL do site; `.../exec?cliente=slug` é o link
   de cada cliente.

Não existe "rodar localmente" no sentido tradicional (sem servidor próprio) — para
testar mudanças de código, cole os arquivos atualizados no editor do Apps Script e crie
uma nova versão do deployment (ver "Atualizando o app" no README da pasta
`google-apps-script/`).

## Estrutura

```
google-apps-script/Code.gs               servidor: auth (senha do time), CRUD de clientes/CRM na Planilha
google-apps-script/Index.html            página única (login, tela inicial, timeline do cliente, modal de novo cliente)
google-apps-script/Stylesheet.html       estilo com a paleta de cores da Hotmart (mesmo CSS de sempre, embutido)
google-apps-script/JavaScript.html       autenticação, dados via google.script.run, cálculo de progresso, CRUD e renderização
google-apps-script/README.md             passo a passo de publicação

index.html, assets/, sql/                versão anterior (site estático + Supabase), em espera — ver nota no topo deste README
data/clients.json                        referência do formato de dados + clientes de demonstração (não é lido por nenhuma das duas versões em produção)
```

## Brandbook Hotmart

Cores e tipografia seguem o brandbook oficial (`data/clients.json` e o restante do
conteúdo permanecem livres para edição; o visual não).

O banner **"Hotmart. Aqui acontece."** aparece no topo, largura total, fundo laranja
(`#FF4000`) e texto preto em `Bitter` bold — nas duas telas internas de navegação (lista
de clientes e seleção de perfil "Quem é você?"), não nas páginas de cliente/Analytics.
Ele é HTML/CSS (não uma imagem), o que mantém nitidez em qualquer tamanho de tela.

O ícone da chama (barra superior e favicon) é um redesenho vetorial (SVG inline,
`fill: currentColor`) baseado na referência visual da chama oficial da Hotmart — símbolo
isolado, sem o texto "hotmart" ao lado, para caber no espaço pequeno da topbar. Não foi
possível extrair o arquivo de imagem original a partir do que foi colado no chat (sem um
arquivo anexado de verdade não há como incorporar os pixels exatos), então o traço foi
recriado visualmente. Duas variantes de cor, escolhidas por contraste:

- Fundo off-white ou preto (topbar, favicon): chama em laranja `#FF4000`.
- Fundo laranja: chama em branco (testei preto também — o branco lê muito melhor em
  tamanho pequeno).

**Paleta primária**

| Nome       | Cor       | Uso no site                                   |
| ---------- | --------- | ---------------------------------------------- |
| Orange     | `#FF4000` | Ações, marcador/badge da fase concluída ou atual |
| Black      | `#0D0D0D` | Topbar, texto principal, base do cabeçalho do cliente |
| Off-White  | `#F5F3EF` | Fundo da página                                 |

**Paleta secundária**

| Nome   | Cor       | Uso no site                                             |
| ------ | --------- | -------------------------------------------------------- |
| Maroon | `#3E0F1D` | Gradiente do cabeçalho do cliente (Black → Maroon)        |
| Yellow | `#FFD450` | Gradiente da barra de progresso, texto de destaque no cabeçalho |
| Grey   | `#C3BFB8` | Bordas, marcadores pendentes, elementos neutros           |
| White  | `#FFFFFF` | Fundo dos cards                                           |

Ícones (chevron, checkmarks) ficam restritos a laranja, off-white, preto e branco,
conforme o brandbook — as cores secundárias aparecem apenas em fundos, bordas e textos
de apoio, nunca em ícones.

**Tipografia**

- Títulos (`h1`/`h2`/`h3`, nome do cliente, título de cada fase): fonte serifada bold
  — `Bitter` via Google Fonts, com fallback para `Georgia`/`Times New Roman` caso a
  fonte não carregue (substituindo a "Hotmart Display" oficial, que não está disponível
  publicamente).
- Corpo de texto: `Inter`, com fallback para fontes sans-serif do sistema.
