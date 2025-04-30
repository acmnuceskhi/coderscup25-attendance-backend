// Logs and certificate stats JavaScript

// Current page and filter state for logs
let currentPage = 1;
let totalPages = 1;
let currentFilters = {
  module: "",
  level: "",
  search: "",
  file: "",
};

// Certificate timeline data
const certificateTimelineData = {
  labels: [],
  datasets: [
    {
      label: "Successful Requests",
      data: [],
      borderColor: "rgba(40, 167, 69, 1)",
      backgroundColor: "rgba(40, 167, 69, 0.2)",
      borderWidth: 2,
      tension: 0.3,
    },
    {
      label: "Failed Requests",
      data: [],
      borderColor: "rgba(220, 53, 69, 1)",
      backgroundColor: "rgba(220, 53, 69, 0.2)",
      borderWidth: 2,
      tension: 0.3,
    },
  ],
};

let certificateTimelineChart;

// Initialize the logs page
document.addEventListener("DOMContentLoaded", function () {
  // Initialize based on the current page
  const path = window.location.pathname;

  if (path.includes("/logs")) {
    initLogsPage();
  } else if (path.includes("/certificates")) {
    initCertificatesPage();
  }
});

// Initialize logs page
function initLogsPage() {
  // Load initial logs
  loadLogs();

  // Add event listeners for log filtering
  document
    .getElementById("logModuleFilter")
    .addEventListener("change", function () {
      currentFilters.module = this.value;
      currentPage = 1;
      loadLogs();
    });

  document
    .getElementById("logLevelFilter")
    .addEventListener("change", function () {
      currentFilters.level = this.value;
      currentPage = 1;
      loadLogs();
    });

  document
    .getElementById("logSearchFilter")
    .addEventListener("input", function () {
      currentFilters.search = this.value;
      currentPage = 1;
      loadLogs();
    });

  document
    .getElementById("logFileFilter")
    .addEventListener("change", function () {
      currentFilters.file = this.value;
      currentPage = 1;
      loadLogs();
    });

  document.getElementById("refreshLogs").addEventListener("click", function () {
    loadLogs();
  });

  document
    .getElementById("clearLogsFilter")
    .addEventListener("click", function () {
      // Reset filters
      document.getElementById("logModuleFilter").value = "";
      document.getElementById("logLevelFilter").value = "";
      document.getElementById("logSearchFilter").value = "";
      document.getElementById("logFileFilter").value = "";

      currentFilters = {
        module: "",
        level: "",
        search: "",
        file: "",
      };

      currentPage = 1;
      loadLogs();
    });
}

// Initialize certificates page
function initCertificatesPage() {
  // Initialize certificate timeline chart
  const timelineCtx = document
    .getElementById("certificateTimelineChart")
    .getContext("2d");
  certificateTimelineChart = new Chart(timelineCtx, {
    type: "line",
    data: certificateTimelineData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: {
            display: true,
            text: "Time",
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Requests",
          },
        },
      },
    },
  });

  // Load certificate data
  loadCertificateData();

  // Set refresh interval
  setInterval(loadCertificateData, 30000); // Refresh every 30 seconds
}

// Load logs with filters and pagination
function loadLogs() {
  const loadingRow = document.createElement("tr");
  loadingRow.innerHTML =
    '<td colspan="4" class="text-center">Loading logs...</td>';
  document.getElementById("logsTableBody").innerHTML = "";
  document.getElementById("logsTableBody").appendChild(loadingRow);

  // Build query string
  let queryParams = `page=${currentPage}`;
  if (currentFilters.module)
    queryParams += `&module=${encodeURIComponent(currentFilters.module)}`;
  if (currentFilters.level)
    queryParams += `&level=${encodeURIComponent(currentFilters.level)}`;
  if (currentFilters.search)
    queryParams += `&search=${encodeURIComponent(currentFilters.search)}`;
  if (currentFilters.file)
    queryParams += `&file=${encodeURIComponent(currentFilters.file)}`;

  fetch(`/admin/monitoring/logs/data?${queryParams}`)
    .then((response) => response.json())
    .then((data) => {
      updateLogsTable(data.logs);
      updateLogsPagination(data.page, data.totalPages);
      updateLogsStats(data.total);

      // Update module filter options if needed
      updateModuleFilterOptions(data.modules);
    })
    .catch((error) => {
      console.error("Error fetching logs:", error);
      document.getElementById("logsTableBody").innerHTML =
        '<tr><td colspan="4" class="text-center text-danger">Error loading logs. Please try again.</td></tr>';
    });
}

// Update logs table with data
function updateLogsTable(logs) {
  const tableBody = document.getElementById("logsTableBody");
  tableBody.innerHTML = "";

  if (logs.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML =
      '<td colspan="4" class="text-center">No logs found matching your criteria</td>';
    tableBody.appendChild(emptyRow);
    return;
  }

  logs.forEach((log) => {
    const row = document.createElement("tr");
    row.className = getLevelClass(log.level);

    // Format timestamp
    const timestamp = document.createElement("td");
    timestamp.textContent = new Date(log.timestamp).toLocaleString();
    row.appendChild(timestamp);

    // Level with badge
    const level = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = getBadgeClass(log.level);
    badge.textContent = log.level;
    level.appendChild(badge);
    row.appendChild(level);

    // Module
    const module = document.createElement("td");
    module.textContent = log.module;
    row.appendChild(module);

    // Message
    const message = document.createElement("td");
    message.textContent = log.message;
    message.className = "log-message";
    row.appendChild(message);

    tableBody.appendChild(row);
  });
}

// Update pagination controls
function updateLogsPagination(page, totalPages) {
  currentPage = page;
  totalPages = totalPages;

  const pagination = document.getElementById("logsPagination");
  pagination.innerHTML = "";

  // Previous button
  const prevItem = document.createElement("li");
  prevItem.className = `page-item ${page <= 1 ? "disabled" : ""}`;
  const prevLink = document.createElement("a");
  prevLink.className = "page-link";
  prevLink.href = "#";
  prevLink.textContent = "Previous";
  if (page > 1) {
    prevLink.addEventListener("click", (e) => {
      e.preventDefault();
      currentPage--;
      loadLogs();
    });
  }
  prevItem.appendChild(prevLink);
  pagination.appendChild(prevItem);

  // Page numbers (show up to 5 pages)
  const startPage = Math.max(1, page - 2);
  const endPage = Math.min(totalPages, startPage + 4);

  for (let i = startPage; i <= endPage; i++) {
    const pageItem = document.createElement("li");
    pageItem.className = `page-item ${i === page ? "active" : ""}`;
    const pageLink = document.createElement("a");
    pageLink.className = "page-link";
    pageLink.href = "#";
    pageLink.textContent = i;
    pageLink.addEventListener("click", (e) => {
      e.preventDefault();
      currentPage = i;
      loadLogs();
    });
    pageItem.appendChild(pageLink);
    pagination.appendChild(pageItem);
  }

  // Next button
  const nextItem = document.createElement("li");
  nextItem.className = `page-item ${page >= totalPages ? "disabled" : ""}`;
  const nextLink = document.createElement("a");
  nextLink.className = "page-link";
  nextLink.href = "#";
  nextLink.textContent = "Next";
  if (page < totalPages) {
    nextLink.addEventListener("click", (e) => {
      e.preventDefault();
      currentPage++;
      loadLogs();
    });
  }
  nextItem.appendChild(nextLink);
  pagination.appendChild(nextItem);
}

// Update logs stats
function updateLogsStats(total) {
  const statsElement = document.getElementById("logsStats");
  statsElement.textContent = `Showing ${Math.min(
    100,
    total
  )} of ${total} log entries`;
}

// Update module filter options
function updateModuleFilterOptions(modules) {
  const select = document.getElementById("logModuleFilter");
  const currentSelection = select.value;

  // Keep the first option (All Modules)
  const firstOption = select.options[0];
  select.innerHTML = "";
  select.appendChild(firstOption);

  // Add new options
  modules.forEach((module) => {
    const option = document.createElement("option");
    option.value = module;
    option.textContent = module;
    select.appendChild(option);
  });

  // Restore selection if it exists
  if (currentSelection) {
    select.value = currentSelection;
  }
}

// Load certificate data
function loadCertificateData() {
  fetch("/admin/monitoring/certificates/data")
    .then((response) => response.json())
    .then((data) => {
      updateCertificateStats(data);
      updateCertificateEnvironment(data.environment);
      updateCertificateRateLimiting(data.rateLimiting);
      updateLastError(data);
      updateCertificateTimeline(data);
    })
    .catch((error) => {
      console.error("Error fetching certificate data:", error);
    });
}

// Update certificate stats
function updateCertificateStats(data) {
  // Total requests
  document.getElementById("certTotalRequests").textContent = data.totalRequests;

  // Success rate
  const successRate =
    data.totalRequests > 0
      ? Math.round((data.successfulRequests / data.totalRequests) * 100)
      : 0;
  document.getElementById(
    "certSuccessRateDisplay"
  ).textContent = `${successRate}%`;

  // Success/failure counts
  document.getElementById("certSuccessfulRequests").textContent =
    data.successfulRequests;
  document.getElementById("certFailedRequests").textContent =
    data.failedRequests;

  // Average time
  const avgTime = data.averageGenerationTimeMs || 0;
  document.getElementById("certAvgTime").textContent = `${avgTime.toFixed(
    2
  )} ms`;

  // Certificate store
  const storeSize = data.certificateStore.currentSize;
  const storeMax = data.certificateStore.maxSize;
  const storePercent = Math.round((storeSize / storeMax) * 100);

  document.getElementById("certStoreSize").textContent = storeSize;
  document.getElementById("certStoreMaxSize").textContent = storeMax;
  document.getElementById(
    "certStorePercentage"
  ).textContent = `${storePercent}%`;
  document.getElementById("certStoreUsageBar").style.width = `${storePercent}%`;
}

// Update certificate environment
function updateCertificateEnvironment(environment) {
  // Node version
  document.getElementById("nodeVersion").textContent = environment.nodeVersion;

  // Template status
  const templateList = document.getElementById("templateStatus");
  templateList.innerHTML = "";

  environment.templates.forEach((template) => {
    const item = document.createElement("li");
    item.className =
      "list-group-item d-flex justify-content-between align-items-center";

    const name = document.createElement("span");
    name.textContent = template.name;
    item.appendChild(name);

    const status = document.createElement("span");
    status.className = template.exists ? "badge bg-success" : "badge bg-danger";
    status.textContent = template.exists ? "Available" : "Missing";
    item.appendChild(status);

    templateList.appendChild(item);
  });
}

// Update certificate rate limiting info
function updateCertificateRateLimiting(rateLimiting) {
  document.getElementById(
    "certTTL"
  ).textContent = `${rateLimiting.ttlSeconds} seconds`;
  document.getElementById("rateLimitMax").textContent =
    rateLimiting.maxRequests;
  document.getElementById(
    "rateLimitWindow"
  ).textContent = `${rateLimiting.windowSeconds} seconds`;
}

// Update last error
function updateLastError(data) {
  if (data.lastError && data.lastErrorTime) {
    document.getElementById(
      "lastErrorTime"
    ).textContent = `Last error at ${new Date(
      data.lastErrorTime
    ).toLocaleString()}`;

    const errorMessage = document.getElementById("lastErrorMessage");
    errorMessage.innerHTML = "";
    const alert = document.createElement("div");
    alert.className = "alert alert-danger";
    alert.textContent = data.lastError;
    errorMessage.appendChild(alert);
  } else {
    document.getElementById("lastErrorTime").textContent = "No errors recorded";
    document.getElementById("lastErrorMessage").innerHTML = "";
  }
}

// Update certificate timeline
function updateCertificateTimeline(data) {
  // We'll simulate a timeline by adding the current data point
  const now = new Date();
  const timeLabel = now.toLocaleTimeString();

  // Add new data point (we only have cumulative data, not time-series)
  certificateTimelineChart.data.labels.push(timeLabel);
  certificateTimelineChart.data.datasets[0].data.push(data.successfulRequests);
  certificateTimelineChart.data.datasets[1].data.push(data.failedRequests);

  // Keep only last 20 data points for better visualization
  if (certificateTimelineChart.data.labels.length > 20) {
    certificateTimelineChart.data.labels.shift();
    certificateTimelineChart.data.datasets[0].data.shift();
    certificateTimelineChart.data.datasets[1].data.shift();
  }

  certificateTimelineChart.update();
}

// Get CSS class for log level
function getLevelClass(level) {
  level = level.toUpperCase();
  switch (level) {
    case "INFO":
      return "log-info";
    case "SUCCESS":
      return "log-success";
    case "WARN":
      return "log-warn";
    case "ERROR":
      return "log-error";
    case "DEBUG":
      return "log-debug";
    default:
      return "";
  }
}

// Get badge class for log level
function getBadgeClass(level) {
  level = level.toUpperCase();
  switch (level) {
    case "INFO":
      return "badge bg-info";
    case "SUCCESS":
      return "badge bg-success";
    case "WARN":
      return "badge bg-warning";
    case "ERROR":
      return "badge bg-danger";
    case "DEBUG":
      return "badge bg-secondary";
    default:
      return "badge bg-secondary";
  }
}
