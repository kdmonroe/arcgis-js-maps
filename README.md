# ArcGIS JavaScript Maps

A collection of interactive, mobile-responsive maps built with the [ArcGIS JavaScript SDK](https://developers.arcgis.com/javascript/latest/) and [Calcite Design System](https://developers.arcgis.com/calcite-design-system/).

🌐 **[View Live Demos](https://kdmonroe.github.io/arcgis-js-maps/)**

## ✨ Features

- **Mobile-First Design**: All demos feature responsive layouts with collapsible panels and touch-optimized controls
- **Real-Time Data**: Integration with OpenStreetMap Overpass API and ArcGIS Living Atlas
- **Interactive Visualizations**: 3D scenes, clustering, hex binning, and temporal filtering
- **Consistent UI/UX**: Shared design patterns and mobile responsiveness framework
- **Modern Web Standards**: Dynamic viewport height, hardware-accelerated animations, and accessibility features

## 🗺️ Demo Maps

### Interactive Data Exploration
- **[OSM Real-Time Amenities Explorer](demos/osm_realtime_amenities.html)** - Query OpenStreetMap data in real-time with 8 amenity categories
- **[Alternative Fuel Sources](demos/alternative_fuel_sources.html)** - Interactive map showcasing alternative fuel sources across the United States
- **[US Power Plants Clustering](demos/power_plants_app/index.html)** - Clustered visualization of power plants by fuel type

### 3D Visualizations
- **[Maryland Traffic Cameras](demos/maryland_traffic_cameras.html)** - 3D map with live traffic camera feeds
- **[Buildings Scene](demos/buildings_scene.html)** - 3D building visualization with height-based rendering

### Temporal & Historical Data
- **[Wildfires Map](demos/wildfires/index.html)** - Active and historic wildfire incidents with temporal filtering

### Geographic Boundaries
- **[Point, Line, and Polygon Demo](demos/point_line_polygon_map.html)** - Basic geometry types with custom styling
- **[Toronto Roads](demos/toronto_roads.html)** - Road network visualization
- **[Philadelphia County Boundaries](demos/philadelphia_map.html)** - County boundaries from GeoJSON data
- **[Two-State Solution Map](demos/two_state_solution_map.html)** - Geographic boundaries visualization

## 📱 Mobile Responsiveness

All demos implement a consistent mobile-first design pattern:

- **Collapsible Control Panels**: Slide-up panels on mobile devices
- **Touch-Optimized Controls**: Minimum 44x44px touch targets
- **Dynamic Viewport Height**: Accounts for mobile browser chrome
- **Responsive Positioning**: UI elements adapt to screen size
- **Search & Location**: Built-in search and geolocation widgets

See [MOBILE_RESPONSIVENESS_GUIDE.md](MOBILE_RESPONSIVENESS_GUIDE.md) for implementation details.

## 🚀 Quick Start

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/kdmonroe/arcgis-js-maps.git
   cd arcgis-js-maps
   ```

2. Set up your API key:
   ```bash
   cp shared/config.template.js shared/config.js
   # Edit shared/config.js and add your ArcGIS API key
   ```

3. Start a local server:
   ```bash
   # Using Python
   python -m http.server
   
   # Or using Node.js http-server
   npx http-server
   ```

4. Visit `http://localhost:8000` in your browser

### Creating a New Demo

1. Copy the template:
   ```bash
   cp shared/map_template.html demos/your_new_demo.html
   ```

2. Include the mobile-responsive stylesheet:
   ```html
   <link rel="stylesheet" href="../shared/mobile-responsive.css">
   ```

3. Follow the patterns in [MOBILE_RESPONSIVENESS_GUIDE.md](MOBILE_RESPONSIVENESS_GUIDE.md)

4. Add your demo to [index.html](index.html)

## 🛠️ Technologies

- **[ArcGIS Maps SDK for JavaScript 4.32](https://developers.arcgis.com/javascript/latest/)** - Interactive mapping platform
- **[Calcite Design System 1.9.2](https://developers.arcgis.com/calcite-design-system/)** - UI components and styling
- **[Font Awesome 6.4.0](https://fontawesome.com/)** - Icons and visual elements
- **[OpenStreetMap Overpass API](https://overpass-api.de/)** - Real-time OSM data queries
- **GitHub Pages** - Static site hosting
- **GitHub Actions** - Automated deployment

## 📚 Documentation

- **[Mobile Responsiveness Guide](MOBILE_RESPONSIVENESS_GUIDE.md)** - Comprehensive mobile patterns and best practices
- **[Project Overview](.cursor/rules/project-overview.mdc)** - Architecture and development guidelines
- **[GitHub Pages Deployment](README-GithubPages.md)** - Deployment configuration
- **[Image Replacement Guide](IMAGE_REPLACEMENT_GUIDE.md)** - Asset management

## 🔑 API Key Management

This project uses separate API keys for development and production:

- **Development**: No referrer restrictions (for localhost)
- **Production**: Restricted to GitHub Pages domain

Production keys are injected via GitHub Secrets during deployment. Never commit API keys to version control.

See [Project Overview](.cursor/rules/project-overview.mdc) for detailed API key setup instructions.

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Follow the established mobile-responsive patterns
2. Test across multiple devices and browsers
3. Update documentation for new features
4. Maintain consistent code style
5. Add your demo to the index page

## 📄 License

MIT License - see the project for more details.

## 👤 Author

**Keon Monroe**
- Website: [kdmonroe.dev](https://www.kdmonroe.dev)
- GitHub: [@kdmonroe](https://github.com/kdmonroe)

---

Built with ❤️ using the ArcGIS JavaScript SDK and Calcite Design System
