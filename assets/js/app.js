(function () {
  "use strict";

  var STORAGE_KEY = "hm_onboarding_store_v2";

  var app = document.getElementById("app");
  var copyBtn = document.getElementById("copy-link-btn");
  var exportBtn = document.getElementById("export-btn");
  var addClientBtn = document.getElementById("add-client-btn");
  var modal = document.getElementById("add-client-modal");
  var addClientForm = document.getElementById("add-client-form");
  var addClientError = document.getElementById("add-client-error");

  var store = null; // { [slug]: cliente }
  var openPhases = new Set();
  var currentSlug = null;

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

  function getClienteSlug() {
    var params = new URLSearchParams(window.location.search);
    return params.get("cliente");
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

  function addClient(fields) {
    var slug = uniqueSlug(slugify(fields.nome));
    store[slug] = {
      nome: fields.nome,
      empresa: fields.empresa || "",
      inicial: initials(fields.nome),
      idConta: fields.idConta || "",
      dataInicio: fields.dataInicio || todayISO(),
      fases: cloneTemplateFases()
    };
    persist();
    return slug;
  }

  // ---------- Renderização ----------

  function renderPicker() {
    copyBtn.style.display = "none";
    var tpl = document.getElementById("tpl-client-picker");
    var node = tpl.content.cloneNode(true);
    var list = node.getElementById("picker-list");

    var slugs = Object.keys(store);
    if (!slugs.length) {
      var empty = document.createElement("p");
      empty.className = "picker__text";
      empty.textContent = "Nenhum cliente cadastrado ainda. Use o botão “+ Novo cliente” para começar.";
      list.appendChild(empty);
    }

    slugs.forEach(function (slug) {
      var c = store[slug];
      var a = document.createElement("a");
      a.className = "picker__item";
      a.href = "?cliente=" + encodeURIComponent(slug);
      a.innerHTML =
        '<span class="picker__item-avatar">' + c.inicial + "</span>" +
        '<span class="picker__item-body">' +
          '<span class="picker__item-name">' + c.nome + "</span><br>" +
          '<span class="picker__item-meta">' + (c.empresa || "Sem empresa informada") + "</span>" +
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
    app.innerHTML = "";
    app.appendChild(tpl.content.cloneNode(true));
  }

  function taskRowHtml(faseIdx, task) {
    return (
      '<div class="task-row' + (task.concluida ? " task-row--done" : "") + '">' +
        '<button type="button" class="task-check" data-action="toggle-task" data-fase="' + faseIdx + '" data-task="' + task.id + '" aria-label="Marcar tarefa como concluída">' +
          (task.concluida ? "✓" : "") +
        "</button>" +
        '<span class="task-name">' + task.nome + "</span>" +
        '<input type="date" class="task-date" data-action="set-date" data-fase="' + faseIdx + '" data-task="' + task.id + '" value="' + (task.data || "") + '" />' +
        '<button type="button" class="task-remove" data-action="remove-task" data-fase="' + faseIdx + '" data-task="' + task.id + '" title="Remover (não se aplica a este cliente)">Remover</button>' +
      "</div>"
    );
  }

  function removedTaskRowHtml(faseIdx, task) {
    return (
      '<div class="task-row task-row--removed">' +
        '<span class="task-name">' + task.nome + "</span>" +
        '<button type="button" class="task-restore" data-action="restore-task" data-fase="' + faseIdx + '" data-task="' + task.id + '">Restaurar</button>' +
      "</div>"
    );
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

    var header = document.createElement("section");
    header.className = "client-header";
    header.innerHTML =
      '<div class="client-header__top">' +
        '<div class="client-header__avatar">' + cliente.inicial + "</div>" +
        "<div>" +
          '<h1 class="client-header__name">' + cliente.nome + "</h1>" +
          '<p class="client-header__company">' + (cliente.empresa || "Sem empresa informada") + "</p>" +
          '<p class="client-header__account">ID da conta: <strong>' + (cliente.idConta || "não informado") + "</strong></p>" +
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
              '<p class="phase__title">' + (i + 1) + ". " + fase.titulo + "</p>" +
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
              '<p class="phase__desc">' + fase.descricao + "</p>" +
              '<div class="phase__tasks">' + (tasksHtml || '<p class="phase__empty">Todas as tarefas desta fase foram removidas para este cliente.</p>') + "</div>" +
              removedHtml +
              '<p class="phase__owner">Responsável: ' + fase.responsavel + "</p>" +
            "</div>" +
          "</div>" +
        "</div>";

      timeline.appendChild(phase);
    });

    var footer = document.createElement("p");
    footer.className = "footer-note";
    footer.textContent = "Este link é exclusivo e não requer login. Guarde-o para acompanhar seu onboarding a qualquer momento.";

    app.innerHTML = "";
    app.appendChild(header);
    app.appendChild(timeline);
    app.appendChild(footer);
  }

  function render() {
    var slug = getClienteSlug();
    currentSlug = slug;
    if (!slug) {
      openPhases = new Set();
      renderPicker();
      return;
    }
    if (!store[slug]) {
      openPhases = new Set();
      renderNotFound();
      return;
    }
    renderClient(slug);
  }

  function refresh() {
    var y = window.scrollY;
    render();
    window.scrollTo(0, y);
  }

  function navigateTo(slug) {
    var url = new URL(window.location.href);
    url.searchParams.set("cliente", slug);
    window.history.pushState(null, "", url);
    openPhases = new Set();
    refresh();
  }

  // ---------- Eventos ----------

  app.addEventListener("click", function (e) {
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

  function openModal() {
    addClientError.hidden = true;
    addClientForm.reset();
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
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
    if (!nome) {
      addClientError.textContent = "Informe o nome do cliente.";
      addClientError.hidden = false;
      return;
    }
    var slug = addClient({
      nome: nome,
      empresa: (formData.get("empresa") || "").toString().trim(),
      idConta: (formData.get("idConta") || "").toString().trim(),
      dataInicio: (formData.get("dataInicio") || "").toString().trim()
    });
    closeModal();
    navigateTo(slug);
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
