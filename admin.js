const STORAGE_KEY = "surakshamap-reports-v2";
const GROUPING_RADIUS = 200;
const riskApi = window.SurakshaMapRisk;
const STATUS_LABELS = { open: "Open", under_review: "Under review", resolved: "Resolved" };

// Demo-only gate. There is no backend, so this cannot be real security —
// anyone can read this value in the page source. It exists purely so the
// admin panel has a sign-in step to walk through in a demo.
const DEMO_PASSPHRASE = "suraksha-demo";
const SESSION_KEY = "surakshamap-admin-demo-session";

let reports = [];

function showLoggedIn() {
  document.getElementById("login-panel").hidden = true;
  document.getElementById("admin-content").hidden = false;
  reports = loadReports();
  render();
}

function showLoggedOut() {
  document.getElementById("login-panel").hidden = false;
  document.getElementById("admin-content").hidden = true;
}

document.getElementById("login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const entered = document.getElementById("passphrase").value;
  const message = document.getElementById("login-message");
  if (entered === DEMO_PASSPHRASE) {
    sessionStorage.setItem(SESSION_KEY, "1");
    document.getElementById("passphrase").value = "";
    message.textContent = "";
    showLoggedIn();
  } else {
    message.textContent = "Incorrect passphrase. Check the hint below the form.";
    message.className = "form-message error";
  }
});

document.getElementById("logout-button").addEventListener("click", () => {
  sessionStorage.removeItem(SESSION_KEY);
  showLoggedOut();
});

if (sessionStorage.getItem(SESSION_KEY) === "1") {
  showLoggedIn();
} else {
  showLoggedOut();
}

function loadReports() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.warn("Local storage unavailable", error);
    return [];
  }
}

function saveReports() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  } catch (error) {
    console.warn("Could not save reports", error);
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

function render() {
  const filter = document.getElementById("a-status-filter").value;

  document.getElementById("a-total").textContent = reports.length;
  document.getElementById("a-open").textContent = reports.filter((r) => r.status === "open").length;
  document.getElementById("a-review").textContent = reports.filter((r) => r.status === "under_review").length;
  document.getElementById("a-resolved").textContent = reports.filter((r) => r.status === "resolved").length;

  const visible = reports.filter((r) => filter === "all" || r.status === filter);
  const sorted = [...visible].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  const table = document.getElementById("a-table");

  if (sorted.length === 0) {
    table.innerHTML = `<tr><td colspan="8" class="muted" style="padding:20px 10px;">No reports match this filter.</td></tr>`;
    return;
  }

  table.innerHTML = sorted
    .map((report) => {
      const nearby = reports.filter((r) => r.id !== report.id && riskApi.distanceInMeters(report.latitude, report.longitude, r.latitude, r.longitude) <= GROUPING_RADIUS);
      const risk = riskApi.calculateRiskScore(report, nearby);
      return `
        <tr>
          <td><code>${report.token}</code></td>
          <td>${report.photo ? `<img class="table-thumb" src="${report.photo}" alt="Report photo" />` : "&mdash;"}</td>
          <td>${escapeHtml(report.category)}<br /><span class="muted">${report.severity}</span></td>
          <td class="muted">${report.latitude}, ${report.longitude}</td>
          <td><span class="badge ${risk.riskLevel}">${risk.riskLevel}</span></td>
          <td><span class="status-pill ${report.status}">${STATUS_LABELS[report.status]}</span></td>
          <td>
            <select class="status-select" data-id="${report.id}">
              <option value="open" ${report.status === "open" ? "selected" : ""}>Open</option>
              <option value="under_review" ${report.status === "under_review" ? "selected" : ""}>Under review</option>
              <option value="resolved" ${report.status === "resolved" ? "selected" : ""}>Resolved</option>
            </select>
          </td>
          <td><button type="button" class="text-button" data-delete="${report.id}">Delete</button></td>
        </tr>`;
    })
    .join("");

  table.querySelectorAll(".status-select").forEach((select) => {
    select.addEventListener("change", () => {
      const report = reports.find((r) => r.id === select.dataset.id);
      if (report) {
        report.status = select.value;
        saveReports();
        render();
      }
    });
  });

  table.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!confirm("Delete this report? This cannot be undone.")) return;
      reports = reports.filter((r) => r.id !== btn.dataset.delete);
      saveReports();
      render();
    });
  });
}

document.getElementById("a-status-filter").addEventListener("change", render);
