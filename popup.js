// AUTOQECFILL - popup.js
// SILENT VERSION: All alert() and confirm() calls removed.

let optionsMap = {
  Course: [],
  Teacher: [],
  Online: [],
};

function setExceptionsMessage(text) {
  const el = document.getElementById("exceptionsMessage");
  if (!el) return;
  if (text) {
    el.textContent = text;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  checkAutomationStatus(); // Check if automation is running
  syncAllForms(); // Auto-sync on open

  // Listen for progress updates
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.automationProgress) {
      updateProgressBar(changes.automationProgress.newValue);
    }
    if (changes.automationState) {
      checkAutomationStatus();
    }
  });

  document
    .getElementById("addException")
    .addEventListener("click", () => addExceptionRow());
  document
    .getElementById("syncAllForms")
    .addEventListener("click", syncAllForms);
  document
    .getElementById("startAutoFill")
    .addEventListener("click", startAutomation);
  document.getElementById("grade").addEventListener("change", saveSettings);

  document.getElementById("showReportBtn").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("report.html") });
  });

  // Add a hidden reset button for troubleshooting (accessible via console or future UI)
  window.resetAutomation = async () => {
    await chrome.storage.local.clear();
    window.location.reload();
  };
});

function updateProgressBar(progress) {
  const container = document.getElementById("progressContainer");
  const bar = document.getElementById("progressBar");
  const percentText = document.getElementById("progressPercent");
  const detailText = document.getElementById("progressDetail");

  if (!progress || progress.percent === undefined) {
    container.style.display = "none";
    return;
  }

  container.style.display = "block";
  bar.style.width = `${progress.percent}%`;
  percentText.textContent = `${progress.percent}%`;
  detailText.textContent = progress.detail || "Processing...";
}

// Check if automation is currently running
async function checkAutomationStatus() {
  const data = await chrome.storage.local.get([
    "automationState",
    "automationProgress",
  ]);
  const state = data.automationState || {};
  const progress = data.automationProgress;
  const btn = document.getElementById("startAutoFill");
  const progressContainer = document.getElementById("progressContainer");
  const showReportBtn = document.getElementById("showReportBtn");

  if (state.isRunning) {
    btn.textContent = "Touch Grass";
    btn.style.background = "#ef4444";
    progressContainer.style.display = "block";
    showReportBtn.style.display = "none";
    if (progress) updateProgressBar(progress);
  } else if (state.isCompleted) {
    btn.textContent = "Do The Thing";
    btn.style.background = "#0ea5e9";
    progressContainer.style.display = "block";
    showReportBtn.style.display = "block";
    if (progress) updateProgressBar(progress);
  } else {
    btn.textContent = "Do The Thing";
    btn.style.background = "#0ea5e9";
    progressContainer.style.display = "none";
    showReportBtn.style.display = "none";
  }
}

// Start or stop automation
async function startAutomation() {
  const data = await chrome.storage.local.get(["automationState"]);
  const state = data.automationState;

  if (state && state.isRunning) {
    // Stop automation
    await chrome.storage.local.set({
      automationState: { isRunning: false },
    });
    console.log("Automation stopped.");
    checkAutomationStatus();
  } else {
    // Start automation
    const settings = await chrome.storage.local.get([
      "defaultGrade",
      "exceptions",
      "enableReport",
    ]);

    console.log("🚀 Starting automation with settings:", settings);

    // Initialize automation state
    await chrome.storage.local.set({
      automationState: {
        isRunning: true,
        currentForm: "Teacher", // Start with Teacher
        currentIndex: 0,
        processedItems: [],
      },
    });

    console.log("✅ Automation state saved to storage");

    // Get current tab and navigate to first form automatically
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    console.log("📍 Current tab:", tab.url);

    chrome.tabs.update(
      tab.id,
      { url: "https://portals.au.edu.pk/qec/p10.aspx" },
      () => {
        console.log("🔄 Navigating to Teacher form...");
      },
    );

    console.log("🚀 Automation started!");
    checkAutomationStatus();
  }
}

async function clearReport() {
  // Removed confirm() for silent operation
  await chrome.storage.local.set({ evaluationLog: [] });
  showReport();
}

function downloadReport() {
  chrome.storage.local.get(["evaluationLog"], (data) => {
    const log = data.evaluationLog || [];
    if (log.length === 0) {
      console.log("No data to download");
      return;
    }

    let csv = "Time,Type,Subject/Teacher,Grade\n";
    log.forEach((item) => {
      csv += `${item.time},${item.type},"${item.name}",${item.grade}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `QEC_Report_${new Date().toLocaleDateString()}.csv`;
    a.click();
  });
}

async function showReport() {
  chrome.storage.local.get(["evaluationLog"], (data) => {
    const log = data.evaluationLog || [];
    const container = document.getElementById("reportContent");
    const modal = document.getElementById("reportModal");

    if (log.length === 0) {
      container.innerHTML =
        '<p style="text-align: center; color: #64748b;">No evaluations recorded yet.</p>';
    } else {
      container.innerHTML = log
        .map(
          (item) => `
                <div style="padding: 10px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: 600;">${item.name}</div>
                        <div style="font-size: 0.75rem; color: #64748b;">${item.type} • ${item.time}</div>
                    </div>
                    <div style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${item.grade}</div>
                </div>
            `,
        )
        .join("");
    }
    modal.style.display = "flex";
  });
}

async function syncAllForms() {
  const btn = document.getElementById("syncAllForms");
  const originalText = btn.textContent;
  btn.textContent = "Syncing...";
  btn.disabled = true;

  try {
    const configs = [
      {
        id: "Course",
        url: "https://portals.au.edu.pk/qec/p1.aspx",
        selector: "#ctl00_ContentPlaceHolder2_cmb_courses",
      },
      {
        id: "Teacher",
        url: "https://portals.au.edu.pk/qec/p10.aspx",
        selector: "#ctl00_ContentPlaceHolder2_ddlTeacher",
      },
      {
        id: "Online",
        url: "https://portals.au.edu.pk/qec/p10a_learning_online_form.aspx",
        selector: "#ctl00_ContentPlaceHolder1_cmb_courses",
      },
    ];

    for (const config of configs) {
      try {
        const response = await fetch(config.url);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const select = doc.querySelector(config.selector);
        if (select) {
          optionsMap[config.id] = Array.from(select.options)
            .slice(1) // Skip first option (--Select--)
            .map((opt) => opt.text.trim())
            .filter((text) => text !== "");
        }
      } catch (e) {
        console.error(`Failed to sync ${config.id}:`, e);
      }
    }

    chrome.storage.local.set({ optionsMap });
    console.log("Sync complete!");
    refreshAllExceptionRows();
  } catch (err) {
    console.error(
      "Sync failed. Please ensure you are logged in to the QEC portal.",
    );
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

function refreshAllExceptionRows() {
  const list = document.getElementById("exceptionsList");
  const rowsData = [];
  document.querySelectorAll(".exception-row").forEach((row) => {
    rowsData.push({
      category: row.querySelector(".exception-category").value,
      name: row.querySelector(".exception-name").value,
      grade: row.querySelector(".exception-grade").value,
    });
  });
  list.innerHTML = "";
  rowsData.forEach((data) =>
    addExceptionRow(data.category, data.name, data.grade),
  );
}

function addExceptionRow(category = "Course", name = "", grade = "2") {
  const list = document.getElementById("exceptionsList");

  // Filter categories that have items
  const availableCategories = Object.keys(optionsMap).filter(
    (cat) => optionsMap[cat].length > 0,
  );

  // If no categories have items, we can't add an exception
  if (availableCategories.length === 0) {
    setExceptionsMessage(
      "No items left to add. Sync the portal if data changed.",
    );
    return;
  }

  setExceptionsMessage("");

  // If the requested category is empty, pick the first available one
  if (!availableCategories.includes(category)) {
    category = availableCategories[0];
  }

  const row = document.createElement("div");
  row.className = "exception-row";

  row.innerHTML = `
        <select class="exception-category">
            ${availableCategories.map((cat) => `<option value="${cat}" ${category === cat ? "selected" : ""}>${cat}</option>`).join("")}
        </select>
        <select class="exception-name">
            <option value="">-- Select --</option>
        </select>
        <select class="exception-grade">
            <option value="1" ${grade === "1" ? "selected" : ""}>A</option>
            <option value="2" ${grade === "2" ? "selected" : ""}>B</option>
            <option value="3" ${grade === "3" ? "selected" : ""}>C</option>
            <option value="4" ${grade === "4" ? "selected" : ""}>D</option>
        </select>
        <button class="remove-btn">×</button>
    `;

  const catSelect = row.querySelector(".exception-category");
  const nameSelect = row.querySelector(".exception-name");

  const updateNames = (selectedCat, selectedName) => {
    let options = optionsMap[selectedCat] || [];

    // Filter out items already selected in other rows (except this one)
    const selectedInOtherRows = Array.from(
      document.querySelectorAll(".exception-row"),
    )
      .filter((row) => row !== nameSelect.closest(".exception-row"))
      .filter(
        (row) => row.querySelector(".exception-category").value === selectedCat,
      )
      .map((row) => row.querySelector(".exception-name").value)
      .filter((val) => val !== "");

    options = options.filter((opt) => !selectedInOtherRows.includes(opt));

    // If no options left, show a message
    if (options.length === 0 && !selectedName) {
      nameSelect.innerHTML = '<option value="">(All items assigned)</option>';
      return;
    }

    nameSelect.innerHTML =
      '<option value="">-- Select --</option>' +
      options
        .map(
          (opt) =>
            `<option value="${opt}" ${opt === selectedName ? "selected" : ""}>${opt}</option>`,
        )
        .join("");

    // If name exists but not in list (manual fallback or old sync)
    if (selectedName && !options.includes(selectedName)) {
      nameSelect.innerHTML += `<option value="${selectedName}" selected>${selectedName}</option>`;
    }
  };

  catSelect.addEventListener("change", () => {
    updateNames(catSelect.value, "");
    saveSettings();
    // Refresh other rows to update their dropdowns
    refreshAllExceptionRows();
  });

  nameSelect.addEventListener("change", () => {
    saveSettings();
    // Refresh other rows to update their dropdowns
    refreshAllExceptionRows();
  });
  row
    .querySelector(".exception-grade")
    .addEventListener("change", saveSettings);
  row.querySelector(".remove-btn").addEventListener("click", () => {
    row.remove();
    saveSettings();
  });

  updateNames(category, name);
  list.appendChild(row);
}

function saveSettings() {
  const defaultGrade = document.getElementById("grade").value;
  const exceptions = [];
  document.querySelectorAll(".exception-row").forEach((row) => {
    const category = row.querySelector(".exception-category").value;
    const name = row.querySelector(".exception-name").value;
    const grade = row.querySelector(".exception-grade").value;
    if (name) {
      exceptions.push({ category, name, grade });
    }
  });

  console.log("Saving settings:", { defaultGrade, exceptions });
  chrome.storage.local.set({ defaultGrade, exceptions, enableReport: true });
}

function loadSettings() {
  chrome.storage.local.get(
    [
      "defaultGrade",
      "exceptions",
      "optionsMap",
      "enableReport",
      "automationState",
    ],
    (data) => {
      const state = data.automationState || {};
      if (state.isCompleted) {
        showReport();
        // Reset completion flag
        chrome.storage.local.set({
          automationState: { ...state, isCompleted: false },
        });
      }

      if (data.optionsMap) {
        optionsMap = data.optionsMap;
      }
      if (data.defaultGrade) {
        document.getElementById("grade").value = data.defaultGrade;
      }
      if (data.enableReport !== undefined) {
        document.getElementById("enableReport").checked = data.enableReport;
        document.getElementById("viewReport").style.display = data.enableReport
          ? "block"
          : "none";
      }
      if (data.exceptions) {
        data.exceptions.forEach((ex) =>
          addExceptionRow(ex.category, ex.name, ex.grade),
        );
      }
    },
  );
}
