(function () {
  "use strict";

  var app = document.getElementById("app");
  var copyBtn = document.getElementById("copy-link-btn");
  copyBtn.style.display = "none";

  function getClienteSlug() {
    var params = new URLSearchParams(window.location.search);
    return params.get("cliente");
  }

  function formatDate(isoString) {
    if (!isoString) return null;
    var parts = isoString.split("-");
    var d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  }

  function statusOf(index, faseAtual) {
    if (index < faseAtual) return "concluida";
    if (index === faseAtual) return "atual";
    return "pendente";
  }

  function statusLabel(status) {
    return { concluida: "Concluída", atual: "Em andamento", pendente: "Pendente" }[status];
  }

  function computeProgress(cliente) {
    var total = cliente.fases.length;
    var sum = 0;
    cliente.fases.forEach(function (fase, i) {
      var status = statusOf(i, cliente.faseAtual);
      if (status === "concluida") {
        sum += 1;
      } else if (status === "atual") {
        var tasks = fase.tarefas || [];
        var done = tasks.filter(function (t) { return t.concluida; }).length;
        sum += tasks.length ? done / tasks.length : 0;
      }
    });
    return Math.round((sum / total) * 100);
  }

  function renderPicker(data) {
    copyBtn.style.display = "none";
    var tpl = document.getElementById("tpl-client-picker");
    var node = tpl.content.cloneNode(true);
    var list = node.getElementById("picker-list");

    Object.keys(data)
      .filter(function (k) { return k.indexOf("_") !== 0; })
      .forEach(function (slug) {
        var c = data[slug];
        var a = document.createElement("a");
        a.className = "picker__item";
        a.href = "?cliente=" + encodeURIComponent(slug);
        a.innerHTML =
          '<span class="picker__item-avatar">' + c.inicial + "</span>" +
          '<span>' +
            '<span class="picker__item-name">' + c.nome + "</span><br>" +
            '<span class="picker__item-meta">' + c.empresa + "</span>" +
          "</span>";
        list.appendChild(a);
      });

    var exampleUrl = node.getElementById("picker-example-url");
    var firstSlug = Object.keys(data).filter(function (k) { return k.indexOf("_") !== 0; })[0];
    exampleUrl.textContent = window.location.origin + window.location.pathname + "?cliente=" + firstSlug;

    app.innerHTML = "";
    app.appendChild(node);
  }

  function renderNotFound() {
    copyBtn.style.display = "none";
    var tpl = document.getElementById("tpl-not-found");
    app.innerHTML = "";
    app.appendChild(tpl.content.cloneNode(true));
  }

  function renderClient(cliente) {
    copyBtn.style.display = "inline-block";
    var progress = computeProgress(cliente);

    var header = document.createElement("section");
    header.className = "client-header";
    header.innerHTML =
      '<div class="client-header__top">' +
        '<div class="client-header__avatar">' + cliente.inicial + "</div>" +
        "<div>" +
          '<h1 class="client-header__name">' + cliente.nome + "</h1>" +
          '<p class="client-header__company">' + cliente.empresa + "</p>" +
        "</div>" +
      "</div>" +
      '<div class="progress">' +
        '<div class="progress__track"><div class="progress__fill" style="width:' + progress + '%"></div></div>' +
        '<div class="progress__label">' + progress + "% concluído</div>" +
      "</div>" +
      '<div class="client-header__meta">' +
        "<span>Início: <strong>" + formatDate(cliente.dataInicio) + "</strong></span>" +
        "<span>Fase atual: <strong>" + (cliente.faseAtual + 1) + " de " + cliente.fases.length + "</strong></span>" +
      "</div>";

    var timeline = document.createElement("div");
    timeline.className = "timeline";

    cliente.fases.forEach(function (fase, i) {
      var status = statusOf(i, cliente.faseAtual);
      var phase = document.createElement("div");
      phase.className = "phase phase--" + status;
      if (status === "atual") phase.classList.add("is-open");

      var dateLabel = fase.dataConclusao
        ? "Concluída em " + formatDate(fase.dataConclusao)
        : "Previsto para " + formatDate(fase.dataPrevista);

      var tasksHtml = (fase.tarefas || [])
        .map(function (t) {
          return (
            '<li class="phase__task' + (t.concluida ? " phase__task--done" : "") + '">' +
              '<span class="phase__task-check">' + (t.concluida ? "✓" : "") + "</span>" +
              '<span class="phase__task-name">' + t.nome + "</span>" +
            "</li>"
          );
        })
        .join("");

      phase.innerHTML =
        '<span class="phase__marker">' + (status === "concluida" ? "✓" : i + 1) + "</span>" +
        '<div class="phase__card">' +
          '<div class="phase__header">' +
            '<div class="phase__title-group">' +
              '<p class="phase__title">' + (i + 1) + ". " + fase.titulo + "</p>" +
              '<span class="phase__date">' + dateLabel + "</span>" +
            "</div>" +
            '<span class="phase__badge">' + statusLabel(status) + "</span>" +
            '<svg class="phase__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>' +
          "</div>" +
          '<div class="phase__body">' +
            '<div class="phase__body-inner">' +
              '<p class="phase__desc">' + fase.descricao + "</p>" +
              (tasksHtml ? '<ul class="phase__tasks">' + tasksHtml + "</ul>" : "") +
              '<p class="phase__owner">Responsável: ' + fase.responsavel + "</p>" +
            "</div>" +
          "</div>" +
        "</div>";

      var headerEl = phase.querySelector(".phase__header");
      headerEl.addEventListener("click", function () {
        phase.classList.toggle("is-open");
      });

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

  fetch("data/clients.json")
    .then(function (res) {
      if (!res.ok) throw new Error("Falha ao carregar dados");
      return res.json();
    })
    .then(function (data) {
      var slug = getClienteSlug();
      if (!slug) {
        renderPicker(data);
        return;
      }
      var cliente = data[slug];
      if (!cliente) {
        renderNotFound();
        return;
      }
      renderClient(cliente);
    })
    .catch(function (err) {
      app.innerHTML = '<div class="loading">Não foi possível carregar o cronograma. ' +
        "Se você abriu o arquivo diretamente, sirva a pasta com um servidor local " +
        "(ex.: <code>python3 -m http.server</code>) e acesse via http://localhost.</div>";
      console.error(err);
    });
})();
