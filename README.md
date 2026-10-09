# Smart Irrigation System Website Simulation

## Project overview

This college project is a website-based simulation of an IoT smart irrigation system. It demonstrates how simulated soil-moisture and weather readings could inform irrigation decisions. All readings, weather events, tank values, and pump actions are generated or controlled in the browser.

**This is a simulation only.** It has no physical sensors, pump, microcontroller, connected IoT hardware, real-time weather API, or actual field-testing results.

## Features

- Responsive dashboard with simulated soil moisture, temperature, air humidity, rain probability, water tank level, pump status, water use, and irrigation cycle count.
- Interactive soil and tank sliders.
- Automatic irrigation with configurable start threshold, target moisture, and optional rain delay.
- Manual pump controls with an empty-tank safety stop.
- Simulate Rain and Restore Normal Weather controls.
- Chart.js charts for soil moisture, temperature, and water consumption.
- Activity history, notifications, and LocalStorage persistence for settings and simulation history.
- System working-principle explanation, responsive system flowchart, About Project information, and college Demo Guide.
- Dashboard demo shortcuts for dry soil, simulated rain, and empty tank, plus a Demo Reset action.

## Technologies used

- HTML5 for page structure and accessible controls.
- CSS3 for responsive styling, layout, and the HTML-based flowchart.
- Vanilla JavaScript for the simulated readings, irrigation rules, controls, navigation, and browser storage.
- Chart.js 4, loaded from the jsDelivr CDN, for the dashboard charts.
- Browser LocalStorage for saved settings and activity/readings.

No frontend framework, backend, database, or build tool is required. An internet connection is needed to load Chart.js and the optional web fonts.

## Folder structure

```text
smart-irrigation/
├── index.html
├── README.md
├── css/
│   └── style.css
└── js/
    └── app.js
```

## Run using VS Code Live Server

1. Open the `smart-irrigation` folder in Visual Studio Code.
2. Install the **Live Server** extension if it is not already installed.
3. Open `index.html`.
4. Select **Go Live** in the VS Code status bar, or right-click `index.html` and select **Open with Live Server**.
5. The simulation opens in your browser.

## How the simulation works

1. The website opens with sample sensor and weather readings. The soil reading can also be changed with the Live Monitoring slider, and rainfall can be simulated from the Dashboard or Weather section.
2. JavaScript checks the soil reading against the configured irrigation start threshold.
3. In Automatic Mode, irrigation can start when the soil is below the threshold, the tank contains water, and an enabled rain delay is not active. In Manual Mode, the user operates the pump controls.
4. Every two seconds while the virtual pump runs, simulated soil moisture rises, tank level falls, and water consumption increases.
5. Automatic irrigation stops when the configured target is reached. The pump also stops safely if the tank becomes empty. An active rain delay prevents automatic watering from starting.
6. The dashboard, Chart.js graphs, notifications, and activity list update with the simulation. Settings, readings, chart history, and activity are saved locally in the browser.

Chart history is limited to the latest 60 readings, and activity history to the latest 100 events.

## College demonstration guide

1. **Normal soil moisture:** Start at the Dashboard with the default sample readings. Open **Live Monitoring** and move the soil slider to show Dry, Moderate, and Moist statuses.
2. **Dry soil and automatic irrigation:** Select **Dry soil** under Dashboard presentation shortcuts. The shortcut sets soil below the configured threshold, refills the simulated tank, switches to Automatic Mode, and starts watering.
3. **Pump stops at the target:** Let the simulation run. Moisture increases in steps until the configured target is reached; then the automatic pump stops.
4. **Manual pump control:** Under **Irrigation Control**, switch to Manual Mode and use **Start pump** and **Stop pump**. The empty-tank safety stop remains active.
5. **Rain and rain delay:** Use **Simulate rain** on the Dashboard or Weather page. Show the simulated weather readings and rain-delay status. **Restore normal weather** clears the delay.
6. **Empty tank protection:** Choose **Empty tank** in the Dashboard presentation shortcuts. The app sets dry soil and an empty tank in Automatic Mode, demonstrating why watering cannot start.
7. **Analytics and activity:** Open **Analytics** to show updated charts, then **History** to review irrigation, weather, and safety events.
8. **Repeat the demonstration:** Select **Demo reset** on the Dashboard or **Reset simulation** in the Demo Guide. Confirm the reset to restore default readings/settings and clear saved activity.

## Limitations

- Values are simulated and are not measurements from a real farm.
- The water tank and pump are virtual; the project cannot operate physical equipment.
- Weather is simulated locally; no real-time weather service is used.
- LocalStorage is limited to the current browser and device and can be cleared by browser settings.
- The project has not been tested as a real irrigation installation or in field conditions.

## Future improvements

A separate hardware implementation could connect calibrated soil sensors, a microcontroller, a protected pump controller, and a weather service. Further work could explore multiple fields, secure remote monitoring, and cloud-based reporting. These are future possibilities and are not implemented in this website simulation.
