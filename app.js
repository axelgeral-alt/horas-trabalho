// ======================================================================
// HORAS DE TRABALHO — app.js (COMPLETO E FUNCIONAL)
// ======================================================================

// ----------------------------------------------------------------------
// ESTADO GLOBAL
// ----------------------------------------------------------------------
let registos = [];
let proximoId = 1;

let inicioAtual = null;
let comentarioAtual = "";
let intervaloContagem = null;

let modoEscuro = false;
let autoBackupAtivo = false;
let filtroData = "";

let popupAberto = false;          // popup manual
let painelOpcoesAberto = false;

let paginaAtual = 1;

// Valores horários: [{ data: "YYYY-MM-DD", valor: Number }]
let valoresHora = [];

// ----------------------------------------------------------------------
// NORMALIZAÇÃO (CRÍTICA)
// ----------------------------------------------------------------------
function normalizarValorHora(valor) {
    const n = Number(String(valor).replace(",", "."));
    if (Number.isNaN(n)) return 0;
    return Math.round(n * 100) / 100;
}

// ----------------------------------------------------------------------
// UTILITÁRIOS
// ----------------------------------------------------------------------
function isMobile() {
    return window.innerWidth <= 768;
}

function registosPorPagina() {
    return isMobile() ? 5 : 10;
}

function totalPaginas(lista) {
    return Math.max(1, Math.ceil(lista.length / registosPorPagina()));
}

function clampPagina(lista) {
    const total = totalPaginas(lista);
    if (paginaAtual < 1) paginaAtual = 1;
    if (paginaAtual > total) paginaAtual = total;
}

function irParaUltimaPagina(lista) {
    paginaAtual = totalPaginas(lista);
}

function calcularMinutos(inicio, fim) {
    return Math.floor((fim - inicio) / 60000);
}

function formatarTempo(min) {
    return `${Math.floor(min / 60)}h ${min % 60}m`;
}

function arredondar15(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    const r = m <= 7 ? 0 : m <= 22 ? 15 : m <= 37 ? 30 : m <= 52 ? 45 : 60;
    return `${h + Math.floor(r / 60)}h ${r % 60}m`;
}

function horasDecimaisDeTexto(txt) {
    const m = String(txt || "").match(/(\d+)h\s+(\d+)m/);
    return m ? parseInt(m[1], 10) + parseInt(m[2], 10) / 60 : 0;
}

function formatarEuro(v) {
    return v.toFixed(2).replace(".", ",") + " €";
}

// ----------------------------------------------------------------------
// BACKUP AUTOMÁTICO
// ----------------------------------------------------------------------
function guardarBackupAutomatico() {
    if (!autoBackupAtivo) return;

    localStorage.setItem("backupAutomatico", JSON.stringify({
        registos,
        proximoId,
        modoEscuro,
        autoBackupAtivo,
        filtroData,
        comentarioAtual,
        popupAberto,
        painelOpcoesAberto,
        inicioAtual: inicioAtual ? inicioAtual.toISOString() : null,
        valoresHora
    }));
}

function carregarBackupAutomatico() {
    const raw = localStorage.getItem("backupAutomatico");
    if (!raw) return;

    try {
        const b = JSON.parse(raw);

        registos = b.registos || [];
        proximoId = b.proximoId || 1;

        modoEscuro = !!b.modoEscuro;
        autoBackupAtivo = !!b.autoBackupAtivo;
        filtroData = b.filtroData || "";
        comentarioAtual = b.comentarioAtual || "";

        popupAberto = !!b.popupAberto;
        painelOpcoesAberto = !!b.painelOpcoesAberto;

        valoresHora = (b.valoresHora || []).map(v => ({
            data: String(v.data || ""),
            valor: normalizarValorHora(v.valor)
        }));
        ordenarValoresHora();

        inicioAtual = b.inicioAtual ? new Date(b.inicioAtual) : null;
        if (inicioAtual) iniciarContagemVisual();
    } catch {
        console.warn("Backup inválido ignorado.");
    }
}

function atualizarBotaoAutoBackup() {
    const btn = document.getElementById("toggleAutoBackupBtn");
    if (!btn) return;

    btn.textContent = autoBackupAtivo ? "Backup Automático: ON" : "Backup Automático: OFF";
    btn.classList.toggle("auto-backup-on", autoBackupAtivo);
}

function toggleAutoBackup() {
    autoBackupAtivo = !autoBackupAtivo;
    atualizarBotaoAutoBackup();
    guardarBackupAutomatico();
}

// ----------------------------------------------------------------------
// CONTAGEM EM TEMPO REAL
// ----------------------------------------------------------------------
function iniciarContagemVisual() {
    const el = document.getElementById("status-contagem");
    if (!el) return;

    el.style.display = "block";

    clearInterval(intervaloContagem);
    intervaloContagem = setInterval(() => {
        if (!inicioAtual) return;
        const min = calcularMinutos(inicioAtual, new Date());
        el.innerHTML = `Contagem em andamento…<br>${formatarTempo(min)}`;
    }, 1000);
}

// ----------------------------------------------------------------------
// POPUPS (CLASSE .open)
// ----------------------------------------------------------------------
function abrirPopupManual() {
    popupAberto = true;
    document.getElementById("popup-manual")?.classList.add("open");
    guardarBackupAutomatico();
}

function fecharPopupManual() {
    popupAberto = false;
    document.getElementById("popup-manual")?.classList.remove("open");
    guardarBackupAutomatico();
}

function abrirPopupExportar() {
    document.getElementById("popup-exportar")?.classList.add("open");
}

function fecharPopupExportar() {
    document.getElementById("popup-exportar")?.classList.remove("open");
}

// ----------------------------------------------------------------------
// VALORES HORÁRIOS (HISTÓRICO)
// ----------------------------------------------------------------------
function ordenarValoresHora() {
    valoresHora.sort((a, b) => String(a.data).localeCompare(String(b.data)));
}

function obterValorHoraParaData(data) {
    ordenarValoresHora();
    let valor = 0;

    for (const v of valoresHora) {
        if (String(v.data) <= String(data)) {
            valor = normalizarValorHora(v.valor);
        }
    }

    return valor;
}

function calcularValorParaRegisto(r) {
    const horas = horasDecimaisDeTexto(r.tempoArredondadoTexto);
    const valorHora = obterValorHoraParaData(r.data);
    return horas * valorHora;
}

// ----------------------------------------------------------------------
// REGISTOS (INICIAR / PARAR)
// ----------------------------------------------------------------------
function iniciarRegisto() {
    if (inicioAtual) return alert("Já existe um registo em andamento.");

    inicioAtual = new Date();
    comentarioAtual = (document.getElementById("comentario")?.value || "").trim();

    iniciarContagemVisual();
    guardarBackupAutomatico();
}

function ajustarFiltroAposNovoRegisto(dataNovo) {
    if (filtroData && filtroData !== dataNovo) {
        filtroData = "";
        const el = document.getElementById("filtro-data");
        if (el) el.value = "";
    }
}

function pararRegisto() {
    if (!inicioAtual) return alert("Nenhum registo iniciado.");

    const dataNovo = inicioAtual.toISOString().split("T")[0];
    const fim = new Date();
    const min = calcularMinutos(inicioAtual, fim);

    registos.push({
        id: proximoId++,
        data: dataNovo,
        inicio: inicioAtual.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
        fim: fim.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
        minutosReais: min,
        tempoRealTexto: formatarTempo(min),
        tempoArredondadoTexto: arredondar15(min),
        comentario: comentarioAtual.slice(0, 100)
    });

    inicioAtual = null;
    comentarioAtual = "";
    const c = document.getElementById("comentario");
    if (c) c.value = "";

    const status = document.getElementById("status-contagem");
    if (status) status.style.display = "none";
    clearInterval(intervaloContagem);

    ajustarFiltroAposNovoRegisto(dataNovo);

    const listaAtual = filtroData ? registos.filter(r => r.data === filtroData) : registos;
    irParaUltimaPagina(listaAtual);

    filtrarPorData(false);
    atualizarTotais();
    guardarBackupAutomatico();
}

// ----------------------------------------------------------------------
// REGISTO MANUAL
// ----------------------------------------------------------------------
function guardarRegistoManual() {
    const data = document.getElementById("manual-data")?.value;
    const inicio = document.getElementById("manual-inicio")?.value;
    const fim = document.getElementById("manual-fim")?.value;
    const comentario = (document.getElementById("manual-comentario")?.value || "").trim().slice(0, 100);

    if (!data || !inicio || !fim) return alert("Preencha todos os campos.");

    const inicioDate = new Date(`${data}T${inicio}`);
    const fimDate = new Date(`${data}T${fim}`);
    if (isNaN(inicioDate) || isNaN(fimDate) || fimDate <= inicioDate) {
        return alert("Hora de fim inválida.");
    }

    const min = calcularMinutos(inicioDate, fimDate);

    registos.push({
        id: proximoId++,
        data,
        inicio,
        fim,
        minutosReais: min,
        tempoRealTexto: formatarTempo(min),
        tempoArredondadoTexto: arredondar15(min),
        comentario
    });

    fecharPopupManual();

    const listaAtual = filtroData ? registos.filter(r => r.data === filtroData) : registos;
    irParaUltimaPagina(listaAtual);

    filtrarPorData(false);
    atualizarTotais();
    guardarBackupAutomatico();
}

// ----------------------------------------------------------------------
// ORDENAR REGISTOS
// ----------------------------------------------------------------------
function ordenarRegistos(lista) {
    return [...lista].sort((a, b) =>
        new Date(`${a.data}T${a.inicio}`) - new Date(`${b.data}T${b.inicio}`)
    );
}

// ----------------------------------------------------------------------
// TABELA + PAGINAÇÃO
// ----------------------------------------------------------------------
function atualizarTabela(lista) {
    const tbody = document.getElementById("tabela-registos");
    if (!tbody) return;

    tbody.innerHTML = "";

    const ordenados = ordenarRegistos(lista);
    clampPagina(ordenados);

    const porPagina = registosPorPagina();
    const start = (paginaAtual - 1) * porPagina;
    const end = start + porPagina;

    ordenados.slice(start, end).forEach(r => {
        const valor = calcularValorParaRegisto(r);

        tbody.innerHTML += `
            <tr>
                <td>${r.data}</td>
                <td>${r.inicio}</td>
                <td>${r.fim}</td>
                <td>${r.tempoRealTexto}</td>
                <td>${r.tempoArredondadoTexto}</td>
                <td>${valor ? formatarEuro(valor) : "-"}</td>
                <td>${r.comentario || ""}</td>
                <td class="acoes">
                    <button onclick="editarRegisto(${r.id})">Editar</button>
                    <button class="danger" onclick="apagarRegisto(${r.id})">Apagar</button>
                </td>
            </tr>
        `;
    });

    atualizarPaginacao();
}

function atualizarPaginacao() {
    const p = document.getElementById("paginacao");
    if (!p) return;

    const listaAtual = filtroData ? registos.filter(r => r.data === filtroData) : registos;
    const totalP = totalPaginas(listaAtual);

    p.innerHTML = `
        <button ${paginaAtual === 1 ? "disabled" : ""} onclick="paginaAnterior()">Anterior</button>
        <span>Página ${paginaAtual} de ${totalP}</span>
        <button ${paginaAtual >= totalP ? "disabled" : ""} onclick="paginaSeguinte()">Próxima</button>
    `;
}

function paginaAnterior() {
    paginaAtual--;
    filtrarPorData(false);
}

function paginaSeguinte() {
    paginaAtual++;
    filtrarPorData(false);
}

// ----------------------------------------------------------------------
// FILTRO
// ----------------------------------------------------------------------
function filtrarPorData(reset = true) {
    if (reset) paginaAtual = 1;

    const el = document.getElementById("filtro-data");
    filtroData = el ? el.value : "";

    const lista = filtroData ? registos.filter(r => r.data === filtroData) : registos;

    clampPagina(lista);
    atualizarTabela(lista);
    guardarBackupAutomatico();
}

// ----------------------------------------------------------------------
// EDITAR / APAGAR
// ----------------------------------------------------------------------
function apagarRegisto(id) {
    if (!confirm("Apagar este registo?")) return;

    registos = registos.filter(r => r.id !== id);

    const lista = filtroData ? registos.filter(r => r.data === filtroData) : registos;
    clampPagina(lista);

    filtrarPorData(false);
    atualizarTotais();
    guardarBackupAutomatico();
}

function editarRegisto(id) {
    const r = registos.find(x => x.id === id);
    if (!r) return;

    const novaData = prompt("Data (YYYY-MM-DD):", r.data);
    if (novaData === null) return;

    const novoInicio = prompt("Início (HH:MM):", r.inicio);
    if (novoInicio === null) return;

    const novoFim = prompt("Fim (HH:MM):", r.fim);
    if (novoFim === null) return;

    const novoComentario = prompt("Comentário:", r.comentario || "");
    if (novoComentario === null) return;

    const inicioDate = new Date(`${novaData}T${novoInicio}`);
    const fimDate = new Date(`${novaData}T${novoFim}`);
    if (isNaN(inicioDate) || isNaN(fimDate) || fimDate <= inicioDate) {
        return alert("Dados inválidos. Verifica data e horas.");
    }

    const min = calcularMinutos(inicioDate, fimDate);

    r.data = novaData;
    r.inicio = novoInicio;
    r.fim = novoFim;
    r.minutosReais = min;
    r.tempoRealTexto = formatarTempo(min);
    r.tempoArredondadoTexto = arredondar15(min);
    r.comentario = (novoComentario || "").trim().slice(0, 100);

    filtrarPorData(false);
    atualizarTotais();
    guardarBackupAutomatico();
}

// ----------------------------------------------------------------------
// TOTAIS (TEMPO + €)
// ----------------------------------------------------------------------
function minutosTotais(lista) {
    return lista.reduce((a, r) => a + (r.minutosReais || 0), 0);
}

function valorTotal(lista) {
    return lista.reduce((a, r) => a + calcularValorParaRegisto(r), 0);
}

// Semana ISO (segunda-feira)
function mesmaSemana(data1, data2) {
    const d1 = new Date(data1);
    const d2 = new Date(data2);

    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);

    const ds1 = d1.getDay() === 0 ? 7 : d1.getDay();
    const ds2 = d2.getDay() === 0 ? 7 : d2.getDay();

    const seg1 = new Date(d1);
    seg1.setDate(d1.getDate() - ds1 + 1);

    const seg2 = new Date(d2);
    seg2.setDate(d2.getDate() - ds2 + 1);

    return seg1.getTime() === seg2.getTime();
}

function mesmoMes(d1, d2) {
    const a = new Date(d1), b = new Date(d2);
    return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

function garantirLinhaValor(totalId, valorId) {
    const totalEl = document.getElementById(totalId);
    if (!totalEl) return null;

    let valorEl = document.getElementById(valorId);
    if (!valorEl) {
        valorEl = document.createElement("div");
        valorEl.id = valorId;
        valorEl.className = "valor";
        totalEl.insertAdjacentElement("afterend", valorEl);
    }
    return valorEl;
}

function atualizarTotais() {
    const hoje = new Date().toISOString().split("T")[0];

    const regDia = registos.filter(r => r.data === hoje);
    const regSemana = registos.filter(r => mesmaSemana(r.data, hoje));
    const regMes = registos.filter(r => mesmoMes(r.data, hoje));

    const elDia = document.getElementById("total-dia");
    const elSemana = document.getElementById("total-semana");
    const elMes = document.getElementById("total-mes");

    if (elDia) elDia.textContent = "Total do dia: " + arredondar15(minutosTotais(regDia));
    if (elSemana) elSemana.textContent = "Total da semana: " + arredondar15(minutosTotais(regSemana));
    if (elMes) elMes.textContent = "Total do mês: " + arredondar15(minutosTotais(regMes));

    const vDia = garantirLinhaValor("total-dia", "valor-dia");
    const vSemana = garantirLinhaValor("total-semana", "valor-semana");
    const vMes = garantirLinhaValor("total-mes", "valor-mes");

    if (vDia) vDia.textContent = "Valor do dia: " + formatarEuro(valorTotal(regDia));
    if (vSemana) vSemana.textContent = "Valor da semana: " + formatarEuro(valorTotal(regSemana));
    if (vMes) vMes.textContent = "Valor do mês: " + formatarEuro(valorTotal(regMes));
}

// ----------------------------------------------------------------------
// EXPORTAÇÃO EXCEL (POPUP)
// ----------------------------------------------------------------------
function exportarPeriodo(tipo) {
    const hoje = new Date();
    let inicio, fim;

    if (tipo === "hoje") {
        inicio = fim = hoje;
    } else if (tipo === "semana") {
        const d = hoje.getDay() === 0 ? 7 : hoje.getDay();
        inicio = new Date(hoje);
        inicio.setDate(hoje.getDate() - d + 1);
        fim = new Date(inicio);
        fim.setDate(inicio.getDate() + 6);
    } else if (tipo === "mes") {
        inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    } else if (tipo === "ano") {
        inicio = new Date(hoje.getFullYear(), 0, 1);
        fim = new Date(hoje.getFullYear(), 11, 31);
    }

    document.getElementById("exportar-de").value = inicio.toISOString().split("T")[0];
    document.getElementById("exportar-ate").value = fim.toISOString().split("T")[0];
}

function exportarExcelComFiltro() {
    const de = document.getElementById("exportar-de").value;
    const ate = document.getElementById("exportar-ate").value;

    let lista = registos;
    if (de && ate) lista = registos.filter(r => r.data >= de && r.data <= ate);

    if (!lista.length) return alert("Não há registos no período selecionado.");
    if (typeof XLSX === "undefined") return alert("Biblioteca XLSX não carregada. Verifica libs/xlsx.full.min.js");

    const dados = ordenarRegistos(lista).map(r => {
        const valor = calcularValorParaRegisto(r);
        return {
            Data: r.data,
            "Das / Às": `Das ${r.inicio} às ${r.fim}`,
            "Tempo Real": r.tempoRealTexto,
            "Tempo Arredondado": r.tempoArredondadoTexto,
            "Valor (€)": valor ? valor.toFixed(2).replace(".", ",") : "",
            Comentário: r.comentario || ""
        };
    });

    const ws = XLSX.utils.json_to_sheet(dados);
    ws["!cols"] = Object.keys(dados[0]).map(k => ({
        wch: Math.max(k.length, ...dados.map(r => String(r[k] || "").length)) + 2
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Registos");
    XLSX.writeFile(wb, "horas_de_trabalho.xlsx");

    fecharPopupExportar();
}

// ----------------------------------------------------------------------
// MODO ESCURO
// ----------------------------------------------------------------------
function toggleDarkMode() {
    modoEscuro = !modoEscuro;
    document.body.classList.toggle("dark", modoEscuro);
    guardarBackupAutomatico();
}

// ----------------------------------------------------------------------
// INIT
// ----------------------------------------------------------------------
window.addEventListener("load", () => {
    carregarBackupAutomatico();

    document.body.classList.toggle("dark", modoEscuro);

    const comentario = document.getElementById("comentario");
    if (comentario) comentario.value = comentarioAtual;

    const filtro = document.getElementById("filtro-data");
    if (filtro) filtro.value = filtroData;

    atualizarBotaoAutoBackup();

    if (popupAberto) {
        document.getElementById("popup-manual")?.classList.add("open");
    }

    filtrarPorData(false);
    atualizarTotais();
});
