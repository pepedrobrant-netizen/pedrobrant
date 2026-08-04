(function () {
  "use strict";

  var STORAGE_KEY = "hm_onboarding_store_v2";
  var PROFILE_KEY = "hm_current_user_v1";

  var PROFILES = ["Ilana", "Pedro", "Josiane", "Madu", "Amanda"];
  var ASSIGNABLE = ["Ilana", "Pedro", "Josiane", "Madu"];

  var app = document.getElementById("app");
  var copyBtn = document.getElementById("copy-link-btn");
  var exportBtn = document.getElementById("export-btn");
  var addClientBtn = document.getElementById("add-client-btn");
  var analyticsBtn = document.getElementById("analytics-btn");
  var profileBtn = document.getElementById("profile-btn");
  var profileBtnLabel = document.getElementById("profile-btn-label");
  var modal = document.getElementById("add-client-modal");
  var addClientForm = document.getElementById("add-client-form");
  var addClientError = document.getElementById("add-client-error");

  var store = null; // { [slug]: cliente }
  var currentUser = localStorage.getItem(PROFILE_KEY) || null;
  var currentSlug = null;
  var openPhases = new Set();
  var addingTaskFor = new Set();

  // ---------- Template para novos clientes ----------

  var TEMPLATE_FASES = [
    {
      titulo: "Setup de Conta",
      descricao: "Criação e configuração inicial da conta do cliente na Hotmart.",
      responsavel: "Suporte Técnico",
      tarefas: [
        "Conta criada e verificada",
        "Dados bancários e fiscais configurados",
        "Usuários e permissões de acesso definidos"
      ]
    },
    {
      titulo: "Treinamento: Configurações Básicas",
      descricao: "Treinamento sobre as configurações essenciais da plataforma.",
      responsavel: "Time de Onboarding",
      tarefas: [
        "Treinamento de configurações gerais realizado",
        "Identidade visual (logo e cores) configurada",
        "Domínio, idioma e moeda configurados"
      ]
    },
    {
      titulo: "Treinamento: Club (Área de Membros)",
      descricao: "Treinamento e estruturação da área de membros (Club).",
      responsavel: "Especialista de Produto",
      tarefas: [
        "Treinamento do Club realizado",
        "Estrutura de módulos e conteúdo criada",
        "Regras de liberação de acesso configuradas"
      ]
    },
    {
      titulo: "Acabamentos e Configurações Finais",
      descricao: "Ajustes finais de checkout, ofertas e integrações antes da venda.",
      responsavel: "Especialista de Conversão",
      tarefas: [
        "Checkout personalizado revisado",
        "Cupons e ofertas configurados",
        "Integrações finais validadas"
      ]
    },
    {
      titulo: "Checklist Pré-venda",
      descricao: "Validação final de ponta a ponta antes da abertura das vendas.",
      responsavel: "QA de Onboarding",
      tarefas: [
        "Compra de teste realizada com sucesso",
        "Acesso ao conteúdo validado",
        "Checklist pré-venda aprovado pelo cliente"
      ]
    },
    {
      titulo: "Ativação",
      descricao: "Abertura oficial das vendas ao público.",
      responsavel: "Time de Onboarding",
      tarefas: [
        "Produto ativado para venda",
        "Comunicação de lançamento enviada",
        "Canais de suporte ao comprador configurados"
      ]
    },
    {
      titulo: "Relatórios Gerenciais (pós-ativação)",
      descricao: "Acompanhamento dos primeiros indicadores após a ativação.",
      responsavel: "Estrategista de Conta",
      tarefas: [
        "Relatório dos primeiros 7 dias enviado",
        "Dashboard de indicadores configurado",
        "Reunião de apresentação de resultados realizada"
      ]
    },
    {
      titulo: "Acompanhamento",
      descricao: "Acompanhamento contínuo do cliente após o encerramento do onboarding.",
      responsavel: "Time de Onboarding",
      tarefas: [
        "Check-in de 30 dias realizado",
        "Plano de otimização definido",
        "Encerramento formal do onboarding registrado"
      ]
    }
  ];

  function cloneTemplateFases() {
    return TEMPLATE_FASES.map(function (fase, fi) {
      return {
        titulo: fase.titulo,
        descricao: fase.descricao,
        responsavel: fase.responsavel,
        tarefas: fase.tarefas.map(function (nome, ti) {
          return { id: "f" + (fi + 1) + "t" + (ti + 1), nome: nome, concluida: false, data: null, removida: false };
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

  // ---------- Perfil / permissões ----------
  // Não é autenticação: é uma preferência local (localStorage) para filtrar a lista de
  // clientes por responsável. Um link direto de cliente (?cliente=slug) nunca é
  // bloqueado por isso — só a lista/analytics internos são filtrados.

  function visibleSlugs() {
    var all = Object.keys(store);
    if (currentUser === "Amanda") return all;
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
    fase.tarefas.push({ id: id, nome: nome, concluida: false, data: null, removida: false });
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
      dataInicio: fields.dataInicio || todayISO(),
      fases: cloneTemplateFases()
    };
    persist();
    return slug;
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
      btn.className = "profile-chip" + (name === "Amanda" ? " profile-chip--coord" : "");
      btn.textContent = name + (name === "Amanda" ? " (coordenação — vê tudo)" : "");
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
    filterNote.textContent = currentUser === "Amanda"
      ? "Visão geral (coordenação): todos os clientes, de todos os responsáveis."
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
        '<span class="picker__item-avatar">' + escapeHtml(c.inicial) + "</span>" +
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

  function statTileHtml(value, label) {
    return (
      '<div class="stat-tile">' +
        '<div class="stat-tile__value">' + value + "</div>" +
        '<div class="stat-tile__label">' + label + "</div>" +
      "</div>"
    );
  }

  function renderAnalytics() {
    copyBtn.style.display = "none";
    var slugs = visibleSlugs();
    var rows = slugs
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

    var avg = rows.length ? Math.round(rows.reduce(function (sum, r) { return sum + r.pct; }, 0) / rows.length) : 0;

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

    var wrap = document.createElement("section");
    wrap.className = "analytics";
    wrap.innerHTML =
      backLinkHtml() +
      '<div class="analytics__header">' +
        '<h1 class="analytics__title">Analytics</h1>' +
        '<p class="analytics__subtitle">' +
          (currentUser === "Amanda"
            ? "Progresso de todos os clientes, todos os responsáveis."
            : "Progresso dos clientes de " + escapeHtml(currentUser) + ".") +
        "</p>" +
      "</div>" +
      '<div class="analytics__stats">' +
        statTileHtml(rows.length, rows.length === 1 ? "Cliente" : "Clientes") +
        statTileHtml(avg + "%", "Progresso médio") +
      "</div>" +
      (rows.length
        ? '<div class="chart-card"><div class="bar-chart">' + barsHtml + "</div></div>"
        : '<p class="picker__text">Nenhum cliente para mostrar.</p>');

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
        '<button type="button" class="task-remove" data-action="remove-task" data-fase="' + faseIdx + '" data-task="' + task.id + '" title="Remover (não se aplica a este cliente)">Remover</button>' +
      "</div>"
    );
  }

  function removedTaskRowHtml(faseIdx, task) {
    return (
      '<div class="task-row task-row--removed">' +
        '<span class="task-name">' + escapeHtml(task.nome) + "</span>" +
        '<button type="button" class="task-restore" data-action="restore-task" data-fase="' + faseIdx + '" data-task="' + task.id + '">Restaurar</button>' +
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

    var backWrap = document.createElement("div");
    backWrap.innerHTML = backLinkHtml();

    var header = document.createElement("section");
    header.className = "client-header";
    header.innerHTML =
      '<div class="client-header__top">' +
        '<div class="client-header__avatar">' + escapeHtml(cliente.inicial) + "</div>" +
        "<div>" +
          '<h1 class="client-header__name">' + escapeHtml(cliente.nome) + "</h1>" +
          '<p class="client-header__company">' + escapeHtml(cliente.empresa || "Sem empresa informada") + "</p>" +
          '<p class="client-header__account">ID da conta: <strong>' + escapeHtml(cliente.idConta || "não informado") +
            "</strong> · Responsável: <strong>" + escapeHtml(cliente.responsavelCliente || "não atribuído") + "</strong></p>" +
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
              '<p class="phase__owner">Responsável pela fase: ' + escapeHtml(fase.responsavel) + "</p>" +
            "</div>" +
          "</div>" +
        "</div>";

      timeline.appendChild(phase);
    });

    var footer = document.createElement("p");
    footer.className = "footer-note";
    footer.textContent = "Este link é exclusivo e não requer login. Guarde-o para acompanhar seu onboarding a qualquer momento.";

    app.innerHTML = "";
    app.appendChild(backWrap.firstElementChild);
    app.appendChild(header);
    app.appendChild(timeline);
    app.appendChild(footer);
  }

  // ---------- Roteamento ----------

  function getView() {
    var params = new URLSearchParams(window.location.search);
    var slug = params.get("cliente");
    if (slug) return { type: "client", slug: slug };
    if (params.get("view") === "analytics") return { type: "analytics" };
    return { type: "picker" };
  }

  function render() {
    var view = getView();
    updateProfileButton();

    if (view.type === "client") {
      currentSlug = view.slug;
      if (!store[view.slug]) {
        openPhases = new Set();
        renderNotFound();
        return;
      }
      renderClient(view.slug);
      return;
    }

    currentSlug = null;
    if (!currentUser) {
      renderProfileGate();
      return;
    }
    if (view.type === "analytics") {
      renderAnalytics();
    } else {
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

  // ---------- Eventos ----------

  app.addEventListener("click", function (e) {
    var backEl = e.target.closest('[data-action="nav-back"]');
    if (backEl) {
      e.preventDefault();
      goToPicker();
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
    }
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
    if (target.getAttribute("data-action") === "set-date") {
      var faseIdx = +target.getAttribute("data-fase");
      var taskId = target.getAttribute("data-task");
      setTaskDate(currentSlug, faseIdx, taskId, target.value);
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
