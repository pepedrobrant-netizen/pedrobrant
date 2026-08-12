// Cronograma de Onboarding — servidor (Google Apps Script)
//
// Fonte de dados: duas abas na planilha vinculada a este script — "Clientes" e "CRM"
// (criadas automaticamente na primeira chamada, se não existirem). fases/equipe/acoes
// são guardados como texto JSON numa única célula, no mesmo formato que o front-end
// já usava.
//
// Autenticação: senha única do time, configurada em Project Settings > Script
// Properties (chave TEAM_PASSWORD) — não fica escrita em nenhum arquivo de código.
// Login gera um token de sessão temporário (6h, limite do CacheService), guardado em
// CacheService; toda função de escrita/leitura de dados do time exige esse token.
// O link público de um cliente (getPublicClient) nunca exige token.

var SHEET_CLIENTES = "Clientes";
var SHEET_CRM = "CRM";
var SESSION_TTL_SECONDS = 6 * 60 * 60; // 6 horas — teto do CacheService

var CLIENTES_HEADERS = [
  "slug", "nome", "empresa", "inicial", "idConta", "responsavelCliente",
  "criadoPor", "dataInicio", "foto", "fases"
];
var CRM_HEADERS = [
  "slug", "idCliente", "telefonePrincipal", "emailCliente", "endereco",
  "aniversario", "eventoParticipa", "eventoQual", "contratoAssinado",
  "brindeEnviado", "metaFaturamento", "equipe", "acoes"
];

// E-mail Google de cada onboarder — usado para saber em qual agenda criar o lembrete
// de reunião (ver "Lembretes de reunião no Google Calendar" abaixo). Cada pessoa
// precisa ter compartilhado a própria agenda com a conta que publicou este Web App,
// com a permissão "Fazer alterações nos eventos" (Configurações do Google Calendar >
// [agenda dela] > Compartilhar com pessoas específicas).
var ONBOARDER_EMAILS = {
  "Ilana": "ilana.carvalho@hotmart.com",
  "Pedro": "pedro.brant@hotmart.com",
  "Josiane": "josiane.rodrigues@hotmart.com",
  "Madu": "ligia.madureira@hotmart.com"
};

// ---------- Web app ----------

function doGet(e) {
  var params = (e && e.parameter) || {};
  var template = HtmlService.createTemplateFromFile("Index");
  template.initialCliente = params.cliente || "";
  template.initialView = params.view || "";
  template.baseUrl = ScriptApp.getService().getUrl();
  return template
    .evaluate()
    .setTitle("Cronograma de Onboarding")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Usado pelos templates HTML (<?!= include('Stylesheet'); ?> etc.) para colar o
// conteúdo de outro arquivo .html do projeto — o Apps Script não serve arquivos
// estáticos separados como um site normal, então CSS/JS viram <style>/<script>
// embutidos dentro do HTML principal.
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ---------- Planilha: helpers ----------

function getSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function rowsToObjects_(sheet, headers) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values
    .filter(function (row) { return row[0]; }) // ignora linhas em branco (sem slug)
    .map(function (row) {
      var obj = {};
      headers.forEach(function (h, i) { obj[h] = row[i]; });
      return obj;
    });
}

function findRowIndexBySlug_(sheet, slug) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var slugs = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < slugs.length; i++) {
    if (slugs[i][0] === slug) return i + 2; // +2: linha 1 é cabeçalho, índice 1-based
  }
  return -1;
}

// Datas voltam da planilha ora como objeto Date (quando o Sheets reconhece o texto
// como data e formata a célula sozinho), ora como string — normaliza pros dois casos
// para sempre devolver "yyyy-MM-dd" pro front-end, que já espera esse formato.
function formatDateOnly_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(value);
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

// ---------- Autenticação ----------

function login(password) {
  var expected = PropertiesService.getScriptProperties().getProperty("TEAM_PASSWORD");
  if (!expected) {
    throw new Error(
      "TEAM_PASSWORD não configurada. No editor do Apps Script, vá em " +
      "Configurações do projeto (ícone de engrenagem) > Script Properties > Add script " +
      "property, com a chave TEAM_PASSWORD e o valor da senha do time."
    );
  }
  if (String(password) !== String(expected)) {
    throw new Error("Senha incorreta.");
  }
  var token = Utilities.getUuid();
  CacheService.getScriptCache().put("session_" + token, "1", SESSION_TTL_SECONDS);
  return { token: token };
}

function logout(token) {
  if (token) CacheService.getScriptCache().remove("session_" + token);
  return { ok: true };
}

// Erros lançados aqui usam o prefixo AUTH_EXPIRED: para o front-end conseguir
// distinguir "sessão expirou, volte pro login" de qualquer outro erro (rede, etc.).
function requireSession_(token) {
  var valid = token && CacheService.getScriptCache().get("session_" + token);
  if (!valid) throw new Error("AUTH_EXPIRED: sessão inválida ou expirada, faça login novamente.");
}

// ---------- Lembretes de reunião no Google Calendar ----------
//
// Sempre que um cliente é salvo, toda tarefa cujo nome contenha "reunião" ganha um
// lembrete de dia inteiro na agenda do responsável por aquele cliente (campo
// responsavelCliente) — não em toda tarefa, pra não poluir a agenda com itens
// administrativos do cronograma. O evento é marcado como "Disponível" (transparente),
// então não ocupa horário nem trava a agenda para reuniões de verdade.
//
// O id do evento criado fica guardado no próprio objeto da tarefa (task.eventId,
// dentro do JSON de "fases" da planilha) — é assim que uma mudança de data atualiza o
// mesmo evento em vez de criar um novo, e como uma data removida sabe qual evento
// apagar. Qualquer falha aqui (ex.: a pessoa ainda não compartilhou a agenda dela)
// não impede o cronograma de ser salvo — só o lembrete daquela tarefa fica pendente.

function isMeetingTask_(nome) {
  return (nome || "").toString().toLowerCase().indexOf("reuni") !== -1;
}

function getOnboarderCalendar_(nome) {
  var email = ONBOARDER_EMAILS[nome];
  if (!email) return null;
  try {
    return CalendarApp.getCalendarById(email);
  } catch (e) {
    return null;
  }
}

function syncMeetingReminder_(cliente, task) {
  if (!isMeetingTask_(task.nome)) return;
  var calendar = getOnboarderCalendar_(cliente.responsavelCliente);
  if (!calendar) return;
  var shouldHaveEvent = !!(task.data && !task.removida);
  try {
    if (!shouldHaveEvent) {
      if (task.eventId) {
        var existing = calendar.getEventById(task.eventId);
        if (existing) existing.deleteEvent();
        task.eventId = null;
      }
      return;
    }
    var date = new Date(task.data + "T00:00:00");
    if (task.eventId) {
      var event = calendar.getEventById(task.eventId);
      if (event) {
        event.setAllDayDate(date);
        return;
      }
    }
    var created = calendar.createAllDayEvent(cliente.nome + " — " + task.nome, date);
    created.setTransparency(CalendarApp.EventTransparency.TRANSPARENT);
    task.eventId = created.getId();
  } catch (e) {
    // Agenda ainda não compartilhada com a conta do script, ou outro erro do
    // Calendar — não propaga, o salvamento do cronograma continua normalmente.
  }
}

function syncClientCalendarReminders_(cliente) {
  (cliente.fases || []).forEach(function (fase) {
    (fase.tarefas || []).forEach(function (task) {
      syncMeetingReminder_(cliente, task);
    });
  });
}

function deleteClientCalendarReminders_(cliente) {
  var calendar = getOnboarderCalendar_(cliente.responsavelCliente);
  if (!calendar) return;
  (cliente.fases || []).forEach(function (fase) {
    (fase.tarefas || []).forEach(function (task) {
      if (!task.eventId) return;
      try {
        var event = calendar.getEventById(task.eventId);
        if (event) event.deleteEvent();
      } catch (e) {}
    });
  });
}

// ---------- Clientes ----------

function parseClientRow_(obj) {
  var fases = [];
  try { fases = obj.fases ? JSON.parse(obj.fases) : []; } catch (e) {}
  return {
    slug: obj.slug,
    nome: obj.nome || "",
    empresa: obj.empresa || "",
    inicial: obj.inicial || "",
    idConta: obj.idConta || "",
    responsavelCliente: obj.responsavelCliente || "",
    criadoPor: obj.criadoPor || "",
    dataInicio: formatDateOnly_(obj.dataInicio),
    foto: obj.foto || null,
    fases: fases
  };
}

function clientRowValues_(slug, obj) {
  return [
    slug,
    obj.nome || "",
    obj.empresa || "",
    obj.inicial || "",
    obj.idConta || "",
    obj.responsavelCliente || "",
    obj.criadoPor || "",
    obj.dataInicio || "",
    obj.foto || "",
    JSON.stringify(obj.fases || [])
  ];
}

function parseCrmRow_(obj) {
  var equipe = [], acoes = [];
  try { equipe = obj.equipe ? JSON.parse(obj.equipe) : []; } catch (e) {}
  try { acoes = obj.acoes ? JSON.parse(obj.acoes) : []; } catch (e) {}
  return {
    slug: obj.slug,
    idCliente: obj.idCliente || "",
    telefonePrincipal: obj.telefonePrincipal || "",
    emailCliente: obj.emailCliente || "",
    endereco: obj.endereco || "",
    aniversario: formatDateOnly_(obj.aniversario),
    eventoParticipa: !!obj.eventoParticipa,
    eventoQual: obj.eventoQual || "",
    contratoAssinado: !!obj.contratoAssinado,
    brindeEnviado: !!obj.brindeEnviado,
    metaFaturamento: obj.metaFaturamento || "",
    equipe: equipe,
    acoes: acoes
  };
}

function crmRowValues_(slug, crm) {
  return [
    slug,
    crm.idCliente || "",
    crm.telefonePrincipal || "",
    crm.emailCliente || "",
    crm.endereco || "",
    crm.aniversario || "",
    !!crm.eventoParticipa,
    crm.eventoQual || "",
    !!crm.contratoAssinado,
    !!crm.brindeEnviado,
    crm.metaFaturamento || "",
    JSON.stringify(crm.equipe || []),
    JSON.stringify(crm.acoes || [])
  ];
}

// Time logado: devolve todos os clientes e todo o CRM de uma vez.
function getTeamData(token) {
  requireSession_(token);
  var clientesSheet = getSheet_(SHEET_CLIENTES, CLIENTES_HEADERS);
  var crmSheet = getSheet_(SHEET_CRM, CRM_HEADERS);
  return {
    clientes: rowsToObjects_(clientesSheet, CLIENTES_HEADERS).map(parseClientRow_),
    crm: rowsToObjects_(crmSheet, CRM_HEADERS).map(parseCrmRow_)
  };
}

// Link público (sem login): só devolve UM cliente, pelo slug exato — nunca lista os
// outros, nunca toca na aba CRM.
function getPublicClient(slug) {
  var sheet = getSheet_(SHEET_CLIENTES, CLIENTES_HEADERS);
  var rowIdx = findRowIndexBySlug_(sheet, slug);
  if (rowIdx === -1) return null;
  var row = sheet.getRange(rowIdx, 1, 1, CLIENTES_HEADERS.length).getValues()[0];
  var obj = {};
  CLIENTES_HEADERS.forEach(function (h, i) { obj[h] = row[i]; });
  return parseClientRow_(obj);
}

function saveClient(token, slug, clientObj) {
  requireSession_(token);
  return withLock_(function () {
    var sheet = getSheet_(SHEET_CLIENTES, CLIENTES_HEADERS);
    var rowIdx = findRowIndexBySlug_(sheet, slug);
    if (rowIdx === -1) throw new Error("Cliente não encontrado: " + slug);
    syncClientCalendarReminders_(clientObj);
    sheet.getRange(rowIdx, 1, 1, CLIENTES_HEADERS.length).setValues([clientRowValues_(slug, clientObj)]);
    return { ok: true };
  });
}

function createClient(token, slug, clientObj) {
  requireSession_(token);
  return withLock_(function () {
    var sheet = getSheet_(SHEET_CLIENTES, CLIENTES_HEADERS);
    if (findRowIndexBySlug_(sheet, slug) !== -1) {
      throw new Error("Já existe um cliente com esse identificador (" + slug + ").");
    }
    sheet.appendRow(clientRowValues_(slug, clientObj));
    return { ok: true };
  });
}

function deleteClient(token, slug) {
  requireSession_(token);
  return withLock_(function () {
    var clientesSheet = getSheet_(SHEET_CLIENTES, CLIENTES_HEADERS);
    var rowIdx = findRowIndexBySlug_(clientesSheet, slug);
    if (rowIdx !== -1) {
      var row = clientesSheet.getRange(rowIdx, 1, 1, CLIENTES_HEADERS.length).getValues()[0];
      var obj = {};
      CLIENTES_HEADERS.forEach(function (h, i) { obj[h] = row[i]; });
      deleteClientCalendarReminders_(parseClientRow_(obj));
      clientesSheet.deleteRow(rowIdx);
    }
    var crmSheet = getSheet_(SHEET_CRM, CRM_HEADERS);
    var crmRowIdx = findRowIndexBySlug_(crmSheet, slug);
    if (crmRowIdx !== -1) crmSheet.deleteRow(crmRowIdx);
    return { ok: true };
  });
}

// upsert: o registro de CRM de um cliente pode ainda não existir na primeira vez que
// alguém preenche algo nele.
function saveCrm(token, slug, crmObj) {
  requireSession_(token);
  return withLock_(function () {
    var sheet = getSheet_(SHEET_CRM, CRM_HEADERS);
    var rowIdx = findRowIndexBySlug_(sheet, slug);
    var row = crmRowValues_(slug, crmObj);
    if (rowIdx === -1) {
      sheet.appendRow(row);
    } else {
      sheet.getRange(rowIdx, 1, 1, CRM_HEADERS.length).setValues([row]);
    }
    return { ok: true };
  });
}
