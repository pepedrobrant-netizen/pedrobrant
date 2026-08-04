# Cronograma de Onboarding — 8 Fases

Página estática (sem backend, sem login) para acompanhar o onboarding de clientes em
**8 fases**, com a identidade visual da Hotmart. Cada cliente acessa seu próprio
cronograma através de um **link único** — não há autenticação nem senha.

## Como funciona

- Todos os clientes ficam cadastrados em [`data/clients.json`](data/clients.json), um por
  chave (`slug`).
- Cada cliente é acessado pela URL `?cliente=<slug>`, por exemplo:
  `https://seudominio.com/?cliente=acme-cursos`
- Sem o parâmetro `cliente`, a página mostra uma tela de seleção (útil para
  demonstração interna); em produção, basta enviar o link direto ao cliente.
- Não existe login: a "segurança" é o link ser único e não listado publicamente. Não
  cadastre dados sensíveis nele.

## As 8 fases

1. Boas-vindas e Kickoff
2. Diagnóstico e Planejamento
3. Configuração da Conta Hotmart
4. Criação do Produto e Oferta
5. Checkout, Preços e Pagamentos
6. Integrações e Automações
7. Testes e Homologação
8. Lançamento e Acompanhamento

## Adicionar um novo cliente

Copie um bloco inteiro dentro de `data/clients.json`, troque a chave (slug) e ajuste:

```json
"novo-cliente": {
  "nome": "Nome do Cliente",
  "empresa": "Nome da Empresa",
  "inicial": "NC",
  "dataInicio": "AAAA-MM-DD",
  "faseAtual": 0,
  "fases": [ ... 8 objetos, um por fase ... ]
}
```

- `faseAtual` é o índice (0 a 7) da fase em andamento; fases com índice menor aparecem
  como concluídas e as posteriores como pendentes.
- Cada fase tem `titulo`, `descricao`, `dataPrevista`, `dataConclusao` (ou `null`),
  `responsavel` e uma lista de `tarefas` (`nome` + `concluida`), usada também para
  calcular a barra de progresso da fase em andamento.

Não é necessário nenhum passo de build — é só editar o JSON e publicar.

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
index.html            página única (seletor de demonstração + timeline do cliente)
assets/css/styles.css estilo com a paleta de cores da Hotmart
assets/js/app.js       leitura da URL, cálculo de progresso e renderização
data/clients.json      dados de todos os clientes (editar para adicionar/atualizar)
```

## Brandbook Hotmart

Cores e tipografia seguem o brandbook oficial (`data/clients.json` e o restante do
conteúdo permanecem livres para edição; o visual não).

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
