/**
 * Content Script CSS Styles
 * Defines all styles for highlighting, tooltips, toasts, and the side panel.
 */

export const HIGHLIGHT_STYLES = `
  /* ========================================
     BASE HIGHLIGHT STYLES - BULLETPROOF
     Force full borders visible above ALL page elements
     Uses OUTLINE instead of border - outlines are NEVER clipped by overflow:hidden
     ======================================== */
  .xtm-highlight {
    /* Use inline-block to ensure proper rendering */
    display: inline-block !important;
    position: relative !important;
    
    /* Maximum z-index to be above everything except our own UI */
    z-index: 2147483640 !important;
    
    /* Visual styling */
    border-radius: 4px !important;
    padding: 3px 24px 3px 8px !important;
    margin: 2px 2px !important;
    cursor: pointer !important;
    text-decoration: none !important;
    vertical-align: middle !important;
    line-height: 1.4 !important;
    box-sizing: border-box !important;
    
    /* Inherit text properties */
    font-size: inherit !important;
    font-family: inherit !important;
    font-weight: inherit !important;
    color: inherit !important;
    
    /* Use OUTLINE instead of border - outlines ignore overflow:hidden! */
    border: none !important;
    outline: 2px solid currentColor !important;
    outline-offset: 0px !important;
    
    /* Multi-line support - ensure borders wrap with text */
    box-decoration-break: clone !important;
    -webkit-box-decoration-break: clone !important;
    
    /* FORCE VISIBILITY */
    visibility: visible !important;
    opacity: 1 !important;
    overflow: visible !important;
    clip: auto !important;
    clip-path: none !important;
    -webkit-clip-path: none !important;
    
    /* Prevent parent overflow from clipping */
    transform: translateZ(0) !important;
    -webkit-transform: translateZ(0) !important;
    
    /* Ensure proper stacking */
    isolation: isolate !important;
    
    /* Pointer events */
    pointer-events: auto !important;
    
    /* White space handling to prevent breaks */
    white-space: normal !important;
    word-wrap: break-word !important;
    overflow-wrap: break-word !important;
  }
  
  /* Ensure text content is present before showing icons */
  .xtm-highlight:empty {
    display: none !important;
  }
  
  /* Force visibility on highlight and children */
  .xtm-highlight,
  .xtm-highlight * {
    visibility: visible !important;
    opacity: 1 !important;
    cursor: pointer !important;
  }
  
  /* CRITICAL: Force ALL ancestor elements to NOT clip highlights
     This is necessary because many websites have overflow:hidden on containers
     Using multiple levels of :has() to catch nested cases */
  *:has(.xtm-highlight) {
    overflow: visible !important;
    clip: auto !important;
    clip-path: none !important;
    -webkit-clip-path: none !important;
  }
  
  /* Also target common clipping container patterns */
  td:has(.xtm-highlight),
  th:has(.xtm-highlight),
  span:has(.xtm-highlight),
  div:has(.xtm-highlight),
  p:has(.xtm-highlight),
  a:has(.xtm-highlight),
  li:has(.xtm-highlight) {
    overflow: visible !important;
    text-overflow: clip !important;
  }
  
  /* Ensure clickable cursor on all interactive highlights */
  .xtm-highlight:not(.xtm-atomic-testing):not(.xtm-scenario):hover {
    cursor: pointer !important;
  }

  /* ========================================
     FOUND IN PLATFORM - Green with checkbox on LEFT and check icon on RIGHT
     ======================================== */
  .xtm-highlight.xtm-found {
    background: rgba(0, 200, 83, 0.25) !important;
    outline: 2px solid #4caf50 !important;
    padding: 4px 26px 4px 30px !important;  /* Extra space on left for checkbox */
  }
  
  /* Unchecked checkbox on LEFT for found entities */
  .xtm-highlight.xtm-found::before {
    content: '' !important;
    position: absolute !important;
    left: 10px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 12px !important;
    height: 12px !important;
    border: 2px solid rgba(0, 200, 83, 0.9) !important;
    border-radius: 2px !important;
    background: transparent !important;
    box-sizing: border-box !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    z-index: 2147483641 !important;
  }
  
  /* Check icon on RIGHT for found */
  .xtm-highlight.xtm-found::after {
    content: '' !important;
    position: absolute !important;
    right: 6px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 14px !important;
    height: 14px !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2300c853'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z'/%3E%3C/svg%3E") !important;
    background-size: contain !important;
    background-repeat: no-repeat !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    z-index: 2147483641 !important;
  }
  
  .xtm-highlight.xtm-found:hover {
    background: rgba(0, 200, 83, 0.4) !important;
    outline-color: #2e7d32 !important;
    box-shadow: 0 0 8px rgba(0, 200, 83, 0.5) !important;
  }
  
  /* Checked checkbox on LEFT when found entity is selected */
  .xtm-highlight.xtm-found.xtm-selected::before {
    background: #00c853 !important;
    border-color: #00c853 !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z'/%3E%3C/svg%3E") !important;
    background-size: 10px !important;
    background-repeat: no-repeat !important;
    background-position: center !important;
  }
  
  /* Selected state for found entities - green glow */
  .xtm-highlight.xtm-found.xtm-selected {
    outline-color: #00c853 !important;
    box-shadow: 0 0 8px rgba(0, 200, 83, 0.6) !important;
  }

  /* ========================================
     NOT FOUND - Amber with checkbox on LEFT, info icon on RIGHT
     ======================================== */
  .xtm-highlight.xtm-not-found {
    background: rgba(255, 167, 38, 0.25) !important;
    outline: 2px solid #ffa726 !important;
    padding: 4px 26px 4px 30px !important;  /* Extra space on left for checkbox */
  }
  
  /* Unchecked checkbox on LEFT */
  .xtm-highlight.xtm-not-found::before {
    content: '' !important;
    position: absolute !important;
    left: 10px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 12px !important;
    height: 12px !important;
    border: 2px solid rgba(255, 167, 38, 0.9) !important;
    border-radius: 2px !important;
    background: transparent !important;
    box-sizing: border-box !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    z-index: 2147483641 !important;
  }
  
  /* Info icon on RIGHT */
  .xtm-highlight.xtm-not-found::after {
    content: '' !important;
    position: absolute !important;
    right: 6px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 14px !important;
    height: 14px !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffa726'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'/%3E%3C/svg%3E") !important;
    background-size: contain !important;
    background-repeat: no-repeat !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    z-index: 2147483641 !important;
  }
  
  .xtm-highlight.xtm-not-found:hover {
    background: rgba(255, 167, 38, 0.4) !important;
    outline-color: #f57c00 !important;
    box-shadow: 0 0 8px rgba(255, 167, 38, 0.5) !important;
  }

  /* ========================================
     SELECTED FOR BULK IMPORT - Checked checkbox
     ======================================== */
  .xtm-highlight.xtm-selected {
    outline-color: #0fbcff !important;
    box-shadow: 0 0 8px rgba(15, 188, 255, 0.5) !important;
  }
  
  /* Checked checkbox on LEFT when selected */
  .xtm-highlight.xtm-not-found.xtm-selected::before {
    background: #0fbcff !important;
    border-color: #0fbcff !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z'/%3E%3C/svg%3E") !important;
    background-size: 10px !important;
    background-repeat: no-repeat !important;
    background-position: center !important;
  }

  /* ========================================
     ENTITY NOT ADDABLE - Gray style for OpenCTI entities that cannot be directly added
     Shows detected but not in platform, without add option
     ======================================== */
  .xtm-highlight.xtm-entity-not-addable {
    background: rgba(158, 158, 158, 0.2) !important;
    outline: 2px solid #9e9e9e !important;
    padding: 2px 22px 2px 6px !important;
    cursor: default !important;  /* Not clickable */
  }
  
  /* Info icon on RIGHT for entity not addable */
  .xtm-highlight.xtm-entity-not-addable::after {
    content: '' !important;
    position: absolute !important;
    right: 6px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 14px !important;
    height: 14px !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%239e9e9e'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'/%3E%3C/svg%3E") !important;
    background-size: contain !important;
    background-repeat: no-repeat !important;
    display: block !important;

  /* ========================================
     MIXED STATE - Not found in one platform but found in another
     Shows amber outline with green badge indicator
     ======================================== */
  }
  .xtm-highlight.xtm-mixed-state {
    background: linear-gradient(90deg, rgba(255, 167, 38, 0.25) 0%, rgba(255, 167, 38, 0.25) 70%, rgba(0, 200, 83, 0.3) 70%, rgba(0, 200, 83, 0.3) 100%) !important;
    outline: 2px solid #ffa726 !important;
    padding: 2px 28px 2px 22px !important;
    cursor: pointer !important;
  }
  
  /* Checkbox on LEFT for mixed state (for adding to primary platform) */
  .xtm-highlight.xtm-mixed-state::before {
    content: '' !important;
    position: absolute !important;
    left: 6px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 12px !important;
    height: 12px !important;
    border: 2px solid #ffa726 !important;
    border-radius: 3px !important;
    background: transparent !important;
    display: block !important;
    box-sizing: border-box !important;
    visibility: visible !important;
    opacity: 1 !important;
    z-index: 2147483641 !important;
  }
  
  /* Green checkmark badge on RIGHT for mixed state (found in other platform) */
  .xtm-highlight.xtm-mixed-state::after {
    content: '' !important;
    position: absolute !important;
    right: 6px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 16px !important;
    height: 16px !important;
    background: #00c853 !important;
    border-radius: 50% !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z'/%3E%3C/svg%3E") !important;
    background-size: 10px !important;
    background-repeat: no-repeat !important;
    background-position: center !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    z-index: 2147483641 !important;
    cursor: pointer !important;
  }
  
  .xtm-highlight.xtm-mixed-state:hover {
    background: linear-gradient(90deg, rgba(255, 167, 38, 0.4) 0%, rgba(255, 167, 38, 0.4) 70%, rgba(0, 200, 83, 0.5) 70%, rgba(0, 200, 83, 0.5) 100%) !important;
    box-shadow: 0 0 8px rgba(255, 167, 38, 0.5) !important;
  }
  
  /* Mixed state when selected for import */
  .xtm-highlight.xtm-mixed-state.xtm-selected::before {
    background: #0fbcff !important;
    border-color: #0fbcff !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z'/%3E%3C/svg%3E") !important;
    background-size: 10px !important;
    background-repeat: no-repeat !important;
    background-position: center !important;
    visibility: visible !important;
    opacity: 1 !important;
    z-index: 2147483641 !important;
  }
  
  .xtm-highlight.xtm-entity-not-addable:hover {
    background: rgba(158, 158, 158, 0.35) !important;
    outline-color: #757575 !important;
    box-shadow: 0 0 8px rgba(158, 158, 158, 0.4) !important;
  }

  /* ========================================
     AI DISCOVERED - Purple theme for entities discovered by AI
     Shows checkbox on left for selection, AI icon on right
     Colors from OpenCTI ThemeDark: main=#9575cd, light=#d1c4e9, dark=#673ab7
     ======================================== */
  .xtm-highlight.xtm-ai-discovered {
    background: rgba(149, 117, 205, 0.25) !important;
    outline: 2px solid #9575cd !important;
    padding: 4px 26px 4px 30px !important;  /* Extra space on left for checkbox */
  }
  
  /* Unchecked checkbox on LEFT */
  .xtm-highlight.xtm-ai-discovered::before {
    content: '' !important;
    position: absolute !important;
    left: 10px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 12px !important;
    height: 12px !important;
    border: 2px solid #9575cd !important;
    border-radius: 3px !important;
    background: transparent !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    z-index: 2147483641 !important;
  }
  
  /* AI sparkle icon on RIGHT */
  .xtm-highlight.xtm-ai-discovered::after {
    content: '' !important;
    position: absolute !important;
    right: 6px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 14px !important;
    height: 14px !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%239575cd'%3E%3Cpath d='M19,8L20.5,11.5L24,13L20.5,14.5L19,18L17.5,14.5L14,13L17.5,11.5L19,8M11.1,5L13.6,10.4L19,12.9L13.6,15.4L11.1,20.8L8.6,15.4L3.2,12.9L8.6,10.4L11.1,5Z'/%3E%3C/svg%3E") !important;
    background-size: contain !important;
    background-repeat: no-repeat !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    z-index: 2147483641 !important;
  }
  
  .xtm-highlight.xtm-ai-discovered:hover {
    background: rgba(149, 117, 205, 0.4) !important;
    outline-color: #673ab7 !important;
    box-shadow: 0 0 8px rgba(149, 117, 205, 0.5) !important;
  }
  
  /* Checked checkbox when AI-discovered entity is selected */
  .xtm-highlight.xtm-ai-discovered.xtm-selected::before {
    background: #9575cd !important;
    border-color: #9575cd !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z'/%3E%3C/svg%3E") !important;
    background-size: 10px !important;
    background-repeat: no-repeat !important;
    background-position: center !important;
  }

  /* ========================================
     INVESTIGATION MODE - Purple style with checkbox on LEFT
     ======================================== */
  .xtm-highlight.xtm-investigation {
    background: rgba(103, 58, 183, 0.25) !important;
    outline: 2px solid #7c4dff !important;
    padding: 4px 8px 4px 30px !important;  /* Extra space on left for checkbox */
    cursor: pointer !important;
  }
  
  /* Unchecked checkbox on LEFT for investigation */
  .xtm-highlight.xtm-investigation::before {
    content: '' !important;
    position: absolute !important;
    left: 10px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 12px !important;
    height: 12px !important;
    border: 2px solid #7c4dff !important;
    border-radius: 2px !important;
    background: transparent !important;
    box-sizing: border-box !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    z-index: 2147483641 !important;
  }
  
  .xtm-highlight.xtm-investigation:hover {
    background: rgba(103, 58, 183, 0.4) !important;
    outline-color: #651fff !important;
    box-shadow: 0 0 8px rgba(103, 58, 183, 0.5) !important;
  }
  
  /* Selected state for investigation */
  .xtm-highlight.xtm-investigation.xtm-selected {
    background: rgba(103, 58, 183, 0.35) !important;
    outline-color: #651fff !important;
    box-shadow: 0 0 8px rgba(103, 58, 183, 0.6) !important;
  }
  
  .xtm-highlight.xtm-investigation.xtm-selected::before {
    background: #7c4dff !important;
    border-color: #7c4dff !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z'/%3E%3C/svg%3E") !important;
    background-size: 8px !important;
    background-repeat: no-repeat !important;
    background-position: center !important;
  }

  /* ========================================
     ATOMIC TESTING MODE - Visual-only highlights (non-clickable)
     Colors match the panel: yellow/lime for attack patterns, teal for domains
     ======================================== */
  .xtm-highlight.xtm-atomic-testing {
    background: rgba(212, 225, 87, 0.25) !important;
    outline: 2px solid #d4e157 !important;
    padding: 2px 6px !important;  /* Simple padding, no extra space for icons */
    cursor: default !important;  /* Not clickable */
    pointer-events: none !important;  /* Disable all mouse events */
    border-radius: 4px !important;
  }
  
  /* No pseudo-elements for atomic testing - keep it clean */
  .xtm-highlight.xtm-atomic-testing::before,
  .xtm-highlight.xtm-atomic-testing::after {
    display: none !important;
    content: none !important;
  }
  
  /* Domain/hostname variant - cyan/teal color */
  .xtm-highlight.xtm-atomic-testing.xtm-atomic-domain {
    background: rgba(0, 188, 212, 0.25) !important;
    outline-color: #00bcd4 !important;
  }
  
  /* Attack pattern variant - lime/yellow color (matches panel) */
  .xtm-highlight.xtm-atomic-testing.xtm-atomic-attack-pattern {
    background: rgba(212, 225, 87, 0.25) !important;
    outline-color: #d4e157 !important;
  }

  /* ========================================
     SCENARIO MODE - Visual-only highlights (non-clickable)
     Uses same lime/yellow color as atomic testing for attack patterns
     ======================================== */
  .xtm-highlight.xtm-scenario {
    background: rgba(212, 225, 87, 0.25) !important;
    outline: 2px solid #d4e157 !important;
    padding: 2px 6px !important;
    cursor: default !important;
    pointer-events: none !important;
    border-radius: 4px !important;
  }
  
  /* No pseudo-elements for scenario - keep it clean */
  .xtm-highlight.xtm-scenario::before,
  .xtm-highlight.xtm-scenario::after {
    display: none !important;
    content: none !important;
  }

  /* ========================================
     TOOLTIP
     ======================================== */
  .xtm-tooltip {
    position: fixed;
    background: #070d19;
    color: rgba(255, 255, 255, 0.9);
    padding: 12px 16px;
    border-radius: 4px;
    font-size: 13px;
    font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    z-index: 2147483647;
    pointer-events: none;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    max-width: 320px;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  
  .xtm-tooltip.visible {
    opacity: 1;
  }
  
  .xtm-tooltip-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  
  .xtm-tooltip-type {
    color: #0fbcff;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.5px;
    background: rgba(15, 188, 255, 0.15);
    padding: 2px 8px;
    border-radius: 4px;
  }
  
  .xtm-tooltip-value {
    word-break: break-all;
    margin-bottom: 8px;
    font-weight: 500;
  }
  
  .xtm-tooltip-status {
    font-size: 12px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  .xtm-tooltip-status.found {
    color: #00c853;
  }
  
  .xtm-tooltip-status.not-found {
    color: #ffa726;
  }

  /* Flash animation for scroll-to highlight */
  @keyframes xtm-flash {
    0%, 100% { box-shadow: 0 0 0 0 rgba(15, 188, 255, 0); }
    25%, 75% { box-shadow: 0 0 20px 8px rgba(15, 188, 255, 0.6); }
    50% { box-shadow: 0 0 30px 12px rgba(15, 188, 255, 0.8); }
  }
  
  .xtm-highlight.xtm-flash {
    animation: xtm-flash 1.5s ease-out;
  }
  
  /* ========================================
     SIDE PANEL FRAME
     All styles use !important to prevent page CSS from overriding
     ======================================== */
  .xtm-panel-frame {
    all: initial !important;
    position: fixed !important;
    top: 0 !important;
    right: 0 !important;
    left: auto !important;
    width: 560px !important;
    min-width: 560px !important;
    max-width: 560px !important;
    height: 100vh !important;
    height: 100dvh !important;
    min-height: 100vh !important;
    max-height: 100vh !important;
    border: none !important;
    margin: 0 !important;
    padding: 0 !important;
    z-index: 2147483646 !important;
    box-shadow: -4px 0 32px rgba(0, 0, 0, 0.4) !important;
    transition: transform 0.3s ease !important;
    background: #070d19 !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    overflow: hidden !important;
    transform: translateX(0) !important;
    box-sizing: border-box !important;
    float: none !important;
    clear: none !important;
    flex: none !important;
    grid-area: auto !important;
    clip: auto !important;
    clip-path: none !important;
  }
  
  .xtm-panel-frame.hidden {
    transform: translateX(100%) !important;
    visibility: hidden !important;
  }
  
  /* Panel overlay - purely visual, pointer-events none so highlights remain clickable */
  .xtm-panel-overlay {
    all: initial !important;
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 560px !important;
    bottom: 0 !important;
    width: auto !important;
    height: auto !important;
    z-index: 2147483635 !important;
    background: transparent !important;
    pointer-events: none !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    box-sizing: border-box !important;
  }
  
  .xtm-panel-overlay.hidden {
    display: none !important;
    visibility: hidden !important;
  }

  /* ========================================
     TOAST NOTIFICATIONS
     ======================================== */
  .xtm-toast {
    position: fixed;
    top: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #070d19 0%, #09101e 100%);
    color: rgba(255, 255, 255, 0.9);
    padding: 12px 20px;
    border-radius: 8px;
    font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    z-index: 2147483647;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 500px;
    animation: xtm-toast-slide-in 0.3s ease-out;
  }

  @keyframes xtm-toast-slide-in {
    from {
      transform: translateX(-50%) translateY(-100%);
      opacity: 0;
    }
    to {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
  }

  .xtm-toast.xtm-toast-hiding {
    animation: xtm-toast-slide-out 0.2s ease-in forwards;
  }

  @keyframes xtm-toast-slide-out {
    from {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
    to {
      transform: translateX(-50%) translateY(-100%);
      opacity: 0;
    }
  }

  @keyframes xtm-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .xtm-toast-info {
    border-left: 4px solid #0fbcff;
  }

  .xtm-toast-success {
    border-left: 4px solid #4caf50;
  }

  .xtm-toast-error {
    border-left: 4px solid #f44336;
  }

  .xtm-toast-warning {
    border-left: 4px solid #ff9800;
  }

  .xtm-toast-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .xtm-toast-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(15, 188, 255, 0.3);
    border-top-color: #0fbcff;
    border-radius: 50%;
    animation: xtm-spin 0.8s linear infinite;
  }

  .xtm-toast-message {
    flex: 1;
    line-height: 1.4;
  }

  .xtm-toast-action {
    background: #0fbcff;
    color: #001e3c;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
    white-space: nowrap;
  }

  .xtm-toast-action:hover {
    background: #40caff;
  }

  .xtm-toast-close {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
    flex-shrink: 0;
  }

  .xtm-toast-close:hover {
    color: rgba(255, 255, 255, 0.9);
  }

`;