// Dashboard Onboarding — servidor (Google Apps Script)
//
// Fonte única de dados "de verdade" (somente leitura, ao vivo, sem cache): a planilha
// externa "Gestão de carteira unificada" (sincronizada do Salesforce), abas
// "[SF] On" (uma linha por oportunidade/cliente) e "[SF] VD" (log de touchpoints,
// usado só pra contar VDs por cliente). Este script NUNCA escreve nessas duas abas.
//
// O app também guarda um pequeno conjunto de campos que só existem aqui (não vêm do
// Salesforce): observações, contrato assinado, brinde enviado, fotos do cliente, e as
// missões da aba Rotina. Isso fica numa aba própria ("App - Overlay CRM" e
// "App - Missões"), criada automaticamente na planilha vinculada A ESTE SCRIPT (não na
// planilha de origem) — assim nunca escrevemos na planilha sincronizada do Salesforce.
//
// Autenticação: senha única do time (Script Properties, chave TEAM_PASSWORD). Login
// gera um token de sessão (6h, limite do CacheService) — exigido só pras operações de
// ESCRITA (overlay de CRM, fotos, missões). A leitura da carteira já fica atrás do
// próprio Web App, publicado com acesso restrito ao domínio hotmart.com — ver
// appsscript.json (`"access": "DOMAIN"`) e o passo a passo em README.md.

var CONFIG = {
  SHEET_ON: "[SF] On",
  SHEET_VD: "[SF] VD",
  OVERLAY_SHEET: "App - Overlay CRM",
  MISSOES_SHEET: "App - Missões",
  SESSION_TTL_SECONDS: 6 * 60 * 60, // 6 horas — teto do CacheService
  ONBOARDERS: ["Madu", "Pedro", "Josiane", "Ilana"],
  ADMINS: ["Amanda", "Julia"]
};

// Índices de coluna (0-based) na aba "[SF] On" — mapeamento confirmado, não mexer sem
// reconferir com a planilha de origem.
var COL = {
  hotmartId: 0,        // A  — Hotmart ID
  nome: 1,              // B  — Onboarding: Name
  gmv: 3,                // D  — GMV BRL after closed won
  cw: 4,                  // E  — Closed Date
  ativacao: 5,             // F  — Activation Date
  status: 7,                // H  — Onboarding Status
  sdr: 8,                     // I  — Opportunity: Created By
  closer: 9,                   // J  — Opportunity: Owner Name
  daysCarteira: 10,             // K  — Days in onboarding
  sow: 11,                       // L  — Share Of Wallet
  amount3Meses: 12,               // M  — Amount 1-3 Months
  taxaAtual: 13,                    // N  — Current Fee
  periodo: 14,                       // O  — Opportunity: Fiscal Period
  platAnterior: 20,                   // U  — Opportunity: Current Platform
  uf: 22,                               // W  — Opportunity: Billing State/Province
  op: 23,                                // X  — Opportunity: Created Date
  segmento: 24,                           // Y  — Opportunity: Market Micro Segment
  amount12Meses: 26,                       // AA — Opportunity: Amount 12 months
  ownerFirstName: 27                        // AB — Owner First Name (só pro filtro)
};

// 5 status considerados "jornada ativa" — pré-marcados como filtro padrão em
// Carteira/Perfil/Analytics. Accomplished/Unaccomplished ficam de fora por padrão.
var STATUS_JORNADA_ATIVA = [
  "Pre Onboarding",
  "Welcome",
  "Product Migration",
  "Ready for Activation",
  "Activation & Monitoring"
];

var OVERLAY_HEADERS = [
  "hotmartId", "observacoes", "contratoAssinado", "brindeEnviado", "lancamento",
  "fotos", "atualizadoEm", "atualizadoPor"
];

var MISSOES_HEADERS = [
  "id", "titulo", "descricao", "pontos", "prazo", "criadoPor", "criadoEm", "atribuicoes"
];

// ---------- Web app ----------

function doGet(e) {
  var template = HtmlService.createTemplateFromFile("Index");
  try {
    var data = getFullPortfolioData_();
    CONFIG.ONBOARDERS.forEach(function (nome) {
      template[nome.toLowerCase() + "Json"] = JSON.stringify(data[nome.toLowerCase()] || []);
    });
    template.overlayJson = JSON.stringify(getOverlayData_());
    template.missoesJson = JSON.stringify(getMissoesData_());
    template.bootError = "";
  } catch (err) {
    CONFIG.ONBOARDERS.forEach(function (nome) {
      template[nome.toLowerCase() + "Json"] = "[]";
    });
    template.overlayJson = "{}";
    template.missoesJson = "[]";
    template.bootError = String((err && err.message) || err);
  }
  template.baseUrl = ScriptApp.getService().getUrl();
  return template
    .evaluate()
    .setTitle("Dashboard Onboarding")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ---------- Nomes de aba: normalização contra caracteres invisíveis ----------
//
// Copiar/colar um nome de aba de um chat ou editor de texto pode introduzir
// caracteres Unicode "invisíveis" (espaço não-separável, largura zero etc.) que
// quebram uma comparação exata (getSheetByName) silenciosamente. Por isso toda busca
// de aba por nome passa por aqui em vez de usar getSheetByName diretamente.
function normalizeSheetName_(name) {
  return String(name || "")
    // Remove espacos/zero-width "invisiveis" que costumam entrar ao colar nomes
    // de aba de um chat/editor: zero-width space/joiner/non-joiner, BOM, NBSP,
    // word joiner, separador mongol, a faixa de espacos U+2000-U+200A e o espaco
    // ideografico U+3000. Sempre por \uXXXX explicito aqui -- nunca colar o
    // caractere invisivel "de verdade" neste arquivo: e exatamente esse tipo de
    // erro silencioso que ja custou um ciclo de debug inteiro numa tentativa
    // anterior.
    .replace(/[\u200B\u200C\u200D\uFEFF\u00A0\u2060\u180E\u2000-\u200A\u3000]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findSheetByName_(spreadsheet, targetName) {
  var target = normalizeSheetName_(targetName);
  var sheets = spreadsheet.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (normalizeSheetName_(sheets[i].getName()) === target) return sheets[i];
  }
  throw new Error(
    'Aba "' + targetName + '" não encontrada na planilha. Abas disponíveis: ' +
    sheets.map(function (s) { return '"' + s.getName() + '"'; }).join(", ")
  );
}

// ---------- Planilha de origem (Salesforce, só leitura) ----------

function getPortfolioSpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty("PORTFOLIO_SHEET_ID");
  if (!id) {
    throw new Error(
      "PORTFOLIO_SHEET_ID não configurada. No editor do Apps Script, vá em " +
      "Configurações do projeto (ícone de engrenagem) > Script Properties > Add script " +
      "property, chave PORTFOLIO_SHEET_ID, valor = o ID da planilha \"Gestão de " +
      "carteira unificada\" (o trecho da URL entre /d/ e /edit)."
    );
  }
  try {
    return SpreadsheetApp.openById(id);
  } catch (err) {
    throw new Error(
      "Não foi possível abrir a planilha com ID \"" + id + "\" (PORTFOLIO_SHEET_ID). " +
      "Confira se o ID está correto e se a conta que publicou o Web App tem acesso a " +
      "essa planilha. Erro original: " + err.message
    );
  }
}

function formatDateOnly_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === "[object Date]") {
    if (isNaN(value.getTime())) return null;
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  var str = String(value).trim();
  return str || null;
}

function toNumberOrNull_(value) {
  if (value === "" || value === null || typeof value === "undefined") return null;
  var n = Number(value);
  return isNaN(n) ? null : n;
}

function toStringOrNull_(value) {
  if (value === "" || value === null || typeof value === "undefined") return null;
  return String(value).trim() || null;
}

// Hash determinístico (djb2) — mesma entrada sempre produz a mesma saída, entre
// requests diferentes. Usado só pros campos ilustrativos que ainda não têm fonte real.
function simpleHash_(str) {
  var hash = 5381;
  var s = String(str || "");
  for (var i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash + s.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash);
}

function illustrativeFields_(hotmartId, today) {
  var hash = simpleHash_(hotmartId);
  var diasAtras = (hash % 30) + 1; // 1 a 30 dias
  var dataContato = new Date(today.getTime());
  dataContato.setDate(dataContato.getDate() - diasAtras);
  return {
    cronogramaProgress: hash % 101, // 0 a 100
    ultimoContatoDias: diasAtras,
    ultimoContatoData: Utilities.formatDate(dataContato, Session.getScriptTimeZone(), "yyyy-MM-dd")
  };
}

function diffDaysFromToday_(dateValue, today) {
  if (!dateValue) return null;
  var date = (Object.prototype.toString.call(dateValue) === "[object Date]") ? dateValue : new Date(dateValue);
  if (isNaN(date.getTime())) return null;
  var ms = today.getTime() - date.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// Lê a aba "[SF] On" inteira e devolve um array de registros já: deduplicados (última
// linha de cada Hotmart ID vence), com os campos calculados e os campos ilustrativos.
function readPortfolioRows_(spreadsheet) {
  var sheet = findSheetByName_(spreadsheet, CONFIG.SHEET_ON);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var lastCol = Math.max(sheet.getLastColumn(), COL.ownerFirstName + 1);
  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  var byId = {}; // dedup: última ocorrência de cada Hotmart ID vence
  var order = [];
  values.forEach(function (row) {
    var hotmartId = toStringOrNull_(row[COL.hotmartId]);
    if (!hotmartId) return; // ignora linhas em branco / sem ID
    if (!(hotmartId in byId)) order.push(hotmartId);
    byId[hotmartId] = row;
  });

  var today = new Date();
  return order.map(function (hotmartId) {
    var row = byId[hotmartId];
    var gmv = toNumberOrNull_(row[COL.gmv]);
    var amount3Meses = toNumberOrNull_(row[COL.amount3Meses]);
    var daysCarteira = toNumberOrNull_(row[COL.daysCarteira]);
    var ativacao = formatDateOnly_(row[COL.ativacao]);

    var amountReal = (amount3Meses !== null && daysCarteira !== null)
      ? (amount3Meses / 90) * daysCarteira
      : null;
    var pctAtingido = (gmv !== null && amount3Meses) ? gmv / amount3Meses : null;
    var pctAmount = (gmv !== null && amountReal) ? gmv / amountReal : null;
    var diasAtivado = ativacao ? diffDaysFromToday_(ativacao, today) : null;

    var illustrative = illustrativeFields_(hotmartId, today);

    return {
      hotmartId: hotmartId,
      nome: toStringOrNull_(row[COL.nome]),
      gmv: gmv,
      cw: formatDateOnly_(row[COL.cw]),
      ativacao: ativacao,
      status: toStringOrNull_(row[COL.status]),
      sdr: toStringOrNull_(row[COL.sdr]),
      closer: toStringOrNull_(row[COL.closer]),
      daysCarteira: daysCarteira,
      sow: toStringOrNull_(row[COL.sow]),
      amount3Meses: amount3Meses,
      taxaAtual: toNumberOrNull_(row[COL.taxaAtual]),
      periodo: toStringOrNull_(row[COL.periodo]),
      platAnterior: toStringOrNull_(row[COL.platAnterior]),
      uf: toStringOrNull_(row[COL.uf]),
      op: formatDateOnly_(row[COL.op]),
      segmento: toStringOrNull_(row[COL.segmento]),
      amount12Meses: toNumberOrNull_(row[COL.amount12Meses]),
      ownerFirstName: toStringOrNull_(row[COL.ownerFirstName]),

      // Campos calculados
      amountReal: amountReal,       // "Amount esperado hoje"
      pctAtingido: pctAtingido,       // "Percentual de atingimento total"
      pctAmount: pctAmount,             // "Tracking GMV atual"
      diasAtivado: diasAtivado,
      vds: 0,                             // preenchido depois, em applyVdCounts_

      // Campos ainda sem fonte na planilha — ficam null/false até existir mapeamento
      observacoes: null,
      col_13: null,
      lancamento: null,
      col_26: false,

      // Campos ilustrativos determinísticos (hash do Hotmart ID, nunca aleatório)
      _cronogramaProgress: illustrative.cronogramaProgress,
      _ultimoContatoDias: illustrative.ultimoContatoDias,
      _ultimoContatoData: illustrative.ultimoContatoData
    };
  });
}

// Lê a aba "[SF] VD" e conta quantas linhas cada Hotmart ID (coluna A) tem —
// equivalente a um COUNTIF.
function readVdCounts_(spreadsheet) {
  var sheet = findSheetByName_(spreadsheet, CONFIG.SHEET_VD);
  var lastRow = sheet.getLastRow();
  var counts = {};
  if (lastRow < 2) return counts;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  ids.forEach(function (row) {
    var id = toStringOrNull_(row[0]);
    if (!id) return;
    counts[id] = (counts[id] || 0) + 1;
  });
  return counts;
}

function applyVdCounts_(records, counts) {
  records.forEach(function (rec) {
    rec.vds = counts[rec.hotmartId] || 0;
  });
  return records;
}

// Devolve { madu: [...], pedro: [...], josiane: [...], ilana: [...] }, cada array já
// filtrado pelo primeiro nome do Owner. Quem não bate com nenhum dos 4 nomes
// conhecidos (carteira de outra pessoa, por exemplo) não entra em nenhum grupo —
// Amanda/Julia veem o consolidado calculado no próprio front-end (união dos 4).
function getFullPortfolioData_() {
  var ss = getPortfolioSpreadsheet_();
  var records = readPortfolioRows_(ss);
  applyVdCounts_(records, readVdCounts_(ss));

  var grouped = {};
  CONFIG.ONBOARDERS.forEach(function (nome) { grouped[nome.toLowerCase()] = []; });

  records.forEach(function (rec) {
    var owner = (rec.ownerFirstName || "").trim().toLowerCase();
    var match = CONFIG.ONBOARDERS.filter(function (nome) { return nome.toLowerCase() === owner; })[0];
    if (match) grouped[match.toLowerCase()].push(rec);
  });

  return grouped;
}

// ---------- Autenticação (só necessária pras operações de escrita) ----------

function login(password) {
  var expected = PropertiesService.getScriptProperties().getProperty("TEAM_PASSWORD");
  if (!expected) {
    throw new Error(
      "TEAM_PASSWORD não configurada. Configurações do projeto > Script Properties > " +
      "Add script property, chave TEAM_PASSWORD."
    );
  }
  if (String(password) !== String(expected)) {
    throw new Error("Senha incorreta.");
  }
  var token = Utilities.getUuid();
  CacheService.getScriptCache().put("session_" + token, "1", CONFIG.SESSION_TTL_SECONDS);
  return { token: token };
}

function logout(token) {
  if (token) CacheService.getScriptCache().remove("session_" + token);
  return { ok: true };
}

function requireSession_(token) {
  var valid = token && CacheService.getScriptCache().get("session_" + token);
  if (!valid) throw new Error("AUTH_EXPIRED: sessão inválida ou expirada, faça login novamente.");
}

// ---------- Overlay de CRM (dados que só existem neste app) ----------
//
// Guardado numa aba própria da planilha VINCULADA a este script (não na planilha de
// origem do Salesforce) — criada automaticamente na primeira escrita.

function getOverlaySheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.OVERLAY_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.OVERLAY_SHEET);
    sheet.appendRow(OVERLAY_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function overlayRowsToMap_(sheet) {
  var lastRow = sheet.getLastRow();
  var map = {};
  if (lastRow < 2) return map;
  var values = sheet.getRange(2, 1, lastRow - 1, OVERLAY_HEADERS.length).getValues();
  values.forEach(function (row) {
    var hotmartId = row[0];
    if (!hotmartId) return;
    var fotos = [];
    try { fotos = row[5] ? JSON.parse(row[5]) : []; } catch (e) {}
    map[hotmartId] = {
      hotmartId: hotmartId,
      observacoes: row[1] || "",
      contratoAssinado: !!row[2],
      brindeEnviado: !!row[3],
      lancamento: row[4] || "",
      fotos: fotos, // [{fileId, legenda, uploadedBy, uploadedAt}] — sem os bytes, ver getClientPhotos
      atualizadoEm: formatDateOnly_(row[6]),
      atualizadoPor: row[7] || ""
    };
  });
  return map;
}

function findOverlayRowIndex_(sheet, hotmartId) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(hotmartId)) return i + 2;
  }
  return -1;
}

function getOverlayData_() {
  return overlayRowsToMap_(getOverlaySheet_());
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

// patch: { observacoes?, contratoAssinado?, brindeEnviado?, lancamento? }
function saveOverlayFields(token, hotmartId, patch, autorNome) {
  requireSession_(token);
  return withLock_(function () {
    var sheet = getOverlaySheet_();
    var rowIdx = findOverlayRowIndex_(sheet, hotmartId);
    var current = rowIdx === -1
      ? { hotmartId: hotmartId, observacoes: "", contratoAssinado: false, brindeEnviado: false, lancamento: "", fotos: [] }
      : overlayRowsToMap_(sheet)[hotmartId];
    var merged = Object.assign({}, current, patch);
    var row = [
      hotmartId,
      merged.observacoes || "",
      !!merged.contratoAssinado,
      !!merged.brindeEnviado,
      merged.lancamento || "",
      JSON.stringify(merged.fotos || []),
      new Date(),
      autorNome || ""
    ];
    if (rowIdx === -1) {
      sheet.appendRow(row);
    } else {
      sheet.getRange(rowIdx, 1, 1, OVERLAY_HEADERS.length).setValues([row]);
    }
    return { ok: true };
  });
}

// ---------- Fotos do cliente ----------
//
// Guardadas no Google Drive (pasta própria do app, criada automaticamente), não na
// planilha — só o ID do arquivo e a legenda ficam na aba de overlay. Servidas de volta
// como base64 (via google.script.run), nunca por um link público do Drive — assim não
// é preciso mudar o compartilhamento de nenhum arquivo nem abrir uma URL nova.

function getPhotosFolder_() {
  var folderId = PropertiesService.getScriptProperties().getProperty("PHOTOS_FOLDER_ID");
  if (folderId) {
    try { return DriveApp.getFolderById(folderId); } catch (e) { /* ID inválido, recria abaixo */ }
  }
  var folder = DriveApp.createFolder("Dashboard Onboarding — Fotos de clientes");
  PropertiesService.getScriptProperties().setProperty("PHOTOS_FOLDER_ID", folder.getId());
  return folder;
}

// base64DataUrl no formato "data:image/jpeg;base64,....". Redimensionar/comprimir a
// imagem é feito no navegador (canvas) ANTES de chamar esta função, pra não estourar o
// limite de tamanho de uma chamada do google.script.run.
function uploadClientPhoto(token, hotmartId, base64DataUrl, filename, legenda, autorNome) {
  requireSession_(token);
  var match = /^data:(.+?);base64,(.+)$/.exec(base64DataUrl || "");
  if (!match) throw new Error("Formato de imagem inválido.");
  var contentType = match[1];
  var bytes = Utilities.base64Decode(match[2]);
  var blob = Utilities.newBlob(bytes, contentType, filename || (hotmartId + "-foto.jpg"));

  var folder = getPhotosFolder_();
  var file = folder.createFile(blob);
  if (legenda) file.setDescription(legenda);

  return withLock_(function () {
    var sheet = getOverlaySheet_();
    var current = overlayRowsToMap_(sheet)[hotmartId] || { fotos: [] };
    var fotos = current.fotos || [];
    fotos.push({
      fileId: file.getId(),
      legenda: legenda || "",
      uploadedBy: autorNome || "",
      uploadedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm")
    });
    saveOverlayFields(token, hotmartId, { fotos: fotos }, autorNome);
    return { ok: true, fileId: file.getId() };
  });
}

function deleteClientPhoto(token, hotmartId, fileId, autorNome) {
  requireSession_(token);
  try {
    var file = DriveApp.getFileById(fileId);
    file.setTrashed(true);
  } catch (e) { /* arquivo já removido — segue o baile */ }
  return withLock_(function () {
    var sheet = getOverlaySheet_();
    var current = overlayRowsToMap_(sheet)[hotmartId] || { fotos: [] };
    var fotos = (current.fotos || []).filter(function (f) { return f.fileId !== fileId; });
    saveOverlayFields(token, hotmartId, { fotos: fotos }, autorNome);
    return { ok: true };
  });
}

// Devolve as fotos de um cliente já em base64, prontas pra <img src="data:...">. Não
// exige sessão — leitura de imagem, mesmo nível de acesso que os dados da carteira.
function getClientPhotosBase64(hotmartId) {
  var overlay = getOverlayData_()[hotmartId];
  if (!overlay || !overlay.fotos || !overlay.fotos.length) return [];
  return overlay.fotos.map(function (foto) {
    try {
      var file = DriveApp.getFileById(foto.fileId);
      var blob = file.getBlob();
      var base64 = Utilities.base64Encode(blob.getBytes());
      return {
        fileId: foto.fileId,
        legenda: foto.legenda,
        uploadedBy: foto.uploadedBy,
        uploadedAt: foto.uploadedAt,
        dataUrl: "data:" + blob.getContentType() + ";base64," + base64
      };
    } catch (e) {
      return { fileId: foto.fileId, legenda: foto.legenda, error: "Arquivo não encontrado no Drive." };
    }
  });
}

// ---------- Missões (aba Rotina) ----------
//
// Amanda/Julia criam, qualquer onboarder marca sua própria atribuição como concluída.

function getMissoesSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.MISSOES_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.MISSOES_SHEET);
    sheet.appendRow(MISSOES_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function missoesRowsToObjects_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, MISSOES_HEADERS.length).getValues();
  return values
    .filter(function (row) { return row[0]; })
    .map(function (row) {
      var atribuicoes = [];
      try { atribuicoes = row[7] ? JSON.parse(row[7]) : []; } catch (e) {}
      return {
        id: row[0],
        titulo: row[1] || "",
        descricao: row[2] || "",
        pontos: Number(row[3]) || 0,
        prazo: formatDateOnly_(row[4]),
        criadoPor: row[5] || "",
        criadoEm: formatDateOnly_(row[6]),
        atribuicoes: atribuicoes // [{pessoa, completo, completoEm}]
      };
    });
}

function getMissoesData_() {
  return missoesRowsToObjects_(getMissoesSheet_());
}

function findMissaoRowIndex_(sheet, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

// missao: { titulo, descricao, pontos, prazo, atribuidoPara: ["Ilana","Pedro",...] }
function createMissao(token, missao, autorNome) {
  requireSession_(token);
  if (CONFIG.ADMINS.indexOf(autorNome) === -1) {
    throw new Error("Só Amanda ou Julia podem criar missões.");
  }
  return withLock_(function () {
    var sheet = getMissoesSheet_();
    var id = Utilities.getUuid();
    var atribuicoes = (missao.atribuidoPara || []).map(function (pessoa) {
      return { pessoa: pessoa, completo: false, completoEm: null };
    });
    sheet.appendRow([
      id,
      missao.titulo || "",
      missao.descricao || "",
      Number(missao.pontos) || 0,
      missao.prazo || "",
      autorNome,
      new Date(),
      JSON.stringify(atribuicoes)
    ]);
    return { ok: true, id: id };
  });
}

function completeMissaoTask(token, missaoId, pessoa) {
  requireSession_(token);
  return withLock_(function () {
    var sheet = getMissoesSheet_();
    var rowIdx = findMissaoRowIndex_(sheet, missaoId);
    if (rowIdx === -1) throw new Error("Missão não encontrada.");
    var raw = sheet.getRange(rowIdx, 8).getValue();
    var atribuicoes = [];
    try { atribuicoes = raw ? JSON.parse(raw) : []; } catch (e) {}
    var found = false;
    atribuicoes = atribuicoes.map(function (a) {
      if (a.pessoa === pessoa) {
        found = true;
        return { pessoa: pessoa, completo: true, completoEm: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd") };
      }
      return a;
    });
    if (!found) throw new Error("Essa missão não está atribuída a " + pessoa + ".");
    sheet.getRange(rowIdx, 8).setValue(JSON.stringify(atribuicoes));
    return { ok: true };
  });
}

function deleteMissao(token, missaoId, autorNome) {
  requireSession_(token);
  if (CONFIG.ADMINS.indexOf(autorNome) === -1) {
    throw new Error("Só Amanda ou Julia podem remover missões.");
  }
  return withLock_(function () {
    var sheet = getMissoesSheet_();
    var rowIdx = findMissaoRowIndex_(sheet, missaoId);
    if (rowIdx !== -1) sheet.deleteRow(rowIdx);
    return { ok: true };
  });
}
