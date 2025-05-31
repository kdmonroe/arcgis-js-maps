# Shared Resources

This directory contains shared resources used across all ArcGIS map demos.

## Files

### `config.js`
Contains the ArcGIS API key configuration. This file should be created locally and is not tracked in version control for security reasons.

**Example structure:**
```javascript
window.arcgisConfig = {
  apiKey: "your-api-key-here"
};
```

### `arcgis-script-reference.js`
A dedicated script file that serves as a stable reference point for the ArcGIS Maps SDK for JavaScript script injection mechanism.

**Purpose:**
- Prevents `"ma.parentNode is null"` errors caused by browser extension conflicts
- Provides a stable DOM reference that won't be removed by browser extensions
- Ensures reliable script injection for the ArcGIS SDK

**Usage:**
Include this script in the `<head>` section of your HTML file, before the ArcGIS SDK script:

```html
<head>
  <!-- Other meta tags and styles -->
  
  <!-- Stable script reference for ArcGIS SDK script injection -->
  <script src="../shared/arcgis-script-reference.js"></script>
  
  <!-- ArcGIS Maps SDK for JavaScript -->
  <script src="https://js.arcgis.com/4.32/"></script>
  
  <!-- Other scripts -->
</head>
```

**Why this is needed:**
Browser extensions (like Bitwarden, LastPass, etc.) often inject temporary scripts into the DOM that get removed after execution. The ArcGIS SDK's script injection logic searches for script tags to use as reference points for inserting additional scripts. When it tries to use a removed extension script as a reference, it fails with `"parentNode is null"` errors.

### `map_template.html`
A comprehensive template for creating new ArcGIS map demos. Incorporates all best practices and lessons learned, including:

- Proper script loading order
- Browser extension conflict prevention
- Valid basemap configurations
- Error handling patterns
- Responsive design
- Accessibility considerations

**Usage:**
1. Copy the template file
2. Replace placeholder values (marked with `{{}}`)
3. Customize styling and functionality as needed
4. Test thoroughly across different browsers and with browser extensions enabled

## Best Practices

1. **Always include `arcgis-script-reference.js`** before the ArcGIS SDK script
2. **Never add `defer` attribute** to the ArcGIS SDK script tag
3. **Use valid basemap names** (check ArcGIS documentation)
4. **Load Map Components dynamically** after DOM is ready
5. **Handle configuration loading errors** gracefully
6. **Test with browser extensions enabled** (especially password managers) 