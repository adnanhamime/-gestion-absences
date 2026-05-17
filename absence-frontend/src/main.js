import "./style.css";

let pendingAbsenceEntries = [];
let currentPage = "dashboard";

const API = "https://gestion-absences-production.up.railway.app/api";

/* =========================
   TOKEN HELPERS
========================= */

function getToken() {
    return localStorage.getItem("sanctum_token");
}

function setToken(token) {
    localStorage.setItem("sanctum_token", token);
}

function clearToken() {
    localStorage.removeItem("sanctum_token");
}

function authHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getToken()}`
    };
}

/* =========================
   TOAST
========================= */

function showToast(message, type = "success") {
    const existing = document.querySelector(".toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/* =========================
   LOGIN
========================= */

function showLogin() {
    document.body.innerHTML = `
        <div class="login-page">
            <div class="login-card">
                <div class="login-logo">
                    <img src="/ofppt.png" alt="OFPPT" class="login-logo-img">
                    <h1>Gestion des Absences</h1>
                    <p>OFPPT — Espace Administrateur</p>                </div>
                <div class="login-form">
                    <div class="input-group">
                        <label>Email</label>
                        <input id="loginUser" type="email" placeholder="admin@ofppt.ma">
                    </div>
                    <div class="input-group">
                        <label>Mot de passe</label>
                        <input id="loginPass" type="password" placeholder="••••">
                    </div>
                    <button id="loginBtn" class="btn-primary btn-full">Se connecter</button>
                </div>
            </div>
        </div>
    `;
    document.getElementById("loginBtn").addEventListener("click", login);
    document.getElementById("loginPass").addEventListener("keydown", e => {
        if (e.key === "Enter") login();
    });
}

async function login() {
    const email = document.getElementById("loginUser").value.trim();
    const pass  = document.getElementById("loginPass").value.trim();

    if (!email || !pass) {
        showToast("Remplis tous les champs", "error");
        return;
    }

    const btn = document.getElementById("loginBtn");
    btn.textContent = "Connexion...";
    btn.disabled = true;

    try {
        const res = await fetch(`${API}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password: pass })
        });

        const data = await res.json();

        if (!res.ok) {
            showToast(data.message || "Identifiants incorrects", "error");
            btn.textContent = "Se connecter";
            btn.disabled = false;
            return;
        }

        setToken(data.token);
        loadShell();
        navigateTo("dashboard");

    } catch (err) {
        showToast("Impossible de contacter le serveur", "error");
        btn.textContent = "Se connecter";
        btn.disabled = false;
    }
}

/* =========================
   SHELL (sidebar layout)
========================= */

function loadShell() {
    document.body.innerHTML = `
        <div class="app-layout">
            <aside class="sidebar">
                <div class="sidebar-brand">
                    <img src="/ofppt.png" alt="OFPPT" class="sidebar-logo-img">
                    <span class="brand-name">AbsenceApp</span>
                </div>
                <nav class="sidebar-nav">
                    <a href="#" class="nav-item" data-page="dashboard">
                        <span class="nav-icon">📊</span> Dashboard
                    </a>
                    <a href="#" class="nav-item" data-page="stagiaires">
                        <span class="nav-icon">👥</span> Stagiaires
                    </a>
                    <a href="#" class="nav-item" data-page="absences">
                        <span class="nav-icon">📋</span> Absences
                    </a>
                </nav>
                <div class="sidebar-footer">
                    <button class="btn-logout" id="logoutBtn">⬅ Déconnexion</button>
                </div>
            </aside>
            <main class="main-content">
                <div id="page-content"></div>
            </main>
        </div>
        <div id="modal-overlay" class="modal-overlay hidden"></div>
    `;

    document.querySelectorAll(".nav-item").forEach(link => {
        link.addEventListener("click", e => {
            e.preventDefault();
            navigateTo(link.dataset.page);
        });
    });

    document.getElementById("logoutBtn").addEventListener("click", async () => {
        try {
            await fetch(`${API}/logout`, { method: "POST", headers: authHeaders() });
        } catch (_) {}
        clearToken();
        pendingAbsenceEntries = [];
        showLogin();
    });
}

function setActiveNav(page) {
    document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));
    const active = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (active) active.classList.add("active");
}

async function navigateTo(page) {
    currentPage = page;
    setActiveNav(page);
    if (page === "dashboard") await renderDashboard();
    else if (page === "stagiaires") await renderStagiaires();
    else if (page === "absences") await renderAbsences();
}

/* =========================
   FETCH
========================= */

async function fetchStagiaires() {
    const res = await fetch(`${API}/students`, { headers: authHeaders() });
    if (res.status === 401) { clearToken(); showLogin(); return []; }
    return res.json();
}

async function fetchAbsences() {
    const res = await fetch(`${API}/absences`, { headers: authHeaders() });
    if (res.status === 401) { clearToken(); showLogin(); return []; }
    return res.json();
}

/* =========================
   DASHBOARD
========================= */

async function renderDashboard() {
    const content = document.getElementById("page-content");
    content.innerHTML = `<div class="page-loading">Chargement...</div>`;

    const [stagiaires, absences] = await Promise.all([fetchStagiaires(), fetchAbsences()]);

    const totalStagiaires = stagiaires.length;
    const totalAbsences = absences.length;
    const justifiees = absences.filter(a => a.status === "Justifiée").length;
    const nonJustifiees = absences.filter(a => a.status === "Non justifiée").length;

    // Top absentéistes
    const absenceMap = {};
    absences.forEach(a => {
        absenceMap[a.student_id] = (absenceMap[a.student_id] || 0) + 1;
    });
    const topStagiaires = stagiaires
        .map(s => ({ ...s, count: absenceMap[s.id] || 0 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    // Par groupe
    const groupMap = {};
    absences.forEach(a => {
        const s = stagiaires.find(st => st.id === a.student_id);
        if (s) groupMap[s.group_name] = (groupMap[s.group_name] || 0) + 1;
    });

    const topRows = topStagiaires.map(s => `
        <tr>
            <td>${s.first_name} ${s.last_name}</td>
            <td>${s.group_name}</td>
            <td><span class="badge badge-red">${s.count} absence${s.count > 1 ? 's' : ''}</span></td>
        </tr>
    `).join("");

    content.innerHTML = `
        <div class="page-header">
            <h1 class="page-title">📊 Dashboard</h1>
            <span class="page-subtitle">Vue d'ensemble</span>
        </div>

        <div class="stats-grid">
            <div class="stat-card stat-blue">
                <div class="stat-icon">👥</div>
                <div class="stat-info">
                    <div class="stat-value">${totalStagiaires}</div>
                    <div class="stat-label">Stagiaires</div>
                </div>
            </div>
            <div class="stat-card stat-red">
                <div class="stat-icon">📋</div>
                <div class="stat-info">
                    <div class="stat-value">${totalAbsences}</div>
                    <div class="stat-label">Total Absences</div>
                </div>
            </div>
            <div class="stat-card stat-green">
                <div class="stat-icon">✅</div>
                <div class="stat-info">
                    <div class="stat-value">${justifiees}</div>
                    <div class="stat-label">Justifiées</div>
                </div>
            </div>
            <div class="stat-card stat-orange">
                <div class="stat-icon">⚠️</div>
                <div class="stat-info">
                    <div class="stat-value">${nonJustifiees}</div>
                    <div class="stat-label">Non Justifiées</div>
                </div>
            </div>
        </div>

        <div class="dashboard-grid">
            <div class="card">
                <h2 class="card-title">Absences par statut</h2>
                <div class="chart-container">
                    <canvas id="chartStatut"></canvas>
                </div>
            </div>
            <div class="card">
                <h2 class="card-title">Absences par groupe</h2>
                <div class="chart-container">
                    <canvas id="chartGroupe"></canvas>
                </div>
            </div>
        </div>

        <div class="card">
            <h2 class="card-title">🏆 Top absentéistes</h2>
            <div class="table-wrapper">
                <table>
                    <thead><tr><th>Stagiaire</th><th>Groupe</th><th>Absences</th></tr></thead>
                    <tbody>${topRows || '<tr><td colspan="3" class="empty">Aucune absence enregistrée</td></tr>'}</tbody>
                </table>
            </div>
        </div>
    `;

    // Load Chart.js from CDN then draw
    if (!window.Chart) {
        await loadScript("https://cdn.jsdelivr.net/npm/chart.js");
    }

    // Statut chart
    new Chart(document.getElementById("chartStatut"), {
        type: "doughnut",
        data: {
            labels: ["Justifiées", "Non justifiées"],
            datasets: [{
                data: [justifiees, nonJustifiees],
                backgroundColor: ["#22c55e", "#ef4444"],
                borderWidth: 0
            }]
        },
        options: { plugins: { legend: { position: "bottom" } }, cutout: "65%" }
    });

    // Groupe chart
    const groupLabels = Object.keys(groupMap);
    const groupValues = Object.values(groupMap);
    new Chart(document.getElementById("chartGroupe"), {
        type: "bar",
        data: {
            labels: groupLabels,
            datasets: [{
                label: "Absences",
                data: groupValues,
                backgroundColor: "#3b82f6",
                borderRadius: 6
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
}

/* =========================
   STAGIAIRES PAGE
========================= */

async function renderStagiaires(filter = "") {
    const content = document.getElementById("page-content");
    content.innerHTML = `<div class="page-loading">Chargement...</div>`;

    const [stagiaires, absences] = await Promise.all([fetchStagiaires(), fetchAbsences()]);

    const filtered = filter
        ? stagiaires.filter(s => `${s.first_name} ${s.last_name}`.toLowerCase().includes(filter.toLowerCase()))
        : stagiaires;

    const rows = filtered.map(s => {
        const nb = absences.filter(a => a.student_id === s.id).length;
        return `
        <tr>
            <td>${s.first_name} ${s.last_name}</td>
            <td><span class="badge badge-blue">${s.group_name}</span></td>
            <td>${s.filiere}</td>
            <td><span class="badge ${nb > 5 ? 'badge-red' : nb > 2 ? 'badge-orange' : 'badge-green'}">${nb} abs.</span></td>
            <td class="actions-cell">
                <button class="btn-icon btn-edit" data-id="${s.id}" data-fn="${s.first_name}" data-ln="${s.last_name}" data-gn="${s.group_name}" data-fi="${s.filiere}" title="Modifier">✏️</button>
                <button class="btn-icon btn-delete" data-id="${s.id}" data-type="stagiaire" title="Supprimer">🗑️</button>
            </td>
        </tr>`;
    }).join("");

    content.innerHTML = `
        <div class="page-header">
            <h1 class="page-title">👥 Stagiaires</h1>
            <span class="page-subtitle">${stagiaires.length} inscrits</span>
        </div>

        <div class="card">
            <h2 class="card-title">➕ Ajouter un stagiaire</h2>
            <div class="form-row">
                <div class="input-group"><label>Prénom</label><input id="first_name" placeholder="Prénom"></div>
                <div class="input-group"><label>Nom</label><input id="last_name" placeholder="Nom"></div>
                <div class="input-group"><label>Groupe</label><input id="group_name" placeholder="Groupe"></div>
                <div class="input-group"><label>Filière</label><input id="filiere" placeholder="Filière"></div>
                <div class="input-group btn-align"><button class="btn-primary" id="addStagiaireBtn">Ajouter</button></div>
            </div>
        </div>

        <div class="card">
            <div class="card-toolbar">
                <h2 class="card-title">Liste des stagiaires</h2>
                <div class="search-row">
                    <input id="searchInput" placeholder="🔍 Chercher par nom..." value="${filter}">
                </div>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead><tr><th>Nom complet</th><th>Groupe</th><th>Filière</th><th>Absences</th><th>Actions</th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="5" class="empty">Aucun stagiaire trouvé</td></tr>'}</tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById("addStagiaireBtn").addEventListener("click", addStagiaire);
    document.getElementById("searchInput").addEventListener("input", e => renderStagiaires(e.target.value));

    document.querySelectorAll(".btn-delete").forEach(btn => {
        btn.addEventListener("click", () => deleteRecord(btn.dataset.id, btn.dataset.type));
    });

    document.querySelectorAll(".btn-edit").forEach(btn => {
        btn.addEventListener("click", () => openEditStagiaire(btn.dataset));
    });
}

async function addStagiaire() {
    const first_name = document.getElementById("first_name").value.trim();
    const last_name = document.getElementById("last_name").value.trim();
    const group_name = document.getElementById("group_name").value.trim();
    const filiere = document.getElementById("filiere").value.trim();

    if (!first_name || !last_name || !group_name || !filiere) {
        showToast("Remplis tous les champs", "error");
        return;
    }

    await fetch(`${API}/students`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ first_name, last_name, group_name, filiere })
    });

    showToast("Stagiaire ajouté ✅");
    renderStagiaires();
}

function openEditStagiaire({ id, fn, ln, gn, fi }) {
    const overlay = document.getElementById("modal-overlay");
    overlay.classList.remove("hidden");
    overlay.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3>✏️ Modifier stagiaire</h3>
                <button class="modal-close" id="closeModal">✕</button>
            </div>
            <div class="modal-body">
                <div class="input-group"><label>Prénom</label><input id="m_fn" value="${fn}"></div>
                <div class="input-group"><label>Nom</label><input id="m_ln" value="${ln}"></div>
                <div class="input-group"><label>Groupe</label><input id="m_gn" value="${gn}"></div>
                <div class="input-group"><label>Filière</label><input id="m_fi" value="${fi}"></div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" id="closeModal2">Annuler</button>
                <button class="btn-primary" id="saveEditBtn">Enregistrer</button>
            </div>
        </div>
    `;

    document.getElementById("closeModal").addEventListener("click", closeModal);
    document.getElementById("closeModal2").addEventListener("click", closeModal);
    document.getElementById("saveEditBtn").addEventListener("click", async () => {
        await fetch(`${API}/students/${id}`, {
            method: "PUT",
            headers: authHeaders(),
            body: JSON.stringify({
                first_name: document.getElementById("m_fn").value.trim(),
                last_name: document.getElementById("m_ln").value.trim(),
                group_name: document.getElementById("m_gn").value.trim(),
                filiere: document.getElementById("m_fi").value.trim()
            })
        });
        showToast("Stagiaire modifié ✅");
        closeModal();
        renderStagiaires();
    });
}

/* =========================
   ABSENCES PAGE
========================= */

async function renderAbsences() {
    const content = document.getElementById("page-content");
    content.innerHTML = `<div class="page-loading">Chargement...</div>`;

    const [stagiaires, absences] = await Promise.all([fetchStagiaires(), fetchAbsences()]);

    const options = stagiaires.map(s =>
        `<option value="${s.id}">${s.first_name} ${s.last_name}</option>`
    ).join("");

    const rows = absences.map(a => `
        <tr>
            <td>${a.student ? a.student.first_name + " " + a.student.last_name : "—"}</td>
            <td>${a.absence_date}</td>
            <td>${a.session_name ?? "—"}</td>
            <td>${a.reason}</td>
            <td><span class="badge ${a.status === 'Justifiée' ? 'badge-green' : 'badge-red'}">${a.status}</span></td>
            <td class="actions-cell">
                <button class="btn-icon btn-edit-abs"
                    data-id="${a.id}"
                    data-sid="${a.student_id}"
                    data-date="${a.absence_date}"
                    data-session="${a.session_name ?? ''}"
                    data-reason="${a.reason}"
                    data-status="${a.status}"
                    title="Modifier">✏️</button>
                <button class="btn-icon btn-delete" data-id="${a.id}" data-type="absence" title="Supprimer">🗑️</button>
            </td>
        </tr>
    `).join("");

    const pendingHtml = pendingAbsenceEntries.length === 0
        ? `<p class="empty-pending">Aucune séance ajoutée.</p>`
        : `<div class="table-wrapper"><table>
            <thead><tr><th>Date</th><th>Séance</th><th>Action</th></tr></thead>
            <tbody>${pendingAbsenceEntries.map((e, i) => `
                <tr>
                    <td>${e.absence_date}</td>
                    <td>${e.session_name}</td>
                    <td><button class="btn-icon btn-delete remove-pending" data-index="${i}">🗑️</button></td>
                </tr>`).join("")}
            </tbody>
        </table></div>`;

    content.innerHTML = `
        <div class="page-header">
            <h1 class="page-title">📋 Absences</h1>
            <span class="page-subtitle">${absences.length} enregistrées</span>
        </div>

        <div class="card">
            <h2 class="card-title">➕ Enregistrer des absences</h2>
            <div class="form-row">
                <div class="input-group">
                    <label>Stagiaire</label>
                    <select id="student_id"><option value="">Choisir...</option>${options}</select>
                </div>
                <div class="input-group">
                    <label>Date</label>
                    <input id="single_date" type="date">
                </div>
                <div class="input-group">
                    <label>Séance</label>
                    <select id="single_session_name">
                        <option value="">Choisir séance...</option>
                        <option value="08:30 - 11:00">08:30 - 11:00</option>
                        <option value="11:00 - 13:30">11:00 - 13:30</option>
                        <option value="13:30 - 16:00">13:30 - 16:00</option>
                        <option value="16:00 - 18:30">16:00 - 18:30</option>
                    </select>
                </div>
                <div class="input-group btn-align">
                    <button class="btn-secondary" id="addEntryBtn">+ Ajouter séance</button>
                </div>
            </div>

            <div class="pending-box">
                <h3>Séances en attente</h3>
                ${pendingHtml}
            </div>

            <div class="form-row" style="margin-top:15px">
                <div class="input-group">
                    <label>Motif</label>
                    <input id="reason" placeholder="Motif de l'absence">
                </div>
                <div class="input-group">
                    <label>Statut</label>
                    <select id="status">
                        <option value="">Choisir statut...</option>
                        <option value="Justifiée">Justifiée</option>
                        <option value="Non justifiée">Non justifiée</option>
                    </select>
                </div>
                <div class="input-group btn-align">
                    <button class="btn-primary" id="addAbsenceBtn">✅ Enregistrer tout</button>
                </div>
            </div>
        </div>

        <div class="card">
            <h2 class="card-title">Liste des absences</h2>
            <div class="table-wrapper">
                <table>
                    <thead><tr><th>Stagiaire</th><th>Date</th><th>Séance</th><th>Motif</th><th>Statut</th><th>Actions</th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="6" class="empty">Aucune absence enregistrée</td></tr>'}</tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById("addEntryBtn").addEventListener("click", addPendingEntry);
    document.getElementById("addAbsenceBtn").addEventListener("click", addAbsence);

    document.querySelectorAll(".remove-pending").forEach(btn => {
        btn.addEventListener("click", () => {
            pendingAbsenceEntries.splice(Number(btn.dataset.index), 1);
            renderAbsences();
        });
    });

    document.querySelectorAll(".btn-delete").forEach(btn => {
        btn.addEventListener("click", () => deleteRecord(btn.dataset.id, btn.dataset.type));
    });

    document.querySelectorAll(".btn-edit-abs").forEach(btn => {
        btn.addEventListener("click", () => openEditAbsence(btn.dataset, stagiaires));
    });
}

function addPendingEntry() {
    const absence_date = document.getElementById("single_date").value;
    const session_name = document.getElementById("single_session_name").value;
    if (!absence_date || !session_name) {
        showToast("Choisis une date et une séance", "error");
        return;
    }
    pendingAbsenceEntries.push({ absence_date, session_name });
    renderAbsences();
}

async function addAbsence() {
    const student_id = document.getElementById("student_id").value;
    const reason = document.getElementById("reason").value.trim();
    const status = document.getElementById("status").value;

    if (!student_id || pendingAbsenceEntries.length === 0 || !reason || !status) {
        showToast("Remplis tous les champs et ajoute au moins une séance", "error");
        return;
    }

    await fetch(`${API}/absences`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ student_id, absence_entries: pendingAbsenceEntries, reason, status })
    });

    pendingAbsenceEntries = [];
    showToast("Absences enregistrées ✅");
    renderAbsences();
}

function openEditAbsence({ id, sid, date, session, reason, status }, stagiaires) {
    const overlay = document.getElementById("modal-overlay");
    overlay.classList.remove("hidden");
    const options = stagiaires.map(s =>
        `<option value="${s.id}" ${s.id == sid ? 'selected' : ''}>${s.first_name} ${s.last_name}</option>`
    ).join("");

    overlay.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3>✏️ Modifier absence</h3>
                <button class="modal-close" id="closeModal">✕</button>
            </div>
            <div class="modal-body">
                <div class="input-group"><label>Stagiaire</label><select id="m_sid">${options}</select></div>
                <div class="input-group"><label>Date</label><input id="m_date" type="date" value="${date}"></div>
                <div class="input-group">
                    <label>Séance</label>
                    <select id="m_session">
                        <option value="08:30 - 11:00" ${session === '08:30 - 11:00' ? 'selected' : ''}>08:30 - 11:00</option>
                        <option value="11:00 - 13:30" ${session === '11:00 - 13:30' ? 'selected' : ''}>11:00 - 13:30</option>
                        <option value="13:30 - 16:00" ${session === '13:30 - 16:00' ? 'selected' : ''}>13:30 - 16:00</option>
                        <option value="16:00 - 18:30" ${session === '16:00 - 18:30' ? 'selected' : ''}>16:00 - 18:30</option>
                    </select>
                </div>
                <div class="input-group"><label>Motif</label><input id="m_reason" value="${reason}"></div>
                <div class="input-group">
                    <label>Statut</label>
                    <select id="m_status">
                        <option value="Justifiée" ${status === 'Justifiée' ? 'selected' : ''}>Justifiée</option>
                        <option value="Non justifiée" ${status === 'Non justifiée' ? 'selected' : ''}>Non justifiée</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" id="closeModal2">Annuler</button>
                <button class="btn-primary" id="saveEditAbsBtn">Enregistrer</button>
            </div>
        </div>
    `;

    document.getElementById("closeModal").addEventListener("click", closeModal);
    document.getElementById("closeModal2").addEventListener("click", closeModal);
    document.getElementById("saveEditAbsBtn").addEventListener("click", async () => {
        await fetch(`${API}/absences/${id}`, {
            method: "PUT",
            headers: authHeaders(),
            body: JSON.stringify({
                student_id: document.getElementById("m_sid").value,
                absence_date: document.getElementById("m_date").value,
                session_name: document.getElementById("m_session").value,
                reason: document.getElementById("m_reason").value.trim(),
                status: document.getElementById("m_status").value
            })
        });
        showToast("Absence modifiée ✅");
        closeModal();
        renderAbsences();
    });
}

/* =========================
   SHARED
========================= */

function closeModal() {
    const overlay = document.getElementById("modal-overlay");
    overlay.classList.add("hidden");
    overlay.innerHTML = "";
}

async function deleteRecord(id, type) {
    const label = type === "stagiaire" ? "ce stagiaire" : "cette absence";
    if (!confirm(`Supprimer ${label} ?`)) return;

    const url = type === "stagiaire" ? `${API}/students/${id}` : `${API}/absences/${id}`;
    await fetch(url, { method: "DELETE", headers: authHeaders() });

    showToast(`${type === "stagiaire" ? "Stagiaire" : "Absence"} supprimé(e) ✅`);
    if (type === "stagiaire") renderStagiaires();
    else renderAbsences();
}

/* =========================
   INIT
========================= */
if (getToken()) {
    loadShell();
    navigateTo("dashboard");
} else {
    showLogin();
}