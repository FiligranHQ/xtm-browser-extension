# Installation

### From Web Store (Coming Soon)

The extension will soon be available on the Chrome Web Store, Firefox Add-ons store and Microsoft Edge Add-ons store.

### From Source (Development)

1. Clone the repository:
   ```bash
   git clone https://github.com/FiligranHQ/xtm-browser-extension.git
   cd xtm-browser-extension
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Chrome / Edge

3a. Build the extension:
   ```bash
   npm run build:chrome  # For Chrome
   npm run build:edge    # For Edge
   ```

4a. Load in browser:
   - Open `chrome://extensions/` (Chrome) or `edge://extensions/` (Edge)
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/chrome` or `dist/edge` folder

## Firefox

3b. Build the extension:
   ```bash
   npm run build:firefox
   ```

4b. Load in Firefox:
   - Open `about:debugging#/runtime/this-firefox`
   - Click "Load Temporary Add-on"
   - Select any file in the `dist/firefox` folder

## Safari

Safari requires a native wrapper application. Instructions coming soon.

## Verifying Installation

After installation, you should see the Filigran icon in your browser toolbar. Click it to open the popup and begin configuration.

