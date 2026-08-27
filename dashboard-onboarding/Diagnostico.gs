// Dashboard Onboarding — funções de diagnóstico
//
// NENHUMA função aqui é chamada pelo Web App. São pra você rodar manualmente dentro
// do editor do Apps Script (selecione a função no menu suspenso ao lado do botão
// "Executar", no topo do editor, e clique em "Executar"), pra confirmar cada peça da
// configuração ANTES de tentar abrir o link /exec. O resultado de cada uma aparece no
// log de execuções (ícone de relógio "Execuções", no menu lateral esquerdo do editor).
//
// Ordem sugerida na primeira configuração: 1) diagnosticarConfiguracao, depois
// 2) diagnosticarAbas, depois 3) testarLeituraPlanilha, depois 4) testarDoGet, e por
// fim 5) autorizarDrive (só se o app for usar upload de fotos).

// 1) Confere se as Script Properties obrigatórias existem, sem expor a senha no log.
function diagnosticarConfiguracao() {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty("PORTFOLIO_SHEET_ID");
  var senha = props.getProperty("TEAM_PASSWORD");

  Logger.log("PORTFOLIO_SHEET_ID configurada? " + (sheetId ? "SIM (" + sheetId + ")" : "NÃO — falta configurar."));
  Logger.log("TEAM_PASSWORD configurada? " + (senha ? "SIM (" + senha.length + " caracteres, valor não exibido)" : "NÃO — falta configurar."));

  if (!sheetId) {
    Logger.log("Pare aqui: configure PORTFOLIO_SHEET_ID em Configurações do projeto > Script Properties antes de continuar.");
    return;
  }

  try {
    var ss = SpreadsheetApp.openById(sheetId);
    Logger.log('Planilha aberta com sucesso: "' + ss.getName() + '"');
  } catch (err) {
    Logger.log("ERRO ao abrir a planilha com esse ID: " + err.message);
    Logger.log("Confira se copiou o ID certo (o trecho da URL entre /d/ e /edit) e se esta conta tem acesso a ela.");
  }
}

// 2) Lista as abas da planilha de origem, mostrando o nome E os códigos Unicode de
// cada caractere — é assim que se enxerga um espaço "invisível" que não aparece
// diferente a olho nu mas quebra uma comparação exata de nome de aba.
function diagnosticarAbas() {
  var sheetId = PropertiesService.getScriptProperties().getProperty("PORTFOLIO_SHEET_ID");
  if (!sheetId) {
    Logger.log("PORTFOLIO_SHEET_ID não configurada — rode diagnosticarConfiguracao primeiro.");
    return;
  }
  var ss = SpreadsheetApp.openById(sheetId);
  var sheets = ss.getSheets();
  Logger.log("Total de abas: " + sheets.length);
  sheets.forEach(function (sheet) {
    var name = sheet.getName();
    var codes = [];
    for (var i = 0; i < name.length; i++) {
      codes.push(name.charCodeAt(i).toString(16).toUpperCase());
    }
    Logger.log('Aba "' + name + '" — códigos Unicode: [' + codes.join(" ") + "]");
  });

  ["[SF] On", "[SF] VD"].forEach(function (esperado) {
    try {
      var encontrada = findSheetByName_(ss, esperado);
      Logger.log('OK — aba esperada "' + esperado + '" encontrada como "' + encontrada.getName() + '" (comparação normalizada).');
    } catch (err) {
      Logger.log('FALHOU — ' + err.message);
    }
  });
}

// 3) Lê a planilha de ponta a ponta (igual ao doGet faria) e mostra quantos clientes
// caíram em cada carteira, sem passar pelo HtmlService — isola se o problema é na
// leitura de dados ou na publicação do Web App em si.
function testarLeituraPlanilha() {
  try {
    var data = getFullPortfolioData_();
    Object.keys(data).forEach(function (nome) {
      Logger.log(nome + ": " + data[nome].length + " clientes");
    });
    var total = Object.keys(data).reduce(function (acc, nome) { return acc + data[nome].length; }, 0);
    Logger.log("Total lido (somando as 4 carteiras): " + total);
    if (total === 0) {
      Logger.log(
        "Total ZERO pode ser normal (planilha vazia) ou indicar que a coluna Owner First " +
        "Name (AB) não bate com nenhum dos nomes esperados (Madu/Pedro/Josiane/Ilana) — " +
        "confira o valor real dessa coluna na planilha."
      );
    }
  } catch (err) {
    Logger.log("ERRO: " + err.message);
  }
}

// 4) Chama a mesma função que o Web App chama (getFullPortfolioData_ + montagem do
// template), sem publicar nada — se isso rodar limpo mas o link /exec não abrir, o
// problema está confirmado como sendo do deploy/autorização, não do código.
function testarDoGet() {
  var resultado = doGet({ parameter: {} });
  var conteudo = resultado.getContent();
  Logger.log("doGet executou sem lançar erro. Tamanho do HTML gerado: " + conteudo.length + " caracteres.");
  Logger.log('Contém erro de boot (bootError)? ' + (conteudo.indexOf("bootError") !== -1 ? "variável presente no HTML, confira o valor" : "não encontrado"));
}

// 5) Só necessário se o app for usar upload de fotos (DriveApp). Força a tela de
// autorização do Drive — autorizações de serviços do Google (Drive, Calendar etc.) só
// aparecem quando uma função é rodada manualmente no editor, nunca sozinhas dentro de
// um Web App. Rode uma vez, aprove o acesso, e o upload de fotos passa a funcionar
// pra quem publicou o Web App.
function autorizarDrive() {
  var folder = getPhotosFolder_();
  Logger.log('Pasta de fotos pronta: "' + folder.getName() + '" (ID: ' + folder.getId() + ")");
}
