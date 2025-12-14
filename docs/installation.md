# Installation

## Chrome / Edge

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

3. Build the extension:
   ```bash
   npm run build:chrome  # For Chrome
   npm run build:edge    # For Edge
   ```

4. Load in browser:
   - Open `chrome://extensions/` (Chrome) or `edge://extensions/` (Edge)
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/chrome` or `dist/edge` folder

### From Web Store (Coming Soon)

The extension will be available on the Chrome Web Store and Microsoft Edge Add-ons store.

## Firefox

### From Source (Development)

1. Build the extension:
   ```bash
   npm run build:firefox
   ```

2. Load in Firefox:
   - Open `about:debugging#/runtime/this-firefox`
   - Click "Load Temporary Add-on"
   - Select any file in the `dist/firefox` folder

### From Add-ons Store (Coming Soon)

The extension will be available on Firefox Add-ons.

## Safari

Safari requires a native wrapper application. Instructions coming soon.

## Verifying Installation

After installation, you should see the Filigran icon in your browser toolbar. Click it to open the popup and begin configuration.

