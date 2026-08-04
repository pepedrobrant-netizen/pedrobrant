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

## Paleta de cores

| Uso              | Cor                     |
| ----------------- | ----------------------- |
| Laranja principal  | `#FF4000`               |
| Laranja escuro     | `#C93400`               |
| Laranja claro      | `#FF7A45`                |
| Fundo laranja suave| `#FFF1EB`               |
| Navy (cabeçalho)   | `#191A2E` → `#2C2D47`   |
