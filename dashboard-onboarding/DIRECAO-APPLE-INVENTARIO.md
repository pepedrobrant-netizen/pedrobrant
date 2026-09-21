# Inventário — Direção visual Apple × app real

Este documento existe por um motivo específico: o `mockup-apple-style-full.html`
é uma prova de **linguagem visual** (cores, sombras, tipografia, movimento),
não uma cópia pixel-a-pixel de cada função do app real. Comparando os dois
lado a lado, ficou claro que várias telas do mockup são mais simples do que
o `Script.html` de verdade — isso é normal num teste de direção visual, mas
é perigoso na hora de implementar: dá pra esquecer funcionalidade se alguém
usar só o mockup como referência.

**Regra pra quando for implementar de verdade:** a fonte da verdade de *o
que existe* é sempre o `Script.html`/`Código.gs` reais, nunca o mockup. O
mockup só decide *a aparência* (tokens de cor, radius, sombra, easing —
todos documentados no `<style>` do arquivo). Aplique os tokens em cima de
cada função abaixo, uma por uma — não recrie a tela a partir do que o
mockup mostra.

Legenda: ✅ já reproduzido fielmente no mockup Apple · 🎨 mockup tem uma
versão simplificada ou com dados diferentes dos reais · ⬜ não mockado ainda,
mas já usa os mesmos tokens/componentes quando for implementado.

## Login / Autenticação

| Função real (`Script.html`) | O que é | Status no mockup |
|---|---|---|
| `renderLogin` | Tela de senha da equipe (split-screen com tagline) | ✅ |
| `renderProfiles` | Seleção de perfil, 6 cards | ✅ |
| `togglePwVisibility` | Mostrar/ocultar senha | ✅ |
| `toggleProfileMenu`, `updateTopbarProfile` | Menu de perfil no topbar, trocar de perfil sem sair do app | ⬜ (mockup só tem botão "Sair" simples) |

## Carteira

| Função real | O que é | Status |
|---|---|---|
| `computeKPIs` | 6 tiles de KPI | ✅ |
| `openNovosClientesModal`, `openNovosClientesMesModal` | Modal de histórico de novos clientes por mês, com drill-down clicável por mês | ⬜ |
| `renderStatusPanel`, `renderCloserPanel`, `renderMilestonePanel` | Os 3 painéis de filtro (dropdown com checkboxes) | 🎨 (só os botões existem, os painéis não abrem) |
| `renderColPanel` | Seletor de colunas — 26 colunas em 7 grupos, "Padrão/Mostrar tudo/Ocultar tudo" | ⬜ |
| `setSort`, `renderHead` | Tabela ordenável por clique no cabeçalho | ⬜ |
| `consultantSwitcherHtml` | Seletor "Visualizando carteira de" (só pra admin, inclui "Todos — visão consolidada") | ⬜ |
| `carteiraRowHtml` → `openPerfil` | Clique na linha abre o Perfil | ✅ (só nos 4 clientes de exemplo) |
| Kanban por etapa | **Não existe no código real ainda** — é a spec `CARTEIRA-KANBAN.md` que criamos | ✅ |

## Central de Atenção

**Não existe no código real ainda** — é inteiramente a spec `SINAIS-PROATIVOS.md`
que definimos nesta conversa. O mockup reflete a spec, não uma tela existente.

## Perfil do Cliente

| Função real | O que é | Status |
|---|---|---|
| `renderPerfilGaleria` | Galeria com busca + filtro de status | 🎨 (versão simplificada, sem filtro) |
| `setIndicatorMode` | 2 modos de indicador (separado / único) no topo do perfil | ⬜ |
| `renderCronogramaTab`, `FASES_TEMPLATE` | As 8 fases reais, com todas as tarefas de cada uma | 🎨 (mockup mostra as 8 fases mas só detalha as tarefas da fase atual) |
| `scheduleFaseDate`, `scheduleTaskDate` | Agendar data por fase e por tarefa (fase 8) | ⬜ |
| `toggleFase` | Expandir/colapsar fase | ⬜ |
| `renderCrmTab`, `updateCrmField` | Campos de contato editáveis | 🎨 (mockup mostra os campos, mas não são editáveis) |
| `addEquipeMember`, `updateEquipeField`, `removeEquipeMember` | "Equipe extra" do cliente (pessoas além do contato principal) | ⬜ |
| `addRelacionamentoAction`, `updateRelacField`, `removeRelacAction` | Ações de relacionamento (adicionar/editar/remover) | 🎨 (mockup só lista, não edita) |
| `crmPhotoCardHtml`, `updateClientPhotoField`, `removeClientPhoto`, `downloadClientPhoto`, `downloadAllClientPhotos`, `openClientPhotoLightbox` | Galeria de fotos do cliente (upload, legenda, data, lightbox, download) | ⬜ |
| `renderSaudeTab` | Indicador de status + progresso + GMV | ✅ (versão simplificada) |

## Meta

| Função real | O que é | Status |
|---|---|---|
| Anel SVG com `circumference`/`dashOffset` real | Anel de progresso calculado matematicamente | 🎨 (mockup usa um anel de CSS puro, visual parecido mas não é a mesma implementação) |
| `badgeTier` | Sistema de nível/badge da carteira | ⬜ |
| Leaderboard só-admin (`isAmanda`) | Ranking do time, só visível pra Amanda/Julia | 🎨 (mockup mostra sempre, sem a condição de admin) |
| `setMetaPeriod`, `lastNMonthKeys(8)` | Seletor de período — últimos 8 meses | ⬜ |
| `metaKpiCard` × 4 | KPIs comparando real × meta: Ativação, % Ferramentas, Receita (GMV), Bônus | ⬜ (mockup tem números soltos, sem comparação real×meta) |
| `sparklineSvg` × 2 | Gráficos de linha acumulados (Ativação e GMV) comparando real × meta | ⬜ |
| Tabelas abaixo dos gráficos | Ainda não explorei o conteúdo completo (o arquivo continua depois da linha 1953) | ⬜ — **conferir o restante de `renderMeta` antes de implementar** |

## Analytics

**Atenção — o conteúdo real é diferente do que coloquei no mockup.** No
`Script.html`, Analytics é especificamente sobre **clientes em queda de
vendas** (já marcado como 🧪 protótipo ilustrativo no próprio app, ligado a
uma futura integração com o Astrobox — mesmo espírito do sinal 6 da Central
de Atenção). Não é uma visão geral de ticket médio/funil/novos clientes —
isso eu inventei.

| Função real | O que é | Status |
|---|---|---|
| `clientDropSeries`, KPIs de queda | Clientes em queda, maior queda, GMV em risco | ⬜ — mockup mostra conteúdo diferente, **refazer do zero** |
| `singleLineSvg` | Gráfico de linha do GMV da carteira, 6 meses | ⬜ |
| `analyticsRowHtml` | Tabela dos 10 clientes com maior queda | ⬜ |
| Recorte pela jornada ativa (`JORNADA_STATUS_VALUES`) | Só olha clientes em onboarding ativo, mesma regra do Kanban | ⬜ |

## Rotina

| Função real | O que é | Status |
|---|---|---|
| `renderRotinaSemana`, agenda editável por dia | Sub-aba "Semana" — editar tema/itens de cada dia | ⬜ na direção Apple (existia na versão anterior do mockup, não Apple) |
| `renderRotinaDiario` | Checklist do dia (Manhã/Durante o dia/Final do dia) | 🎨 (virou o conteúdo colapsado da aba "Hoje") |
| `renderRotinaSemanal` | Checklist semanal com progresso | 🎨 (versão já ajustada com os gaps de dado marcados) |
| `renderRotinaPorTipo` | Por tipo de cliente | 🎨 (versão já refeita como funil de Status) |
| `renderRotinaMensal`, itens editáveis | Mensal — adicionar/remover itens | 🎨 (mostrado, mas não editável) |
| `renderRotinaMissoes`, `createMission`, `deleteMission`, `toggleMissionComplete`, `updateMissionBell` | Missões — criar, completar, deletar, pontos, sininho de notificação | ⬜ não mockado na direção Apple |
| "Hoje" (ações prioritárias) | **Não existe no código real ainda** — é a spec desta conversa | ✅ |

## Calendário do Time

**Não existe no código real ainda** — é inteiramente a spec
`CALENDARIO-TIME.md`. O mockup reflete a spec.

## Global

| Função real | O que é | Status |
|---|---|---|
| `toggleTheme` | Alternar claro/escuro | 🎨 (os tokens dark mode já existem no CSS do mockup — só falta o botão) |
| `showToast` | Notificação temporária no canto da tela | ⬜ |
| `openModal` | Modal genérico reutilizável | ⬜ (o Perfil no mockup virou tela cheia, não modal — decisão a confirmar) |

## Como usar isso

Quando for implementar a direção Apple de verdade (no VS Code): percorra
esta lista de cima a baixo. Pra cada linha ⬜ ou 🎨, abra a função real
correspondente no `Script.html`, entenda o que ela faz, e reconstrua com os
tokens do mockup (`--surface-card`, `--shadow-md`, `--brand-orange`, a
classe `.widget`, `.pill-status`, `.seg-indicator` etc.) — **sem cortar
nenhum campo, filtro ou ação que já existe hoje.** O objetivo é trocar a
casca visual, não reduzir o que o app faz.
