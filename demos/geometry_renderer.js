/**
 * Geometry Renderer
 * 
 * This module provides an elegant UI for styling point, line, and polygon geometries
 * using ESRI's rendering capabilities and Calcite components for UI controls.
 */
(function() {
  class GeometryRenderer {
    constructor(viewOrMapElement) {
      this.view = viewOrMapElement.map ? viewOrMapElement : null; // Check if it's a view
      this.mapElement = !this.view ? viewOrMapElement : null; // If not a view, it's a map element
      this.graphicsLayer = null;
      this.pointGraphic = null;
      this.lineGraphic = null;
      this.polygonGraphic = null;
      
      // Default symbols
      this.defaultSymbols = {
        point: {
          type: "simple-marker",
          color: [226, 119, 40], // Orange
          size: 8,
          outline: {
            color: [255, 255, 255], // White
            width: 1
          }
        },
        line: {
          type: "simple-line",
          color: [226, 119, 40], // Orange
          width: 2,
          style: "solid"
        },
        polygon: {
          type: "simple-fill",
          color: [227, 139, 79, 0.8], // Orange, opacity 80%
          outline: {
            color: [255, 255, 255],
            width: 1
          },
          style: "solid"
        }
      };
      
      // Initialize
      this.initRenderer();
      
      // Create UI controls after a short delay to ensure the map is loaded
      setTimeout(() => {
        this.createCalciteControls();
      }, 800);
    }
    
    /**
     * Initialize the renderer
     */
    initRenderer() {
      const self = this;
      
      // If we have a view, use it directly
      if (this.view) {
        this.initWithView();
        return;
      }
      
      // Otherwise listen for the map view ready event
      this.mapElement.addEventListener("arcgisViewReadyChange", function(event) {
        try {
          console.log("Map view ready, initializing geometry renderer");
          self.view = self.mapElement.view;
          self.initWithView();
        } catch (error) {
          console.error("Error initializing geometry renderer:", error);
        }
      });
    }
    
    /**
     * Initialize with a view instance
     */
    initWithView() {
      console.log("Initializing with view: ", this.view ? "Yes" : "No", "Map element: ", this.mapElement ? "Yes" : "No");
      
      try {
        // For arcgis-map web component
        if (this.mapElement && !this.view) {
          if (this.mapElement.view) {
            console.log("Using view from arcgis-map element");
            this.view = this.mapElement.view;
          } else {
            console.log("No view available yet, will try to find graphics layer directly");
          }
        }
        
        // If we have a view, get graphics layer using require
        if (this.view) {
          // Get reference to existing graphics layer and graphics
          require(["esri/layers/GraphicsLayer"], (GraphicsLayer) => {
            try {
              // Find existing graphics layer or create a new one
              if (this.view.map && this.view.map.layers.some(layer => layer.type === "graphics")) {
                this.graphicsLayer = this.view.map.layers.find(layer => layer.type === "graphics");
                console.log("Found existing graphics layer");
              } else if (this.view.map) {
                this.graphicsLayer = new GraphicsLayer();
                this.view.map.add(this.graphicsLayer);
                console.log("Created new graphics layer");
              } else {
                console.error("View map is not available");
              }
              
              // Find existing graphics if layer exists
              if (this.graphicsLayer) {
                this.graphicsLayer.graphics.forEach(graphic => {
                  if (!graphic.geometry) return;
                  
                  const geometry = graphic.geometry;
                  if (geometry.type === "point") {
                    this.pointGraphic = graphic;
                  } else if (geometry.type === "polyline") {
                    this.lineGraphic = graphic;
                  } else if (geometry.type === "polygon") {
                    this.polygonGraphic = graphic;
                  }
                });
                
                console.log("Found graphics - Point:", !!this.pointGraphic, 
                           "Line:", !!this.lineGraphic, 
                           "Polygon:", !!this.polygonGraphic);
              }
            } catch (error) {
              console.error("Error finding graphics layer or graphics:", error);
            }
          });
        }
      } catch (error) {
        console.error("Error in initWithView:", error);
      }
    }
    
    /**
     * Create Calcite UI components for styling controls
     */
    createCalciteControls() {
      // Create container for controls
      const controlsContainer = document.createElement('div');
      controlsContainer.id = 'geometry-styling-controls';
      controlsContainer.className = 'styling-panel';
      controlsContainer.style.position = 'absolute';
      controlsContainer.style.top = '15px';
      controlsContainer.style.left = '15px';
      controlsContainer.style.zIndex = '1000';
      controlsContainer.style.maxWidth = '300px';
      controlsContainer.style.maxHeight = '80vh';
      controlsContainer.style.overflow = 'auto';
      
      // Create UI
      controlsContainer.innerHTML = `
        <calcite-panel heading="Symbology" summary="Customize the appearance of geometries" 
                       collapsible>
          
          <!-- Point Styling -->
          <calcite-accordion>
            <calcite-accordion-item heading="Point Styling" icon="pin">
              <!-- Color picker -->
              <calcite-label>Color
                <div style="display: flex; align-items: center;">
                  <calcite-color-picker id="point-color" scale="m" value="#E27728"></calcite-color-picker>
                  <span style="margin-left: 10px; width: 100px;" id="point-color-hex">#E27728</span>
                </div>
              </calcite-label>
              
              <!-- Size -->
              <calcite-label>Size
                <calcite-slider id="point-size" min="4" max="24" value="8" step="1" snap></calcite-slider>
              </calcite-label>
              
              <!-- Opacity -->
              <calcite-label>Opacity
                <calcite-slider id="point-opacity" min="0" max="1" value="1" step="0.1"></calcite-slider>
              </calcite-label>
              
              <!-- Outline width -->
              <calcite-label>Outline Width
                <calcite-slider id="point-outline-width" min="0" max="5" value="1" step="0.5" snap></calcite-slider>
              </calcite-label>
              
              <!-- Symbol style -->
              <calcite-label>Symbol Style
                <calcite-select id="point-style">
                  <calcite-option value="circle" selected>Circle</calcite-option>
                  <calcite-option value="square">Square</calcite-option>
                  <calcite-option value="triangle">Triangle</calcite-option>
                  <calcite-option value="diamond">Diamond</calcite-option>
                  <calcite-option value="cross">Cross</calcite-option>
                  <calcite-option value="x">X</calcite-option>
                </calcite-select>
              </calcite-label>
            </calcite-accordion-item>
            
            <!-- Line Styling -->
            <calcite-accordion-item heading="Line Styling" icon="line">
              <!-- Color picker -->
              <calcite-label>Color
                <div style="display: flex; align-items: center;">
                  <calcite-color-picker id="line-color" scale="m" value="#E27728"></calcite-color-picker>
                  <span style="margin-left: 10px; width: 100px;" id="line-color-hex">#E27728</span>
                </div>
              </calcite-label>
              
              <!-- Width -->
              <calcite-label>Width
                <calcite-slider id="line-width" min="1" max="10" value="2" step="0.5" snap></calcite-slider>
              </calcite-label>
              
              <!-- Opacity -->
              <calcite-label>Opacity
                <calcite-slider id="line-opacity" min="0" max="1" value="1" step="0.1"></calcite-slider>
              </calcite-label>
              
              <!-- Line style -->
              <calcite-label>Line Style
                <calcite-select id="line-style">
                  <calcite-option value="solid" selected>Solid</calcite-option>
                  <calcite-option value="dash">Dash</calcite-option>
                  <calcite-option value="dot">Dot</calcite-option>
                  <calcite-option value="dash-dot">Dash Dot</calcite-option>
                  <calcite-option value="short-dash">Short Dash</calcite-option>
                  <calcite-option value="short-dot">Short Dot</calcite-option>
                </calcite-select>
              </calcite-label>
            </calcite-accordion-item>
            
            <!-- Polygon Styling -->
            <calcite-accordion-item heading="Polygon Styling" icon="polygon">
              <!-- Fill color picker -->
              <calcite-label>Fill Color
                <div style="display: flex; align-items: center;">
                  <calcite-color-picker id="polygon-color" scale="m" value="#E38B4F"></calcite-color-picker>
                  <span style="margin-left: 10px; width: 100px;" id="polygon-color-hex">#E38B4F</span>
                </div>
              </calcite-label>
              
              <!-- Fill opacity -->
              <calcite-label>Fill Opacity
                <calcite-slider id="polygon-opacity" min="0" max="1" value="0.8" step="0.1"></calcite-slider>
              </calcite-label>
              
              <!-- Outline width -->
              <calcite-label>Outline Width
                <calcite-slider id="polygon-outline-width" min="0" max="5" value="1" step="0.5" snap></calcite-slider>
              </calcite-label>
              
              <!-- Fill style -->
              <calcite-label>Fill Style
                <calcite-select id="polygon-style">
                  <calcite-option value="solid" selected>Solid</calcite-option>
                  <calcite-option value="backward-diagonal">Backward Diagonal</calcite-option>
                  <calcite-option value="forward-diagonal">Forward Diagonal</calcite-option>
                  <calcite-option value="cross">Cross</calcite-option>
                  <calcite-option value="diagonal-cross">Diagonal Cross</calcite-option>
                  <calcite-option value="vertical">Vertical</calcite-option>
                  <calcite-option value="horizontal">Horizontal</calcite-option>
                </calcite-select>
              </calcite-label>
            </calcite-accordion-item>
          </calcite-accordion>
          
          <!-- Reset button -->
          <calcite-button width="full" appearance="outline" id="reset-styling">
            Reset to Default
          </calcite-button>
        </calcite-panel>
      `;
      
      try {
        console.log("Appending controls - finding target container");
        let targetContainer = null;
        
        // Try to find the map container first
        const mapContainer = document.querySelector('.map-container');
        if (mapContainer) {
          console.log("Found map container, using it as target");
          targetContainer = mapContainer;
        } 
        // If we have a view with container, use that
        else if (this.view && this.view.container) {
          console.log("Using view container as target");
          targetContainer = this.view.container;
        } 
        // Last resort, add to body
        else {
          console.log("Using body as target container");
          targetContainer = document.body;
        }
        
        // Append controls to the target container
        targetContainer.appendChild(controlsContainer);
        console.log("Controls appended to", targetContainer.tagName);
        
        // Make an initial update to the legend
        setTimeout(() => {
          this.updateLegend();
        }, 200);
      } catch (error) {
        console.error("Error appending controls:", error);
        // Fallback - add to document body
        document.body.appendChild(controlsContainer);
      }
      
      // Setup event listeners
      this.setupEventListeners();
    }
    
    /**
     * Set up event listeners for UI controls
     */
    setupEventListeners() {
      // Point styling
      this.setupColorPicker('point-color', 'point-color-hex', this.updatePointSymbol.bind(this));
      this.setupSlider('point-size', this.updatePointSymbol.bind(this));
      this.setupSlider('point-opacity', this.updatePointSymbol.bind(this));
      this.setupSlider('point-outline-width', this.updatePointSymbol.bind(this));
      this.setupSelect('point-style', this.updatePointSymbol.bind(this));
      
      // Line styling
      this.setupColorPicker('line-color', 'line-color-hex', this.updateLineSymbol.bind(this));
      this.setupSlider('line-width', this.updateLineSymbol.bind(this));
      this.setupSlider('line-opacity', this.updateLineSymbol.bind(this));
      this.setupSelect('line-style', this.updateLineSymbol.bind(this));
      
      // Polygon styling
      this.setupColorPicker('polygon-color', 'polygon-color-hex', this.updatePolygonSymbol.bind(this));
      this.setupSlider('polygon-opacity', this.updatePolygonSymbol.bind(this));
      this.setupSlider('polygon-outline-width', this.updatePolygonSymbol.bind(this));
      this.setupSelect('polygon-style', this.updatePolygonSymbol.bind(this));
      
      // Reset button
      const resetButton = document.getElementById('reset-styling');
      if (resetButton) {
        resetButton.addEventListener('click', this.resetToDefaults.bind(this));
      }
    }
    
    /**
     * Setup a color picker with event listeners
     */
    setupColorPicker(id, hexId, updateCallback) {
      const picker = document.getElementById(id);
      const hexDisplay = document.getElementById(hexId);
      
      if (picker && hexDisplay) {
        picker.addEventListener('calciteColorPickerChange', (e) => {
          hexDisplay.textContent = e.target.value;
          updateCallback();
        });
      }
    }
    
    /**
     * Setup a slider with event listeners
     */
    setupSlider(id, updateCallback) {
      const slider = document.getElementById(id);
      if (slider) {
        slider.addEventListener('calciteSliderChange', updateCallback);
      }
    }
    
    /**
     * Setup a select dropdown with event listeners
     */
    setupSelect(id, updateCallback) {
      const select = document.getElementById(id);
      if (select) {
        select.addEventListener('calciteSelectChange', updateCallback);
      }
    }
    
    /**
     * Update point symbol based on current UI values
     */
    updatePointSymbol() {
      if (!this.pointGraphic) return;
      
      require(["esri/symbols/SimpleMarkerSymbol", "esri/Color"], (SimpleMarkerSymbol, Color) => {
        // Get values from UI
        const colorHex = document.getElementById('point-color').value;
        const size = parseFloat(document.getElementById('point-size').value);
        const opacity = parseFloat(document.getElementById('point-opacity').value);
        const outlineWidth = parseFloat(document.getElementById('point-outline-width').value);
        const style = document.getElementById('point-style').value;
        
        // Convert hex to RGB
        const color = new Color(colorHex);
        color.a = opacity; // Set alpha/opacity
        
        // Create new symbol
        const symbol = new SimpleMarkerSymbol({
          style: style,
          color: color,
          size: size,
          outline: {
            color: [255, 255, 255], // White
            width: outlineWidth
          }
        });
        
        // Apply to graphic
        this.pointGraphic.symbol = symbol;
        
        // Update legend
        this.updateLegend();
      });
    }
    
    /**
     * Update line symbol based on current UI values
     */
    updateLineSymbol() {
      if (!this.lineGraphic) return;
      
      require(["esri/symbols/SimpleLineSymbol", "esri/Color"], (SimpleLineSymbol, Color) => {
        // Get values from UI
        const colorHex = document.getElementById('line-color').value;
        const width = parseFloat(document.getElementById('line-width').value);
        const opacity = parseFloat(document.getElementById('line-opacity').value);
        const style = document.getElementById('line-style').value;
        
        // Convert hex to RGB
        const color = new Color(colorHex);
        color.a = opacity; // Set alpha/opacity
        
        // Create new symbol
        const symbol = new SimpleLineSymbol({
          style: style,
          color: color,
          width: width
        });
        
        // Apply to graphic
        this.lineGraphic.symbol = symbol;
        
        // Update legend
        this.updateLegend();
      });
    }
    
    /**
     * Update polygon symbol based on current UI values
     */
    updatePolygonSymbol() {
      if (!this.polygonGraphic) return;
      
      require(["esri/symbols/SimpleFillSymbol", "esri/Color"], (SimpleFillSymbol, Color) => {
        // Get values from UI
        const colorHex = document.getElementById('polygon-color').value;
        const opacity = parseFloat(document.getElementById('polygon-opacity').value);
        const outlineWidth = parseFloat(document.getElementById('polygon-outline-width').value);
        const style = document.getElementById('polygon-style').value;
        
        // Convert hex to RGB
        const color = new Color(colorHex);
        color.a = opacity; // Set alpha/opacity
        
        // Create new symbol
        const symbol = new SimpleFillSymbol({
          style: style,
          color: color,
          outline: {
            color: [255, 255, 255], // White
            width: outlineWidth
          }
        });
        
        // Apply to graphic
        this.polygonGraphic.symbol = symbol;
        
        // Update legend
        this.updateLegend();
      });
    }
    
    /**
     * Update the legend to match current styling
     */
    updateLegend() {
      console.log("Updating legend with current symbology");
      
      // Find legend elements by ID for more reliable selection
      const pointLegend = document.getElementById('legend-point');
      const lineLegend = document.getElementById('legend-line');
      const polygonLegend = document.getElementById('legend-polygon');
      
      try {
        // Update point legend
        if (pointLegend && this.pointGraphic && this.pointGraphic.symbol) {
          const pointColor = this.pointGraphic.symbol.color;
          const rgbaColor = `rgba(${pointColor.r}, ${pointColor.g}, ${pointColor.b}, ${pointColor.a})`;
          console.log("Updating point legend with color:", rgbaColor);
          
          pointLegend.style.backgroundColor = rgbaColor;
          
          // Update point style if needed
          switch(this.pointGraphic.symbol.style) {
            case 'square':
              pointLegend.style.borderRadius = '0';
              break;
            case 'diamond':
              pointLegend.style.borderRadius = '0';
              pointLegend.style.transform = 'rotate(45deg)';
              break;
            case 'triangle':
              pointLegend.style.borderRadius = '0';
              pointLegend.style.clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)';
              break;
            case 'cross':
              pointLegend.style.borderRadius = '0';
              pointLegend.style.backgroundImage = 'linear-gradient(to right, transparent 40%, ' + rgbaColor + ' 40%, ' + rgbaColor + ' 60%, transparent 60%), linear-gradient(to bottom, transparent 40%, ' + rgbaColor + ' 40%, ' + rgbaColor + ' 60%, transparent 60%)';
              pointLegend.style.backgroundColor = 'transparent';
              break;
            case 'x':
              pointLegend.style.borderRadius = '0';
              pointLegend.style.backgroundImage = 'linear-gradient(45deg, transparent 40%, ' + rgbaColor + ' 40%, ' + rgbaColor + ' 60%, transparent 60%), linear-gradient(-45deg, transparent 40%, ' + rgbaColor + ' 40%, ' + rgbaColor + ' 60%, transparent 60%)';
              pointLegend.style.backgroundColor = 'transparent';
              break;
            default:
              // Reset to circle
              pointLegend.style.borderRadius = '50%';
              pointLegend.style.transform = 'none';
              pointLegend.style.clipPath = 'none';
              pointLegend.style.backgroundImage = 'none';
          }
          
          // Update size if specified
          if (this.pointGraphic.symbol.size) {
            const size = Math.min(this.pointGraphic.symbol.size, 20) + 'px';
            pointLegend.style.width = size;
            pointLegend.style.height = size;
          }
          
          // Update outline
          if (this.pointGraphic.symbol.outline) {
            const outlineWidth = this.pointGraphic.symbol.outline.width || 1;
            const outlineColor = this.pointGraphic.symbol.outline.color;
            const outlineRgba = `rgba(${outlineColor.r}, ${outlineColor.g}, ${outlineColor.b}, ${outlineColor.a})`;
            pointLegend.style.border = `${outlineWidth}px solid ${outlineRgba}`;
          }
        }
        
        // Update line legend
        if (lineLegend && this.lineGraphic && this.lineGraphic.symbol) {
          const lineColor = this.lineGraphic.symbol.color;
          const rgbaColor = `rgba(${lineColor.r}, ${lineColor.g}, ${lineColor.b}, ${lineColor.a})`;
          console.log("Updating line legend with color:", rgbaColor);
          
          lineLegend.style.backgroundColor = rgbaColor;
          
          // Reset any previous styles
          lineLegend.style.backgroundImage = 'none';
          
          // Update line style if needed
          switch(this.lineGraphic.symbol.style) {
            case 'dash':
              lineLegend.style.backgroundImage = `linear-gradient(to right, ${rgbaColor} 50%, transparent 50%)`;
              lineLegend.style.backgroundSize = '10px 100%';
              break;
            case 'dot':
              lineLegend.style.backgroundImage = `linear-gradient(to right, ${rgbaColor} 25%, transparent 25%)`;
              lineLegend.style.backgroundSize = '4px 100%';
              break;
            case 'dash-dot':
              lineLegend.style.backgroundImage = `linear-gradient(to right, ${rgbaColor} 40%, transparent 40%, transparent 60%, ${rgbaColor} 60%, ${rgbaColor} 70%, transparent 70%)`;
              lineLegend.style.backgroundSize = '12px 100%';
              break;
            case 'short-dash':
              lineLegend.style.backgroundImage = `linear-gradient(to right, ${rgbaColor} 33%, transparent 33%)`;
              lineLegend.style.backgroundSize = '6px 100%';
              break;
            case 'short-dot':
              lineLegend.style.backgroundImage = `linear-gradient(to right, ${rgbaColor} 20%, transparent 20%)`;
              lineLegend.style.backgroundSize = '3px 100%';
              break;
            default:
              // Solid line - no pattern needed
              lineLegend.style.backgroundImage = 'none';
          }
          
          // Update line width
          if (this.lineGraphic.symbol.width) {
            const height = Math.min(Math.max(this.lineGraphic.symbol.width, 2), 8);
            lineLegend.style.height = `${height}px`;
            lineLegend.style.marginTop = `${Math.max((20 - height) / 2, 6)}px`;
          }
        }
        
        // Update polygon legend
        if (polygonLegend && this.polygonGraphic && this.polygonGraphic.symbol) {
          const polygonColor = this.polygonGraphic.symbol.color;
          const rgbaColor = `rgba(${polygonColor.r}, ${polygonColor.g}, ${polygonColor.b}, ${polygonColor.a})`;
          console.log("Updating polygon legend with color:", rgbaColor);
          
          polygonLegend.style.backgroundColor = rgbaColor;
          
          // Reset any previous styles
          polygonLegend.style.backgroundImage = 'none';
          
          // Update fill style if needed
          switch(this.polygonGraphic.symbol.style) {
            case 'backward-diagonal':
              polygonLegend.style.backgroundImage = 'linear-gradient(45deg, rgba(255, 255, 255, 0.5) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.5) 50%, rgba(255, 255, 255, 0.5) 75%, transparent 75%, transparent)';
              polygonLegend.style.backgroundSize = '8px 8px';
              break;
            case 'forward-diagonal':
              polygonLegend.style.backgroundImage = 'linear-gradient(-45deg, rgba(255, 255, 255, 0.5) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.5) 50%, rgba(255, 255, 255, 0.5) 75%, transparent 75%, transparent)';
              polygonLegend.style.backgroundSize = '8px 8px';
              break;
            case 'cross':
              polygonLegend.style.backgroundImage = 'linear-gradient(to right, rgba(255, 255, 255, 0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.5) 1px, transparent 1px)';
              polygonLegend.style.backgroundSize = '8px 8px';
              break;
            case 'diagonal-cross':
              polygonLegend.style.backgroundImage = 'linear-gradient(45deg, rgba(255, 255, 255, 0.5) 1px, transparent 1px), linear-gradient(-45deg, rgba(255, 255, 255, 0.5) 1px, transparent 1px)';
              polygonLegend.style.backgroundSize = '8px 8px';
              break;
            case 'vertical':
              polygonLegend.style.backgroundImage = 'linear-gradient(to right, rgba(255, 255, 255, 0.5) 1px, transparent 1px)';
              polygonLegend.style.backgroundSize = '8px 1px';
              break;
            case 'horizontal':
              polygonLegend.style.backgroundImage = 'linear-gradient(to bottom, rgba(255, 255, 255, 0.5) 1px, transparent 1px)';
              polygonLegend.style.backgroundSize = '1px 8px';
              break;
            default:
              // Reset to solid
              polygonLegend.style.backgroundImage = 'none';
          }
          
          // Update outline
          if (this.polygonGraphic.symbol.outline) {
            const outlineWidth = this.polygonGraphic.symbol.outline.width || 1;
            const outlineColor = this.polygonGraphic.symbol.outline.color;
            const outlineRgba = `rgba(${outlineColor.r}, ${outlineColor.g}, ${outlineColor.b}, ${outlineColor.a})`;
            polygonLegend.style.border = `${outlineWidth}px solid ${outlineRgba}`;
          }
        }
      } catch (error) {
        console.error("Error updating legend:", error);
      }
    }
    
    /**
     * Reset all styling to defaults
     */
    resetToDefaults() {
      require(["esri/symbols/SimpleMarkerSymbol", "esri/symbols/SimpleLineSymbol", "esri/symbols/SimpleFillSymbol"], 
      (SimpleMarkerSymbol, SimpleLineSymbol, SimpleFillSymbol) => {
        // Reset point
        if (this.pointGraphic) {
          const pointSymbol = this.createSymbolFromDefault('point');
          this.pointGraphic.symbol = pointSymbol;
        }
        
        // Reset line
        if (this.lineGraphic) {
          const lineSymbol = this.createSymbolFromDefault('line');
          this.lineGraphic.symbol = lineSymbol;
        }
        
        // Reset polygon
        if (this.polygonGraphic) {
          const polygonSymbol = this.createSymbolFromDefault('polygon');
          this.polygonGraphic.symbol = polygonSymbol;
        }
        
        // Reset UI controls
        this.resetUIControls();
        
        // Update legend
        this.updateLegend();
      });
    }
    
    /**
     * Create a symbol from default settings
     */
    createSymbolFromDefault(type) {
      return this.defaultSymbols[type];
    }
    
    /**
     * Reset UI controls to default values
     */
    resetUIControls() {
      // Point controls
      document.getElementById('point-color').value = '#E27728';
      document.getElementById('point-color-hex').textContent = '#E27728';
      document.getElementById('point-size').value = 8;
      document.getElementById('point-opacity').value = 1;
      document.getElementById('point-outline-width').value = 1;
      document.getElementById('point-style').value = 'circle';
      
      // Line controls
      document.getElementById('line-color').value = '#E27728';
      document.getElementById('line-color-hex').textContent = '#E27728';
      document.getElementById('line-width').value = 2;
      document.getElementById('line-opacity').value = 1;
      document.getElementById('line-style').value = 'solid';
      
      // Polygon controls
      document.getElementById('polygon-color').value = '#E38B4F';
      document.getElementById('polygon-color-hex').textContent = '#E38B4F';
      document.getElementById('polygon-opacity').value = 0.8;
      document.getElementById('polygon-outline-width').value = 1;
      document.getElementById('polygon-style').value = 'solid';
    }
  }
  
  // Add to global scope
  window.GeometryRenderer = GeometryRenderer;
})(); 