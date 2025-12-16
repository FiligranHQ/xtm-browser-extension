# Troubleshooting

## Common Issues

### Connection Failed

**Symptoms:**
- "Connection failed" message
- Cannot save settings
- Platform shows as disconnected

**Solutions:**
1. Verify your platform URL is correct and accessible
2. Check your API token is valid and not expired
3. Ensure your platform instance allows CORS from browser extensions
4. Try accessing your platform URL directly in the browser
5. Check if you're behind a VPN or proxy that might block connections

### No Highlights Appearing

**Symptoms:**
- Scan completes but nothing is highlighted
- "0 items found" message

**Solutions:**
1. The page may not contain any detectable items
2. Check Detection settings - some types may be disabled
3. Clear cache and rescan: Options → Clear Cache → Scan again
4. Check browser console (F12) for errors
5. Verify entity cache is populated (check cache stats in Options)

### Entities Not Detected

**Symptoms:**
- Known entities on page not highlighted
- Cache shows 0 entities

**Solutions:**
1. Refresh the entity cache: Options → Refresh Cache
2. Check if the entity type is enabled in Detection settings
3. For OpenCTI: Ensure entities exist in your platform
4. For OpenAEV: Verify assets have name/hostname/IP populated

### MITRE IDs Not Matching

**Symptoms:**
- T1566 or similar IDs not highlighted

**Solutions:**
1. MITRE IDs use exact word-boundary matching
2. Ensure the ID is separated by spaces or punctuation
3. Check that Attack Pattern detection is enabled
4. For OpenAEV: Attack patterns need external_id populated

### Assets Not Found by IP/MAC

**Symptoms:**
- Asset exists in OpenAEV but not detected by IP or MAC

**Solutions:**
1. Refresh OpenAEV cache
2. Verify asset has IP/MAC addresses populated in OpenAEV
3. Check asset cache includes endpoint_ips and endpoint_mac_addresses
4. IP matching uses exact boundaries - ensure full IP is present

### Extension Icon Shows Default Puzzle

**Symptoms:**
- Browser toolbar shows generic extension icon instead of Filigran logo

**Solutions:**
1. Reload the extension from `chrome://extensions/`
2. Restart your browser
3. Re-install the extension

### Context Menu Not Appearing

**Symptoms:**
- Right-click doesn't show extension menu items

**Solutions:**
1. Reload the extension
2. Check extension permissions
3. Some pages (browser internal pages, PDFs) don't allow extensions

### Slow Performance

**Symptoms:**
- Page becomes slow after scanning
- Long scan times

**Solutions:**
1. Disable detection of unused entity types
2. Large pages with many matches can be slow
3. Reduce cache refresh frequency
4. Clear highlights when done reviewing

### Side Panel Not Opening

**Symptoms:**
- Clicking highlights doesn't open side panel
- Panel appears blank

**Solutions:**
1. Chrome/Edge: Ensure side panel is enabled in browser
2. Firefox: Check sidebar permissions
3. Reload the extension
4. Try clicking the extension icon first

## Error Messages

### "Cannot read properties of null"

This occurs on special pages (images, PDFs, browser pages) that don't have a normal HTML structure. This is expected behavior.

### "Duplicate context menu ID"

Occurs during extension updates. Reload the extension from `chrome://extensions/` to fix.

### "Network error"

Check your internet connection and ensure your platform instance is accessible.

### PDF Generation Issues

**Symptoms:**
- PDF is empty or incomplete
- Images missing from PDF
- PDF generation fails

**Solutions:**
1. Some pages have complex layouts that prevent clean extraction
2. Cross-origin images may fail to load (CORS restrictions)
3. Try using the native PDF generation if jsPDF fails
4. Very long pages may timeout - try scanning a shorter article

### AI Feature Issues

**"AI features require Enterprise Edition":**
- Connect at least one EE-licensed platform (OpenCTI EE or OpenAEV EE)
- Or start a free trial at [filigran.io/enterprise-editions-trial](https://filigran.io/enterprise-editions-trial/)

**"Invalid API key":**
- Verify your API key is correct and not expired
- Ensure you have sufficient credits/quota with the provider
- Try regenerating the API key from the provider's console

**"Model not available":**
- Click "Test Connection" to refresh the model list
- Some models require special access (e.g., GPT-4 requires paid account)
- Try selecting a different model

### "OPENCTI_TOKEN not set" (in tests)

For running integration tests locally, set environment variables:
```bash
export OPENCTI_URL="http://localhost:8080"
export OPENCTI_TOKEN="your-api-token"
```

### "fetch failed" / "ECONNREFUSED"

The platform is not running or not accessible. Check:
1. Platform URL is correct
2. Platform is running and healthy
3. Network/firewall allows connection

## Debug Mode

Enable debug logging to troubleshoot issues:

1. Open browser console (F12)
2. Set log level:
   ```javascript
   localStorage.setItem('LOG_LEVEL', 'debug');
   ```
3. Reload the extension
4. Reproduce the issue
5. Check console for detailed logs

Log levels: `debug`, `info`, `warn`, `error`

## Browser-Specific Issues

### Chrome
- Extension may need to be reloaded after updates
- Side panel requires Chrome 114+

### Firefox
- Use sidebar instead of side panel
- Temporary add-ons are removed on browser restart

### Edge
- Similar to Chrome (Chromium-based)
- May need to enable developer mode

## Platform-Specific Issues

### OpenCTI

**GraphQL errors:**
- Check API token has correct permissions
- Verify OpenCTI version is 6.0+
- Some queries require specific entity access

**Cache not populating:**
- Large instances may timeout - increase cache limits
- Check user has access to entity types

### OpenAEV

**Assets not found:**
- Verify assets have populated name/hostname/IPs
- Check API token has asset read permissions
- OpenAEV 2.0+ required

**Attack patterns missing:**
- MITRE collector must be enabled in OpenAEV
- Check attack_pattern_external_id is populated

## Getting Help

If you continue experiencing issues:

1. **Check GitHub Issues**: Your problem may already be reported
   - [GitHub Issues](https://github.com/FiligranHQ/xtm-browser-extension/issues)

2. **Community Support**: Ask in the Filigran community
   - [Filigran Community](https://community.filigran.io)

3. **Report a Bug**: Create a new issue with:
   - Browser name and version
   - Extension version
   - Steps to reproduce
   - Error messages from browser console
   - Debug logs if available
   - Screenshots if applicable
