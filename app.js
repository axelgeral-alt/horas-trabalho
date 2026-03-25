// =====================================================
// ESTADO GLOBAL
// =====================================================
let registos = JSON.parse(localStorage.getItem("registos")) || [];
let valorHora = JSON.parse(localStorage.getItem("valorHora")) || [];
let registoAtivo = null;
let autoBackup = JSON.parse(localStorage.getItem("autoBackup")) || false;

// =====================================================
// UTILITÁRIOS
// =====================================================
function guardarLocal() {
    localStorage.setItem("registos", JSON.stringify(registos));
    localStorage.setItem("valorHora", JSON.stringify(valorHora));
    localStorage.setItem("autoBackup", JSON.stringify(autoBackup));
}

function formatarTempo(minutos) {
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return `${h}h ${m}m`;
}

function calcularMinutos(inicio, fim) {
    const [hi, mi] = inicio.split(":").map(Number);
    const [hf, mf] = fim.split(":").map(Number);
    return (hf * 60 + mf) - (hi * 60 + mi);
}

function obterValorHora(data) {
    const aplicaveis = valorHora
        .filter(v => v.data <= data)
        .sort((a, b) => b.data.localeCompare(a.data));
    return aplicaveis.length ? aplicaveis[0].valor : 0;
}

// =====================================================
// REGISTO AUTOMÁTICO
// =====================================================
function iniciarRegisto() {
    if (registoAtivo) return;
    registoAtivo = {
        data: new Date().toISOString().slice(0, 10),
        inicio: new Date().toTimeString().slice(0, 5),
        comentario: document.getElementById("comentario").value || ""
    };
    document.getElementById("status-contagem").textContent = "Registo em curso...";
}

function pararRegisto() {
    if (!registoAtivo) return;

    const fim = new Date().toTimeString().slice(0, 5);
    const minutos = calcularMinutos(registoAtivo.inicio, fim);
    const valor = (minutos / 60) * obterValorHora(registoAtivo.data);

    registos.push({
        ...registoAtivo,
        fim,
        minutos,
        valor
    });

    registoAtivo = null;
    document.getElementById("comentario").value = "";
    document.getElementById("status-contagem").textContent = "";

    guardarLocal();
    atualizarTabela();
    atualizarTotais();
    if (autoBackup) exportarBackup();
}

// =====================================================
// REGISTO MANUAL
// =====================================================
function abrirPopupManual() {
    document.getElementById("popup-manual").style.display = "flex";
}

function fecharPopupManual() {
    document.getElementById("popup-manual").style.display = "none";
}

function guardarRegistoManual() {
    const data = document.getElementById("manual-data").value;
    const inicio = document.getElementById("manual-inicio").value;
    const fim = document.getElementById("manual-fim").value;
    const comentario = document.getElementById("manual-comentario").value;

    if (!data || !inicio || !fim) return;

    const minutos = calcularMinutos(inicio, fim);
    const valor = (minutos / 60) * obterValorHora(data);

    registos.push({ data, inicio, fim, minutos, valor, comentario });

    guardarLocal();
    fecharPopupManual();
    atualizarTabela();
    atualizarTotais();
}

// =====================================================
// TABELA E TOTAIS
// =====================================================
function atualizarTabela(lista = registos) {
    const tbody = document.getElementById("tabela-registos");
    tbody.innerHTML = "";

    lista.forEach((r, i) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${r.data}</td>
            <td>${r.inicio}</td>
            <td>${r.fim}</td>
            <td>${formatarTempo(r.minutos)}</td>
            <td>${formatarTempo(Math.round(r.minutos / 15) * 15)}</td>
            <td>${r.valor.toFixed(2)} €</td>
            <td>${r.comentario || ""}</td>
            <td><button onclick="apagarRegisto(${i})">🗑</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function apagarRegisto(i) {
    registos.splice(i, 1);
    guardarLocal();
    atualizarTabela();
    atualizarTotais();
}

function atualizarTotais() {
    const hoje = new Date().toISOString().slice(0, 10);
    const semana = new Date();
    semana.setDate(semana.getDate() - 7);
    const mes = hoje.slice(0, 7);

    const totalDia = registos.filter(r => r.data === hoje);
    const totalSemana = registos.filter(r => r.data >= semana.toISOString().slice(0, 10));
    const totalMes = registos.filter(r => r.data.startsWith(mes));

    document.getElementById("total-dia").textContent =
        "Total do dia: " + formatarTempo(totalDia.reduce((s, r) => s + r.minutos, 0));

    document.getElementById("total-semana").textContent =
        "Total da semana: " + formatarTempo(totalSemana.reduce((s, r) => s + r.minutos, 0));

    document.getElementById("total-mes").textContent =
        "Total do mês: " + formatarTempo(totalMes.reduce((s, r) => s + r.minutos, 0));
}

// =====================================================
// FILTRO
// =====================================================
function filtrarPorData() {
    const data = document.getElementById("filtro-data").value;
    atualizarTabela(data ? registos.filter(r => r.data === data) : registos);
}

// =====================================================
// VALOR HORA
// =====================================================
function guardarValorHora() {
    const valor = parseFloat(document.getElementById("valor-hora").value.replace(",", "."));
    const data = document.getElementById("data-valor-hora").value;
    if (!valor || !data) return;

    valorHora.push({ valor, data });
    guardarLocal();
}

// =====================================================
// BACKUPS
// =====================================================
function exportarBackup() {
    const blob = new Blob([JSON.stringify({ registos, valorHora })], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "backup-horas.json";
    a.click();
}

function importarBackup() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = e => {
        const reader = new FileReader();
        reader.onload = () => {
            const data = JSON.parse(reader.result);
            registos = data.registos || [];
            valorHora = data.valorHora || [];
            guardarLocal();
            atualizarTabela();
            atualizarTotais();
        };
        reader.readAsText(e.target.files[0]);
    };
    input.click();
}

function toggleAutoBackup() {
    autoBackup = !autoBackup;
    document.getElementById("toggleAutoBackupBtn").textContent =
        `Backup Automático: ${autoBackup ? "ON" : "OFF"}`;
    guardarLocal();
}

// =====================================================
// EXPORTAÇÃO EXCEL
// =====================================================
function abrirPopupExportar() {
    document.getElementById("popup-exportar").style.display = "flex";
}

function fecharPopupExportar() {
    document.getElementById("popup-exportar").style.display = "none";
}

function exportarPeriodo(tipo) {
    const hoje = new Date().toISOString().slice(0, 10);
    let lista = [];

    if (tipo === "hoje") lista = registos.filter(r => r.data === hoje);
    if (tipo === "semana") {
        const d = new Date(); d.setDate(d.getDate() - 7);
        lista = registos.filter(r => r.data >= d.toISOString().slice(0, 10));
    }
    if (tipo === "mes") lista = registos.filter(r => r.data.startsWith(hoje.slice(0, 7)));
    if (tipo === "ano") lista = registos.filter(r => r.data.startsWith(hoje.slice(0, 4)));

    exportarExcel(lista);
}

function exportarExcelComFiltro() {
    const de = document.getElementById("exportar-de").value;
    const ate = document.getElementById("exportar-ate").value;
    exportarExcel(registos.filter(r => r.data >= de && r.data <= ate));
}

function exportarExcel(lista) {
    const ws = XLSX.utils.json_to_sheet(lista);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Horas");
    XLSX.writeFile(wb, "horas.xlsx");
}

// =====================================================
// UI
// =====================================================
function toggleDarkMode() {
    document.body.classList.toggle("dark");
}

// =====================================================
// INIT
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
    atualizarTabela();
    atualizarTotais();
    document.getElementById("toggleAutoBackupBtn").textContent =
        `Backup Automático: ${autoBackup ? "ON" : "OFF"}`;
});
