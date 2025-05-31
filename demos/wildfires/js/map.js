// Wildfire Map Application

// Initialize the map when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    require([
        "esri/config",
        "esri/Map",
        "esri/views/MapView",
        "esri/widgets/BasemapToggle",
        "esri/widgets/Home",
        "esri/widgets/LayerList",
        "esri/widgets/Expand",
        "esri/layers/FeatureLayer",
        "esri/renderers/SimpleRenderer",
        "esri/symbols/SimpleFillSymbol",
        "esri/symbols/SimpleMarkerSymbol",
        "esri/Color",
        "esri/support/actions/ActionButton",
        "esri/support/actions/ActionToggle",
        "esri/core/Collection",
        "esri/widgets/Print"
    ], function(
        esriConfig, Map, MapView, BasemapToggle, Home, LayerList, Expand,
        FeatureLayer, SimpleRenderer, SimpleFillSymbol, SimpleMarkerSymbol, Color,
        ActionButton, ActionToggle, Collection, Print
    ) {
        // Set ArcGIS API key if needed
        // esriConfig.apiKey = "YOUR_API_KEY";
        
        // Create map instance
        const map = new Map({
            basemap: "hybrid"
        });
        
        // Create view instance
        const view = new MapView({
            container: "viewDiv",
            map: map,
            center: [-116.5, 39.5], // Centered on USA
            zoom: 5,
            constraints: {
                snapToZoom: false
            },
            popup: {
                dockEnabled: true,
                dockOptions: {
                    position: "top-right",
                    breakpoint: false
                }
            }
        });
        
        // Dynamically set view padding based on header height
        const headerElement = document.querySelector('.header');
        if (headerElement) {
            const headerHeight = headerElement.offsetHeight;
            view.padding = {
                top: headerHeight,
                // you can add other padding values if needed, e.g., left: 0, right: 0, bottom: 0
            };
        }
        
        // Create incident point layer (wildfire points)
        const incidentLayer = createIncidentLayer();
        
        // Create perimeter polygon layer (wildfire perimeters)
        const perimeterLayer = createPerimeterLayer();
        
        // Add layers to map
        map.add(perimeterLayer);
        map.add(incidentLayer);
        
        // Add UI widgets
        addMapWidgets(view, incidentLayer, perimeterLayer);
        
        // Initialize the view
        view.when(() => {
        });
        
        // Helper function to create incident layer
        function createIncidentLayer() {
            return new FeatureLayer({
                url: "https://services9.arcgis.com/RHVPKKiFTONKtxq3/arcgis/rest/services/USA_Wildfires_v1/FeatureServer/0",
                outFields: ["*"],
                title: "Wildfire Incidents",
                listMode: "show",
                opacity: 0.8,
                renderer: new SimpleRenderer({
                    symbol: new SimpleMarkerSymbol({
                        style: "circle",
                        color: new Color([255, 0, 0, 0.8]), // Red with 80% opacity
                        size: 8,
                        outline: {
                            color: new Color([255, 255, 255, 0.8]),
                            width: 1
                        }
                    })
                })
            });
        }
        
        // Helper function to create perimeter layer
        function createPerimeterLayer() {
            return new FeatureLayer({
                url: "https://services9.arcgis.com/RHVPKKiFTONKtxq3/arcgis/rest/services/USA_Wildfires_v1/FeatureServer/1",
                outFields: ["*"],
                title: "Wildfire Perimeters",
                listMode: "show",
                opacity: 0.5,
                renderer: new SimpleRenderer({
                    symbol: new SimpleFillSymbol({
                        color: new Color([255, 140, 0, 0.5]), // Orange with 50% opacity
                        outline: {
                            color: new Color([255, 0, 0, 0.8]),
                            width: 1
                        }
                    })
                })
            });
        }
        
        // Add widgets to the map
        function addMapWidgets(view, incidentLayer, perimeterLayer) {
            // Add a home button
            const homeWidget = new Home({
                view: view
            });
            view.ui.add(homeWidget, "top-left");
            
            // Create enhanced LayerList widget with actions and transparency controls
            const layerList = new LayerList({
                view: view,
                visibleElements: {
                    statusIndicators: true,
                    heading: true,
                    filter: true
                },
                // Define actions and panels for each layer list item
                listItemCreatedFunction: createLayerListActions
            });
            
            // Create an Expand widget for LayerList
            const layerListExpand = new Expand({
                view: view,
                content: layerList,
                expandIconClass: "esri-icon-layer-list",
                expandTooltip: "Layer List",
                group: "top-left",
                expanded: true // Start expanded to show the controls
            });
            
            // Add LayerList to UI (position it under the home button)
            view.ui.add(layerListExpand, {
                position: "top-left",
                index: 1
            });
            
            // Add basemap toggle
            const basemapToggle = new BasemapToggle({
                view: view,
                nextBasemap: "streets-vector"
            });
            view.ui.add(basemapToggle, "bottom-right");
            
            // Setup event handler for layer actions
            setupLayerActionsHandler(layerList, view);
        }
        
        // Create actions for each layer list item
        function createLayerListActions(event) {
            const item = event.item;
            
            // Create action sections (2D array of actions)
            item.actionsSections = [
                // First section - Data and navigation actions
                [
                    new ActionButton({
                        title: "Zoom to layer",
                        className: "esri-icon-zoom-in-magnifying-glass",
                        id: "zoom-to"
                    }),
                    new ActionButton({
                        title: "View details",
                        className: "esri-icon-description",
                        id: "layer-details"
                    }),
                    new ActionButton({
                        title: "View Data Table",
                        className: "esri-icon-table",
                        id: "view-table"
                    })
                ]
            ];
            
            // Add a transparency slider to each layer's panel
            createTransparencySlider(item);
        }
        
        // Add transparency slider to layer panel
        function createTransparencySlider(item) {
            // Create container elements
            const container = document.createElement("div");
            container.className = "layer-transparency-control";
            
            const label = document.createElement("div");
            label.className = "layer-slider-label";
            label.textContent = "Layer Transparency";
            
            // Create Calcite slider
            const sliderContainer = document.createElement("div");
            sliderContainer.className = "layer-slider-container";
            
            const slider = document.createElement("calcite-slider");
            slider.min = 0;
            slider.max = 1;
            slider.step = 0.1;
            slider.value = 1 - item.layer.opacity; // Convert opacity to transparency
            slider.labelHandles = true;
            slider.labelTicks = true;
            slider.ticks = 0.5;
            slider.minLabel = "0%";
            slider.maxLabel = "100%";
            
            slider.addEventListener("calciteSliderInput", (event) => {
                // Update layer opacity (invert transparency value)
                item.layer.opacity = 1 - event.target.value;
            });
            
            // Assemble the panel
            sliderContainer.appendChild(slider);
            container.appendChild(label);
            container.appendChild(sliderContainer);
            
            // Add the panel content
            item.panel = {
                title: "Layer Transparency",
                content: container,
                className: "esri-icon-sliders-horizontal"
            };
        }
        
        // Handle actions triggered from the layer list
        function setupLayerActionsHandler(layerList, view) {
            layerList.on("trigger-action", (event) => {
                // Get the action and layer information
                const action = event.action;
                const item = event.item;
                const layer = item.layer;
                
                // Handle different actions
                switch(action.id) {
                    case "zoom-to":
                        // Zoom to the layer's full extent
                        if (layer && layer.queryExtent) {
                            layer.queryExtent().then(function(result) {
                                if (result.extent) {
                                    view.goTo(result.extent);
                                }
                            });
                        }
                        break;
                        
                    case "layer-details":
                        // Display layer information
                        showLayerDetails(layer);
                        break;

                    case "view-table":
                        // Show data table for the layer
                        showDataTable(layer, view);
                        break;
                }
            });
        }
        
        // Show layer details in a panel
        function showLayerDetails(layer) {
            // Get layer information
            const layerInfo = {
                title: layer.title,
                type: layer.geometryType || "Unknown geometry type",
                visible: layer.visible ? "Yes" : "No",
                opacity: Math.round(layer.opacity * 100) + "%",
                url: layer.url || "Local layer"
            };
            
            // Update the layer info panel
            const layerInfoContent = document.getElementById("layer-info");
            layerInfoContent.innerHTML = `
                <h3>${layerInfo.title}</h3>
                <p><strong>Type:</strong> ${layerInfo.type}</p>
                <p><strong>Visible:</strong> ${layerInfo.visible}</p>
                <p><strong>Opacity:</strong> ${layerInfo.opacity}</p>
                <p><strong>URL:</strong> <a href="${layerInfo.url}" target="_blank" rel="noopener noreferrer">View Service</a></p>
            `;
            
            // Show the layer info panel
            const layerInfoPanel = document.getElementById("layer-info-panel");
            layerInfoPanel.style.display = "block";
            
            // Add close button functionality
            const closeInfoButton = document.getElementById("close-info-button");
            closeInfoButton.addEventListener("click", function() {
                layerInfoPanel.style.display = "none";
            });
        }

        // Show feature table for a layer
        function showDataTable(layer, view) {
            // Create or get data table container
            let dataTableContainer = document.getElementById("data-table-container");
            
            if (!dataTableContainer) {
                // Create data table panel if it doesn't exist
                dataTableContainer = document.createElement("div");
                dataTableContainer.id = "data-table-container";
                dataTableContainer.className = "data-table-container";
                
                // Create header with title and close button
                const tableHeader = document.createElement("div");
                tableHeader.className = "data-table-header";
                
                const tableTitle = document.createElement("h3");
                tableTitle.id = "data-table-title";
                tableTitle.textContent = "Data Table";
                
                const closeButton = document.createElement("calcite-button");
                closeButton.setAttribute("appearance", "transparent");
                closeButton.setAttribute("icon-start", "x");
                closeButton.setAttribute("scale", "s");
                closeButton.id = "close-table-button";
                
                tableHeader.appendChild(tableTitle);
                tableHeader.appendChild(closeButton);
                
                // Create content div
                const tableContent = document.createElement("div");
                tableContent.id = "data-table-content";
                tableContent.className = "data-table-content";
                
                // Assemble container
                dataTableContainer.appendChild(tableHeader);
                dataTableContainer.appendChild(tableContent);
                
                // Add to document
                document.body.appendChild(dataTableContainer);
                
                // Setup close button functionality
                closeButton.addEventListener("click", function() {
                    dataTableContainer.style.display = "none";
                });
            } else {
                // Update existing container
                dataTableContainer.style.display = "block";
                document.getElementById("data-table-title").textContent = `Data: ${layer.title}`;
            }
            
            // Clear previous content
            const tableContent = document.getElementById("data-table-content");
            tableContent.innerHTML = '';
            
            // Show loading state
            const loadingMessage = document.createElement("calcite-loader");
            loadingMessage.setAttribute("text", "Loading table data...");
            loadingMessage.setAttribute("scale", "m");
            tableContent.appendChild(loadingMessage);
            
            // Query feature data with pagination (first 100 records)
            layer.queryFeatures({
                where: "1=1",
                outFields: ["*"],
                returnGeometry: false,
                num: 100
            }).then((results) => {
                // Remove loading indicator
                tableContent.removeChild(loadingMessage);
                
                if (results.features && results.features.length > 0) {
                    // Create table element
                    const table = document.createElement("table");
                    table.className = "feature-data-table";
                    
                    // Create table header
                    const thead = document.createElement("thead");
                    const headerRow = document.createElement("tr");
                    
                    // Get fields from the first feature
                    const fields = Object.keys(results.features[0].attributes)
                        .filter(field => !field.startsWith('__'))  // Filter out internal fields
                        .slice(0, 10);  // Limit to first 10 fields for readability
                    
                    // Add headers for each field
                    fields.forEach(field => {
                        const th = document.createElement("th");
                        th.textContent = field;
                        headerRow.appendChild(th);
                    });
                    
                    thead.appendChild(headerRow);
                    table.appendChild(thead);
                    
                    // Create table body
                    const tbody = document.createElement("tbody");
                    
                    // Add rows for each feature
                    results.features.forEach(feature => {
                        const row = document.createElement("tr");
                        
                        // Add cells for each field
                        fields.forEach(field => {
                            const td = document.createElement("td");
                            td.textContent = feature.attributes[field] !== null ? 
                                feature.attributes[field].toString() : '';
                            row.appendChild(td);
                        });
                        
                        tbody.appendChild(row);
                    });
                    
                    table.appendChild(tbody);
                    tableContent.appendChild(table);
                    
                    // Add record count information
                    const recordInfo = document.createElement("div");
                    recordInfo.className = "record-info";
                    recordInfo.textContent = `Showing ${results.features.length} records`;
                    tableContent.appendChild(recordInfo);
                    
                } else {
                    // Show no data message
                    const noDataMessage = document.createElement("div");
                    noDataMessage.className = "no-data-message";
                    noDataMessage.textContent = "No data available for this layer.";
                    tableContent.appendChild(noDataMessage);
                }
            }).catch(error => {
                // Handle error
                tableContent.removeChild(loadingMessage);
                
                const errorMessage = document.createElement("div");
                errorMessage.className = "error-message";
                errorMessage.textContent = `Error loading data: ${error.message}`;
                tableContent.appendChild(errorMessage);
            });
        }
    });
}); 