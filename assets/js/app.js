(function () {
  "use strict";

  var STORAGE_KEY = "hm_onboarding_store_v2";
  var PROFILE_KEY = "hm_current_user_v1";
  // Dados de CRM ficam numa chave à parte, nunca semeada a partir de data/clients.json e
  // nunca incluída em "Exportar dados": só existe no navegador onde alguém do time digitou
  // algo. Como este app não sincroniza nada entre navegadores, isso garante que o
  // navegador do cliente (que nunca escreve nessa chave) nunca chega a ter essa informação.
  var CRM_STORAGE_KEY = "hm_crm_store_v1";

  var PROFILES = ["Ilana", "Pedro", "Josiane", "Madu", "Administrador"];
  var ASSIGNABLE = ["Ilana", "Pedro", "Josiane", "Madu"];
  var ADMIN = "Administrador";

  // Pilares de atuação (usados para classificar tarefas e no gráfico do Analytics)
  var PILARES_BASE = {
    relacionamento: { emoji: "🟢", nome: "Relacionamento", cor: "#2F8F5B" },
    estrategia: { emoji: "🔵", nome: "Estratégia", cor: "#2F5FA8" },
    capacitacao: { emoji: "🟡", nome: "Capacitação", cor: "#FFD450" }
  };
  function sortedPilaresKey(arr) {
    return arr.slice().sort().join(",");
  }

  // As 7 combinações da legenda — "keys" é a combinação exata de pilares base que
  // define a categoria; "key" é a chave canônica usada para classificar cada tarefa.
  var PILARES_LEGEND = [
    { keys: ["relacionamento"], emoji: "🟢", nome: "Relacionamento", objetivo: "Construir confiança" },
    { keys: ["estrategia"], emoji: "🔵", nome: "Estratégia", objetivo: "Direcionar" },
    { keys: ["capacitacao"], emoji: "🟡", nome: "Capacitação", objetivo: "Desenvolver" },
    { keys: ["relacionamento", "estrategia"], emoji: "🟢🔵", nome: "Inteligência do Cliente", objetivo: "Personalizar" },
    { keys: ["estrategia", "capacitacao"], emoji: "🔵🟡", nome: "Enablement Estratégico", objetivo: "Preparar" },
    { keys: ["relacionamento", "capacitacao"], emoji: "🟢🟡", nome: "Customer Enablement", objetivo: "Engajar" },
    { keys: ["relacionamento", "estrategia", "capacitacao"], emoji: "🟢🔵🟡", nome: "Customer Success", objetivo: "Gerar resultado" }
  ];
  PILARES_LEGEND.forEach(function (p) {
    p.key = sortedPilaresKey(p.keys);
    p.cor = p.keys.length === 1
      ? PILARES_BASE[p.keys[0]].cor
      : "linear-gradient(90deg, " + p.keys.map(function (k) { return PILARES_BASE[k].cor; }).join(", ") + ")";
  });

  var app = document.getElementById("app");
  var heroBanner = document.getElementById("hero-banner");
  var copyBtn = document.getElementById("copy-link-btn");
  var exportBtn = document.getElementById("export-btn");
  var addClientBtn = document.getElementById("add-client-btn");
  var analyticsBtn = document.getElementById("analytics-btn");
  var profileBtn = document.getElementById("profile-btn");
  var profileBtnLabel = document.getElementById("profile-btn-label");
  var modal = document.getElementById("add-client-modal");
  var addClientForm = document.getElementById("add-client-form");
  var addClientError = document.getElementById("add-client-error");
  var confirmModal = document.getElementById("confirm-modal");
  var confirmModalTitle = document.getElementById("confirm-modal-title");
  var confirmModalMessage = document.getElementById("confirm-modal-message");
  var confirmModalConfirmBtn = document.getElementById("confirm-modal-confirm");
  var confirmModalCallback = null;
  var photoInput = document.getElementById("photo-input");

  var store = null; // { [slug]: cliente }
  var crmStore = loadCrmStore(); // { [slug]: { endereco, aniversario, eventoParticipa, eventoQual, contratoAssinado, metaFaturamento } }
  var currentUser = localStorage.getItem(PROFILE_KEY) || null;
  if (currentUser === "Amanda") {
    // migração: nome antigo do perfil de administração
    currentUser = ADMIN;
    localStorage.setItem(PROFILE_KEY, currentUser);
  }
  var currentSlug = null;
  var openPhases = new Set();
  var addingTaskFor = new Set();
  var analyticsFilter = new Set(ASSIGNABLE);

  // ---------- Template para novos clientes ----------

  var TEMPLATE_FASES = [
    {
      titulo: "Setup de Conta",
      descricao: "Criação e configuração inicial da conta do cliente na Hotmart.",
      responsavel: "Suporte Técnico",
      tarefas: [
        { nome: "Envio de dados de migração", pilares: ["estrategia"] },
        { nome: "Completar cadastro da conta", pilares: ["estrategia"] }
      ]
    },
    {
      titulo: "Treinamento: Configurações Básicas",
      descricao: "Treinamento sobre as configurações essenciais da plataforma.",
      responsavel: "Time de Onboarding",
      tarefas: [
        { nome: "Overview e navegação", pilares: ["capacitacao"] },
        { nome: "Cadastro de produtos e formatos", pilares: ["capacitacao"] },
        { nome: "Configurações de checkout", pilares: ["capacitacao"] },
        { nome: "Otimização do checkout", pilares: ["estrategia", "capacitacao"] },
        { nome: "Integrações", pilares: ["capacitacao"] }
      ]
    },
    {
      titulo: "Treinamento: Club (Área de Membros)",
      descricao: "Treinamento e estruturação da área de membros (Club).",
      responsavel: "Especialista de Produto",
      tarefas: [
        { nome: "Navegação básica e ocultar produtos", pilares: ["capacitacao"] },
        { nome: "Gestão de conteúdo", pilares: ["capacitacao"] },
        { nome: "Club Sales", pilares: ["estrategia", "capacitacao"] },
        { nome: "Gestão de turmas e agendamento", pilares: ["capacitacao"] },
        { nome: "Capas de módulos, aulas e trilhas", pilares: ["capacitacao"] },
        { nome: "Personalizações", pilares: ["capacitacao"] },
        { nome: "Extras (tutor, PWA, insights)", pilares: ["capacitacao"] }
      ]
    },
    {
      titulo: "Acabamentos e Configurações Finais",
      descricao: "Ajustes finais de checkout, ofertas e integrações antes da venda.",
      responsavel: "Especialista de Conversão",
      tarefas: [
        { nome: "Criativos e artes", pilares: ["capacitacao"] },
        { nome: "Configurações gerais da plataforma", pilares: ["estrategia"] }
      ]
    },
    {
      titulo: "Checklist Pré-venda",
      descricao: "Validação final de ponta a ponta antes da abertura das vendas.",
      responsavel: "QA de Onboarding",
      tarefas: [
        { nome: "Relatórios essenciais", pilares: ["estrategia"] },
        { nome: "Check do Produto", pilares: ["estrategia", "capacitacao"] },
        { nome: "Definição de abertura de carrinho", pilares: ["estrategia"] }
      ]
    },
    {
      titulo: "Ativação",
      descricao: "Abertura oficial das vendas ao público.",
      responsavel: "Time de Onboarding",
      tarefas: [
        { nome: "Primeiros 10k após início da parceria", pilares: ["relacionamento", "estrategia", "capacitacao"] }
      ]
    },
    {
      titulo: "Relatórios Gerenciais (pós-ativação)",
      descricao: "Acompanhamento dos primeiros indicadores após a ativação.",
      responsavel: "Estrategista de Conta",
      tarefas: [
        { nome: "Relatório de Agente IA", pilares: ["estrategia"] },
        { nome: "Gestão de vendas e relatórios de vendas", pilares: ["estrategia"] },
        { nome: "Desempenho de checkout com Analytics", pilares: ["estrategia"] },
        { nome: "Dinheiro na mesa", pilares: ["estrategia", "capacitacao"] }
      ]
    },
    {
      titulo: "Acompanhamento",
      descricao: "Acompanhamento contínuo do cliente após o encerramento do onboarding.",
      responsavel: "Time de Onboarding",
      tarefas: [
        { nome: "Reunião de análise 30 dias", pilares: ["relacionamento", "estrategia"] },
        { nome: "Reunião de análise 60 dias", pilares: ["relacionamento", "estrategia"] },
        { nome: "Reunião de fechamento do onboarding", pilares: ["relacionamento", "estrategia", "capacitacao"] }
      ]
    }
  ];

  function cloneTemplateFases() {
    return TEMPLATE_FASES.map(function (fase, fi) {
      return {
        titulo: fase.titulo,
        descricao: fase.descricao,
        responsavel: fase.responsavel,
        tarefas: fase.tarefas.map(function (t, ti) {
          return {
            id: "f" + (fi + 1) + "t" + (ti + 1),
            nome: t.nome,
            pilares: t.pilares.slice(),
            concluida: false,
            data: null,
            removida: false
          };
        })
      };
    });
  }

  // ---------- Persistência ----------

  function loadStore() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        return Promise.resolve(JSON.parse(raw));
      } catch (e) {
        // dado corrompido, recarrega da semente
      }
    }
    return fetch("data/clients.json")
      .then(function (res) {
        if (!res.ok) throw new Error("Falha ao carregar dados");
        return res.json();
      })
      .then(function (data) {
        delete data._readme;
        saveStore(data);
        return data;
      });
  }

  function saveStore(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function persist() {
    saveStore(store);
  }

  // Store de CRM: nunca tem semente (não existe fetch de fallback). Se a chave não
  // existir neste navegador, começa vazio — só passa a existir quando alguém do time
  // digita algo, e só naquele navegador.
  function loadCrmStore() {
    var raw = localStorage.getItem(CRM_STORAGE_KEY);
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch (e) {
      return {};
    }
  }

  function persistCrm() {
    localStorage.setItem(CRM_STORAGE_KEY, JSON.stringify(crmStore));
  }

  function crmDefaults() {
    return {
      idCliente: "",
      telefonePrincipal: "",
      endereco: "",
      aniversario: null,
      eventoParticipa: false,
      eventoQual: "",
      contratoAssinado: false,
      metaFaturamento: "",
      equipe: []
    };
  }

  // Mescla com os defaults (não só substitui) para não quebrar quando o registro foi
  // salvo antes de um campo novo existir.
  function getCrm(slug) {
    var defaults = crmDefaults();
    var saved = crmStore[slug] || {};
    var merged = Object.assign(defaults, saved);
    merged.equipe = saved.equipe || [];
    return merged;
  }

  // Não chama refresh(): o próprio input/textarea/date já mostra o valor digitado
  // nativamente. Recriar o DOM a cada tecla/blur causaria uma corrida entre campos
  // vizinhos (o próximo "fill" foca o campo seguinte, disparando o "change" do atual
  // no meio de um refresh e perdendo valor). Quem precisa de refresh (ex.: toggles
  // sim/não, que mudam o que é exibido) chama refresh() explicitamente depois.
  function setCrmField(slug, field, value) {
    var current = getCrm(slug);
    current[field] = value;
    crmStore[slug] = current;
    persistCrm();
  }

  function addTeamMember(slug) {
    var current = getCrm(slug);
    current.equipe.push({ nome: "", cargo: "", telefone: "" });
    crmStore[slug] = current;
    persistCrm();
    refresh();
  }

  // Mesma razão do setCrmField acima: sem refresh(), para não perder valores dos
  // outros campos da mesma linha quando o foco muda rápido entre eles.
  function setTeamMemberField(slug, idx, field, value) {
    var current = getCrm(slug);
    if (!current.equipe[idx]) return;
    current.equipe[idx][field] = value;
    crmStore[slug] = current;
    persistCrm();
  }

  function removeTeamMember(slug, idx) {
    var current = getCrm(slug);
    current.equipe.splice(idx, 1);
    crmStore[slug] = current;
    persistCrm();
    refresh();
  }

  // ---------- Utilidades ----------

  function slugify(text) {
    return (text || "")
      .toString()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "cliente";
  }

  function uniqueSlug(base) {
    var slug = base;
    var n = 2;
    while (store[slug]) {
      slug = base + "-" + n;
      n++;
    }
    return slug;
  }

  function initials(nome) {
    var parts = (nome || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "??";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function formatDate(isoString) {
    if (!isoString) return null;
    var parts = isoString.split("-");
    var d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  }

  function escapeHtml(str) {
    return (str || "").toString().replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function avatarInnerHtml(cliente) {
    if (cliente.foto) {
      return '<img class="avatar-img" src="' + cliente.foto + '" alt="" />';
    }
    return escapeHtml(cliente.inicial);
  }

  function cameraIconSvg() {
    return (
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="14" r="3.2"/>' +
      "</svg>"
    );
  }

  // ---------- Perfil / permissões ----------
  // Não é autenticação: é uma preferência local (localStorage) para filtrar a lista de
  // clientes por responsável. Um link direto de cliente (?cliente=slug) nunca é
  // bloqueado por isso — só a lista/analytics internos são filtrados.

  function visibleSlugs() {
    var all = Object.keys(store);
    if (currentUser === ADMIN) return all;
    return all.filter(function (s) { return store[s].responsavelCliente === currentUser; });
  }

  function updateProfileButton() {
    profileBtnLabel.textContent = currentUser ? "👤 " + currentUser + " · trocar" : "Selecionar perfil";
    profileBtn.classList.toggle("is-set", !!currentUser);
  }

  function switchProfile() {
    currentUser = null;
    localStorage.removeItem(PROFILE_KEY);
    setParams({ cliente: null, view: null });
  }

  // ---------- Cálculo de progresso ----------

  function activeTasks(fase) {
    return fase.tarefas.filter(function (t) { return !t.removida; });
  }

  function faseProgress(fase) {
    var active = activeTasks(fase);
    var done = active.filter(function (t) { return t.concluida; }).length;
    var total = active.length;
    return { done: done, total: total, pct: total ? done / total : 1 };
  }

  function clientProgress(cliente) {
    var done = 0, total = 0;
    cliente.fases.forEach(function (fase) {
      var p = faseProgress(fase);
      done += p.done;
      total += p.total;
    });
    return total ? Math.round((done / total) * 100) : 0;
  }

  // Conta, entre as tarefas ativas e concluídas, quantas caem em cada uma das 7
  // combinações de pilares da legenda — pela combinação EXATA de pilares da tarefa,
  // não decompondo pilares combinados em contagens separadas por pilar base.
  function pilarCombCounts(cliente) {
    var counts = {};
    PILARES_LEGEND.forEach(function (p) { counts[p.key] = 0; });
    cliente.fases.forEach(function (fase) {
      fase.tarefas.forEach(function (t) {
        if (t.removida || !t.concluida) return;
        if (!t.pilares || !t.pilares.length) return;
        var key = sortedPilaresKey(t.pilares);
        if (counts.hasOwnProperty(key)) counts[key]++;
      });
    });
    return counts;
  }

  // status de cada fase: a primeira fase incompleta é "atual"; antes dela, "concluida"; depois, "pendente"
  function faseStatuses(cliente) {
    var statuses = [];
    var passedCurrent = false;
    cliente.fases.forEach(function (fase) {
      var pct = faseProgress(fase).pct;
      if (pct >= 1) {
        statuses.push("concluida");
      } else if (!passedCurrent) {
        statuses.push("atual");
        passedCurrent = true;
      } else {
        statuses.push("pendente");
      }
    });
    return statuses;
  }

  // ---------- Mutações ----------

  function findTask(cliente, faseIdx, taskId) {
    var fase = cliente.fases[faseIdx];
    if (!fase) return null;
    return fase.tarefas.filter(function (t) { return t.id === taskId; })[0] || null;
  }

  function toggleTask(slug, faseIdx, taskId) {
    var cliente = store[slug];
    var task = findTask(cliente, faseIdx, taskId);
    if (!task) return;
    task.concluida = !task.concluida;
    if (task.concluida && !task.data) task.data = todayISO();
    persist();
    refresh();
  }

  function setTaskDate(slug, faseIdx, taskId, value) {
    var cliente = store[slug];
    var task = findTask(cliente, faseIdx, taskId);
    if (!task) return;
    task.data = value || null;
    persist();
    refresh();
  }

  function removeTask(slug, faseIdx, taskId) {
    var cliente = store[slug];
    var task = findTask(cliente, faseIdx, taskId);
    if (!task) return;
    task.removida = true;
    persist();
    refresh();
  }

  function restoreTask(slug, faseIdx, taskId) {
    var cliente = store[slug];
    var task = findTask(cliente, faseIdx, taskId);
    if (!task) return;
    task.removida = false;
    persist();
    refresh();
  }

  function deleteTaskForever(slug, faseIdx, taskId) {
    var cliente = store[slug];
    var fase = cliente.fases[faseIdx];
    if (!fase) return;
    fase.tarefas = fase.tarefas.filter(function (t) { return t.id !== taskId; });
    persist();
    refresh();
  }

  function addTask(slug, faseIdx, nome) {
    var cliente = store[slug];
    var fase = cliente.fases[faseIdx];
    if (!fase) return;
    var idx = fase.tarefas.length + 1;
    var id = "f" + (faseIdx + 1) + "-custom-" + idx;
    while (fase.tarefas.some(function (t) { return t.id === id; })) {
      idx++;
      id = "f" + (faseIdx + 1) + "-custom-" + idx;
    }
    fase.tarefas.push({ id: id, nome: nome, concluida: false, data: null, removida: false, custom: true });
    persist();
  }

  function addClient(fields) {
    var slug = uniqueSlug(slugify(fields.nome));
    store[slug] = {
      nome: fields.nome,
      empresa: fields.empresa || "",
      inicial: initials(fields.nome),
      idConta: fields.idConta || "",
      responsavelCliente: fields.responsavelCliente || "",
      criadoPor: currentUser || "",
      dataInicio: fields.dataInicio || todayISO(),
      fases: cloneTemplateFases()
    };
    persist();
    return slug;
  }

  function deleteClient(slug) {
    delete store[slug];
    persist();
  }

  function setClientPhoto(slug, dataUrl) {
    var cliente = store[slug];
    if (!cliente) return;
    cliente.foto = dataUrl;
    persist();
    refresh();
  }

  function removeClientPhoto(slug) {
    var cliente = store[slug];
    if (!cliente) return;
    cliente.foto = null;
    persist();
    refresh();
  }

  // Redimensiona a imagem no cliente (canvas) antes de salvar como data URL,
  // para não inflar o localStorage com fotos em resolução alta.
  function resizeImageFile(file, maxSize) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          var w = Math.max(1, Math.round(img.width * scale));
          var h = Math.max(1, Math.round(img.height * scale));
          var canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ---------- Renderização ----------

  function renderProfileGate() {
    copyBtn.style.display = "none";
    var tpl = document.getElementById("tpl-profile-gate");
    var node = tpl.content.cloneNode(true);
    var grid = node.getElementById("profile-grid");

    PROFILES.forEach(function (name) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "profile-chip" + (name === ADMIN ? " profile-chip--coord" : "");
      btn.textContent = name + (name === ADMIN ? " (vê todos os clientes)" : "");
      btn.addEventListener("click", function () {
        currentUser = name;
        localStorage.setItem(PROFILE_KEY, name);
        refresh();
      });
      grid.appendChild(btn);
    });

    app.innerHTML = "";
    app.appendChild(node);
  }

  function renderPicker() {
    copyBtn.style.display = "none";
    var tpl = document.getElementById("tpl-client-picker");
    var node = tpl.content.cloneNode(true);
    var list = node.getElementById("picker-list");

    var filterNote = document.createElement("p");
    filterNote.className = "picker__filter-note";
    filterNote.textContent = currentUser === ADMIN
      ? "Visão geral (administrador): todos os clientes, de todos os responsáveis."
      : "Mostrando apenas os clientes de " + currentUser + ".";
    node.getElementById("picker-example-url").parentNode.parentNode.insertBefore(filterNote, list);

    var slugs = visibleSlugs();
    if (!slugs.length) {
      var empty = document.createElement("p");
      empty.className = "picker__text";
      empty.textContent = "Nenhum cliente atribuído a você ainda. Use o botão “+ Novo cliente” para começar.";
      list.appendChild(empty);
    }

    slugs.forEach(function (slug) {
      var c = store[slug];
      var a = document.createElement("a");
      a.className = "picker__item";
      a.href = "?cliente=" + encodeURIComponent(slug);
      a.innerHTML =
        '<span class="picker__item-avatar">' + avatarInnerHtml(c) + "</span>" +
        '<span class="picker__item-body">' +
          '<span class="picker__item-name">' + escapeHtml(c.nome) + "</span><br>" +
          '<span class="picker__item-meta">' + escapeHtml(c.empresa || "Sem empresa informada") +
            (c.responsavelCliente ? " · " + escapeHtml(c.responsavelCliente) : "") + "</span>" +
        "</span>" +
        '<span class="picker__item-progress">' + clientProgress(c) + "%</span>";
      list.appendChild(a);
    });

    var exampleUrl = node.getElementById("picker-example-url");
    var firstSlug = slugs[0];
    exampleUrl.textContent = firstSlug
      ? window.location.origin + window.location.pathname + "?cliente=" + firstSlug
      : window.location.origin + window.location.pathname + "?cliente=slug-do-cliente";

    app.innerHTML = "";
    app.appendChild(node);
  }

  function renderNotFound() {
    copyBtn.style.display = "none";
    var tpl = document.getElementById("tpl-not-found");
    var backWrap = document.createElement("div");
    backWrap.innerHTML = backLinkHtml();
    app.innerHTML = "";
    app.appendChild(backWrap.firstElementChild);
    app.appendChild(tpl.content.cloneNode(true));
  }

  function backLinkHtml() {
    return '<a href="?" class="back-link" data-action="nav-back">← Voltar para clientes</a>';
  }

  function backToClientLinkHtml(slug) {
    return '<a href="?cliente=' + encodeURIComponent(slug) +
      '" class="back-link" data-action="nav-back-client" data-slug="' + encodeURIComponent(slug) + '">← Voltar para o cliente</a>';
  }

  function statTileHtml(value, label) {
    return (
      '<div class="stat-tile">' +
        '<div class="stat-tile__value">' + value + "</div>" +
        '<div class="stat-tile__label">' + label + "</div>" +
      "</div>"
    );
  }

  function rowsFor(slugs) {
    return slugs
      .map(function (slug) {
        var c = store[slug];
        return {
          slug: slug,
          nome: c.nome,
          empresa: c.empresa,
          responsavel: c.responsavelCliente,
          pct: clientProgress(c)
        };
      })
      .sort(function (a, b) { return b.pct - a.pct; });
  }

  function avgOf(rows) {
    return rows.length ? Math.round(rows.reduce(function (sum, r) { return sum + r.pct; }, 0) / rows.length) : 0;
  }

  function barChartHtml(rows) {
    if (!rows.length) return '<p class="picker__text">Nenhum cliente para mostrar.</p>';
    var barsHtml = rows.map(function (r) {
      return (
        '<a class="bar-row" href="?cliente=' + encodeURIComponent(r.slug) + '" title="' +
          escapeHtml(r.nome) + " — " + r.pct + '% concluído">' +
          '<div class="bar-row__label">' +
            '<span class="bar-row__name">' + escapeHtml(r.nome) + "</span>" +
            '<span class="bar-row__meta">' + escapeHtml(r.empresa || "") +
              (r.responsavel ? " · " + escapeHtml(r.responsavel) : "") + "</span>" +
          "</div>" +
          '<div class="bar-row__track"><div class="bar-row__fill" style="width:' + r.pct + '%"></div></div>' +
          '<span class="bar-row__value">' + r.pct + "%</span>" +
        "</a>"
      );
    }).join("");
    return '<div class="chart-card"><div class="bar-chart">' + barsHtml + "</div></div>";
  }

  function pilaresLegendHtml() {
    var rows = PILARES_LEGEND.map(function (p) {
      return (
        '<div class="pilares-legend__row">' +
          '<span class="pilares-legend__emoji">' + p.emoji + "</span>" +
          '<span class="pilares-legend__name">' + escapeHtml(p.nome) + "</span>" +
          '<span class="pilares-legend__goal">' + escapeHtml(p.objetivo) + "</span>" +
        "</div>"
      );
    }).join("");
    return '<div class="pilares-legend">' + rows + "</div>";
  }

  function pilarMiniChartHtml(cliente) {
    var counts = pilarCombCounts(cliente);
    var max = Math.max.apply(null, PILARES_LEGEND.map(function (p) { return counts[p.key]; }).concat([1]));
    // Só mostra categorias com pelo menos 1 tarefa concluída — com a legenda tendo
    // 7 combinações, exibir todas sempre vira uma parede de barras zeradas para
    // clientes no início do onboarding.
    return PILARES_LEGEND.filter(function (p) { return counts[p.key] > 0; }).map(function (p) {
      var val = counts[p.key];
      var pct = Math.round((val / max) * 100);
      return (
        '<div class="pilar-bar-row">' +
          '<span class="pilar-bar-row__label">' + p.emoji + " " + escapeHtml(p.nome) + "</span>" +
          '<div class="pilar-bar-row__track"><div class="pilar-bar-row__fill" style="width:' + pct + "%;background:" + p.cor + '"></div></div>' +
          '<span class="pilar-bar-row__value">' + val + "</span>" +
        "</div>"
      );
    }).join("");
  }

  function pilaresPorClienteHtml(rows) {
    if (!rows.length) return "";
    var cards = rows.map(function (r) {
      var cliente = store[r.slug];
      var counts = pilarCombCounts(cliente);
      var allZero = PILARES_LEGEND.every(function (p) { return !counts[p.key]; });
      return (
        '<div class="pilar-card">' +
          '<div class="pilar-card__header">' +
            '<a class="pilar-card__name" href="?cliente=' + encodeURIComponent(r.slug) + '">' + escapeHtml(cliente.nome) + "</a>" +
          "</div>" +
          (allZero
            ? '<p class="pilar-card__empty">Nenhuma tarefa concluída com pilar definido ainda.</p>'
            : pilarMiniChartHtml(cliente)) +
        "</div>"
      );
    }).join("");
    return (
      '<p class="analytics__section-label">Pilares por cliente (com base nas tarefas concluídas)</p>' +
      pilaresLegendHtml() +
      '<div class="pilar-cards">' + cards + "</div>"
    );
  }

  var MESES = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
  ];

  // Baseado no CRM (localStorage próprio, ver getCrm) — só enxerga aniversários
  // preenchidos neste mesmo navegador.
  function birthdaysHtml(slugs) {
    var curMonth = new Date().getMonth() + 1;
    var items = slugs
      .map(function (slug) {
        var crm = crmStore[slug];
        if (!crm || !crm.aniversario) return null;
        var mes = +crm.aniversario.slice(5, 7);
        if (mes !== curMonth) return null;
        var dia = +crm.aniversario.slice(8, 10);
        return { slug: slug, nome: store[slug].nome, dia: dia };
      })
      .filter(Boolean)
      .sort(function (a, b) { return a.dia - b.dia; });

    var body = items.length
      ? '<div class="birthday-list">' + items.map(function (it) {
          return (
            '<a class="birthday-row" href="?cliente=' + encodeURIComponent(it.slug) + '">' +
              '<span class="birthday-row__day">' + (it.dia < 10 ? "0" + it.dia : it.dia) + "</span>" +
              '<span class="birthday-row__name">' + escapeHtml(it.nome) + "</span>" +
            "</a>"
          );
        }).join("") + "</div>"
      : '<p class="picker__text">Nenhum aniversariante este mês (com base no CRM preenchido neste navegador).</p>';

    var cakeIcon =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M4 21h16" />' +
        '<path d="M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7" />' +
        '<path d="M12 12V7" />' +
        '<path d="M12 7c-1 0-1.5-.7-1.5-1.5S12 3 12 3s1.5.7 1.5 1.5S13 7 12 7z" />' +
      "</svg>";

    return (
      '<p class="analytics__section-label analytics__section-label--icon">' +
        cakeIcon + "Aniversariantes de " + MESES[curMonth - 1] +
      "</p>" +
      body
    );
  }

  function renderAnalytics() {
    copyBtn.style.display = "none";
    var isAdmin = currentUser === ADMIN;

    if (!isAdmin) {
      var rows = rowsFor(visibleSlugs());
      var wrap = document.createElement("section");
      wrap.className = "analytics";
      wrap.innerHTML =
        backLinkHtml() +
        '<div class="analytics__header">' +
          '<h1 class="analytics__title">Analytics</h1>' +
          '<p class="analytics__subtitle">Progresso dos clientes de ' + escapeHtml(currentUser) + ".</p>" +
        "</div>" +
        '<div class="analytics__stats">' +
          statTileHtml(rows.length, rows.length === 1 ? "Cliente" : "Clientes") +
          statTileHtml(avgOf(rows) + "%", "Progresso médio") +
        "</div>" +
        birthdaysHtml(rows.map(function (r) { return r.slug; })) +
        '<p class="analytics__section-label">Clientes</p>' +
        barChartHtml(rows) +
        pilaresPorClienteHtml(rows);
      app.innerHTML = "";
      app.appendChild(wrap);
      return;
    }

    // Administrador: visão geral fixa + filtro por onboarding
    var allSlugs = Object.keys(store);
    var overallRows = rowsFor(allSlugs);
    var selected = ASSIGNABLE.filter(function (name) { return analyticsFilter.has(name); });

    var filterChipsHtml = ASSIGNABLE.map(function (name) {
      var active = analyticsFilter.has(name);
      return '<button type="button" class="filter-chip' + (active ? " is-active" : "") +
        '" data-action="toggle-onboarder-filter" data-name="' + escapeHtml(name) + '">' + escapeHtml(name) + "</button>";
    }).join("");

    var breakdownHtml = "";
    var chartRows;
    if (!selected.length) {
      breakdownHtml = '<p class="picker__text">Selecione ao menos um onboarding para ver o detalhamento.</p>';
      chartRows = [];
    } else {
      breakdownHtml = '<div class="analytics__stats">' + selected.map(function (name) {
        var nameRows = rowsFor(allSlugs.filter(function (s) { return store[s].responsavelCliente === name; }));
        return statTileHtml(avgOf(nameRows) + "%", name + " (" + nameRows.length + ")");
      }).join("") + "</div>";
      chartRows = rowsFor(allSlugs.filter(function (s) { return selected.indexOf(store[s].responsavelCliente) !== -1; }));
    }

    var wrap = document.createElement("section");
    wrap.className = "analytics";
    wrap.innerHTML =
      backLinkHtml() +
      '<div class="analytics__header">' +
        '<h1 class="analytics__title">Analytics</h1>' +
        '<p class="analytics__subtitle">Visão geral (administrador): todos os clientes, todos os responsáveis.</p>' +
      "</div>" +
      '<div class="analytics__stats">' +
        statTileHtml(overallRows.length, overallRows.length === 1 ? "Cliente (todos)" : "Clientes (todos)") +
        statTileHtml(avgOf(overallRows) + "%", "Progresso médio geral") +
      "</div>" +
      birthdaysHtml(allSlugs) +
      '<div class="filter-row">' +
        filterChipsHtml +
        '<div class="filter-actions">' +
          '<button type="button" class="filter-action-link" data-action="filter-select-all">Selecionar todos</button>' +
          '<button type="button" class="filter-action-link" data-action="filter-clear">Limpar</button>' +
        "</div>" +
      "</div>" +
      '<p class="analytics__section-label">Progresso médio por onboarding selecionado</p>' +
      breakdownHtml +
      '<p class="analytics__section-label">Clientes no filtro atual</p>' +
      barChartHtml(chartRows) +
      pilaresPorClienteHtml(chartRows);

    app.innerHTML = "";
    app.appendChild(wrap);
  }

  function taskRowHtml(faseIdx, task) {
    return (
      '<div class="task-row' + (task.concluida ? " task-row--done" : "") + '">' +
        '<button type="button" class="task-check" data-action="toggle-task" data-fase="' + faseIdx + '" data-task="' + task.id + '" aria-label="Marcar tarefa como concluída">' +
          (task.concluida ? "✓" : "") +
        "</button>" +
        '<span class="task-name">' + escapeHtml(task.nome) + "</span>" +
        '<input type="date" class="task-date" data-action="set-date" data-fase="' + faseIdx + '" data-task="' + task.id + '" value="' + (task.data || "") + '" />' +
        '<button type="button" class="task-remove" data-action="remove-task" data-fase="' + faseIdx + '" data-task="' + task.id + '" title="Remover (não se aplica a este cliente)" aria-label="Remover tarefa">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        "</button>" +
      "</div>"
    );
  }

  function removedTaskRowHtml(faseIdx, task) {
    return (
      '<div class="task-row task-row--removed">' +
        '<span class="task-name">' + escapeHtml(task.nome) + "</span>" +
        '<button type="button" class="task-restore" data-action="restore-task" data-fase="' + faseIdx + '" data-task="' + task.id + '">Restaurar</button>' +
        (task.custom
          ? '<button type="button" class="task-delete" data-action="delete-task-forever" data-fase="' + faseIdx + '" data-task="' + task.id + '" title="Excluir definitivamente — não pode ser desfeito">Excluir definitivamente</button>'
          : "") +
      "</div>"
    );
  }

  function addTaskControlHtml(faseIdx) {
    if (addingTaskFor.has(faseIdx)) {
      return (
        '<form class="add-task-form" data-fase="' + faseIdx + '">' +
          '<input type="text" name="nome" class="add-task-input" placeholder="Nome da nova tarefa" required autocomplete="off" />' +
          '<button type="submit" class="btn btn--primary btn--small">Adicionar</button>' +
          '<button type="button" class="btn btn--secondary btn--small" data-action="cancel-add-task" data-fase="' + faseIdx + '">Cancelar</button>' +
        "</form>"
      );
    }
    return '<button type="button" class="add-task-btn" data-action="show-add-task" data-fase="' + faseIdx + '">+ Adicionar tarefa</button>';
  }

  function renderClient(slug) {
    var cliente = store[slug];
    copyBtn.style.display = "inline-block";
    var progress = clientProgress(cliente);
    var statuses = faseStatuses(cliente);

    if (!openPhases.size) {
      var atualIdx = statuses.indexOf("atual");
      openPhases.add(atualIdx >= 0 ? atualIdx : 0);
    }

    var topRow = document.createElement("div");
    topRow.className = "client-top-row";
    topRow.innerHTML =
      backLinkHtml() +
      '<div class="client-top-row__actions">' +
        (currentUser
          ? '<button type="button" class="btn btn--secondary btn--small" data-action="go-crm">CRM</button>'
          : "") +
        '<button type="button" class="btn btn--danger btn--small" data-action="delete-client">Excluir cliente</button>' +
      "</div>";

    var header = document.createElement("section");
    header.className = "client-header";
    header.innerHTML =
      '<div class="client-header__top">' +
        '<div class="client-header__avatar-wrap">' +
          '<div class="client-header__avatar">' + avatarInnerHtml(cliente) + "</div>" +
          '<button type="button" class="avatar-upload-btn" data-action="upload-photo" title="Alterar foto" aria-label="Alterar foto">' +
            cameraIconSvg() +
          "</button>" +
        "</div>" +
        "<div>" +
          '<h1 class="client-header__name">' + escapeHtml(cliente.nome) + "</h1>" +
          '<p class="client-header__company">' + escapeHtml(cliente.empresa || "Sem empresa informada") + "</p>" +
          '<p class="client-header__account">ID da conta: <strong>' + escapeHtml(cliente.idConta || "não informado") +
            "</strong> · Responsável: <strong>" + escapeHtml(cliente.responsavelCliente || "não atribuído") + "</strong></p>" +
          (cliente.foto
            ? '<button type="button" class="filter-action-link client-header__remove-photo" data-action="remove-photo">Remover foto</button>'
            : "") +
        "</div>" +
      "</div>" +
      '<div class="progress">' +
        '<div class="progress__track"><div class="progress__fill" style="width:' + progress + '%"></div></div>' +
        '<div class="progress__label">' + progress + "% concluído</div>" +
      "</div>" +
      '<div class="client-header__meta">' +
        "<span>Início: <strong>" + (formatDate(cliente.dataInicio) || "—") + "</strong></span>" +
      "</div>";

    var timeline = document.createElement("div");
    timeline.className = "timeline";

    cliente.fases.forEach(function (fase, i) {
      var status = statuses[i];
      var p = faseProgress(fase);
      var phasePct = Math.round(p.pct * 100);
      var removedTasks = fase.tarefas.filter(function (t) { return t.removida; });

      var phase = document.createElement("div");
      phase.className = "phase phase--" + status;
      if (openPhases.has(i)) phase.classList.add("is-open");

      var tasksHtml = activeTasks(fase).map(function (t) { return taskRowHtml(i, t); }).join("");
      var removedHtml = removedTasks.length
        ? '<div class="removed-tasks"><p class="removed-tasks__label">Tarefas removidas (não contam no progresso)</p>' +
            removedTasks.map(function (t) { return removedTaskRowHtml(i, t); }).join("") +
          "</div>"
        : "";

      phase.innerHTML =
        '<span class="phase__marker">' + (status === "concluida" ? "✓" : i + 1) + "</span>" +
        '<div class="phase__card">' +
          '<div class="phase__header" data-action="toggle-phase" data-fase="' + i + '">' +
            '<div class="phase__title-group">' +
              '<p class="phase__title">' + (i + 1) + ". " + escapeHtml(fase.titulo) + "</p>" +
              '<div class="phase__progress">' +
                '<div class="phase__progress-track"><div class="phase__progress-fill" style="width:' + phasePct + '%"></div></div>' +
                '<span class="phase__progress-label">' + p.done + "/" + p.total + "</span>" +
              "</div>" +
            "</div>" +
            '<span class="phase__badge">' + { concluida: "Concluída", atual: "Em andamento", pendente: "Pendente" }[status] + "</span>" +
            '<svg class="phase__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>' +
          "</div>" +
          '<div class="phase__body">' +
            '<div class="phase__body-inner">' +
              '<p class="phase__desc">' + escapeHtml(fase.descricao) + "</p>" +
              '<div class="phase__tasks">' + (tasksHtml || '<p class="phase__empty">Todas as tarefas desta fase foram removidas para este cliente.</p>') + "</div>" +
              addTaskControlHtml(i) +
              removedHtml +
              '<p class="phase__owner">Responsável pela fase: ' + escapeHtml(cliente.criadoPor || "não informado") + "</p>" +
            "</div>" +
          "</div>" +
        "</div>";

      timeline.appendChild(phase);
    });

    var footer = document.createElement("p");
    footer.className = "footer-note";
    footer.textContent = "Este link é exclusivo e não requer login. Guarde-o para acompanhar seu onboarding a qualquer momento.";

    app.innerHTML = "";
    app.appendChild(topRow);
    app.appendChild(header);
    app.appendChild(timeline);
    app.appendChild(footer);
  }

  function yesNoToggleHtml(field, value, slug) {
    return (
      '<div class="yesno-toggle">' +
        '<button type="button" class="yesno-chip' + (value ? " is-active" : "") +
          '" data-action="crm-set-bool" data-field="' + field + '" data-value="true">Sim</button>' +
        '<button type="button" class="yesno-chip' + (!value ? " is-active" : "") +
          '" data-action="crm-set-bool" data-field="' + field + '" data-value="false">Não</button>' +
      "</div>"
    );
  }

  function teamMemberRowHtml(slug, idx, pessoa) {
    return (
      '<div class="crm-team-row">' +
        '<input class="field__input" type="text" data-action="crm-team-set" data-idx="' + idx + '" data-field="nome" ' +
          'placeholder="Nome" value="' + escapeHtml(pessoa.nome) + '" />' +
        '<input class="field__input" type="text" data-action="crm-team-set" data-idx="' + idx + '" data-field="cargo" ' +
          'placeholder="Cargo" value="' + escapeHtml(pessoa.cargo) + '" />' +
        '<input class="field__input" type="text" data-action="crm-team-set" data-idx="' + idx + '" data-field="telefone" ' +
          'placeholder="Telefone" value="' + escapeHtml(pessoa.telefone) + '" />' +
        '<button type="button" class="crm-team-remove" data-action="crm-team-remove" data-idx="' + idx + '" ' +
          'title="Remover pessoa" aria-label="Remover pessoa">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        "</button>" +
      "</div>"
    );
  }

  function renderCrm(slug) {
    copyBtn.style.display = "none";
    var cliente = store[slug];
    var crm = getCrm(slug);

    var teamRowsHtml = crm.equipe.length
      ? crm.equipe.map(function (p, i) { return teamMemberRowHtml(slug, i, p); }).join("")
      : '<p class="crm-team-empty">Nenhuma pessoa cadastrada ainda.</p>';

    var wrap = document.createElement("section");
    wrap.className = "crm";
    wrap.innerHTML =
      backToClientLinkHtml(slug) +
      '<div class="crm__header">' +
        '<h1 class="crm__title">CRM · ' + escapeHtml(cliente.nome) + "</h1>" +
        '<p class="crm__subtitle">Dados internos e sensíveis — visíveis só para o time (Ilana, Pedro, Josiane, ' +
          "Madu, Administrador). Guardados apenas neste navegador: não entram no " +
          '"Exportar dados" nem em nenhuma versão pública do link deste cliente, e não ' +
          "aparecem para outros times/dispositivos que não tenham preenchido aqui.</p>" +
      "</div>" +
      '<div class="crm__card">' +
        '<p class="crm__card-title">Contato</p>' +
        '<label class="field crm-field">' +
          '<span class="field__label">ID do cliente</span>' +
          '<input class="field__input" type="text" data-action="crm-set-text" data-field="idCliente" ' +
            'placeholder="Número/identificador da conta" value="' + escapeHtml(crm.idCliente) + '" />' +
        "</label>" +
        '<label class="field crm-field">' +
          '<span class="field__label">Telefone principal (WhatsApp)</span>' +
          '<input class="field__input" type="text" data-action="crm-set-text" data-field="telefonePrincipal" ' +
            'placeholder="(11) 91234-5678" value="' + escapeHtml(crm.telefonePrincipal) + '" />' +
        "</label>" +
        '<label class="field crm-field">' +
          '<span class="field__label">Endereço completo (para envio de brindes)</span>' +
          '<textarea class="field__input crm-textarea" rows="3" data-action="crm-set-text" data-field="endereco" ' +
            'placeholder="Rua, número, complemento, bairro, cidade, estado, CEP">' + escapeHtml(crm.endereco) + "</textarea>" +
        "</label>" +
        '<label class="field crm-field">' +
          '<span class="field__label">Data de aniversário</span>' +
          '<input class="field__input" type="date" data-action="crm-set-text" data-field="aniversario" value="' + (crm.aniversario || "") + '" />' +
        "</label>" +
      "</div>" +
      '<div class="crm__card">' +
        '<p class="crm__card-title">Comercial</p>' +
        '<div class="field crm-field">' +
          '<span class="field__label">Vai participar de algum evento?</span>' +
          yesNoToggleHtml("eventoParticipa", crm.eventoParticipa, slug) +
          (crm.eventoParticipa
            ? '<input class="field__input crm-followup" type="text" data-action="crm-set-text" data-field="eventoQual" ' +
                'placeholder="Qual evento?" value="' + escapeHtml(crm.eventoQual) + '" />'
            : "") +
        "</div>" +
        '<div class="field crm-field">' +
          '<span class="field__label">Tem contrato assinado?</span>' +
          yesNoToggleHtml("contratoAssinado", crm.contratoAssinado, slug) +
        "</div>" +
        '<label class="field crm-field">' +
          '<span class="field__label">Meta de faturamento</span>' +
          '<input class="field__input" type="text" data-action="crm-set-text" data-field="metaFaturamento" ' +
            'placeholder="Ex.: R$ 50.000/mês" value="' + escapeHtml(crm.metaFaturamento) + '" />' +
        "</label>" +
      "</div>" +
      '<div class="crm__card crm__card--team">' +
        '<p class="crm__card-title">Equipe do cliente</p>' +
        '<div class="crm-team-list">' + teamRowsHtml + "</div>" +
        '<button type="button" class="add-task-btn" data-action="crm-team-add">+ Adicionar pessoa</button>' +
      "</div>";

    app.innerHTML = "";
    app.appendChild(wrap);
  }

  // ---------- Roteamento ----------

  function getView() {
    var params = new URLSearchParams(window.location.search);
    var slug = params.get("cliente");
    if (slug) {
      // A rota do CRM só existe de verdade quando há um perfil do time ativo neste
      // navegador — sem isso, o parâmetro "view=crm" é ignorado silenciosamente e cai
      // na tela normal do cliente (não expõe nem a existência da aba).
      if (params.get("view") === "crm" && currentUser) return { type: "crm", slug: slug };
      return { type: "client", slug: slug };
    }
    if (params.get("view") === "analytics") return { type: "analytics" };
    return { type: "picker" };
  }

  function render() {
    var view = getView();
    updateProfileButton();

    if (view.type === "client" || view.type === "crm") {
      heroBanner.hidden = true;
      currentSlug = view.slug;
      if (!store[view.slug]) {
        openPhases = new Set();
        renderNotFound();
        return;
      }
      if (view.type === "crm") {
        renderCrm(view.slug);
      } else {
        renderClient(view.slug);
      }
      return;
    }

    currentSlug = null;
    if (!currentUser) {
      heroBanner.hidden = false;
      renderProfileGate();
      return;
    }
    if (view.type === "analytics") {
      heroBanner.hidden = true;
      renderAnalytics();
    } else {
      heroBanner.hidden = false;
      renderPicker();
    }
  }

  function refresh() {
    var y = window.scrollY;
    render();
    window.scrollTo(0, y);
  }

  function setParams(obj) {
    var url = new URL(window.location.href);
    Object.keys(obj).forEach(function (k) {
      if (obj[k] === null) url.searchParams.delete(k);
      else url.searchParams.set(k, obj[k]);
    });
    window.history.pushState(null, "", url);
    openPhases = new Set();
    addingTaskFor = new Set();
    refresh();
  }

  function goToPicker() { setParams({ cliente: null, view: null }); }
  function goToAnalytics() { setParams({ cliente: null, view: "analytics" }); }
  function goToClient(slug) { setParams({ cliente: slug, view: null }); }
  function goToCrm(slug) { setParams({ cliente: slug, view: "crm" }); }

  // ---------- Eventos ----------

  app.addEventListener("click", function (e) {
    var backEl = e.target.closest('[data-action="nav-back"]');
    if (backEl) {
      e.preventDefault();
      goToPicker();
      return;
    }

    var backClientEl = e.target.closest('[data-action="nav-back-client"]');
    if (backClientEl) {
      e.preventDefault();
      goToClient(backClientEl.getAttribute("data-slug"));
      return;
    }

    var target = e.target.closest("[data-action]");
    if (!target) return;
    var action = target.getAttribute("data-action");
    var slug = currentSlug;
    var faseIdx = target.hasAttribute("data-fase") ? +target.getAttribute("data-fase") : null;
    var taskId = target.getAttribute("data-task");

    if (action === "toggle-phase") {
      if (openPhases.has(faseIdx)) {
        openPhases.delete(faseIdx);
      } else {
        openPhases.add(faseIdx);
      }
      refresh();
    } else if (action === "toggle-task") {
      toggleTask(slug, faseIdx, taskId);
    } else if (action === "remove-task") {
      removeTask(slug, faseIdx, taskId);
    } else if (action === "restore-task") {
      restoreTask(slug, faseIdx, taskId);
    } else if (action === "show-add-task") {
      addingTaskFor.add(faseIdx);
      refresh();
    } else if (action === "cancel-add-task") {
      addingTaskFor.delete(faseIdx);
      refresh();
    } else if (action === "delete-task-forever") {
      if (window.confirm("Excluir esta tarefa definitivamente? Essa ação não pode ser desfeita.")) {
        deleteTaskForever(slug, faseIdx, taskId);
      }
    } else if (action === "toggle-onboarder-filter") {
      var name = target.getAttribute("data-name");
      if (analyticsFilter.has(name)) analyticsFilter.delete(name);
      else analyticsFilter.add(name);
      refresh();
    } else if (action === "filter-select-all") {
      analyticsFilter = new Set(ASSIGNABLE);
      refresh();
    } else if (action === "filter-clear") {
      analyticsFilter = new Set();
      refresh();
    } else if (action === "delete-client") {
      var clienteAtual = store[slug];
      if (!clienteAtual) return;
      openConfirmModal(
        "Excluir cliente",
        "Tem certeza que deseja excluir " + clienteAtual.nome + "? Essa ação não pode ser desfeita.",
        function () {
          deleteClient(slug);
          goToPicker();
        }
      );
    } else if (action === "upload-photo") {
      photoInput.click();
    } else if (action === "remove-photo") {
      removeClientPhoto(slug);
    } else if (action === "go-crm") {
      if (currentUser) goToCrm(slug);
    } else if (action === "crm-set-bool") {
      var boolField = target.getAttribute("data-field");
      var boolValue = target.getAttribute("data-value") === "true";
      setCrmField(slug, boolField, boolValue);
      refresh();
    } else if (action === "crm-team-add") {
      addTeamMember(slug);
    } else if (action === "crm-team-remove") {
      removeTeamMember(slug, +target.getAttribute("data-idx"));
    }
  });

  photoInput.addEventListener("change", function (e) {
    var file = e.target.files && e.target.files[0];
    var slugParaFoto = currentSlug;
    photoInput.value = "";
    if (!file || !slugParaFoto) return;
    resizeImageFile(file, 240).then(function (dataUrl) {
      setClientPhoto(slugParaFoto, dataUrl);
    });
  });

  app.addEventListener("submit", function (e) {
    var form = e.target;
    if (form.classList.contains("add-task-form")) {
      e.preventDefault();
      var faseIdx = +form.getAttribute("data-fase");
      var input = form.querySelector('input[name="nome"]');
      var nome = input.value.trim();
      if (!nome) return;
      addTask(currentSlug, faseIdx, nome);
      addingTaskFor.delete(faseIdx);
      refresh();
    }
  });

  app.addEventListener("change", function (e) {
    var target = e.target;
    var targetAction = target.getAttribute("data-action");
    if (targetAction === "set-date") {
      var faseIdx = +target.getAttribute("data-fase");
      var taskId = target.getAttribute("data-task");
      setTaskDate(currentSlug, faseIdx, taskId, target.value);
    } else if (targetAction === "crm-set-text") {
      var field = target.getAttribute("data-field");
      setCrmField(currentSlug, field, target.value || (field === "aniversario" ? null : ""));
    } else if (targetAction === "crm-team-set") {
      var teamIdx = +target.getAttribute("data-idx");
      var teamField = target.getAttribute("data-field");
      setTeamMemberField(currentSlug, teamIdx, teamField, target.value);
    }
  });

  copyBtn.addEventListener("click", function () {
    navigator.clipboard.writeText(window.location.href).then(function () {
      var original = copyBtn.textContent;
      copyBtn.textContent = "Link copiado!";
      copyBtn.classList.add("is-copied");
      setTimeout(function () {
        copyBtn.textContent = original;
        copyBtn.classList.remove("is-copied");
      }, 2000);
    });
  });

  exportBtn.addEventListener("click", function () {
    var payload = JSON.stringify(store, null, 2);
    var blob = new Blob([payload], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "clients.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  analyticsBtn.addEventListener("click", goToAnalytics);
  profileBtn.addEventListener("click", switchProfile);

  function openModal() {
    addClientError.hidden = true;
    addClientForm.reset();
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    var respSelect = addClientForm.querySelector('select[name="responsavelCliente"]');
    if (respSelect && ASSIGNABLE.indexOf(currentUser) !== -1) respSelect.value = currentUser;
    var firstInput = addClientForm.querySelector('input[name="nome"]');
    if (firstInput) firstInput.focus();
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  addClientBtn.addEventListener("click", openModal);

  modal.addEventListener("click", function (e) {
    if (e.target.closest('[data-action="close-modal"]')) closeModal();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
    if (e.key === "Escape" && confirmModal.classList.contains("is-open")) closeConfirmModal();
  });

  function openConfirmModal(title, message, onConfirm) {
    confirmModalTitle.textContent = title;
    confirmModalMessage.textContent = message;
    confirmModalCallback = onConfirm;
    confirmModal.classList.add("is-open");
    confirmModal.setAttribute("aria-hidden", "false");
  }

  function closeConfirmModal() {
    confirmModal.classList.remove("is-open");
    confirmModal.setAttribute("aria-hidden", "true");
    confirmModalCallback = null;
  }

  confirmModal.addEventListener("click", function (e) {
    if (e.target.closest('[data-action="close-confirm-modal"]')) closeConfirmModal();
  });

  confirmModalConfirmBtn.addEventListener("click", function () {
    var cb = confirmModalCallback;
    closeConfirmModal();
    if (cb) cb();
  });

  addClientForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var formData = new FormData(addClientForm);
    var nome = (formData.get("nome") || "").toString().trim();
    var responsavelCliente = (formData.get("responsavelCliente") || "").toString().trim();
    if (!nome) {
      addClientError.textContent = "Informe o nome do cliente.";
      addClientError.hidden = false;
      return;
    }
    if (ASSIGNABLE.indexOf(responsavelCliente) === -1) {
      addClientError.textContent = "Selecione um responsável.";
      addClientError.hidden = false;
      return;
    }
    var slug = addClient({
      nome: nome,
      empresa: (formData.get("empresa") || "").toString().trim(),
      idConta: (formData.get("idConta") || "").toString().trim(),
      responsavelCliente: responsavelCliente,
      dataInicio: (formData.get("dataInicio") || "").toString().trim()
    });
    closeModal();
    goToClient(slug);
  });

  window.addEventListener("popstate", refresh);

  // ---------- Início ----------

  loadStore()
    .then(function (data) {
      store = data;
      render();
    })
    .catch(function (err) {
      app.innerHTML = '<div class="loading">Não foi possível carregar o cronograma. ' +
        "Se você abriu o arquivo diretamente, sirva a pasta com um servidor local " +
        "(ex.: <code>python3 -m http.server</code>) e acesse via http://localhost.</div>";
      console.error(err);
    });
})();
