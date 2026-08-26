// Dashboard Onboarding — servidor (Google Apps Script)
//
// Fonte única de dados "de verdade" (somente leitura, ao vivo, sem cache): a planilha
// externa "Gestão de carteira unificada" (sincronizada do Salesforce), abas
// "SF On" (uma linha por oportunidade/cliente) e "SF VD" (log de touchpoints,
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
  SHEET_ON: "SF On",
  SHEET_VD: "SF VD",
  OVERLAY_SHEET: "App - Overlay CRM",
  MISSOES_SHEET: "App - Missões",
  SESSION_TTL_SECONDS: 6 * 60 * 60, // 6 horas — teto do CacheService
  ONBOARDERS: ["Madu", "Pedro", "Josiane", "Ilana"],
  ADMINS: ["Amanda", "Julia"]
};

// Índices de coluna (0-based) na aba "SF On" — mapeamento confirmado, não mexer sem
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

// Overlay de CRM — campos que só existem no app (o mockup de UI que define esses
// campos: telefone, e-mail, endereço, aniversário, evento, contrato, brinde, meta de
// faturamento, Hotmart Cast, equipe do cliente, ações de relacionamento e fotos).
var OVERLAY_HEADERS = [
  "hotmartId", "telefone", "email", "endereco", "aniversario", "evento", "contrato",
  "brinde", "metaFaturamento", "hotmartCast", "hotmartCastData", "hotmartCastHora",
  "equipeExtra", "relacExtra", "fotos", "atualizadoEm", "atualizadoPor"
];

var MISSOES_HEADERS = [
  "id", "titulo", "descricao", "pontos", "destinatario", "criadoPor", "criadoEm", "completions"
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
  var output = template.evaluate();
  output.setTitle("Dashboard Onboarding");
  output.addMetaTag("viewport", "width=device-width, initial-scale=1");
  output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return output;
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
  // Remove espacos/zero-width "invisiveis" que costumam entrar ao colar nomes
  // de aba de um chat/editor: zero-width space/joiner/non-joiner, BOM, NBSP,
  // word joiner, separador mongol, a faixa de espacos U+2000-U+200A e o espaco
  // ideografico U+3000. Sempre por \uXXXX explicito aqui -- nunca colar o
  // caractere invisivel "de verdade" neste arquivo: e exatamente esse tipo de
  // erro silencioso que ja custou um ciclo de debug inteiro numa tentativa
  // anterior.
  var s = String(name || "");
  s = s.replace(/[\u200B\u200C\u200D\uFEFF\u00A0\u2060\u180E\u2000-\u200A\u3000]/g, "");
  s = s.replace(/\s+/g, " ");
  return s.trim();
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

// Lê a aba "SF On" inteira e devolve um array de registros já: deduplicados (última
// linha de cada Hotmart ID vence), com os campos calculados e os campos ilustrativos.
//
// As chaves de cada registro usam os MESMOS nomes de campo (em português, com
// espaços/acentos) que o mockup de UI já usa — não é um capricho, é pra bater
// exatamente com o front-end sem precisar de nenhuma camada de tradução no meio.
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
      "Hotmart ID": hotmartId,
      "Nome": toStringOrNull_(row[COL.nome]),
      "GMV": gmv,
      "CW": formatDateOnly_(row[COL.cw]),
      "Ativação": ativacao,
      "Status": toStringOrNull_(row[COL.status]),
      "SDR": toStringOrNull_(row[COL.sdr]),
      "Closer": toStringOrNull_(row[COL.closer]),
      "Days carteira": daysCarteira,
      "SOW": toStringOrNull_(row[COL.sow]),
      "Amount 3 meses": amount3Meses,
      "Taxa atual": toNumberOrNull_(row[COL.taxaAtual]),
      "Período": toStringOrNull_(row[COL.periodo]),
      "Plat. anterior": toStringOrNull_(row[COL.platAnterior]),
      "UF": toStringOrNull_(row[COL.uf]),
      "OP": formatDateOnly_(row[COL.op]),
      "Segmento": toStringOrNull_(row[COL.segmento]),
      "Amount 12 meses": toNumberOrNull_(row[COL.amount12Meses]),
      "Owner First Name": toStringOrNull_(row[COL.ownerFirstName]), // só pro filtro/agrupamento, não exibido

      // Campos calculados
      "Amount real*": amountReal,
      "% atingido": pctAtingido,
      "% amount": pctAmount,
      "Dias ativado": diasAtivado,
      "VDs": 0, // preenchido depois, em applyVdCounts_

      // Campos ainda sem fonte na planilha — ficam null/false até existir mapeamento
      "Observações": null,
      "col_13": null,
      "Lançamento": null,
      "col_26": false,

      // Campos ilustrativos determinísticos (hash do Hotmart ID, nunca aleatório)
      "_cronogramaProgress": illustrative.cronogramaProgress,
      "_ultimoContatoDias": illustrative.ultimoContatoDias,
      "_ultimoContatoData": illustrative.ultimoContatoData
    };
  });
}

// Lê a aba "SF VD" e conta quantas linhas cada Hotmart ID (coluna A) tem —
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
    rec["VDs"] = counts[rec["Hotmart ID"]] || 0;
  });
  return records;
}

// Devolve { madu: [...], pedro: [...], josiane: [...], ilana: [...] }, cada array já
// filtrado pelo primeiro nome do Owner e com o campo "Responsavel" preenchido (nome
// "bonito" do consultor, usado só pra exibição — o filtro real usa Owner First Name).
// Quem não bate com nenhum dos 4 nomes conhecidos (carteira de outra pessoa, por
// exemplo) não entra em nenhum grupo — Amanda/Julia veem o consolidado calculado no
// próprio front-end (união dos 4).
function getFullPortfolioData_() {
  var ss = getPortfolioSpreadsheet_();
  var records = readPortfolioRows_(ss);
  applyVdCounts_(records, readVdCounts_(ss));

  var grouped = {};
  CONFIG.ONBOARDERS.forEach(function (nome) { grouped[nome.toLowerCase()] = []; });

  records.forEach(function (rec) {
    var owner = (rec["Owner First Name"] || "").trim().toLowerCase();
    var match = CONFIG.ONBOARDERS.filter(function (nome) { return nome.toLowerCase() === owner; })[0];
    if (match) {
      rec["Responsavel"] = match;
      grouped[match.toLowerCase()].push(rec);
    }
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
    var equipeExtra = [], relacExtra = [], fotos = [];
    try { equipeExtra = row[12] ? JSON.parse(row[12]) : []; } catch (e) {}
    try { relacExtra = row[13] ? JSON.parse(row[13]) : []; } catch (e) {}
    try { fotos = row[14] ? JSON.parse(row[14]) : []; } catch (e) {}
    map[hotmartId] = {
      hotmartId: hotmartId,
      telefone: row[1] || "",
      email: row[2] || "",
      endereco: row[3] || "",
      aniversario: row[4] || "",
      evento: row[5] || "",
      contrato: row[6] || "",
      brinde: row[7] || "",
      metaFaturamento: row[8] || "",
      hotmartCast: row[9] || "",
      hotmartCastData: row[10] || "",
      hotmartCastHora: row[11] || "",
      equipeExtra: equipeExtra, // [{nome, cargo, telefone}]
      relacExtra: relacExtra, // [{data, texto}]
      fotos: fotos, // [{fileId, legenda, data, nomeArquivo, uploadedBy, uploadedAt}] — sem bytes, ver getClientPhotosBase64
      atualizadoEm: formatDateOnly_(row[15]),
      atualizadoPor: row[16] || ""
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

var OVERLAY_DEFAULTS_ = {
  hotmartId: "", telefone: "", email: "", endereco: "", aniversario: "", evento: "",
  contrato: "", brinde: "", metaFaturamento: "", hotmartCast: "", hotmartCastData: "",
  hotmartCastHora: "", equipeExtra: [], relacExtra: [], fotos: []
};

// patch: qualquer subconjunto dos campos do overlay (telefone, email, endereco,
// aniversario, evento, contrato, brinde, metaFaturamento, hotmartCast,
// hotmartCastData, hotmartCastHora, equipeExtra[], relacExtra[], fotos[]).
function saveOverlayFields(token, hotmartId, patch, autorNome) {
  requireSession_(token);
  return withLock_(function () {
    var sheet = getOverlaySheet_();
    var rowIdx = findOverlayRowIndex_(sheet, hotmartId);
    var current = rowIdx === -1
      ? Object.assign({}, OVERLAY_DEFAULTS_, { hotmartId: hotmartId })
      : overlayRowsToMap_(sheet)[hotmartId];
    var merged = Object.assign({}, current, patch);
    var row = [
      hotmartId,
      merged.telefone || "",
      merged.email || "",
      merged.endereco || "",
      merged.aniversario || "",
      merged.evento || "",
      merged.contrato || "",
      merged.brinde || "",
      merged.metaFaturamento || "",
      merged.hotmartCast || "",
      merged.hotmartCastData || "",
      merged.hotmartCastHora || "",
      JSON.stringify(merged.equipeExtra || []),
      JSON.stringify(merged.relacExtra || []),
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
// limite de tamanho de uma chamada do google.script.run. `dataFoto` é a data da foto
// (evento, entrega de brinde etc.), editável pelo time — não confundir com
// `uploadedAt`, que é quando o arquivo foi de fato enviado.
function uploadClientPhoto(token, hotmartId, base64DataUrl, nomeArquivo, legenda, dataFoto, autorNome) {
  requireSession_(token);
  var match = /^data:(.+?);base64,(.+)$/.exec(base64DataUrl || "");
  if (!match) throw new Error("Formato de imagem inválido.");
  var contentType = match[1];
  var bytes = Utilities.base64Decode(match[2]);
  var blob = Utilities.newBlob(bytes, contentType, nomeArquivo || (hotmartId + "-foto.jpg"));

  var folder = getPhotosFolder_();
  var file = folder.createFile(blob);
  if (legenda) file.setDescription(legenda);

  return withLock_(function () {
    var sheet = getOverlaySheet_();
    var current = overlayRowsToMap_(sheet)[hotmartId] || Object.assign({}, OVERLAY_DEFAULTS_, { hotmartId: hotmartId });
    var fotos = current.fotos || [];
    var registro = {
      fileId: file.getId(),
      legenda: legenda || "",
      data: dataFoto || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
      nomeArquivo: nomeArquivo || "",
      uploadedBy: autorNome || "",
      uploadedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm")
    };
    fotos.unshift(registro);
    saveOverlayFields(token, hotmartId, { fotos: fotos }, autorNome);
    return { ok: true, foto: registro, dataUrl: base64DataUrl };
  });
}

function updateClientPhotoField(token, hotmartId, fileId, field, value, autorNome) {
  requireSession_(token);
  if (["legenda", "data"].indexOf(field) === -1) throw new Error("Campo de foto inválido: " + field);
  return withLock_(function () {
    var current = overlayRowsToMap_(getOverlaySheet_())[hotmartId];
    if (!current) throw new Error("Cliente sem overlay ainda.");
    var fotos = (current.fotos || []).map(function (f) {
      if (f.fileId === fileId) { var copy = Object.assign({}, f); copy[field] = value; return copy; }
      return f;
    });
    saveOverlayFields(token, hotmartId, { fotos: fotos }, autorNome);
    return { ok: true };
  });
}

function deleteClientPhoto(token, hotmartId, fileId, autorNome) {
  requireSession_(token);
  try {
    var file = DriveApp.getFileById(fileId);
    file.setTrashed(true);
  } catch (e) { /* arquivo já removido — segue o baile */ }
  return withLock_(function () {
    var current = overlayRowsToMap_(getOverlaySheet_())[hotmartId] || { fotos: [] };
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
        data: foto.data,
        nomeArquivo: foto.nomeArquivo,
        dataUrl: "data:" + blob.getContentType() + ";base64," + base64
      };
    } catch (e) {
      return { fileId: foto.fileId, legenda: foto.legenda, data: foto.data, error: "Arquivo não encontrado no Drive." };
    }
  });
}

// ---------- Missões (Rotina — gamificação) ----------
//
// Amanda/Julia criam (pra toda a equipe ou pra uma pessoa específica), qualquer
// onboarder marca/desmarca sua própria conclusão. `destinatario` é "todos" ou o nome
// de um onboarder; `completions` é um mapa { "Ilana": true, ... } — só entra quem já
// concluiu, ausência de chave = pendente.

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
  var withId = values.filter(function (row) { return row[0]; });
  return withId.map(function (row) {
    var completions = {};
    try { completions = row[7] ? JSON.parse(row[7]) : {}; } catch (e) {}
    return {
      id: row[0],
      titulo: row[1] || "",
      descricao: row[2] || "",
      pontos: Number(row[3]) || 0,
      destinatario: row[4] || "todos",
      criadoPor: row[5] || "",
      criadoEm: formatDateOnly_(row[6]),
      completions: completions
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

// missao: { titulo, descricao, pontos, destinatario: "todos" | "Ilana" | ... }
function createMissao(token, missao, autorNome) {
  requireSession_(token);
  if (CONFIG.ADMINS.indexOf(autorNome) === -1) {
    throw new Error("Só Amanda ou Julia podem criar missões.");
  }
  return withLock_(function () {
    var sheet = getMissoesSheet_();
    var id = Utilities.getUuid();
    sheet.appendRow([
      id,
      missao.titulo || "",
      missao.descricao || "",
      Number(missao.pontos) || 0,
      missao.destinatario || "todos",
      autorNome,
      new Date(),
      JSON.stringify({})
    ]);
    return { ok: true, id: id };
  });
}

// Alterna concluído/pendente pra `pessoa` (não é só marcar — desmarcar também é
// permitido, igual ao mockup de UI).
function toggleMissionComplete(token, missaoId, pessoa) {
  requireSession_(token);
  return withLock_(function () {
    var sheet = getMissoesSheet_();
    var rowIdx = findMissaoRowIndex_(sheet, missaoId);
    if (rowIdx === -1) throw new Error("Missão não encontrada.");
    var raw = sheet.getRange(rowIdx, 8).getValue();
    var completions = {};
    try { completions = raw ? JSON.parse(raw) : {}; } catch (e) {}
    if (completions[pessoa]) delete completions[pessoa];
    else completions[pessoa] = true;
    sheet.getRange(rowIdx, 8).setValue(JSON.stringify(completions));
    return { ok: true, completo: !!completions[pessoa] };
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
