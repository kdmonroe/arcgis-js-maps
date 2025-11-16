// Wildfire Map Application

// Initialize the map when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    require([
        "esri/Map",
        "esri/views/MapView",
        "esri/widgets/Home",
        "esri/widgets/LayerList",
        "esri/widgets/Legend",
        "esri/widgets/Expand",
        "esri/widgets/TimeSlider",
        "esri/layers/FeatureLayer",
        "esri/renderers/SimpleRenderer",
        "esri/symbols/SimpleMarkerSymbol",
        "esri/support/actions/ActionButton",
        "esri/core/reactiveUtils"
    ], function(
        Map, MapView, Home, LayerList, Legend, Expand, TimeSlider,
        FeatureLayer, SimpleRenderer, SimpleMarkerSymbol,
        ActionButton, reactiveUtils
    ) {
        // Global reference to TimeSlider for synchronization with quick filters
        let timeSlider = null;
        
        // Create map instance with dark cartography
        // Using dark-gray-vector as primary basemap (Firefly portal item may require authentication)
        const map = new Map({
            basemap: "dark-gray-vector"
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

        // Add layer to map
        map.add(incidentLayer);

        // Add UI widgets
        addMapWidgets(view, incidentLayer);
        
        // Initialize the view
        view.when(() => {
        });
        
        // Helper function to create incident layer with fire point symbols
        function createIncidentLayer() {
            // Create Firefly-style fire symbol with size-based rendering
            // Symbol size scales with fire acreage for visual prominence
            const fireSymbol = new SimpleMarkerSymbol({
                color: "#FF6B00",  // Bright orange for fire incidents
                size: 4,           // Base size - will be overridden by visual variables
                outline: null      // No outline for cleaner bloom glow
            });

            const incidentLayer = new FeatureLayer({
                url: "https://services9.arcgis.com/RHVPKKiFTONKtxq3/arcgis/rest/services/USA_Wildfires_v1/FeatureServer/0",
                outFields: ["*"],
                title: "Wildfire Incidents",
                listMode: "show",
                opacity: 1.0,
                // Configure temporal information for time-based filtering
                timeInfo: {
                    startField: "FireDiscoveryDateTime",
                    interval: {
                        unit: "days",
                        value: 1
                    }
                },
                // Add popup template for interactive feature details
                popupTemplate: {
                    title: "{IncidentName}",
                    content: [
                        {
                            type: "fields",
                            fieldInfos: [
                                { fieldName: "IncidentName", label: "Incident Name" },
                                { fieldName: "FireDiscoveryDateTime", label: "Discovered", format: { dateFormat: "short-date-short-time" } },
                                { fieldName: "DailyAcres", label: "Acres Burned" },
                                { fieldName: "PercentContained", label: "% Contained" },
                                { fieldName: "UniqueFireIdentifier", label: "Fire ID" }
                            ]
                        }
                    ]
                },
                renderer: new SimpleRenderer({
                    symbol: fireSymbol,
                    // Add visual variables for size-based rendering by acreage
                    visualVariables: [{
                        type: "size",
                        field: "DailyAcres",  // Size based on fire acreage
                        stops: [
                            { value: 100, size: 2 },      // Small fires: 2px
                            { value: 1000, size: 4 },     // Medium fires: 4px
                            { value: 10000, size: 8 },    // Large fires: 8px
                            { value: 50000, size: 12 }    // Very large fires: 12px
                        ]
                    }]
                })
            });

            // Add Firefly bloom effect for glowing appearance
            // Parameters: bloom(strength, radius, threshold)
            // - strength: 1.5 (moderate glow intensity)
            // - radius: 0.5px (soft blur)
            // - threshold: 10% (glow on bright colors only)
            incidentLayer.effect = "bloom(1.5, 0.5px, 10%)";

            return incidentLayer;
        }
        
        // Add widgets to the map
        function addMapWidgets(view, incidentLayer) {
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
                expanded: false // Start collapsed
            });
            
            // Add LayerList to UI (position it under the home button)
            view.ui.add(layerListExpand, {
                position: "top-left",
                index: 1
            });
            
            // Add incident count display with dynamic updates (must be before TimeSlider to register updateIncidentCount function)
            addIncidentCount(view, incidentLayer);

            // Add TimeSlider widget for temporal navigation
            addTimeSlider(view, incidentLayer);

            // Add date filter buttons for quick filtering
            addDateFilterButtons(incidentLayer);

            // Create Legend widget
            const legend = new Legend({
                view: view,
                style: "card",  // Modern card style
                respectLayerVisibility: true,  // Only show legend for visible layers
                basemapLegendVisible: false    // Exclude basemap from legend
            });

            // Wrap Legend in Expand widget for collapsibility
            const legendExpand = new Expand({
                view: view,
                content: legend,
                expandIconClass: "esri-icon-legend",
                expandTooltip: "Legend",
                expanded: true  // Start expanded
            });

            // Add Legend to UI in top-left corner, under home button
            view.ui.add(legendExpand, {
                position: "top-left",
                index: 1  // Position below home button (index 0)
            });

            // Setup event handler for layer actions
            setupLayerActionsHandler(layerList, view);
        }

        // Add TimeSlider widget for temporal filtering
        function addTimeSlider(view, incidentLayer) {
            // Create TimeSlider widget after incident layer is loaded
            incidentLayer.when(() => {
                const fullExtent = incidentLayer.timeInfo.fullTimeExtent;
                
                // Set initial time window to show last 30 days
                const endDate = fullExtent.end;
                const startDate = new Date(endDate.getTime() - (30 * 24 * 60 * 60 * 1000)); // 30 days ago
                
                const initialTimeExtent = {
                    start: startDate > fullExtent.start ? startDate : fullExtent.start,
                    end: endDate
                };
                
                timeSlider = new TimeSlider({
                    container: "timeSlider",  // Use custom HTML container for centered positioning
                    view: view,
                    mode: "time-window",
                    fullTimeExtent: fullExtent,
                    timeExtent: initialTimeExtent,
                    stops: {
                        interval: {
                            value: 1,
                            unit: "days"
                        }
                    },
                    playRate: 1500,
                    loop: false
                });
                
                // Apply the initial time extent to the view to filter the layer
                view.timeExtent = initialTimeExtent;
                
                // Note: No view.ui.add() needed - container is in HTML
            });
        }

        // Add incident count display with dynamic updates
        function addIncidentCount(view, incidentLayer) {
            const countContainer = document.createElement("div");
            countContainer.className = "incident-count";
            countContainer.id = "incident-count";
            countContainer.innerHTML = '<span class="count-label">Showing:</span> <span class="count-number" id="count-number">Loading...</span>';

            const header = document.querySelector(".header");
            if (header) {
                header.appendChild(countContainer);
            }

            // Variables for debouncing
            let updateTimeout = null;
            let isUpdating = false;

            // Function to update count based on current filters and view
            function updateIncidentCount() {
                if (isUpdating) return;
                
                isUpdating = true;
                
                // Query features that are currently visible based on all active filters
                const query = incidentLayer.createQuery();
                query.where = incidentLayer.definitionExpression || "1=1";
                
                // Apply time extent if set
                if (view.timeExtent) {
                    query.timeExtent = view.timeExtent;
                }
                
                incidentLayer.queryFeatureCount(query).then(count => {
                    const countElement = document.getElementById("count-number");
                    if (countElement) {
                        countElement.textContent = `${count} incident${count !== 1 ? 's' : ''}`;
                    }
                    isUpdating = false;
                }).catch(error => {
                    console.error("Error querying feature count:", error);
                    isUpdating = false;
                });
            }

            // Debounced update function
            function debouncedUpdate() {
                if (updateTimeout) {
                    clearTimeout(updateTimeout);
                }
                updateTimeout = setTimeout(updateIncidentCount, 300);
            }

            // Make update function available globally for manual calls
            window.updateIncidentCount = debouncedUpdate;

            // Watch for timeExtent changes directly (simpler, more reliable)
            reactiveUtils.watch(
                () => view.timeExtent,
                (newTimeExtent) => {
                    if (newTimeExtent) {
                        debouncedUpdate();
                    }
                }
            );

            // Also watch for definitionExpression changes
            reactiveUtils.watch(
                () => incidentLayer.definitionExpression,
                () => {
                    debouncedUpdate();
                }
            );

            // Set up initial count update after layer view is available
            view.whenLayerView(incidentLayer).then(() => {
                // Give it a moment for everything to settle, then update
                setTimeout(() => {
                    updateIncidentCount();
                }, 500);
            });
        }

        // Add date filter buttons for quick filtering
        function addDateFilterButtons(incidentLayer) {
            // Track whether quick filter is enabled
            let quickFilterEnabled = false;

            // Apply "All Time" filter by default when layer loads
            incidentLayer.when(() => {
                incidentLayer.definitionExpression = null; // Clear any filters to show all data
            });

            // Create filter button container
            const filterContainer = document.createElement("div");
            filterContainer.className = "date-filter-buttons";

            const filterLabel = document.createElement("div");
            filterLabel.className = "filter-label";
            filterLabel.textContent = "Quick Filter:";
            filterContainer.appendChild(filterLabel);

            // Define filter options
            const filters = [
                { label: "Current Incidents", type: "current", id: "filter-current" },
                { label: "Last 24 Hours", type: "hours", hours: 24, id: "filter-24h" },
                { label: "Last 7 Days", type: "hours", hours: 168, id: "filter-7d" },
                { label: "Last 30 Days", type: "hours", hours: 720, id: "filter-30d" },
                { label: "All Time", type: "all", hours: null, id: "filter-all" }
            ];

            // Create filter buttons (initially appear disabled but are clickable)
            filters.forEach((filterOption, index) => {
                const button = document.createElement("calcite-button");
                button.id = filterOption.id;
                button.textContent = filterOption.label;
                button.appearance = "outline";
                button.scale = "s";

                button.addEventListener("click", () => {
                    // Check if this button is already active
                    const wasActive = button.appearance === "solid";
                    
                    // If clicking the active button, disable the feature
                    if (wasActive) {
                        quickFilterEnabled = false;
                        button.appearance = "outline";
                        
                        // Clear definition expression
                        incidentLayer.definitionExpression = null;
                        
                        // Reset time slider to full extent
                        if (timeSlider && timeSlider.fullTimeExtent) {
                            view.timeExtent = timeSlider.fullTimeExtent;
                        }

                        // Update incident count
                        if (window.updateIncidentCount) {
                            window.updateIncidentCount();
                        }
                        return;
                    }

                    // Enable the feature and activate this button
                    quickFilterEnabled = true;
                    
                    // Update all buttons
                    document.querySelectorAll(".date-filter-buttons calcite-button").forEach(btn => {
                        btn.appearance = "outline";
                    });
                    button.appearance = "solid";

                    // Apply filter based on type
                    if (filterOption.type === "current") {
                        // Show only current incidents (not fully contained)
                        incidentLayer.definitionExpression = "PercentContained < 100";
                        // Reset time filter to show all time for current incidents
                        if (timeSlider && timeSlider.fullTimeExtent) {
                            view.timeExtent = timeSlider.fullTimeExtent;
                        }
                    } else if (filterOption.type === "all") {
                        // Show all features - clear definition expression
                        incidentLayer.definitionExpression = null;
                        // Reset time slider to full extent
                        if (timeSlider && timeSlider.fullTimeExtent) {
                            view.timeExtent = timeSlider.fullTimeExtent;
                        }
                    } else if (filterOption.type === "hours") {
                        // Clear any definition expression for time-based filtering
                        incidentLayer.definitionExpression = null;
                        
                        // Calculate time extent for time-based filter
                        const now = new Date();
                        const cutoffDate = new Date(now.getTime() - (filterOption.hours * 60 * 60 * 1000));
                        
                        // Update the view's timeExtent to filter the layer
                        if (timeSlider && timeSlider.fullTimeExtent) {
                            const timeExtent = {
                                start: cutoffDate,
                                end: timeSlider.fullTimeExtent.end
                            };
                            view.timeExtent = timeExtent;
                            
                            // Also update the TimeSlider's values to reflect the filter
                            timeSlider.timeExtent = timeExtent;
                        }
                    }

                    // Update incident count after filter is applied
                    if (window.updateIncidentCount) {
                        window.updateIncidentCount();
                    }
                });

                filterContainer.appendChild(button);
            });

            // Add filter container to the header
            const header = document.querySelector(".header");
            if (header) {
                header.appendChild(filterContainer);
            } else {
                document.body.appendChild(filterContainer);
            }
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