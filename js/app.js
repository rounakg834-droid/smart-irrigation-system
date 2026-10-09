"use strict";

const STORAGE_KEY = "fieldsense-smart-irrigation-v1";
const MAX_HISTORY = 60;
const MAX_ACTIVITIES = 100;
const SIMULATION_INTERVAL = 2000;

const defaultState = {
  moisture: 42,
  temperature: 24,
  humidity: 58,
  rainProbability: 15,
  tank: 72,
  pumpOn: false,
  mode: "auto",
  waterUsed: 0,
  cycles: 0,
  settings: { startThreshold: 30, targetMoisture: 60, rainDelayEnabled: true, rainDelayMinutes: 10 },
  weatherIsRainy: false,
  rainDelayUntil: 0,
  history: [],
  activities: []
};

const el = (id) => document.getElementById(id);
let state = loadState();
let charts = {};
let previousMoisture = state.moisture;
let simulationTimer = null;
let emptyTankWarningActive = state.mode === "auto"
  && state.tank <= 0
  && state.moisture < state.settings.startThreshold;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function validNumber(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max;
}

// Restore valid saved values and fall back to safe defaults if browser data is missing or damaged.
function loadState() {
  let stored;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.error("Could not read the irrigation simulation from LocalStorage.", error);
    showToast("Saved data is unavailable", "The simulation is using default values for this visit.", "error");
    return structuredClone(defaultState);
  }
  if (!stored) return structuredClone(defaultState);

  try {
    const saved = JSON.parse(stored);
    if (!saved || typeof saved !== "object") throw new Error("Saved data is not an object.");
    const settings = saved.settings || {};
    const startThreshold = Number(settings.startThreshold);
    const targetMoisture = Number(settings.targetMoisture);
    const rainDelayMinutes = Number(settings.rainDelayMinutes);
    const validSettings = validNumber(startThreshold, 1, 98)
      && validNumber(targetMoisture, 2, 100)
      && startThreshold < targetMoisture
      && validNumber(rainDelayMinutes, 1, 1440);
    const restored = {
      ...structuredClone(defaultState),
      moisture: validNumber(Number(saved.moisture), 0, 100) ? Number(saved.moisture) : defaultState.moisture,
      temperature: validNumber(Number(saved.temperature), -10, 55) ? Number(saved.temperature) : defaultState.temperature,
      humidity: validNumber(Number(saved.humidity), 0, 100) ? Number(saved.humidity) : defaultState.humidity,
      rainProbability: validNumber(Number(saved.rainProbability), 0, 100) ? Number(saved.rainProbability) : defaultState.rainProbability,
      tank: validNumber(Number(saved.tank), 0, 100) ? Number(saved.tank) : defaultState.tank,
      pumpOn: saved.pumpOn === true,
      mode: saved.mode === "manual" ? "manual" : "auto",
      waterUsed: validNumber(Number(saved.waterUsed), 0, Number.MAX_SAFE_INTEGER) ? Number(saved.waterUsed) : 0,
      cycles: Number.isInteger(saved.cycles) && saved.cycles >= 0 ? saved.cycles : 0,
      weatherIsRainy: saved.weatherIsRainy === true,
      rainDelayUntil: Number.isFinite(saved.rainDelayUntil) ? saved.rainDelayUntil : 0,
      settings: validSettings
        ? { startThreshold, targetMoisture, rainDelayEnabled: settings.rainDelayEnabled !== false, rainDelayMinutes }
        : structuredClone(defaultState.settings),
      history: Array.isArray(saved.history) ? saved.history.filter(isValidReading).slice(-MAX_HISTORY) : [],
      activities: Array.isArray(saved.activities) ? saved.activities.filter(isValidActivity).slice(0, MAX_ACTIVITIES) : []
    };
    if (restored.mode === "auto" && restored.moisture >= restored.settings.targetMoisture) restored.pumpOn = false;
    if (restored.tank === 0) restored.pumpOn = false;
    return restored;
  } catch (error) {
    console.error("Could not restore the saved irrigation simulation.", error);
    showToast("Saved data could not be restored", "The simulation has started with default values.", "error");
    return structuredClone(defaultState);
  }
}

// Keep the saved chart series inside the same sensor ranges used by the controls.
function isValidReading(entry) {
  return entry && typeof entry.label === "string"
    && validNumber(entry.moisture, 0, 100)
    && validNumber(entry.temperature, -10, 55)
    && validNumber(entry.water, 0, Number.MAX_SAFE_INTEGER);
}

function isValidActivity(entry) {
  return entry && typeof entry.title === "string" && typeof entry.detail === "string"
    && typeof entry.time === "string" && typeof entry.type === "string";
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Could not save the irrigation simulation to LocalStorage.", error);
    showToast("Could not save this change", "Check browser storage settings or available space.", "error");
  }
}

function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function addActivity(title, detail, type = "system") {
  state.activities.unshift({ title, detail, type, time: formatTime() });
  state.activities = state.activities.slice(0, MAX_ACTIVITIES);
  renderActivities();
  saveState();
}

function showToast(title, detail, kind = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${kind}`;
  const icon = document.createElement("span");
  icon.textContent = kind === "warning" ? "⚠" : kind === "error" ? "!" : "✓";
  const text = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = title;
  const message = document.createElement("small");
  message.textContent = detail;
  text.append(heading, message);
  toast.append(icon, text);
  el("toastRegion").append(toast);
  window.setTimeout(() => toast.remove(), 4800);
}

function moistureStatus(value) {
  if (value < 30) return { label: "Dry", color: "tag-dry" };
  if (value < 60) return { label: "Moderate", color: "tag-moderate" };
  return { label: "Moist", color: "tag-green" };
}

function setRangeBackground(input, value) {
  input.style.background = `linear-gradient(to right, #56a873 0%, #56a873 ${value}%, #e9efe9 ${value}%, #e9efe9 100%)`;
}

function render() {
  const status = moistureStatus(state.moisture);
  el("moistureValue").textContent = state.moisture;
  el("sensorMoisture").textContent = state.moisture;
  el("moistureSlider").value = state.moisture;
  el("moistureStatus").textContent = status.label;
  el("moistureStatus").className = `metric-tag ${status.color}`;
  el("moistureMiniBar").style.width = `${state.moisture}%`;
  el("moistureTrend").textContent = state.moisture > previousMoisture ? "↑ Rising" : state.moisture < previousMoisture ? "↓ Falling" : "● Stable";
  setRangeBackground(el("moistureSlider"), state.moisture);

  el("temperatureValue").textContent = state.temperature;
  el("monitorTemp").textContent = state.temperature;
  el("weatherTemp").textContent = `${state.temperature}°`;
  el("weatherTempCard").textContent = state.temperature;
  el("humidityValue").textContent = state.humidity;
  el("monitorHumidity").textContent = state.humidity;
  el("weatherHumidityCard").textContent = state.humidity;
  el("rainValue").textContent = state.rainProbability;
  el("monitorRain").textContent = state.rainProbability;
  el("weatherRainCard").textContent = state.rainProbability;
  el("rainFoot").textContent = state.rainProbability >= 50 ? "☂ Rain likely" : "☀ Low chance";
  el("weatherRainCaption").textContent = state.rainProbability >= 50 ? "Rain likely" : "Low chance of rain";
  el("feelsLike").textContent = state.temperature + (state.weatherIsRainy ? -1 : 1);

  el("tankLevel").textContent = state.tank;
  el("tankPercent").textContent = `${state.tank}%`;
  el("controlTankValue").textContent = state.tank;
  el("tankSlider").value = state.tank;
  el("tankFill").style.height = `${state.tank}%`;
  el("tankFill").classList.toggle("low-water", state.tank > 0 && state.tank <= 20);
  setRangeBackground(el("tankSlider"), state.tank);
  el("tankWarning").hidden = state.tank > 20;
  el("tankWarning").textContent = state.tank === 0
    ? "⚠ Tank is empty. The pump cannot run."
    : "⚠ Low water level. Irrigation may stop soon.";
  el("tankState").classList.toggle("low-water", state.tank > 0 && state.tank <= 20);
  el("tankState").innerHTML = state.tank === 0
    ? '<span class="status-dot"></span> Empty'
    : state.tank <= 20
      ? '<span class="status-dot"></span> Low supply'
      : '<span class="live-dot"></span> Available';
  el("moistureCard").classList.toggle("is-dry", state.moisture < 30);

  el("waterUsed").textContent = state.waterUsed.toFixed(1);
  el("cycleCount").textContent = state.cycles;
  const pumpBadgeText = state.pumpOn ? "Pump running" : "Pump off";
  el("pumpBadge").className = `pump-status ${state.pumpOn ? "status-on" : "status-off"}`;
  el("pumpBadge").innerHTML = `<span class="status-dot"></span> ${pumpBadgeText}`;
  el("controlPumpBadge").className = `pump-status ${state.pumpOn ? "status-on" : "status-off"}`;
  el("controlPumpBadge").innerHTML = `<span class="status-dot"></span> ${state.pumpOn ? "Running" : "Off"}`;
  el("pumpHeadline").textContent = state.pumpOn ? "Pump is running" : "Pump is idle";
  el("pumpDescription").textContent = state.pumpOn ? "Water is flowing to the simulated field" : "Waiting for irrigation conditions";
  el("pumpIllustration").classList.toggle("pumping", state.pumpOn);
  el("modeSummary").textContent = state.mode === "auto" ? "Automatic" : "Manual";

  el("autoMode").classList.toggle("active", state.mode === "auto");
  el("manualMode").classList.toggle("active", state.mode === "manual");
  el("modeDescription").textContent = state.mode === "auto"
    ? "The pump starts when soil is too dry and stops when the target moisture is reached."
    : "Use Start pump and Stop pump to control irrigation. The pump will not stop automatically at the target.";
  el("pumpControlHint").textContent = state.mode === "auto"
    ? "Switch to Manual Mode to control the pump directly."
    : "Manual mode is active. The tank-empty safety stop remains enabled.";

  const isDelayed = state.settings.rainDelayEnabled && state.rainDelayUntil > Date.now();
  el("rainDelayStatus").textContent = isDelayed
    ? `Automatic watering is paused until ${new Date(state.rainDelayUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`
    : state.settings.rainDelayEnabled ? "No rain delay is active." : "Rain delay is turned off in irrigation settings.";
  el("delayIndicator").classList.toggle("active", isDelayed);
  el("delayIndicator").innerHTML = isDelayed
    ? '<span class="status-dot" style="background:#6b93ad"></span> Delay active'
    : '<span class="live-dot"></span> Monitoring';
  el("weatherBanner").classList.toggle("rainy", state.weatherIsRainy);
  el("weatherCondition").textContent = state.weatherIsRainy ? "Rain showers" : "Clear and sunny";
  el("weatherDescription").textContent = state.weatherIsRainy
    ? "Simulated rainfall is reaching the field. Automatic irrigation may be paused."
    : "A bright day over the field with a low chance of rain.";
  el("stripWeather").textContent = state.weatherIsRainy ? "Simulated rainfall" : "Clear conditions";
  el("stripWeatherIcon").textContent = state.weatherIsRainy ? "☂" : "☀";
  renderActivities();
  updateCharts();
}

function startPump(source) {
  if (state.pumpOn) return;
  if (state.tank <= 0) {
    showToast("Water tank is empty", "Refill the simulated tank before starting the pump.", "warning");
    addActivity("Pump start blocked", "The water tank is empty.", "warning");
    return;
  }
  state.pumpOn = true;
  state.cycles += 1;
  addActivity("Irrigation started", source === "manual" ? "Pump started manually." : "Soil moisture fell below the start threshold.", "irrigation");
  showToast("Irrigation started", source === "manual" ? "The virtual pump is running in manual mode." : "Soil moisture is below the configured threshold.");
  render();
  saveState();
}

function stopPump(reason, notify = true) {
  if (!state.pumpOn) return;
  state.pumpOn = false;
  addActivity("Irrigation stopped", reason, "irrigation");
  if (notify) showToast("Irrigation stopped", reason);
  render();
  saveState();
}

// Automatic mode has start, target, rain-delay, and tank checks; tank safety applies in both modes.
function evaluateAutomaticMode() {
  if (state.pumpOn && state.tank <= 0) {
    emptyTankWarningActive = true;
    stopPump("The tank ran empty; pump stopped for safety.", false);
    showToast("Tank empty", "The pump stopped automatically to prevent dry running.", "warning");
    addActivity("Empty tank warning", "Pump stopped because the tank ran empty.", "warning");
    return;
  }
  if (state.tank > 0 || state.moisture >= state.settings.startThreshold) emptyTankWarningActive = false;
  if (state.mode !== "auto") return;
  if (state.pumpOn && state.moisture >= state.settings.targetMoisture) {
    stopPump(`Target moisture of ${state.settings.targetMoisture}% reached.`);
    return;
  }
  if (state.pumpOn) return;
  if (state.tank <= 0 && state.moisture < state.settings.startThreshold) {
    if (!emptyTankWarningActive) {
      emptyTankWarningActive = true;
      showToast("Water tank is empty", "Automatic irrigation is waiting for the tank to be refilled.", "warning");
      addActivity("Empty tank warning", "Automatic irrigation could not start because the tank is empty.", "warning");
    }
    return;
  }
  if (state.moisture < state.settings.startThreshold) {
    if (state.settings.rainDelayEnabled && state.rainDelayUntil > Date.now()) return;
    startPump("automatic");
  }
}

function recordReading() {
  state.history.push({
    label: formatTime(),
    moisture: state.moisture,
    temperature: state.temperature,
    water: Number(state.waterUsed.toFixed(1))
  });
  state.history = state.history.slice(-MAX_HISTORY);
}

// One timer tick advances the pump, records a bounded chart reading, and saves the new state.
function simulationTick() {
  evaluateAutomaticMode();
  if (state.pumpOn) {
    previousMoisture = state.moisture;
    const moistureIncrease = state.mode === "auto"
      ? Math.min(2, state.settings.targetMoisture - state.moisture)
      : 2;
    state.moisture = clamp(state.moisture + moistureIncrease, 0, 100);
    state.tank = clamp(state.tank - 0.5, 0, 100);
    state.waterUsed = clamp(state.waterUsed + 0.5, 0, Number.MAX_SAFE_INTEGER);
    if (state.mode === "auto" && state.moisture >= state.settings.targetMoisture) {
      stopPump(`Target moisture of ${state.settings.targetMoisture}% reached.`);
    } else if (state.tank <= 0) {
      emptyTankWarningActive = true;
      stopPump("The tank ran empty; pump stopped for safety.", false);
      showToast("Tank empty", "The pump stopped automatically to prevent dry running.", "warning");
      addActivity("Empty tank warning", "Pump stopped because the tank ran empty.", "warning");
    }
  }
  recordReading();
  render();
  saveState();
}

function renderActivities() {
  const list = el("activityList");
  list.replaceChildren();
  el("historyCount").textContent = `${state.activities.length} EVENT${state.activities.length === 1 ? "" : "S"}`;
  el("historyEmpty").hidden = state.activities.length > 0;
  for (const activity of state.activities) {
    const row = document.createElement("div");
    row.className = "activity-item";
    const icon = document.createElement("span");
    icon.className = `activity-icon ${activity.type === "warning" ? "warning" : activity.type === "weather" ? "weather" : activity.type === "settings" ? "settings" : ""}`;
    icon.textContent = activity.type === "warning" ? "⚠" : activity.type === "weather" ? "☂" : activity.type === "settings" ? "⚙" : activity.type === "irrigation" ? "♧" : "◉";
    const copy = document.createElement("span");
    copy.className = "activity-copy";
    const title = document.createElement("strong");
    title.textContent = activity.title;
    const detail = document.createElement("span");
    detail.textContent = activity.detail;
    copy.append(title, detail);
    const time = document.createElement("span");
    time.className = "activity-time";
    time.textContent = activity.time;
    row.append(icon, copy, time);
    list.append(row);
  }
}

function updateCharts() {
  if (!window.Chart || !charts.moisture) return;
  const labels = state.history.map((reading) => reading.label);
  charts.moisture.data.labels = labels;
  charts.moisture.data.datasets[0].data = state.history.map((reading) => reading.moisture);
  charts.temperature.data.labels = labels;
  charts.temperature.data.datasets[0].data = state.history.map((reading) => reading.temperature);
  const intervals = state.history.map((reading, index) => {
    if (index === 0) return 0;
    return Number(Math.max(0, reading.water - state.history[index - 1].water).toFixed(1));
  });
  charts.water.data.labels = labels;
  charts.water.data.datasets[0].data = intervals;
  Object.values(charts).forEach((chart) => chart.update("none"));
}

function initializeCharts() {
  if (!window.Chart) {
    showToast("Charts are unavailable", "Chart.js could not load. Check your internet connection and refresh.", "error");
    return;
  }
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: "#20392a", padding: 10, titleFont: { size: 10 }, bodyFont: { size: 10 }, displayColors: false }
    },
    interaction: { intersect: false, mode: "index" },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: "#9aa49c", maxTicksLimit: 7, maxRotation: 0, font: { size: 9 } } },
      y: { beginAtZero: true, border: { display: false, dash: [3, 4] }, grid: { color: "#eef1ed" }, ticks: { color: "#9aa49c", maxTicksLimit: 5, font: { size: 9 } } }
    }
  };
  const lineChart = (id, label, color, fill, max) => new Chart(el(id), {
    type: "line",
    data: { labels: [], datasets: [{ label, data: [], borderColor: color, backgroundColor: fill, fill: true, borderWidth: 2, pointRadius: 2, pointHoverRadius: 4, pointBackgroundColor: color, tension: .34 }] },
    options: { ...commonOptions, scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, max } } }
  });
  charts.moisture = lineChart("moistureChart", "Moisture", "#4e9b63", "rgba(78, 155, 99, .10)", 100);
  charts.temperature = lineChart("temperatureChart", "Temperature", "#d99a4b", "rgba(217, 154, 75, .10)", undefined);
  charts.water = new Chart(el("waterChart"), {
    type: "bar",
    data: { labels: [], datasets: [{ label: "Water used", data: [], backgroundColor: "#77b286", hoverBackgroundColor: "#4d9562", borderRadius: 4, maxBarThickness: 20 }] },
    options: { ...commonOptions, scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, suggestedMax: 1 } } }
  });
}

// Validate the student's irrigation rules before applying or persisting them.
function saveSettings() {
  const startThreshold = Number(el("startThreshold").value);
  const targetMoisture = Number(el("targetMoisture").value);
  const rainDelayMinutes = Number(el("rainDelayMinutes").value);
  if (!validNumber(startThreshold, 1, 98) || !validNumber(targetMoisture, 2, 100)
      || startThreshold >= targetMoisture || !validNumber(rainDelayMinutes, 1, 1440)) {
    showToast("Settings were not saved", "Use a start threshold of 1–98%, a higher target up to 100%, and a delay of 1–1440 minutes.", "warning");
    return;
  }
  state.settings = {
    startThreshold,
    targetMoisture,
    rainDelayEnabled: el("rainDelayToggle").checked,
    rainDelayMinutes
  };
  if (!state.settings.rainDelayEnabled) state.rainDelayUntil = 0;
  addActivity("Irrigation settings changed", `Start below ${startThreshold}%, stop at ${targetMoisture}%. Rain delay ${state.settings.rainDelayEnabled ? `enabled for ${rainDelayMinutes} minutes` : "disabled"}.`, "settings");
  showToast("Settings saved", "Your irrigation rules are stored in this browser.");
  render();
  evaluateAutomaticMode();
  saveState();
}

function syncSettingsForm() {
  el("startThreshold").value = state.settings.startThreshold;
  el("targetMoisture").value = state.settings.targetMoisture;
  el("rainDelayToggle").checked = state.settings.rainDelayEnabled;
  el("rainDelayMinutes").value = state.settings.rainDelayMinutes;
}

function setMode(mode) {
  if (state.mode === mode) return;
  if (state.pumpOn) stopPump(`Pump stopped because the operating mode changed to ${mode === "auto" ? "Automatic" : "Manual"}.`);
  state.mode = mode;
  addActivity("Operating mode changed", `Switched to ${mode === "auto" ? "Automatic" : "Manual"} Mode.`, "settings");
  showToast(`${mode === "auto" ? "Automatic" : "Manual"} Mode enabled`, mode === "auto" ? "Irrigation will follow your configured rules." : "Use the pump buttons to control watering.");
  render();
  evaluateAutomaticMode();
  saveState();
}

// Apply fixed sample weather values and start the configured automatic-mode delay.
function simulateRain() {
  state.weatherIsRainy = true;
  state.temperature = 19;
  state.humidity = 91;
  state.rainProbability = 92;
  if (state.settings.rainDelayEnabled) {
    state.rainDelayUntil = Date.now() + state.settings.rainDelayMinutes * 60 * 1000;
    if (state.mode === "auto" && state.pumpOn) stopPump("Simulated rain activated the configured rain delay.");
  } else state.rainDelayUntil = 0;
  addActivity("Simulated rainfall", state.settings.rainDelayEnabled
    ? `Rain delay active for ${state.settings.rainDelayMinutes} minutes.`
    : "Weather changed to rain; rain delay is disabled.", "weather");
  showToast("Rain simulated", state.settings.rainDelayEnabled
    ? `Automatic irrigation paused for ${state.settings.rainDelayMinutes} minutes.`
    : "Weather updated. Rain delay is disabled.");
  recordReading();
  render();
  saveState();
}

function restoreWeather() {
  state.weatherIsRainy = false;
  state.temperature = 24;
  state.humidity = 58;
  state.rainProbability = 15;
  state.rainDelayUntil = 0;
  addActivity("Weather restored", "Normal simulated weather conditions restored; rain delay cleared.", "weather");
  showToast("Normal weather restored", "The active rain delay has been cleared.");
  recordReading();
  evaluateAutomaticMode();
  render();
  saveState();
}

// Reset both the visible demo and its saved state so the presentation can be repeated.
function resetSimulation() {
  if (!window.confirm("Reset all simulation readings, settings, and saved activity to their defaults?")) return;
  state = structuredClone(defaultState);
  previousMoisture = state.moisture;
  emptyTankWarningActive = false;
  syncSettingsForm();
  recordReading();
  saveState();
  render();
  showToast("Simulation reset", "Readings, settings, and activity have been restored to defaults.");
}

// Demo shortcuts start from a predictable, clear-weather automatic-mode baseline.
function prepareDemoScenario() {
  if (state.pumpOn) stopPump("Pump stopped to prepare a presentation scenario.");
  state.mode = "auto";
  state.weatherIsRainy = false;
  state.temperature = defaultState.temperature;
  state.humidity = defaultState.humidity;
  state.rainProbability = defaultState.rainProbability;
  state.rainDelayUntil = 0;
  state.tank = 100;
  emptyTankWarningActive = false;
}

function demoDrySoil() {
  prepareDemoScenario();
  previousMoisture = state.moisture;
  state.moisture = Math.max(0, state.settings.startThreshold - 1);
  addActivity("Dry soil demo prepared", `Soil set to ${state.moisture}% with a full tank in Automatic Mode.`, "settings");
  render();
  evaluateAutomaticMode();
  saveState();
}

function demoEmptyTank() {
  prepareDemoScenario();
  previousMoisture = state.moisture;
  state.moisture = Math.max(0, state.settings.startThreshold - 1);
  state.tank = 0;
  addActivity("Empty tank demo prepared", "Dry soil with an empty tank in Automatic Mode.", "warning");
  render();
  evaluateAutomaticMode();
  saveState();
}

function bindEvents() {
  el("moistureSlider").addEventListener("input", (event) => {
    previousMoisture = state.moisture;
    state.moisture = Number(event.target.value);
    render();
    evaluateAutomaticMode();
    saveState();
  });
  el("tankSlider").addEventListener("input", (event) => {
    state.tank = Number(event.target.value);
    if (state.tank === 0 && state.pumpOn) {
      emptyTankWarningActive = true;
      stopPump("The tank was set to empty; pump stopped for safety.", false);
      showToast("Tank empty", "The pump stopped automatically to prevent dry running.", "warning");
      addActivity("Empty tank warning", "Pump stopped because the tank was set to empty.", "warning");
    } else if (state.tank === 0 && state.mode === "auto" && state.moisture < state.settings.startThreshold) {
      evaluateAutomaticMode();
      render();
      saveState();
    } else {
      if (state.tank > 0) emptyTankWarningActive = false;
      render();
      saveState();
    }
  });
  el("startPump").addEventListener("click", () => {
    if (state.mode !== "manual") {
      showToast("Manual Mode required", "Switch to Manual Mode before starting the pump directly.", "warning");
      return;
    }
    startPump("manual");
  });
  el("stopPump").addEventListener("click", () => {
    if (state.mode !== "manual") {
      showToast("Manual Mode required", "Switch to Manual Mode before stopping the pump directly.", "warning");
      return;
    }
    if (state.pumpOn) stopPump("Pump stopped manually.");
  });
  el("autoMode").addEventListener("click", () => setMode("auto"));
  el("manualMode").addEventListener("click", () => setMode("manual"));
  el("saveSettings").addEventListener("click", saveSettings);
  el("simulateRain").addEventListener("click", simulateRain);
  el("demoDrySoil").addEventListener("click", demoDrySoil);
  el("demoRain").addEventListener("click", simulateRain);
  el("demoEmptyTank").addEventListener("click", demoEmptyTank);
  el("restoreWeather").addEventListener("click", restoreWeather);
  el("clearHistory").addEventListener("click", () => {
    if (!window.confirm("Clear all saved activity history?")) return;
    state.activities = [];
    renderActivities();
    saveState();
    showToast("History cleared", "Previous activity has been removed from this browser.");
  });
  document.querySelectorAll('[data-action="reset"]').forEach((button) => button.addEventListener("click", resetSimulation));

  const sidebar = el("sidebar");
  const overlay = el("mobileOverlay");
  const menu = el("mobileMenu");
  const closeMenu = () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("visible");
    menu.setAttribute("aria-expanded", "false");
    menu.setAttribute("aria-label", "Open navigation");
  };
  menu.addEventListener("click", () => {
    const isOpen = sidebar.classList.toggle("open");
    overlay.classList.toggle("visible", isOpen);
    menu.setAttribute("aria-expanded", String(isOpen));
    menu.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
  });
  overlay.addEventListener("click", closeMenu);

  const navLinks = [...document.querySelectorAll(".nav-link")];
  const navLabel = (link) => [...link.childNodes]
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent)
    .join("")
    .trim();
  let pendingNavigationId = null;
  let navigationScrollTimeout = null;
  navLinks.forEach((link) => link.addEventListener("click", () => {
    navLinks.forEach((item) => item.classList.toggle("active", item === link));
    el("pageTitle").textContent = navLabel(link);
    pendingNavigationId = link.getAttribute("href").slice(1);
    window.clearTimeout(navigationScrollTimeout);
    navigationScrollTimeout = window.setTimeout(() => {
      pendingNavigationId = null;
      syncActiveSection();
    }, 1200);
    closeMenu();
  }));
  const sections = [...document.querySelectorAll(".page-section")];
  // Keep the selected navigation item aligned with the section nearest the sticky header.
  const syncActiveSection = () => {
    if (pendingNavigationId) return;
    const marker = document.querySelector(".topbar").getBoundingClientRect().bottom + 115;
    let currentSection = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2
      ? sections[sections.length - 1]
      : sections[0];
    if (currentSection !== sections[sections.length - 1]) {
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= marker) currentSection = section;
      }
    }
    const activeLink = navLinks.find((link) => link.getAttribute("href") === `#${currentSection.id}`);
    if (!activeLink) return;
    navLinks.forEach((link) => link.classList.toggle("active", link === activeLink));
    el("pageTitle").textContent = navLabel(activeLink);
  };
  window.addEventListener("scroll", syncActiveSection, { passive: true });
  window.addEventListener("hashchange", syncActiveSection);
  syncActiveSection();
}

function initialize() {
  el("currentDate").textContent = new Date().toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  if (state.history.length === 0) recordReading();
  initializeCharts();
  bindEvents();
  syncSettingsForm();
  render();
  evaluateAutomaticMode();
  saveState();
  startSimulationTimer();
}

// Reuse one interval even if setup calls this again.
function startSimulationTimer() {
  if (simulationTimer !== null) window.clearInterval(simulationTimer);
  simulationTimer = window.setInterval(simulationTick, SIMULATION_INTERVAL);
}

initialize();
