require([
    "esri/Map",
    "esri/views/MapView",
    "esri/layers/FeatureLayer",
    "esri/widgets/Legend",
    "esri/widgets/Expand",
    "esri/widgets/HistogramRangeSlider",
    "esri/core/reactiveUtils",
    "esri/core/promiseUtils",
    "esri/core/Collection",
    "esri/smartMapping/statistics/histogram"
], function(
    Map, MapView, FeatureLayer, Legend, Expand, HistogramRangeSlider, reactiveUtils, 
    promiseUtils, Collection, histogram
) {
    
    // Status update function
    function updateStatus(message) {
        document.getElementById("status").textContent = message;
    }
    
    // Create the map
    const map = new Map({
        basemap: "osm"
    });
    
    // Create the view
    const view = new MapView({
        container: "viewDiv",
        map: map,
        center: [-98.5, 39.5],
        zoom: 4,
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
    
    // --- Add ESRI Legend in Expand widget on left ---
    const legend = new Legend({
        view: view
    });
    const legendExpand = new Expand({
        view: view,
        content: legend,
        expanded: false,
        group: "top-left"
    });
    view.ui.add(legendExpand, "top-left");
    
    // Create the power plants layer
    const powerPlantsLayer = new FeatureLayer({
        url: "https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/Power_Plants_in_the_US/FeatureServer/0",
        outFields: ["*"],
        title: "Power Plants",
        popupTemplate: {
            title: "{Plant_Name}",
            content: function(feature) {
                // Calculate homes powered based on capacity
                const capacity = feature.graphic.attributes.Total_MW;
                const homesPerMW = 168; // Based on SEIA national average
                const homesPowered = Math.round(capacity * homesPerMW).toLocaleString();
                
                // Create content elements
                const contentElement = document.createElement("div");
                
                // Create table for plant details
                const table = document.createElement("table");
                table.style.width = "100%";
                table.style.borderCollapse = "collapse";
                
                // Add rows for each field
                const fields = [
                    { name: "PrimSource", label: "Primary Fuel Source" },
                    { name: "Plant_Code", label: "Plant ID Number" },
                    { name: "Utility_Na", label: "Utility Name" },
                    { name: "sector_nam", label: "Sector" },
                    { name: "Street_Add", label: "Street Address" },
                    { name: "City", label: "City" },
                    { name: "County", label: "County" },
                    { name: "State", label: "State" },
                    { name: "Zip", label: "Zip Code" },
                    { name: "source_des", label: "Energy Sources" },
                    { name: "tech_desc", label: "Technology" },
                    { name: "Install_MW", label: "Installed Capacity (MW)", description: "Theoretical maximum under ideal conditions" },
                    { name: "Total_MW", label: "Maximum Output (MW)", description: "Actual deliverable capacity to the grid" }
                ];
                
                fields.forEach(field => {
                    const row = table.insertRow();
                    
                    const cellLabel = row.insertCell();
                    cellLabel.innerHTML = field.label + (field.description ? `<br><span style="font-size: 0.8em; color: #666; font-weight: normal;">${field.description}</span>` : '');
                    cellLabel.style.padding = "4px 8px";
                    cellLabel.style.backgroundColor = "#f5f5f5";
                    cellLabel.style.fontWeight = "bold";
                    cellLabel.style.width = "40%";
                    
                    const cellValue = row.insertCell();
                    let value = feature.graphic.attributes[field.name];
                    
                    // Format numeric values
                    if (field.name.includes("MW") && !isNaN(value)) {
                        value = Number(value).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        });
                    }
                    
                    cellValue.textContent = value || "N/A";
                    cellValue.style.padding = "4px 8px";
                });
                
                contentElement.appendChild(table);
                
                // Add homes powered information
                const homesPoweredDiv = document.createElement("div");
                homesPoweredDiv.style.margin = "15px 0";
                homesPoweredDiv.style.padding = "10px";
                homesPoweredDiv.style.backgroundColor = "#f0f8ff";
                homesPoweredDiv.style.borderRadius = "4px";
                homesPoweredDiv.style.border = "1px solid #d0e6ff";
                
                const homesPoweredText = document.createElement("p");
                homesPoweredText.innerHTML = `This power plant can power approximately <b>${homesPowered}</b> homes based on its maximum output capacity (${capacity} MW).<br><span style="font-size: 0.85em; color: #666;">*Calculation uses actual grid-deliverable capacity, not theoretical installed capacity</span>`;
                homesPoweredText.style.margin = "0";
                
                homesPoweredDiv.appendChild(homesPoweredText);
                contentElement.appendChild(homesPoweredDiv);
                
                // Add source information
                const sourceDiv = document.createElement("div");
                sourceDiv.style.fontSize = "0.85em";
                sourceDiv.style.color = "#666";
                sourceDiv.style.marginTop = "10px";
                sourceDiv.textContent = `Source: ${feature.graphic.attributes.Source || "N/A"}, Period: ${feature.graphic.attributes.Period || "N/A"}`;
                contentElement.appendChild(sourceDiv);
                
                return contentElement;
            }
        }
    });
    
    // Add the layer to the map
    map.add(powerPlantsLayer);
    
    // Variables for state charts
    let stateSelect = document.getElementById("stateSelect");
    let plantCountChart = null;
    let capacityChart = null;
    let valueToColor = {}; // Global color mapping
    let states = [];
    
    // Variables for filtering
    let layerView = null;
    let fuelTypeFilter = document.getElementById("fuelTypeFilter");
    let mwSlider = null;
    let currentFilters = {
        fuelType: "",
        mwRange: null
    };
    
    // --- Colorblind-friendly palette (Krzywinski's 8-color palette) ---
    const colorblindPalette = [
        '#E69F00', // orange
        '#56B4E9', // sky blue
        '#009E73', // bluish green
        '#F0E442', // yellow
        '#0072B2', // blue
        '#D55E00', // vermillion
        '#CC79A7', // reddish purple
        '#000000'  // black
    ];

    // --- National ranking data ---
    let stateRanking = [];
    let stateMWTotals = {};

    // Query total MW by state on load
    function queryNationalTotals() {
        const query = powerPlantsLayer.createQuery();
        query.outStatistics = [{
            statisticType: "sum",
            onStatisticField: "Total_MW",
            outStatisticFieldName: "total_mw"
        }];
        query.groupByFieldsForStatistics = ["State"];
        query.orderByFields = ["total_mw DESC"];
        query.returnGeometry = false;
        return powerPlantsLayer.queryFeatures(query).then(function(result) {
            stateRanking = result.features
                .map(f => ({
                    state: f.attributes.State,
                    total_mw: f.attributes.total_mw
                }))
                .sort((a, b) => b.total_mw - a.total_mw);
            stateMWTotals = {};
            stateRanking.forEach((item, idx) => {
                stateMWTotals[item.state] = {
                    total_mw: item.total_mw,
                    rank: idx + 1
                };
            });
        });
    }
    
    // Function to initialize data source information
    function initializeDataSourceInfo() {
        // Query total count of power plants
        const countQuery = powerPlantsLayer.createQuery();
        countQuery.where = "1=1";
        countQuery.returnGeometry = false;
        
        powerPlantsLayer.queryFeatureCount(countQuery).then(function(count) {
            document.getElementById("plantCount").textContent = `This dataset contains ${count.toLocaleString()} power plants in the United States`;
        }).catch(function(error) {
            console.error("Error getting plant count:", error);
            document.getElementById("plantCount").textContent = "Power plant count unavailable";
        });
        
        // Query for fuel type diversity
        const fuelQuery = powerPlantsLayer.createQuery();
        fuelQuery.where = "PrimSource IS NOT NULL";
        fuelQuery.outFields = ["PrimSource"];
        fuelQuery.returnDistinctValues = true;
        fuelQuery.returnGeometry = false;
        
        powerPlantsLayer.queryFeatures(fuelQuery).then(function(result) {
            const fuelTypes = result.features
                .map(feature => feature.attributes.PrimSource)
                .filter(fuel => fuel && fuel.trim() !== "");
            
            // Query for capacity statistics
            const statsQuery = powerPlantsLayer.createQuery();
            statsQuery.where = "Total_MW > 0";
            statsQuery.outStatistics = [
                {
                    statisticType: "sum",
                    onStatisticField: "Total_MW",
                    outStatisticFieldName: "total_capacity"
                },
                {
                    statisticType: "avg",
                    onStatisticField: "Total_MW", 
                    outStatisticFieldName: "avg_capacity"
                },
                {
                    statisticType: "max",
                    onStatisticField: "Total_MW",
                    outStatisticFieldName: "max_capacity"
                }
            ];
            statsQuery.returnGeometry = false;
            
            powerPlantsLayer.queryFeatures(statsQuery).then(function(statsResult) {
                if (statsResult.features.length > 0) {
                    const stats = statsResult.features[0].attributes;
                    const totalCapacity = stats.total_capacity;
                    const avgCapacity = stats.avg_capacity;
                    const maxCapacity = stats.max_capacity;
                    
                    // Calculate homes that could be powered nationally
                    const homesPerMW = 168;
                    const totalHomes = Math.round(totalCapacity * homesPerMW);
                    
                    const dataSourceDetails = document.getElementById("dataSourceDetails");
                    dataSourceDetails.innerHTML = `
                        <ul style="margin: 5px 0; padding-left: 20px; font-size: 0.85em;">
                            <li><strong>${fuelTypes.length}</strong> different fuel types</li>
                            <li><strong>${totalCapacity.toLocaleString(undefined, {maximumFractionDigits: 0})}</strong> MW total capacity</li>
                            <li>Approximately <strong>${totalHomes.toLocaleString()}</strong> homes could be powered nationally (according to SEIA)</li>
                        </ul>
                    `;
                }
            }).catch(function(error) {
                console.error("Error getting capacity statistics:", error);
                document.getElementById("dataSourceDetails").innerHTML = `
                    <p><strong>${fuelTypes.length}</strong> fuel types represented in dataset.</p>
                `;
            });
        }).catch(function(error) {
            console.error("Error querying data source info:", error);
            document.getElementById("dataSourceDetails").innerHTML = 
                "<p>Data source information temporarily unavailable.</p>";
        });
    }
    
    // Function to apply filters
    function applyFilters() {
        if (!layerView) return;
        
        let whereClause = "1=1";
        
        // Apply fuel type filter
        if (currentFilters.fuelType) {
            whereClause += ` AND PrimSource = '${currentFilters.fuelType}'`;
        }
        
        // Apply MW range filter
        if (currentFilters.mwRange) {
            whereClause += ` AND Total_MW >= ${currentFilters.mwRange[0]} AND Total_MW <= ${currentFilters.mwRange[1]}`;
        }
        
        layerView.filter = {
            where: whereClause
        };
    }
    
    // Function to clear filters
    function clearFilters() {
        currentFilters.fuelType = "";
        currentFilters.mwRange = null;
        
        fuelTypeFilter.value = "";
        if (mwSlider) {
            mwSlider.values = [mwSlider.min, mwSlider.max];
        }
        
        if (layerView) {
            layerView.filter = null;
        }
        
        updateSliderValues();
    }
    
    // Function to update slider value display
    function updateSliderValues() {
        if (mwSlider) {
            document.getElementById("minMW").textContent = Math.round(mwSlider.values[0]);
            document.getElementById("maxMW").textContent = Math.round(mwSlider.values[1]);
        }
    }
    
    // Function to initialize filter controls
    function initializeFilterControls() {
        // Initialize fuel type dropdown
        const fuelQuery = powerPlantsLayer.createQuery();
        fuelQuery.where = "PrimSource IS NOT NULL";
        fuelQuery.outFields = ["PrimSource"];
        fuelQuery.returnDistinctValues = true;
        fuelQuery.returnGeometry = false;
        
        powerPlantsLayer.queryFeatures(fuelQuery).then(function(result) {
            const fuelTypes = result.features
                .map(feature => feature.attributes.PrimSource)
                .filter(fuel => fuel && fuel.trim() !== "")
                .sort();
            
            fuelTypes.forEach(fuelType => {
                const option = document.createElement("option");
                option.value = fuelType;
                option.textContent = fuelType;
                fuelTypeFilter.appendChild(option);
            });
        });
        
        // Initialize MW slider
        histogram({
            layer: powerPlantsLayer,
            field: "Total_MW",
            numBins: 50
        }).then(function(histogramResult) {
            const min = histogramResult.minValue;
            const max = histogramResult.maxValue;
            
            mwSlider = new HistogramRangeSlider({
                bins: histogramResult.bins,
                min: min,
                max: max,
                values: [min, max],
                excludedBarColor: "#524e4e",
                rangeType: "between",
                container: document.getElementById("mwSlider")
            });
            
            mwSlider.on(["thumb-change", "thumb-drag", "segment-drag"], function(event) {
                currentFilters.mwRange = [mwSlider.values[0], mwSlider.values[1]];
                updateSliderValues();
                applyFilters();
            });
            
            updateSliderValues();
        });
        
        // Add event listeners
        fuelTypeFilter.addEventListener("change", function() {
            currentFilters.fuelType = this.value;
            applyFilters();
        });
        
        document.getElementById("clearFilters").addEventListener("click", clearFilters);
    }
    
    // Wait for the layer to load
    powerPlantsLayer.when(function() {
        updateStatus("Setting up clustering...");
        
        // Query for unique values of PrimSource field
        const query = powerPlantsLayer.createQuery();
        query.where = "1=1";
        query.outFields = ["PrimSource"];
        query.returnDistinctValues = true;
        query.returnGeometry = false;
        
        powerPlantsLayer.queryFeatures(query).then(function(result) {
            console.log("Query result:", result);
            
            // Extract unique values
            const uniqueValues = result.features
                .map(feature => feature.attributes.PrimSource)
                .filter(value => value !== null && value !== "");
            
            console.log("Unique PrimSource values:", uniqueValues);
            
            // Create a mapping of values to colors
            uniqueValues.forEach(value => {
                let color = "#888888"; // Default gray
                
                if (typeof value === 'string') {
                    const lowerValue = value.toLowerCase();
                    if (lowerValue.includes("coal")) color = "#8B4513";
                    else if (lowerValue.includes("gas")) color = "#FF6B35";
                    else if (lowerValue.includes("petroleum")) color = "#A52A2A";
                    else if (lowerValue.includes("nuclear")) color = "#FFD700";
                    else if (lowerValue.includes("hydro")) color = "#4169E1";
                    else if (lowerValue.includes("wind")) color = "#32CD32";
                    else if (lowerValue.includes("solar")) color = "#FFA500";
                    else if (lowerValue.includes("biomass")) color = "#006400";
                    else if (lowerValue.includes("geothermal")) color = "#FF4500";
                    else if (lowerValue.includes("pump")) color = "#9370DB";
                    else if (lowerValue.includes("batter")) color = "#20B2AA";
                }
                
                valueToColor[value] = color;
            });
            
            console.log("Value to color mapping:", valueToColor);
            
            // Create renderer for individual features
            const uniqueValueInfos = uniqueValues.map(value => ({
                value: value,
                symbol: {
                    type: "simple-marker",
                    style: "circle",
                    color: valueToColor[value] || "#888888",
                    size: "8px",
                    outline: {
                        color: "white",
                        width: 0.5
                    }
                },
                label: value
            }));
            
            // Set renderer for the layer
            powerPlantsLayer.renderer = {
                type: "unique-value",
                field: "PrimSource",
                defaultSymbol: {
                    type: "simple-marker",
                    style: "circle",
                    color: "#888888",
                    size: "8px",
                    outline: {
                        color: "white",
                        width: 0.5
                    }
                },
                uniqueValueInfos: uniqueValueInfos
            };
            
            // Configure clustering
            powerPlantsLayer.featureReduction = {
                type: "cluster",
                clusterRadius: "100px",
                // Define statistics to calculate for each cluster
                onStatisticDefinitions: [
                    {
                        onStatisticField: "PrimSource",
                        outStatisticFieldName: "predominant_fuel",
                        statisticType: "mode"
                    },
                    {
                        onStatisticField: "Total_MW",
                        outStatisticFieldName: "total_capacity",
                        statisticType: "sum"
                    }
                ],
                // Define renderer for clusters
                renderer: {
                    type: "unique-value",
                    field: "PrimSource",
                    defaultSymbol: {
                        type: "simple-marker",
                        style: "circle",
                        color: "#888888",
                        size: "24px",
                        outline: {
                            color: "white",
                            width: 1
                        }
                    },
                    uniqueValueInfos: uniqueValues.map(value => ({
                        value: value,
                        symbol: {
                            type: "simple-marker",
                            style: "circle",
                            color: valueToColor[value] || "#888888",
                            size: "24px",
                            outline: {
                                color: "white",
                                width: 1
                            }
                        },
                        label: value
                    }))
                },
                // Define popup template for clusters
                popupTemplate: {
                    title: "Cluster of Power Plants",
                    content: function(feature) {
                        const clusterCount = feature.graphic.attributes.cluster_count;
                        const predominantFuel = feature.graphic.attributes.PrimSource;
                        const totalCapacity = feature.graphic.attributes.Total_MW;
                        const homesPerMW = 168; // Based on SEIA national average
                        
                        console.log("Cluster attributes:", feature.graphic.attributes); // Debug log
                        
                        const contentElement = document.createElement("div");
                        
                        const countInfo = document.createElement("p");
                        countInfo.innerHTML = `This cluster contains <b>${clusterCount}</b> power plants.`;
                        contentElement.appendChild(countInfo);
                        
                        const fuelInfo = document.createElement("p");
                        fuelInfo.innerHTML = `Predominant fuel type: <b>${predominantFuel || 'Mixed'}</b>`;
                        contentElement.appendChild(fuelInfo);
                        
                        const capacityInfo = document.createElement("p");
                        if (totalCapacity && totalCapacity > 0) {
                            const homesPowered = Math.round(totalCapacity * homesPerMW).toLocaleString();
                            capacityInfo.innerHTML = `Total capacity: <b>${totalCapacity.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                            })} MW</b>, which can power approximately <b>${homesPowered}</b> homes. Based on a national average of 168 homes per MW (<a href="https://www.seia.org/initiatives/whats-megawatt" target="_blank"> according to SEIA</a>).`;
                        } else {
                            capacityInfo.innerHTML = `Total capacity: <b>N/A</b>`;
                        }
                        contentElement.appendChild(capacityInfo);
                        
                        return contentElement;
                    }
                },
                // Define labels for clusters
                labelingInfo: [
                    {
                        deconflictionStrategy: "none",
                        labelExpressionInfo: {
                            expression: "Text($feature.cluster_count, '#,###')"
                        },
                        symbol: {
                            type: "text",
                            color: "white",
                            font: {
                                family: "Noto Sans",
                                size: "12px"
                            },
                            haloColor: "black",
                            haloSize: "1px"
                        },
                        labelPlacement: "center-center"
                    }
                ]
            };
            
            // Initialize state dropdown and charts
            initializeStateAnalysis();
            
            // Initialize data source information
            initializeDataSourceInfo();
            
            // Get the layer view and initialize filter controls
            view.whenLayerView(powerPlantsLayer).then(function(lv) {
                layerView = lv;
                initializeFilterControls();
                
                // --- Improved cluster count logic with better performance ---
                let clusterCountTimeout = null;
                let isUpdating = false;
                
                // Enhanced cluster count estimation function
                function estimateClusterCount(featureCount, zoom, extent) {
                    if (featureCount === 0) return 0;
                    
                    // More sophisticated estimation based on zoom and extent
                    const extentArea = extent.width * extent.height;
                    const clusterRadius = 100; // pixels
                    const mapWidth = view.width;
                    const mapHeight = view.height;
                    
                    // Calculate approximate clusters based on map area and cluster radius
                    const clustersPerRow = Math.floor(mapWidth / clusterRadius);
                    const clustersPerColumn = Math.floor(mapHeight / clusterRadius);
                    const maxPossibleClusters = clustersPerRow * clustersPerColumn;
                    
                    // Scale factor based on zoom level (higher zoom = more clusters)
                    const zoomFactor = Math.pow(1.5, Math.max(0, zoom - 4));
                    
                    // Feature density factor
                    const densityFactor = Math.min(1, featureCount / 1000);
                    
                    // Calculate estimated clusters
                    let estimatedClusters = Math.ceil(featureCount / (Math.pow(2, Math.max(0, 12 - zoom)) * densityFactor));
                    
                    // Cap at maximum possible clusters on screen
                    estimatedClusters = Math.min(estimatedClusters, maxPossibleClusters);
                    
                    return Math.max(1, estimatedClusters);
                }
                
                // Optimized cluster count update function
                function updateClusterCount() {
                    if (isUpdating || !layerView || layerView.updating) {
                        return;
                    }
                    
                    isUpdating = true;
                    
                    // Use LayerView's queryFeatureCount for better performance
                    const query = layerView.createQuery();
                    query.geometry = view.extent;
                    
                    layerView.queryFeatureCount(query).then(function(count) {
                        const estimatedClusters = estimateClusterCount(count, view.zoom, view.extent);
                        document.getElementById("clusterCount").textContent = estimatedClusters;
                        isUpdating = false;
                    }).catch(function(error) {
                        console.warn("Could not update cluster count:", error);
                        isUpdating = false;
                    });
                }
                
                // Immediate update function for quick feedback
                function immediateUpdate() {
                    if (clusterCountTimeout) {
                        clearTimeout(clusterCountTimeout);
                    }
                    clusterCountTimeout = setTimeout(updateClusterCount, 100);
                }
                
                // Debounced update function for final accuracy
                function debouncedUpdate() {
                    if (clusterCountTimeout) {
                        clearTimeout(clusterCountTimeout);
                    }
                    clusterCountTimeout = setTimeout(updateClusterCount, 500);
                }
                
                // Watch for multiple properties efficiently using array format
                const clusterCountWatchHandle = reactiveUtils.watch(
                    () => [view.stationary, view.extent, view.zoom, layerView.updating],
                    ([stationary, extent, zoom, layerViewUpdating]) => {
                        if (!layerViewUpdating) {
                            if (stationary) {
                                // When stationary, do a final accurate update
                                debouncedUpdate();
                            } else {
                                // While moving, give quick feedback
                                immediateUpdate();
                            }
                        }
                    },
                    {
                        initial: false // Don't fire immediately
                    }
                );
                
                // Watch for layer view updates separately for immediate response
                const layerViewWatchHandle = reactiveUtils.watch(
                    () => layerView.updating,
                    (updating) => {
                        if (!updating && view.stationary) {
                            debouncedUpdate();
                        }
                    }
                );
                
                // Initial cluster count update after everything is ready
                reactiveUtils.whenOnce(
                    () => !layerView.updating && view.stationary,
                    () => {
                        setTimeout(updateClusterCount, 200);
                    }
                );
                
                // Store handles for cleanup if needed
                view._clusterCountHandles = [clusterCountWatchHandle, layerViewWatchHandle];
            });
            
            queryNationalTotals().then(() => {
                // Continue with the rest of the setup
                updateStatus("Map ready. Zoom in/out to see clustering behavior.");
            });
        }).catch(function(error) {
            console.error("Error querying features:", error);
            updateStatus("Error: " + error.message);
        });
    }).catch(function(error) {
        console.error("Error loading layer:", error);
        updateStatus("Error: " + error.message);
    });
    
    // Function to initialize state analysis
    function initializeStateAnalysis() {
        // Query for unique state values
        const stateQuery = powerPlantsLayer.createQuery();
        stateQuery.where = "State IS NOT NULL";
        stateQuery.outFields = ["State"];
        stateQuery.returnDistinctValues = true;
        stateQuery.returnGeometry = false;
        
        powerPlantsLayer.queryFeatures(stateQuery).then(function(result) {
            // Extract and sort states
            states = result.features
                .map(feature => feature.attributes.State)
                .filter(state => state && state.trim() !== "")
                .sort();
            
            // Populate state dropdown
            stateSelect.innerHTML = "";
            // Add national option
            const nationalOption = document.createElement("option");
            nationalOption.value = "__NATIONAL__";
            nationalOption.textContent = "All States (National)";
            stateSelect.appendChild(nationalOption);

            const defaultOption = document.createElement("option");
            defaultOption.value = "";
            defaultOption.textContent = "Select a state";
            stateSelect.appendChild(defaultOption);

            states.forEach(state => {
                const option = document.createElement("option");
                option.value = state;
                option.textContent = state;
                stateSelect.appendChild(option);
            });
            
            // Add event listener to state dropdown
            stateSelect.addEventListener("change", function() {
                const selectedState = this.value;
                if (selectedState) {
                    updateStateCharts(selectedState);
                } else {
                    // Clear charts if no state is selected
                    clearCharts();
                    document.getElementById("stateSummary").innerHTML = "";
                }
            });
            
            // Initialize with national view
            stateSelect.value = "__NATIONAL__";
            updateStateCharts("__NATIONAL__");
        }).catch(function(error) {
            console.error("Error querying states:", error);
            updateStatus("Error loading states: " + error.message);
        });
    }
    
    // Function to clear charts
    function clearCharts() {
        const plantCountChartContainer = document.getElementById("plantCountChart");
        const capacityChartContainer = document.getElementById("capacityChart");
        
        plantCountChartContainer.innerHTML = "";
        capacityChartContainer.innerHTML = "";
    }
    
    // Function to update state charts
    function updateStateCharts(state) {
        // If 'All States (National)' is selected, aggregate all states
        let isNational = (state === '__NATIONAL__');
        const query = powerPlantsLayer.createQuery();
        if (!isNational) {
            query.where = `State = '${state}'`;
        } else {
            query.where = '1=1';
        }
        query.outFields = ["PrimSource", "Total_MW"];
        query.returnGeometry = false;

        powerPlantsLayer.queryFeatures(query).then(function(result) {
            if (result.features.length === 0) {
                updateStatus(`No power plants found${isNational ? '' : ' in ' + state}`);
                clearCharts();
                document.getElementById("stateSummary").innerHTML = "";
                return;
            }

            // Process data for charts
            const fuelTypes = {};
            const capacityByFuel = {};
            let totalCapacity = 0;

            result.features.forEach(feature => {
                const fuelType = feature.attributes.PrimSource || "Unknown";
                const capacity = feature.attributes.Total_MW || 0;
                fuelTypes[fuelType] = (fuelTypes[fuelType] || 0) + 1;
                capacityByFuel[fuelType] = (capacityByFuel[fuelType] || 0) + capacity;
                totalCapacity += capacity;
            });

            // Create data arrays for charts
            const fuelLabels = Object.keys(fuelTypes);
            const plantCounts = fuelLabels.map(fuel => fuelTypes[fuel]);
            const capacities = fuelLabels.map(fuel => capacityByFuel[fuel]);

            // Assign colorblind-friendly palette to fuel types
            const colors = fuelLabels.map((fuel, i) => colorblindPalette[i % colorblindPalette.length]);

            // --- State/National Summary ---
            const sortedFuelTypes = fuelLabels
                .map(fuel => ({ 
                    fuel, 
                    count: fuelTypes[fuel],
                    capacity: capacityByFuel[fuel],
                    percentage: (capacityByFuel[fuel] / totalCapacity) * 100
                }))
                .sort((a, b) => b.capacity - a.capacity);
            
            const top5 = sortedFuelTypes.slice(0, 5);
            let rank = 'N/A';
            let totalMWNational = totalCapacity;
            let summaryTitle = state;
            if (isNational) {
                summaryTitle = 'The US';
            } else if (stateMWTotals[state]) {
                rank = stateMWTotals[state].rank;
                totalMWNational = stateMWTotals[state].total_mw;
            }
            
            const top5Html = top5.map(item => {
                const idx = fuelLabels.indexOf(item.fuel);
                const color = colors[idx] || '#888';
                return `<span style="color:${color};font-weight:bold;">${item.fuel} (${item.percentage.toFixed(1)}%)</span>`;
            }).join(', ');
            
            const summaryText =
                `<p><strong>${summaryTitle}</strong>'s top five power plant types are: ${top5Html}.<br>` +
                `Its total MW capacity is <strong>${totalMWNational.toLocaleString(undefined, {maximumFractionDigits: 2})} MW</strong>${isNational ? '' : `, ranking <strong>${rank}</strong> nationally.`}</p>`;
            document.getElementById("stateSummary").innerHTML = summaryText;

            // --- Charts ---
            createPlantCountChart(fuelLabels, plantCounts, colors);
            createCapacityChart(fuelLabels, capacities, colors);

            updateStatus(`Showing data for ${summaryTitle}`);
        }).catch(function(error) {
            console.error("Error querying state data:", error);
            updateStatus("Error: " + error.message);
            document.getElementById("stateSummary").innerHTML = "";
        });
    }
    
    // Tooltip helpers
    function createOrGetTooltip(container) {
        let tooltip = container.querySelector('.chart-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'chart-tooltip';
            container.appendChild(tooltip);
        }
        return tooltip;
    }
    function showTooltip(tooltip, x, y, html) {
        tooltip.innerHTML = html;
        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';
        tooltip.classList.add('visible');
    }
    function hideTooltip(tooltip) {
        tooltip.classList.remove('visible');
    }
    
    // Format numbers with K for thousands
    function formatNumber(num) {
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }
    
    // --- Pie chart with hover tooltips only ---
    function createPlantCountChart(labels, data, colors) {
        const chartContainer = document.getElementById("plantCountChart");
        chartContainer.innerHTML = "";
        const tooltip = createOrGetTooltip(chartContainer);
        try {
            const canvas = document.createElement("canvas");
            canvas.width = chartContainer.clientWidth;
            canvas.height = chartContainer.clientHeight;
            chartContainer.appendChild(canvas);
            const ctx = canvas.getContext("2d");
            // Draw pie slices only (no labels)
            const total = data.reduce((sum, val) => sum + val, 0);
            let startAngle = 0;
            const slices = [];
            for (let i = 0; i < data.length; i++) {
                const sliceAngle = 2 * Math.PI * data[i] / total;
                const endAngle = startAngle + sliceAngle;
                ctx.beginPath();
                ctx.moveTo(canvas.width / 2, canvas.height / 2);
                ctx.arc(
                    canvas.width / 2, 
                    canvas.height / 2, 
                    Math.min(canvas.width, canvas.height) / 2 - 10, 
                    startAngle, 
                    endAngle
                );
                ctx.closePath();
                ctx.fillStyle = colors[i];
                ctx.fill();
                ctx.strokeStyle = "white";
                ctx.lineWidth = 2;
                ctx.stroke();
                slices.push({startAngle, endAngle, label: labels[i], value: data[i], color: colors[i]});
                startAngle = endAngle;
            }
            // Tooltip event
            canvas.addEventListener('mousemove', function(e) {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left - canvas.width / 2;
                const y = e.clientY - rect.top - canvas.height / 2;
                const angle = Math.atan2(y, x);
                let a = angle < 0 ? angle + 2 * Math.PI : angle;
                let found = false;
                let radius = Math.sqrt(x*x + y*y);
                for (let i = 0; i < slices.length; i++) {
                    if (a >= slices[i].startAngle && a < slices[i].endAngle && radius < Math.min(canvas.width, canvas.height) / 2 - 10) {
                        showTooltip(tooltip, e.offsetX + 10, e.offsetY - 10, `<strong>${slices[i].label}</strong><br>Count: ${formatNumber(slices[i].value)}`);
                        found = true;
                        break;
                    }
                }
                if (!found) hideTooltip(tooltip);
            });
            canvas.addEventListener('mouseleave', function() { hideTooltip(tooltip); });
            // Add legend below the chart
            const legendDiv = document.createElement("div");
            legendDiv.style.marginTop = "10px";
            legendDiv.style.fontSize = "12px";
            labels.forEach((label, i) => {
                const item = document.createElement("div");
                item.style.display = "flex";
                item.style.alignItems = "center";
                item.style.marginBottom = "5px";
                const colorBox = document.createElement("span");
                colorBox.style.display = "inline-block";
                colorBox.style.width = "12px";
                colorBox.style.height = "12px";
                colorBox.style.backgroundColor = colors[i];
                colorBox.style.marginRight = "5px";
                const labelText = document.createElement("span");
                labelText.textContent = `${label}: ${formatNumber(data[i])}`;
                item.appendChild(colorBox);
                item.appendChild(labelText);
                legendDiv.appendChild(item);
            });
            chartContainer.appendChild(legendDiv);
        } catch (error) {
            console.error("Error creating plant count chart:", error);
            chartContainer.textContent = "Error creating chart";
        }
    }

    function createCapacityChart(labels, data, colors) {
        const chartContainer = document.getElementById("capacityChart");
        chartContainer.innerHTML = "";
        const tooltip = createOrGetTooltip(chartContainer);
        try {
            const canvas = document.createElement("canvas");
            canvas.width = chartContainer.clientWidth;
            canvas.height = chartContainer.clientHeight;
            chartContainer.appendChild(canvas);
            const ctx = canvas.getContext("2d");
            // Draw pie slices only (no labels)
            const total = data.reduce((sum, val) => sum + val, 0);
            let startAngle = 0;
            const slices = [];
            for (let i = 0; i < data.length; i++) {
                const sliceAngle = 2 * Math.PI * data[i] / total;
                const endAngle = startAngle + sliceAngle;
                ctx.beginPath();
                ctx.moveTo(canvas.width / 2, canvas.height / 2);
                ctx.arc(
                    canvas.width / 2, 
                    canvas.height / 2, 
                    Math.min(canvas.width, canvas.height) / 2 - 10, 
                    startAngle, 
                    endAngle
                );
                ctx.closePath();
                ctx.fillStyle = colors[i];
                ctx.fill();
                ctx.strokeStyle = "white";
                ctx.lineWidth = 2;
                ctx.stroke();
                slices.push({startAngle, endAngle, label: labels[i], value: data[i], color: colors[i]});
                startAngle = endAngle;
            }
            // Tooltip event
            canvas.addEventListener('mousemove', function(e) {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left - canvas.width / 2;
                const y = e.clientY - rect.top - canvas.height / 2;
                const angle = Math.atan2(y, x);
                let a = angle < 0 ? angle + 2 * Math.PI : angle;
                let found = false;
                let radius = Math.sqrt(x*x + y*y);
                for (let i = 0; i < slices.length; i++) {
                    if (a >= slices[i].startAngle && a < slices[i].endAngle && radius < Math.min(canvas.width, canvas.height) / 2 - 10) {
                        const formattedValue = data[i] >= 1000 ? 
                            (data[i] / 1000).toFixed(1) + 'K MW' : 
                            data[i].toFixed(1) + ' MW';
                        showTooltip(tooltip, e.offsetX + 10, e.offsetY - 10, `<strong>${slices[i].label}</strong><br>Capacity: ${formattedValue}`);
                        found = true;
                        break;
                    }
                }
                if (!found) hideTooltip(tooltip);
            });
            canvas.addEventListener('mouseleave', function() { hideTooltip(tooltip); });
            // Add legend below the chart
            const legendDiv = document.createElement("div");
            legendDiv.style.marginTop = "10px";
            legendDiv.style.fontSize = "12px";
            labels.forEach((label, i) => {
                const item = document.createElement("div");
                item.style.display = "flex";
                item.style.alignItems = "center";
                item.style.marginBottom = "5px";
                const colorBox = document.createElement("span");
                colorBox.style.display = "inline-block";
                colorBox.style.width = "12px";
                colorBox.style.height = "12px";
                colorBox.style.backgroundColor = colors[i];
                colorBox.style.marginRight = "5px";
                const labelText = document.createElement("span");
                const formattedCapacity = data[i] >= 1000 ?
                    (data[i] / 1000).toFixed(1) + 'K MW' :
                    data[i].toFixed(1) + ' MW';
                labelText.textContent = `${label}: ${formattedCapacity}`;
                item.appendChild(colorBox);
                item.appendChild(labelText);
                legendDiv.appendChild(item);
            });
            chartContainer.appendChild(legendDiv);
        } catch (error) {
            console.error("Error creating capacity chart:", error);
            chartContainer.textContent = "Error creating chart";
        }
    }
    
    // Sidebar toggle functionality
    const sidebarToggle = document.getElementById("sidebarToggle");
    const sidebar = document.getElementById("sidebar");
    let sidebarVisible = true;
    
    sidebarToggle.addEventListener("click", function() {
        sidebarVisible = !sidebarVisible;
        if (sidebarVisible) {
            sidebar.classList.remove("sidebar-hidden");
            sidebarToggle.innerHTML = "☰";
            sidebarToggle.title = "Hide Sidebar";
        } else {
            sidebar.classList.add("sidebar-hidden");
            sidebarToggle.innerHTML = "☰";
            sidebarToggle.title = "Show Sidebar";
        }
        // Resize the view to ensure the map renders correctly after sidebar toggle
        setTimeout(() => {
            view.resize();
        }, 300); // Match the transition duration
    });
}); 