# Smart Transport Optimizer Prototype (Surat, Gujarat)

Welcome to the **Smart Transport Optimizer Prototype** — a sleek React + Vite single page application showcasing transit optimizations and live coordinate telemetry for Surat, Gujarat, India.

Powered by raw **Leaflet.js** maps and OpenStreetMap tiles, the app enables interactive routing overlays, carbon emission reduction metrics, and transit pricing estimates directly from map inputs.

---

## 🌟 Key Features

1. **Surat-Centric Interactive Map**: Full scroll-zoom and drag-pan map centered exactly on the coordinates of Surat (`21.1702, 72.8311`).
2. **Terminal Node Selector**: Toggle setting modes in the dashboard sidebar, then click on the map to define the starting **Source** (Green marker) and ending **Destination** (Red marker).
3. **Draggable Coordinates**: Fine-tune your coordinate paths by dragging placed markers directly on the map.
4. **Calculated Telemetry Feed**: Real-time exact distance computation in kilometers using the mathematical **Haversine formula**.
5. **Multi-Route Optimization Recommendations**:
   - **Autonomous EV Shuttle**: Fast lane bypassing, speed routing, and time calculations.
   - **Electric Bus BRTS**: Dedicated lane routing with lowest cost estimates.
   - **Eco-Share Carpool**: Group ride pool modeling.
6. **Carbon Savings**: Visual metrics demonstrating CO₂ reduction (in kg) compared to standard petrol cars.
7. **Simulated Route Flow**: Renders dashed simulated road routing polyline when both terminals are locked. Clicking "Simulate Live Transit Flow" triggers custom simulator feedback.
8. **Premium Glassmorphism Dark Style**: Beautiful blur-filtered sidebars, HSL colors, pulse markers, and responsiveness.

---

## 📁 Code Architecture

```text
smart-transport-optimizer/
├── package.json          # Project node dependencies (React 18, Vite 5, Leaflet 1.9)
├── vite.config.js        # Vite configurations
├── index.html            # Main HTML blueprint preloading Outfit/Inter Fonts and Leaflet styles
│
└── src/
    ├── main.jsx          # React app DOM hook
    ├── App.jsx           # Global state manager, coordinate calculator, and telemetry sidebar UI
    ├── App.css           # Custom glassmorphic styles, keyframe pulse animations, and map overrides
    │
    └── components/
        └── MapView.jsx   # Interactive map, marker nodes, dragging event listeners, and polyline route drawing
```

---

## 🚀 Quick Start Guide

### 1. Set Active Workspace
Ensure your code editor is opened directly in the project directory:
```text
C:\Users\AMAND\.gemini\antigravity\scratch\smart-transport-optimizer
```

### 2. Install Node Modules
Open your command terminal in the project directory and install dependencies:
```bash
npm install
```

### 3. Launch Development Server
Start the local Vite server:
```bash
npm run dev
```

Once started, open the local URL in your web browser (typically [http://localhost:5173](http://localhost:5173)).

---

## 📍 Coordinate Testing Guidelines

Here are a few quick landmark coordinates in Surat that make for fantastic route testing:

- **Surat Fort (Old Castle)**: Near the center, near `21.1985, 72.8184`
- **Dumas Beach**: Southwest coast, near `21.0754, 72.7126`
- **Gopi Talav**: Historic lake park, near `21.1903, 72.8295`
- **Science Centre Surat**: Southwest suburbs, near `21.1685, 72.7937`
