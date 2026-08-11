# Publicar no Google Apps Script

Este é o app rodando como **Web App do Google Apps Script**, usando uma **Planilha
Google** como banco de dados. É a via de publicação usada quando políticas internas
não permitem hospedagem fora do ecossistema Google (GitHub Pages, Supabase, etc.).

## O que você precisa colar onde

| Arquivo neste repositório | Onde cola no editor do Apps Script |
| --- | --- |
| `Code.gs` | Um arquivo de script `.gs` chamado exatamente **Code** |
| `Index.html` | Um arquivo HTML chamado exatamente **Index** |
| `Stylesheet.html` | Um arquivo HTML chamado exatamente **Stylesheet** |
| `JavaScript.html` | Um arquivo HTML chamado exatamente **JavaScript** |

Os nomes importam: `Code.gs` referencia `Index`, `Stylesheet` e `JavaScript` pelo nome
(função `include(...)`), sem a extensão `.html`.

## Passo a passo

### 1. Criar a Planilha (o banco de dados)

1. Acesse [sheets.google.com](https://sheets.google.com) e crie uma planilha em
   branco. Dê um nome, ex.: **"Cronograma de Onboarding — Dados"**.
2. Não precisa criar nenhuma aba/coluna manualmente — o script cria as abas
   **Clientes** e **CRM** sozinho, com os cabeçalhos certos, na primeira vez que
   alguém usa o app.

### 2. Abrir o editor de scripts

1. Com a planilha aberta, vá em **Extensões → Apps Script**.
2. Abre uma aba nova com o editor. Vai ter um arquivo `Code.gs` vazio (com uma função
   `myFunction()` de exemplo) — pode apagar tudo.

### 3. Colar os arquivos

1. Apague o conteúdo padrão de `Code.gs` e cole o conteúdo do arquivo `Code.gs` deste
   repositório.
2. Clique no **+** ao lado de "Arquivos" no menu lateral esquerdo → **HTML** → nomeie
   como **Index** → cole o conteúdo de `Index.html` deste repositório.
3. Repita para **Stylesheet** (cole `Stylesheet.html`) e **JavaScript** (cole
   `JavaScript.html`).
4. Salve tudo (ícone de disquete, ou `Ctrl+S`).

### 4. Configurar a senha do time

1. No editor do Apps Script, clique no ícone de **engrenagem** ("Configurações do
   projeto") no menu lateral esquerdo.
2. Desça até **"Script Properties"** → **"Add script property"**.
3. Em **Property**, digite exatamente `TEAM_PASSWORD`. Em **Value**, digite a senha
   que o time vai usar para logar. Clique em **"Save script properties"**.
4. Essa senha nunca fica escrita em nenhum arquivo de código — só aqui, nas
   propriedades do projeto.

### 5. Publicar como Web App

1. Volte para a aba do editor (ícone `<>` no menu lateral, "Editor").
2. Clique no botão azul **"Deploy"** (Implantar) no canto superior direito → **"New
   deployment"**.
3. Ao lado de "Select type", clique no ícone de engrenagem e escolha **"Web app"**.
4. Preencha:
   - **Description**: algo como "v1"
   - **Execute as**: **Me** (sua conta)
   - **Who has access**: **Anyone** (senão o link público do cliente não funciona
     para quem não tem conta Google)
5. Clique em **"Deploy"**.
6. Na primeira vez, o Google vai pedir para **autorizar** o script a acessar sua
   planilha — siga o fluxo (**Authorize access** → escolha sua conta → pode aparecer
   um aviso "Google hasn't verified this app": clique em **"Advanced"** → **"Go to
   [nome do projeto] (unsafe)"** → **Allow**). Isso é esperado para scripts próprios
   não publicados na loja do Google, é seguro continuar.
7. Copie a **URL do Web App** que aparece (algo como
   `https://script.google.com/macros/s/AKfycb.../exec`) — essa é a URL do site.

### 6. Testar

1. Abra a URL copiada. Deve aparecer a tela **"Login do time"**.
2. Digite a senha que você configurou no passo 4.
3. Depois de logar, escolha um perfil ("Quem é você?") e deve aparecer a lista de
   clientes (vazia na primeira vez).
4. Crie um cliente de teste pelo botão **"+ Novo cliente"** para confirmar que grava
   na planilha (você pode conferir abrindo a aba **Clientes** na planilha).

### 7. Compartilhar o link de um cliente

O link de cada cliente é a URL do Web App + `?cliente=<slug>`, por exemplo:
```
https://script.google.com/macros/s/AKfycb.../exec?cliente=acme-cursos
```
Esse link funciona sem login (modo leitura). Você pode copiá-lo direto de dentro do
app, pelo botão **"Copiar link do cliente"** na página de cada cliente.

⚠️ **Atenção — esse link só funciona para quem tem conta `@hotmart.com`.** Se no passo
5 ("Quem pode acessar") a única opção disponível foi **"Qualquer pessoa em Hotmart"**
(sem a opção "Qualquer pessoa"), isso significa que a política do Google Workspace da
Hotmart restringe o acesso ao domínio. Na prática: **um cliente externo não consegue
abrir esse link** — ele cai numa tela de login do Google pedindo uma conta que ele não
tem. Isso não é um bug do app, é uma configuração do Workspace; só a TI da Hotmart pode
mudar isso (perguntando se dá pra liberar "Qualquer pessoa" só para este Web App).

**Enquanto isso não é liberado, use o botão "Baixar página do cliente"** (ao lado de
"Copiar link do cliente") para gerar um arquivo estático do cronograma do cliente:
1. Abra a página do cliente.
2. Clique em **"Baixar página do cliente"** — baixa um arquivo `.html` com o
   cronograma daquele cliente, todas as fases já expandidas e sem os botões de edição.
3. Envie esse arquivo ao cliente por e-mail, WhatsApp, etc. — ele abre com duplo-clique
   em qualquer navegador, **sem pedir login nenhum** (é só um arquivo, não um link para
   o Apps Script).
4. Se quiser um PDF de verdade: a pessoa que recebeu o arquivo pode abri-lo e usar o
   "Imprimir → Salvar como PDF" do próprio navegador dela — como esse arquivo não roda
   mais dentro do Apps Script, a impressão funciona normalmente (dentro do Apps Script
   ela não funciona, por causa do isolamento que o Google usa para servir a página).

⚠️ Não use o "Imprimir" do navegador (Ctrl+P) **de dentro do app** para tentar gerar
esse PDF — `window.print()` fica bloqueado pelo iframe isolado que o Apps Script usa
para servir a página, então não abre nada. É por isso que o botão baixa um arquivo em
vez de abrir a caixa de impressão direto.

A desvantagem é que o arquivo é uma foto do momento — não atualiza sozinho. Sempre que
o cronograma mudar, é preciso gerar e reenviar um arquivo novo. Mas resolve o problema
de acesso sem depender de nenhuma liberação da TI.

## Atualizando o app depois de mudanças no código

Toda vez que o `Code.gs` ou os arquivos `.html` deste repositório forem atualizados
(por mim, em uma próxima rodada de ajustes), os passos para você aplicar são:

1. Copie o novo conteúdo de cada arquivo mudado para o arquivo correspondente no
   editor do Apps Script (substituindo o conteúdo antigo).
2. Vá em **Deploy → Manage deployments**.
3. Clique no ícone de lápis (editar) ao lado do deployment ativo.
4. Em **Version**, escolha **"New version"**, e clique em **"Deploy"**.

Sem esse passo 3-4, a URL pública continua servindo a versão antiga do código —
salvar os arquivos no editor sozinho não atualiza o Web App já publicado.

## Limitações desta arquitetura (Apps Script + Planilha)

- **Concorrência**: o script usa um bloqueio (`LockService`) para evitar que duas
  gravações simultâneas corrompam a planilha, mas em uso muito simultâneo (várias
  pessoas salvando ao mesmo tempo) pode haver uma pequena espera. Para o tamanho de
  time desta ferramenta, não deve ser perceptível.
- **Sessão de login dura até 6 horas** (limite técnico do `CacheService` do Apps
  Script) — depois disso, é pedido login de novo.
- **Botão "voltar" do navegador**: como a navegação interna do app não usa mais a URL
  (por causa de como o Apps Script isola a página num iframe), o botão de voltar do
  navegador não acompanha a navegação dentro do app. Use os links "← Voltar" da
  própria interface.
- **Cota de uso do Apps Script**: contas Google gratuitas têm limites diários de uso
  (tempo de execução de scripts, chamadas). Para o volume de uma ferramenta interna
  de time, isso dificilmente é atingido, mas vale saber que existe um teto.
