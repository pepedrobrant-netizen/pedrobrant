# Cronograma de Onboarding — 8 Fases

Página estática (sem backend, sem login) para acompanhar o onboarding de clientes em
**8 fases**, com a identidade visual da Hotmart. Cada cliente acessa seu próprio
cronograma através de um **link único** — não há autenticação nem senha.

## Como funciona

- `data/clients.json` é o **dado-semente**: na primeira vez que a página é aberta em um
  navegador, ele é copiado para o `localStorage` e passa a ser a fonte de verdade
  *local* (por navegador/dispositivo). Todas as edições feitas pela interface — marcar
  tarefa, editar data, remover/restaurar tarefa, criar cliente — são salvas ali e
  sobrevivem a recarregar a página, mas **não são compartilhadas automaticamente** com
  quem abre o link em outro navegador ou dispositivo.
- Para publicar de verdade uma mudança (ex.: um cliente novo, tarefas ajustadas) para
  todos que acessam o site, use o botão **"Exportar dados"** na barra superior — ele
  baixa o `clients.json` atualizado. Substitua o arquivo em `data/clients.json` no
  repositório e publique (commit + deploy) para que o novo estado vire o padrão de
  todo mundo.
- Cada cliente é acessado pela URL `?cliente=<slug>`, por exemplo:
  `https://seudominio.com/?cliente=acme-cursos`
- Sem o parâmetro `cliente`, a página mostra a tela inicial com a lista de clientes e o
  botão **"+ Novo cliente"**.
- Não existe login: a "segurança" é o link ser único e não listado publicamente. Não
  cadastre dados sensíveis nele.

## Perfis (Ilana, Pedro, Josiane, Madu, Administrador)

- Cada cliente tem um campo **Responsável** (Ilana, Pedro, Josiane ou Madu).
- Ao abrir a tela inicial ou o Analytics pela primeira vez, a página pergunta **"Quem é
  você?"** — a pessoa escolhe seu nome numa lista (sem senha) e isso fica salvo no
  `localStorage` daquele navegador. A partir daí, a lista de clientes e o Analytics
  mostram só os clientes daquele responsável.
- **Administrador** é o perfil de coordenação: ao selecioná-lo, a lista e o Analytics
  mostram **todos** os clientes, de todos os responsáveis, sem filtro.
- Isso é uma preferência de UI, não autenticação de verdade — qualquer pessoa pode abrir
  o seletor e escolher "Administrador" ou qualquer outro nome. Não use isso como controle
  de acesso a dados sensíveis.
- Um **link direto de cliente** (`?cliente=slug`) nunca passa por esse filtro — continua
  abrindo normalmente para quem tiver o link, mesmo que a pessoa nunca tenha escolhido um
  perfil. O filtro de perfil só afeta a lista/Analytics internos da equipe.
- Para trocar de perfil (ex.: outra pessoa usando o mesmo navegador), use o botão com o
  nome atual no canto superior direito ("👤 Nome · trocar").
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

## Adicionar um novo cliente

Pelo botão **"+ Novo cliente"** na barra superior: preenche nome, empresa, ID da conta e
data de início, e o cliente já nasce com as 8 fases padrão (ver `TEMPLATE_FASES` em
`assets/js/app.js`) prontas para ajustar. Alternativamente, copie um bloco inteiro
dentro de `data/clients.json` (isso muda apenas o dado-semente, não o que já está salvo
no `localStorage` de quem já visitou a página):

```json
"novo-cliente": {
  "nome": "Nome do Cliente",
  "empresa": "Nome da Empresa",
  "inicial": "NC",
  "idConta": "HM-00000",
  "responsavelCliente": "Ilana",
  "criadoPor": "Ilana",
  "dataInicio": "AAAA-MM-DD",
  "fases": [ ... 8 objetos, um por fase ... ]
}
```

- `responsavelCliente` aceita `"Ilana"`, `"Pedro"`, `"Josiane"` ou `"Madu"` — define quem
  vê esse cliente na lista/Analytics quando filtrado por perfil.
- `criadoPor` é o que aparece como "Responsável pela fase" em todas as 8 fases (pelo
  botão "+ Novo cliente" isso é preenchido sozinho com o perfil atual; editando o JSON à
  mão, escreva o nome desejado diretamente).

- Cada fase tem `titulo`, `descricao`, `responsavel` (interno, não exibido na UI — ver
  `criadoPor` acima) e uma lista de `tarefas`.
- Cada tarefa tem `id` (estável, usado pelos controles de UI), `nome`, `pilares`
  (array com `"relacionamento"`, `"estrategia"` e/ou `"capacitacao"` — usado no gráfico
  de pilares do Analytics; tarefas extras não têm esse campo), `concluida`, `data`
  (agendada/realizada, por tarefa — não existe mais data por fase), `removida` e,
  quando criada pelo botão "+ Adicionar tarefa", `custom: true` (habilita a opção de
  excluir definitivamente).
- Uma tarefa com `removida: true` não conta no cálculo de progresso (nem no numerador
  nem no denominador) daquele cliente, mas continua no arquivo — dá pra restaurar a
  qualquer momento pela interface (seção "Tarefas removidas" dentro de cada fase).

Não é necessário nenhum passo de build — é só editar o JSON e publicar.

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

## Rodar localmente

```bash
python3 -m http.server 8000
```

Depois acesse `http://localhost:8000/?cliente=acme-cursos` (veja os slugs de exemplo em
`data/clients.json`). Abrir o `index.html` diretamente como arquivo (`file://`) não
funciona, pois o navegador bloqueia o `fetch` do JSON — é necessário um servidor HTTP.

## Publicar

Por ser 100% estático (HTML/CSS/JS, sem dependências), pode ser publicado em qualquer
hospedagem de arquivos estáticos (GitHub Pages, Netlify, Vercel, S3, etc.).

## Estrutura

```
index.html            página única (tela inicial + timeline do cliente + modal de novo cliente)
assets/css/styles.css estilo com a paleta de cores da Hotmart
assets/js/app.js       store (localStorage), cálculo de progresso, CRUD e renderização
data/clients.json      dado-semente (primeira carga); depois disso o localStorage manda
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
