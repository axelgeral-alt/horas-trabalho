/* ============================================================
   BLOCO 1 — ESTADO GLOBAL + UTILITÁRIOS + LIMPEZA AUTOMÁTICA
   ============================================================ */

// Estado global
let registos = JSON.parse(localStorage.getItem("registos")) || [];
let valorHoraConfig = JSON.parse(localStorage.getItem("valorHoraConfig")) || [];
let registoAtivo = null;
let cronometroInterval = null;

// Backup automático ON por defeito
let autoBackup;
const autoBackupStored = localStorage.getItem("autoBackup");
if (autoBackupStored === null) {
    autoBackup = true;
    localStorage.setItem("autoBackup", JSON.stringify(true));
} else {
    autoBackup = JSON.parse(autoBackupStored);
}

// Pasta fixa de backup (File Picker API)
let pastaBackupHandle = null;

// Guardar no localStorage
function guardarLocal() {
    localStorage.setItem("registos", JSON.stringify(registos));
    localStorage.setItem("valorHoraConfig", JSON.stringify(valorHoraConfig));
    localStorage.setItem("autoBackup", JSON.stringify(autoBackup));
}

// Formatar tempo em horas e minutos
function formatarTempo(minutos) {
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return `${h}h ${m}m`;
}

// Calcular minutos entre horas HH:MM
function calcularMinutos(inicio, fim) {
    const [hi, mi] = inicio.split(":").map(Number);
    const [hf, mf] = fim.split(":").map(Number);
    return (hf * 60 + mf) - (hi * 60 + mi);
}

// Obter valor hora aplicável numa data
function obterValorHoraNaData(dataISO) {
    if (!valorHoraConfig.length) return 0;
    const aplicaveis = valorHoraConfig
        .filter(v => v.data <= dataISO)
        .sort((a, b) => b.data.localeCompare(a.data));
    return aplicaveis.length ? aplicaveis[0].valor : 0;
}

// Formatar data curta (Seg, 26/Mar)
function formatarDataCurta(dataISO) {
    const d = new Date(dataISO + "T00:00:00");
    const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const mes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${dias[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}/${mes[d.getMonth()]}`;
}

/* ============================================================
   LIMPEZA AUTOMÁTICA — APAGAR REGISTOS COM MAIS DE 12 MESES
   ============================================================ */

function limparRegistosAntigos() {
    const hoje = new Date();
    const limite = new Date();
    limite.setMonth(limite.getMonth() - 12);

    const limiteISO = limite.toISOString().slice(0, 10);

    const antes = registos.length;
    registos = registos.filter(r => r.data >= limiteISO);
    const depois = registos.length;

    if (antes !== depois) {
        guardarLocal();
    }
}
/* ============================================================
   BLOCO 2 — CRONÓMETRO + REGISTOS AUTOMÁTICOS + MANUAIS
   ============================================================ */

/* ------------------------------
   Atualizar cronómetro (Desktop + Android)
------------------------------ */
function atualizarStatusCronometro() {
    if (!registoAtivo) return;

    const agora = new Date();
    const inicio = new Date(`${registoAtivo.data}T${registoAtivo.inicio}:00`);
    const diffMs = agora - inicio;
    if (diffMs < 0) return;

    const totalSeg = Math.floor(diffMs / 1000);
    const h = String(Math.floor(totalSeg / 3600)).padStart(2, "0");
    const m = String(Math.floor((totalSeg % 3600) / 60)).padStart(2, "0");
    const s = String(totalSeg % 60).padStart(2, "0");

    // Desktop
    const status = document.getElementById("status-contagem");
    if (status) status.textContent = `Registo em curso: ${h}:${m}:${s}`;

    // Android — cronómetro entre os botões
    const cron = document.getElementById("android-cronometro");
    if (cron) cron.textContent = `${h}:${m}:${s}`;
}

/* ------------------------------
   Iniciar registo automático
------------------------------ */
function iniciarRegisto() {
    if (registoAtivo) return;

    limparRegistosAntigos(); // limpeza automática silenciosa

    const agora = new Date();
    const data = agora.toISOString().slice(0, 10);
    const inicio = agora.toTimeString().slice(0, 5);
    const comentario = document.getElementById("comentario")?.value || "";

    registoAtivo = { data, inicio, comentario };

    atualizarStatusCronometro();
    cronometroInterval = setInterval(atualizarStatusCronometro, 1000);

    // Android — alternar botões
    if (window.innerWidth < 600) {
        document.getElementById("android-btn-iniciar").classList.add("android-hidden");
        document.getElementById("android-btn-parar").classList.remove("android-hidden");
    }
}

/* ------------------------------
   Parar registo automático
------------------------------ */
async function pararRegisto() {
    if (!registoAtivo) return;

    if (cronometroInterval) {
        clearInterval(cronometroInterval);
        cronometroInterval = null;
    }

    const fim = new Date().toTimeString().slice(0, 5);
    const minutos = calcularMinutos(registoAtivo.inicio, fim);

    if (minutos <= 0) {
        registoAtivo = null;
        document.getElementById("status-contagem").textContent = "";
        return;
    }

    const valorHora = obterValorHoraNaData(registoAtivo.data);
    const valor = (minutos / 60) * valorHora;

    registos.push({
        data: registoAtivo.data,
        inicio: registoAtivo.inicio,
        fim,
        minutos,
        comentario: registoAtivo.comentario,
        valor
    });

    registoAtivo = null;
    document.getElementById("comentario").value = "";
    document.getElementById("status-contagem").textContent = "";

    guardarLocal();
    limparRegistosAntigos(); // limpeza automática silenciosa

    atualizarTabela();
    atualizarTotais();
    atualizarAndroid();

    // Android — alternar botões
    if (window.innerWidth < 600) {
        document.getElementById("android-btn-iniciar").classList.remove("android-hidden");
        document.getElementById("android-btn-parar").classList.add("android-hidden");
    }

    // Backup automático diário
    if (autoBackup) {
        await backupAutomaticoDiario();
    }
}

/* ------------------------------
   POPUP — Abrir registo manual
------------------------------ */
function abrirPopupManual() {
    document.getElementById("popup-manual").style.display = "flex";
}

function fecharPopupManual() {
    document.getElementById("popup-manual").style.display = "none";
}

/* ------------------------------
   Guardar registo manual
------------------------------ */
function guardarRegistoManual() {
    const data = document.getElementById("manual-data").value;
    const inicio = document.getElementById("manual-inicio").value;
    const fim = document.getElementById("manual-fim").value;
    const comentario = document.getElementById("manual-comentario").value;

    if (!data || !inicio || !fim) return;

    limparRegistosAntigos(); // limpeza automática silenciosa

    const minutos = calcularMinutos(inicio, fim);
    if (minutos <= 0) return;

    const valorHora = obterValorHoraNaData(data);
    const valor = (minutos / 60) * valorHora;

    registos.push({ data, inicio, fim, minutos, comentario, valor });

    guardarLocal();
    fecharPopupManual();
    atualizarTabela();
    atualizarTotais();
    atualizarAndroid();
}
/* ============================================================
   BLOCO 3 — TABELA DESKTOP + TOTAIS + FILTROS + VALOR HORA
   ============================================================ */

/* ------------------------------
   Atualizar tabela Desktop
------------------------------ */
function atualizarTabela(lista = registos) {
    const tbody = document.getElementById("tabela-registos");
    if (!tbody) return;

    tbody.innerHTML = "";

    lista.forEach((r, i) => {
        const tr = document.createElement("tr");

        const minutosArredondados = Math.round(r.minutos / 15) * 15;
        const valorHora = obterValorHoraNaData(r.data);
        const valor = (r.minutos / 60) * valorHora;

        tr.innerHTML = `
            <td>${formatarDataCurta(r.data)}</td>
            <td>${r.inicio}</td>
            <td>${r.fim}</td>
            <td>${formatarTempo(r.minutos)}</td>
            <td>${formatarTempo(minutosArredondados)}</td>
            <td>${valor.toFixed(2)} €</td>
            <td>${r.comentario || ""}</td>
            <td><button onclick="apagarRegisto(${i})">🗑</button></td>
        `;

        tbody.appendChild(tr);
    });
}

/* ------------------------------
   Apagar registo
------------------------------ */
function apagarRegisto(i) {
    registos.splice(i, 1);
    guardarLocal();
    atualizarTabela();
    atualizarTotais();
    atualizarAndroid();
}

/* ------------------------------
   Atualizar totais (dia, semana, mês)
------------------------------ */
function atualizarTotais() {
    const hojeISO = new Date().toISOString().slice(0, 10);

    const semanaInicio = new Date();
    semanaInicio.setDate(semanaInicio.getDate() - 6);
    const semanaISO = semanaInicio.toISOString().slice(0, 10);

    const mesPrefix = hojeISO.slice(0, 7);

    function somar(lista) {
        return lista.reduce((acc, r) => {
            const valorHora = obterValorHoraNaData(r.data);
            const valor = (r.minutos / 60) * valorHora;
            return {
                minutos: acc.minutos + r.minutos,
                euros: acc.euros + valor
            };
        }, { minutos: 0, euros: 0 });
    }

    const diaLista = registos.filter(r => r.data === hojeISO);
    const semanaLista = registos.filter(r => r.data >= semanaISO && r.data <= hojeISO);
    const mesLista = registos.filter(r => r.data.startsWith(mesPrefix));

    const dia = somar(diaLista);
    const semana = somar(semanaLista);
    const mes = somar(mesLista);

    const elDia = document.getElementById("total-dia");
    const elSemana = document.getElementById("total-semana");
    const elMes = document.getElementById("total-mes");

    if (elDia) elDia.textContent = `Total do dia: ${formatarTempo(dia.minutos)} — ${dia.euros.toFixed(2)} €`;
    if (elSemana) elSemana.textContent = `Total da semana: ${formatarTempo(semana.minutos)} — ${semana.euros.toFixed(2)} €`;
    if (elMes) elMes.textContent = `Total do mês: ${formatarTempo(mes.minutos)} — ${mes.euros.toFixed(2)} €`;
}

/* ------------------------------
   Filtro por data
------------------------------ */
function filtrarPorData() {
    const data = document.getElementById("filtro-data").value;
    if (!data) {
        atualizarTabela(registos);
        return;
    }
    const filtrados = registos.filter(r => r.data === data);
    atualizarTabela(filtrados);
}

/* ------------------------------
   Guardar valor hora
------------------------------ */
function guardarValorHora() {
    const valorStr = document.getElementById("valor-hora").value.trim();
    const data = document.getElementById("data-valor-hora").value;

    if (!valorStr || !data) return;

    const valor = parseFloat(valorStr.replace(",", "."));
    if (isNaN(valor) || valor <= 0) return;

    valorHoraConfig.push({ valor, data });
    valorHoraConfig.sort((a, b) => a.data.localeCompare(b.data));

    guardarLocal();
    atualizarTabela();
    atualizarTotais();
    atualizarAndroid();
}
/* ============================================================
   BLOCO 4 — EXPORTAÇÕES EXCEL + MODO ESCURO + INICIALIZAÇÃO
   ============================================================ */

/* ------------------------------
   POPUP — Exportar Excel
------------------------------ */
function abrirPopupExportar() {
    document.getElementById("popup-exportar").style.display = "flex";
}

function fecharPopupExportar() {
    document.getElementById("popup-exportar").style.display = "none";
}

/* ------------------------------
   Exportar por período rápido
------------------------------ */
function exportarPeriodo(tipo) {
    const hojeISO = new Date().toISOString().slice(0, 10);
    let lista = [];

    if (tipo === "hoje") {
        lista = registos.filter(r => r.data === hojeISO);
    } else if (tipo === "semana") {
        const d = new Date();
        d.setDate(d.getDate() - 6);
        const semanaISO = d.toISOString().slice(0, 10);
        lista = registos.filter(r => r.data >= semanaISO && r.data <= hojeISO);
    } else if (tipo === "mes") {
        const mesPrefix = hojeISO.slice(0, 7);
        lista = registos.filter(r => r.data.startsWith(mesPrefix));
    } else if (tipo === "ano") {
        const anoPrefix = hojeISO.slice(0, 4);
        lista = registos.filter(r => r.data.startsWith(anoPrefix));
    }

    exportarExcel(lista);
}

/* ------------------------------
   Exportar com intervalo personalizado
------------------------------ */
function exportarExcelComFiltro() {
    const de = document.getElementById("exportar-de").value;
    const ate = document.getElementById("exportar-ate").value;
    if (!de || !ate) return;

    const lista = registos.filter(r => r.data >= de && r.data <= ate);
    exportarExcel(lista);
}

/* ------------------------------
   Exportar Excel (função principal)
------------------------------ */
function exportarExcel(lista) {
    if (!lista.length) return;

    const dados = lista.map(r => {
        const valorHora = obterValorHoraNaData(r.data);
        const valor = (r.minutos / 60) * valorHora;
        return {
            Data: r.data,
            Início: r.inicio,
            Fim: r.fim,
            "Tempo (min)": r.minutos,
            "Tempo formatado": formatarTempo(r.minutos),
            Comentário: r.comentario || "",
            "Valor (€)": valor.toFixed(2)
        };
    });

    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Horas");
    XLSX.writeFile(wb, "horas-trabalho.xlsx");
}

/* ------------------------------
   Modo escuro
------------------------------ */
function toggleDarkMode() {
    document.body.classList.toggle("dark");
}

/* ============================================================
   INICIALIZAÇÃO — ARRANQUE DA APLICAÇÃO
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {

    // Limpeza automática silenciosa (12 meses)
    limparRegistosAntigos();

    // Atualizar tabela e totais
    atualizarTabela();
    atualizarTotais();
    atualizarAndroid();

    // Atualizar botão de backup automático
    const btn = document.getElementById("toggleAutoBackupBtn");
    if (btn) {
        btn.textContent = `Backup Automático: ${autoBackup ? "ON" : "OFF"}`;
    }

    // Ativar modo Android automaticamente
    if (window.innerWidth < 600) {
        ativarModoAndroid();
    }

    // Restaurar pasta de backup (se existir)
    try {
        const saved = localStorage.getItem("pastaBackupHandle");
        if (saved) {
            // Pedir permissões persistentes
            const handle = await window.showDirectoryPicker();
            const perm = await handle.requestPermission({ mode: "readwrite" });

            if (perm === "granted") {
                pastaBackupHandle = handle;
            }
        }
    } catch (e) {
        console.warn("Não foi possível restaurar a pasta de backup:", e);
    }
});
/* ============================================================
   BLOCO 5 — MODO ANDROID SIMPLIFICADO
   ============================================================ */

/* ------------------------------
   Ativar modo Android
------------------------------ */
function ativarModoAndroid() {
    const view = document.getElementById("android-view");
    if (view) view.classList.remove("android-hidden");
    atualizarAndroid();
}

/* ------------------------------
   Atualizar vista Android
------------------------------ */
function atualizarAndroid() {
    if (window.innerWidth >= 600) return; // só Android

    const hoje = new Date().toISOString().slice(0, 10);
    const lista = registos.filter(r => r.data === hoje);

    // Registos do dia
    const div = document.getElementById("android-registos");
    if (div) {
        div.innerHTML = "";
        lista.forEach(r => {
            const el = document.createElement("div");
            el.style.marginBottom = "12px";
            el.innerHTML = `
                <strong>${formatarDataCurta(r.data)}</strong><br>
                Início: ${r.inicio}<br>
                Fim: ${r.fim}<br>
                Total: ${formatarTempo(r.minutos)}<br>
                Valor: ${r.valor.toFixed(2)} €
            `;
            div.appendChild(el);
        });
    }

    // Totais do dia
    const totalMin = lista.reduce((s, r) => s + r.minutos, 0);
    const totalEur = lista.reduce((s, r) => s + r.valor, 0);

    const elDia = document.getElementById("android-total-dia");
    const elEur = document.getElementById("android-total-euros");

    if (elDia) elDia.textContent = formatarTempo(totalMin);
    if (elEur) elEur.textContent = totalEur.toFixed(2) + " €";
}

/* ------------------------------
   Fechar app (PWA Android)
------------------------------ */
function fecharApp() {
    window.close();
}

/* ------------------------------
   Atualizar cronómetro Android
   (Chamado pelo cronómetro global)
------------------------------ */
function atualizarCronometroAndroid(h, m, s) {
    const cron = document.getElementById("android-cronometro");
    if (cron) cron.textContent = `${h}:${m}:${s}`;
}

/* ------------------------------
   Ajuste visual — cronómetro entre botões
   (opção B: espaçamento confortável)
------------------------------ */
function ajustarLayoutAndroid() {
    if (window.innerWidth >= 600) return;

    const cron = document.getElementById("android-cronometro");
    if (cron) {
        cron.style.marginTop = "20px";
        cron.style.marginBottom = "20px";
        cron.style.fontSize = "48px";
        cron.style.textAlign = "center";
        cron.style.fontWeight = "bold";
    }
}

// Executar sempre que a app arranca
document.addEventListener("DOMContentLoaded", ajustarLayoutAndroid);
/* ============================================================
   BLOCO 6 — BACKUP AUTOMÁTICO DIÁRIO + PASTA FIXA
   ============================================================ */

/* ------------------------------
   Escolher pasta de backup
------------------------------ */
async function escolherPastaBackup() {
    try {
        const handle = await window.showDirectoryPicker();

        // Pedir permissões persistentes
        const perm = await handle.requestPermission({ mode: "readwrite" });
        if (perm !== "granted") {
            alert("A aplicação precisa de permissão para gravar backups.");
            return;
        }

        pastaBackupHandle = handle;
        localStorage.setItem("pastaBackupHandle", "1");

        alert("Pasta de backup definida com sucesso!");
    } catch (e) {
        console.error("Erro ao escolher pasta:", e);
    }
}

/* ------------------------------
   Gravar ficheiro na pasta fixa
------------------------------ */
async function gravarBackupNaPasta(nome, conteudo) {
    if (!pastaBackupHandle) {
        alert("Nenhuma pasta definida. Escolha uma pasta primeiro.");
        return false;
    }

    try {
        const ficheiro = await pastaBackupHandle.getFileHandle(nome, { create: true });
        const writable = await ficheiro.createWritable();
        await writable.write(conteudo);
        await writable.close();
        return true;
    } catch (e) {
        console.error("Erro ao gravar backup:", e);
        alert("Erro ao gravar backup. Pode ser necessário escolher a pasta novamente.");
        return false;
    }
}

/* ------------------------------
   Backup manual (Exportar Backup)
------------------------------ */
async function exportarBackup() {
    const dados = JSON.stringify({ registos, valorHoraConfig }, null, 2);
    const nome = "backup-manual-" + new Date().toISOString().slice(0, 10) + ".json";

    if (pastaBackupHandle) {
        const ok = await gravarBackupNaPasta(nome, dados);
        if (ok) {
            alert("Backup guardado na pasta definida.");
            return;
        }
    }

    // Fallback — download normal
    const blob = new Blob([dados], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    a.click();
}

/* ------------------------------
   Backup automático diário
------------------------------ */
async function backupAutomaticoDiario() {
    limparRegistosAntigos(); // limpeza silenciosa antes do backup

    const hoje = new Date().toISOString().slice(0, 10);
    const nome = `backup-auto-${hoje}.json`;
    const dados = JSON.stringify({ registos, valorHoraConfig }, null, 2);

    if (pastaBackupHandle) {
        const ok = await gravarBackupNaPasta(nome, dados);
        if (ok) return;
    }

    // Fallback — download normal
    const blob = new Blob([dados], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    a.click();
}

/* ------------------------------
   Alternar backup automático
------------------------------ */
function toggleAutoBackup() {
    autoBackup = !autoBackup;
    localStorage.setItem("autoBackup", JSON.stringify(autoBackup));

    const btn = document.getElementById("toggleAutoBackupBtn");
    if (btn) btn.textContent = `Backup Automático: ${autoBackup ? "ON" : "OFF"}`;
}
