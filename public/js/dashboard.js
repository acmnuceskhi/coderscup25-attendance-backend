// Dashboard JavaScript

// Store data for charts
const memoryData = {
  labels: [],
  datasets: [
    {
      label: "Heap Usage (MB)",
      data: [],
      borderColor: "rgba(75, 192, 192, 1)",
      backgroundColor: "rgba(75, 192, 192, 0.2)",
      borderWidth: 2,
      tension: 0.3,
      fill: true,
    },
  ],
};

let memoryChart;

// Initialize dashboard
document.addEventListener("DOMContentLoaded", function () {
  // Initialize memory chart
  const memoryCtx = document.getElementById("memoryChart").getContext("2d");
  memoryChart = new Chart(memoryCtx, {
    type: "line",
    data: memoryData,
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
            text: "Memory (MB)",
          },
        },
      },
    },
  });

  // Initial data load
  fetchHealthData();

  // Set up refresh interval
  setInterval(fetchHealthData, 30000); // Refresh every 30 seconds

  // Add event listeners
  document
    .getElementById("refreshHealth")
    .addEventListener("click", fetchHealthData);
});

// Fetch health data from server
function fetchHealthData() {
  fetch("/admin/monitoring/data")
    .then((response) => response.json())
    .then((data) => {
      updateDashboard(data);
    })
    .catch((error) => {
      console.error("Error fetching health data:", error);
      showError("Failed to fetch server health data");
    });
}

// Update dashboard with health data
function updateDashboard(data) {
  // Update server status
  updateServerStatus(data.health);

  // Update circuit breakers
  updateCircuitBreakers(data.health.circuitBreakers);

  // Update certificate stats
  if (data.certificates) {
    updateCertificateStats(data.certificates);
  }

  // Update recent errors
  if (data.recentErrors && data.recentErrors.length > 0) {
    updateRecentErrors(data.recentErrors);
  } else {
    document.getElementById("noErrorsMessage").style.display = "block";
  }

  // Update memory chart
  updateMemoryChart(data.health.memoryUsage);
}

// Update server status section
function updateServerStatus(health) {
  // Server status
  const statusBadge = document.getElementById("serverStatus");
  statusBadge.textContent = health.status === "ok" ? "Healthy" : "Degraded";
  statusBadge.className =
    health.status === "ok" ? "badge bg-success" : "badge bg-warning";

  // Uptime
  const uptime = formatUptime(health.uptime);
  document.getElementById("uptime").textContent = uptime;

  // Memory usage
  const heapUsed = health.memoryUsage.heapUsedMB;
  const heapTotal = Math.round(health.memoryUsage.rssMB * 1.5); // Estimate total based on RSS
  const memoryPercentage = Math.min(
    100,
    Math.round((heapUsed / heapTotal) * 100)
  );

  document.getElementById("heapUsed").textContent = heapUsed;
  document.getElementById("heapTotal").textContent = heapTotal;

  const memoryBar = document.getElementById("memoryUsage");
  memoryBar.style.width = `${memoryPercentage}%`;
  if (memoryPercentage < 60) {
    memoryBar.className = "progress-bar bg-success";
  } else if (memoryPercentage < 85) {
    memoryBar.className = "progress-bar bg-warning";
  } else {
    memoryBar.className = "progress-bar bg-danger";
  }

  // Database status
  const dbBadge = document.getElementById("dbStatus");
  dbBadge.textContent = health.database.status;
  dbBadge.className =
    health.database.status === "connected"
      ? "badge bg-success"
      : "badge bg-danger";
}

// Update circuit breakers table
function updateCircuitBreakers(circuitBreakers) {
  const table = document.getElementById("circuitBreakersTable");
  table.innerHTML = "";

  for (const [key, breaker] of Object.entries(circuitBreakers)) {
    const row = document.createElement("tr");

    // Service name
    const serviceCell = document.createElement("td");
    serviceCell.textContent = key;
    row.appendChild(serviceCell);

    // Status
    const statusCell = document.createElement("td");
    const statusBadge = document.createElement("span");
    statusBadge.textContent = breaker.status;
    statusBadge.className =
      breaker.status === "closed" ? "badge bg-success" : "badge bg-danger";
    statusCell.appendChild(statusBadge);
    row.appendChild(statusCell);

    // Failures
    const failuresCell = document.createElement("td");
    failuresCell.textContent = breaker.failureCount;
    row.appendChild(failuresCell);

    // Reset time
    const resetCell = document.createElement("td");
    resetCell.textContent = breaker.willResetAt
      ? new Date(breaker.willResetAt).toLocaleTimeString()
      : "-";
    row.appendChild(resetCell);

    table.appendChild(row);
  }
}

// Update certificate stats
function updateCertificateStats(certData) {
  // Success rate
  const successRate =
    certData.totalRequests > 0
      ? Math.round((certData.successfulRequests / certData.totalRequests) * 100)
      : 0;

  document.getElementById("certSuccessRate").style.width = `${successRate}%`;
  document.getElementById("certSuccessCount").textContent =
    certData.successfulRequests;
  document.getElementById("certTotalCount").textContent =
    certData.totalRequests;

  // Average generation time
  document.getElementById("avgGenTime").textContent =
    certData.averageGenerationTimeMs
      ? certData.averageGenerationTimeMs.toFixed(2)
      : "-";

  // Certificate store
  const storeUsagePercent = Math.round(
    (certData.certificateStore.currentSize /
      certData.certificateStore.maxSize) *
      100
  );
  document.getElementById(
    "certStoreUsage"
  ).style.width = `${storeUsagePercent}%`;
  document.getElementById("certStoreCount").textContent =
    certData.certificateStore.currentSize;
  document.getElementById("certStoreMax").textContent =
    certData.certificateStore.maxSize;
}

// Update recent errors
function updateRecentErrors(errors) {
  const container = document.getElementById("recentErrors");
  document.getElementById("noErrorsMessage").style.display = "none";
  container.innerHTML = "";

  errors.forEach((error) => {
    const errorDiv = document.createElement("div");
    errorDiv.className = "alert alert-danger mb-2 p-2";

    const timestamp = document.createElement("small");
    timestamp.className = "text-muted d-block";
    timestamp.textContent = new Date(error.timestamp).toLocaleString();
    errorDiv.appendChild(timestamp);

    const message = document.createElement("div");
    message.textContent = error.message;
    errorDiv.appendChild(message);

    container.appendChild(errorDiv);
  });
}

// Update memory chart
function updateMemoryChart(memoryData) {
  const now = new Date();
  const timeLabel = now.toLocaleTimeString();

  // Add new data point
  memoryChart.data.labels.push(timeLabel);
  memoryChart.data.datasets[0].data.push(memoryData.heapUsedMB);

  // Keep only last 20 data points for better visualization
  if (memoryChart.data.labels.length > 20) {
    memoryChart.data.labels.shift();
    memoryChart.data.datasets[0].data.shift();
  }

  memoryChart.update();
}

// Helper function to format uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  let result = "";
  if (days > 0) result += `${days}d `;
  if (hours > 0 || days > 0) result += `${hours}h `;
  if (minutes > 0 || hours > 0 || days > 0) result += `${minutes}m `;
  result += `${remainingSeconds}s`;

  return result;
}

// Show error message
function showError(message) {
  // Implementation for showing errors
  console.error(message);
}
