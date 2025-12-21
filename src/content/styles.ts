/**
 * Content Script CSS Styles
 * Defines all styles for highlighting, tooltips, toasts, and the side panel.
 */

import { PANEL_WIDTH_PX } from '../shared/constants';

export const HIGHLIGHT_STYLES = `
  /* ========================================
     BASE HIGHLIGHT STYLES - ABOVE DOM APPROACH
     Uses OUTLINE for visibility + high z-index to float above content
     Forces parent containers to allow overflow
     ======================================== */
  .xtm-highlight {
    /* Use inline to preserve text flow */
    display: inline !important;
    position: relative !important;
    z-index: 9999 !important;  /* Float above page content but below panel (2147483646) */
    
    /* Minimal padding - icon space handled per-type */
    border-radius: 3px !important;
    padding: 1px 4px !important;
    cursor: pointer !important;
    text-decoration: none !important;
    box-sizing: border-box !important;
    
    /* Inherit text properties */
    font-size: inherit !important;
    font-family: inherit !important;
    font-weight: inherit !important;
    color: inherit !important;
    line-height: inherit !important;
    vertical-align: baseline !important;
    
    /* Use OUTLINE - not clipped by overflow:hidden */
    border: none !important;
    outline: 2px solid currentColor !important;
    outline-offset: 0px !important;
    
    /* Multi-line support */
    box-decoration-break: clone !important;
    -webkit-box-decoration-break: clone !important;
    
    /* Pointer events */
    pointer-events: auto !important;
  }
  
  /* Ensure text content is present before showing icons */
  .xtm-highlight:empty {
    display: none !important;
  }
  
  /* Ensure clickable cursor on all interactive highlights */
  .xtm-highlight:not(.xtm-atomic-testing):not(.xtm-scenario):hover {
    cursor: pointer !important;
  }
  
  /* ========================================
     AGGRESSIVE OVERFLOW HANDLING
     Force ALL ancestors containing highlights to allow overflow
     This ensures the highlight outline/padding is never clipped
     ======================================== */
  
  /* Any element that directly contains a highlight */
  *:has(> .xtm-highlight) {
    overflow: visible !important;
    text-overflow: clip !important;
  }
  
  /* Common inline containers - force overflow visible at any depth */
  span:has(.xtm-highlight),
  a:has(.xtm-highlight),
  em:has(.xtm-highlight),
  strong:has(.xtm-highlight),
  b:has(.xtm-highlight),
  i:has(.xtm-highlight),
  code:has(.xtm-highlight),
  label:has(.xtm-highlight),
  small:has(.xtm-highlight),
  mark:has(.xtm-highlight),
  div:has(.xtm-highlight),
  article:has(.xtm-highlight),
  section:has(.xtm-highlight) {
    overflow: visible !important;
    text-overflow: clip !important;
  }
  
  /* Block elements containing highlights */
  p:has(.xtm-highlight),
  li:has(.xtm-highlight),
  td:has(.xtm-highlight),
  th:has(.xtm-highlight),
  h1:has(.xtm-highlight),
  h2:has(.xtm-highlight),
  h3:has(.xtm-highlight),
  h4:has(.xtm-highlight),
  h5:has(.xtm-highlight),
  h6:has(.xtm-highlight) {
    overflow: visible !important;
    text-overflow: clip !important;
  }
  
  /* ========================================
     FOUND IN PLATFORM - Green with check icon on RIGHT
     ======================================== */
  .xtm-highlight.xtm-found {
    background: rgba(0, 200, 83, 0.2) !important;
    outline: 2px solid #4caf50 !important;
    padding: 1px 16px 1px 16px !important;  /* Space on left for checkbox, right for check icon */
  }
  
  /* Checkbox on LEFT for found */
  .xtm-highlight.xtm-found::before {
    content: '' !important;
    position: absolute !important;
    left: 2px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 10px !important;
    height: 10px !important;
    border: 1.5px solid #4caf50 !important;
    border-radius: 2px !important;
    background: transparent !important;
    box-sizing: border-box !important;
  }
  
  /* Checkbox checked state for found */
  .xtm-highlight.xtm-found.xtm-selected::before {
    background: #4caf50 !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z'/%3E%3C/svg%3E") !important;
    background-size: 8px !important;
    background-repeat: no-repeat !important;
    background-position: center !important;
  }
  
  /* Check icon on RIGHT for found */
  .xtm-highlight.xtm-found::after {
    content: '' !important;
    position: absolute !important;
    right: 2px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 10px !important;
    height: 10px !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2300c853'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z'/%3E%3C/svg%3E") !important;
    background-size: contain !important;
    background-repeat: no-repeat !important;
  }
  
  .xtm-highlight.xtm-found:hover {
    background: rgba(0, 200, 83, 0.35) !important;
    outline-color: #2e7d32 !important;
  }
  
  /* Selected state for found entities */
  .xtm-highlight.xtm-found.xtm-selected {
    outline-color: #00c853 !important;
    background: rgba(0, 200, 83, 0.35) !important;
  }

  /* ========================================
     NOT FOUND - Amber with info icon on RIGHT
     ======================================== */
  .xtm-highlight.xtm-not-found {
    background: rgba(255, 167, 38, 0.2) !important;
    outline: 2px solid #ffa726 !important;
    padding: 1px 16px 1px 16px !important;  /* Space on left for checkbox, right for info icon */
  }
  
  /* Checkbox on LEFT for not found */
  .xtm-highlight.xtm-not-found::before {
    content: '' !important;
    position: absolute !important;
    left: 2px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 10px !important;
    height: 10px !important;
    border: 1.5px solid #ffa726 !important;
    border-radius: 2px !important;
    background: transparent !important;
    box-sizing: border-box !important;
  }
  
  /* Checkbox checked state for not found */
  .xtm-highlight.xtm-not-found.xtm-selected::before {
    background: #ffa726 !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z'/%3E%3C/svg%3E") !important;
    background-size: 8px !important;
    background-repeat: no-repeat !important;
    background-position: center !important;
  }
  
  /* Info icon on RIGHT */
  .xtm-highlight.xtm-not-found::after {
    content: '' !important;
    position: absolute !important;
    right: 2px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 10px !important;
    height: 10px !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffa726'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'/%3E%3C/svg%3E") !important;
    background-size: contain !important;
    background-repeat: no-repeat !important;
  }
  
  .xtm-highlight.xtm-not-found:hover {
    background: rgba(255, 167, 38, 0.35) !important;
    outline-color: #f57c00 !important;
  }

  /* ========================================
     SELECTED FOR BULK IMPORT - Blue highlight
     ======================================== */
  .xtm-highlight.xtm-selected {
    outline-color: #0fbcff !important;
    background: rgba(15, 188, 255, 0.25) !important;
  }

  /* ========================================
     ENTITY NOT ADDABLE - Gray style for OpenCTI entities that cannot be directly added
     ======================================== */
  .xtm-highlight.xtm-entity-not-addable {
    background: rgba(158, 158, 158, 0.15) !important;
    outline: 2px solid #9e9e9e !important;
    padding: 1px 16px 1px 4px !important;  /* No left padding - no checkbox for non-addable */
    cursor: default !important;
  }
  
  /* No checkbox for entity not addable - explicitly hide */
  .xtm-highlight.xtm-entity-not-addable::before {
    display: none !important;
    content: none !important;
  }
  
  /* Info icon on RIGHT for entity not addable */
  .xtm-highlight.xtm-entity-not-addable::after {
    content: '' !important;
    position: absolute !important;
    right: 2px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 10px !important;
    height: 10px !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%239e9e9e'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'/%3E%3C/svg%3E") !important;
    background-size: contain !important;
    background-repeat: no-repeat !important;
  }
  
  .xtm-highlight.xtm-entity-not-addable:hover {
    background: rgba(158, 158, 158, 0.25) !important;
    outline-color: #757575 !important;
  }

  /* ========================================
     MIXED STATE - Not found in one platform but found in another
     ======================================== */
  .xtm-highlight.xtm-mixed-state {
    background: linear-gradient(90deg, rgba(255, 167, 38, 0.2) 0%, rgba(255, 167, 38, 0.2) 70%, rgba(0, 200, 83, 0.25) 70%, rgba(0, 200, 83, 0.25) 100%) !important;
    outline: 2px solid #ffa726 !important;
    padding: 1px 16px 1px 16px !important;  /* Space on left for checkbox, right for badge */
    cursor: pointer !important;
  }
  
  /* Checkbox on LEFT for mixed state */
  .xtm-highlight.xtm-mixed-state::before {
    content: '' !important;
    position: absolute !important;
    left: 2px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 10px !important;
    height: 10px !important;
    border: 1.5px solid #ffa726 !important;
    border-radius: 2px !important;
    background: transparent !important;
    box-sizing: border-box !important;
  }
  
  /* Checkbox checked state for mixed state */
  .xtm-highlight.xtm-mixed-state.xtm-selected::before {
    background: #ffa726 !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z'/%3E%3C/svg%3E") !important;
    background-size: 8px !important;
    background-repeat: no-repeat !important;
    background-position: center !important;
  }
  
  /* Green checkmark badge on RIGHT for mixed state */
  .xtm-highlight.xtm-mixed-state::after {
    content: '' !important;
    position: absolute !important;
    right: 2px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 10px !important;
    height: 10px !important;
    background: #00c853 !important;
    border-radius: 50% !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z'/%3E%3C/svg%3E") !important;
    background-size: 6px !important;
    background-repeat: no-repeat !important;
    background-position: center !important;
    cursor: pointer !important;
  }
  
  .xtm-highlight.xtm-mixed-state:hover {
    background: linear-gradient(90deg, rgba(255, 167, 38, 0.35) 0%, rgba(255, 167, 38, 0.35) 70%, rgba(0, 200, 83, 0.4) 70%, rgba(0, 200, 83, 0.4) 100%) !important;
  }
  
  /* Mixed state when selected */
  .xtm-highlight.xtm-mixed-state.xtm-selected {
    outline-color: #0fbcff !important;
    background: linear-gradient(90deg, rgba(15, 188, 255, 0.2) 0%, rgba(15, 188, 255, 0.2) 70%, rgba(0, 200, 83, 0.25) 70%, rgba(0, 200, 83, 0.25) 100%) !important;
  }

  /* ========================================
     AI DISCOVERED - Purple theme for entities discovered by AI
     ======================================== */
  .xtm-highlight.xtm-ai-discovered {
    background: rgba(149, 117, 205, 0.2) !important;
    outline: 2px solid #9575cd !important;
    padding: 1px 16px 1px 16px !important;  /* Space on left for checkbox, right for AI icon */
  }
  
  /* Checkbox on LEFT for AI discovered */
  .xtm-highlight.xtm-ai-discovered::before {
    content: '' !important;
    position: absolute !important;
    left: 2px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 10px !important;
    height: 10px !important;
    border: 1.5px solid #9575cd !important;
    border-radius: 2px !important;
    background: transparent !important;
    box-sizing: border-box !important;
  }
  
  /* Checkbox checked state for AI discovered */
  .xtm-highlight.xtm-ai-discovered.xtm-selected::before {
    background: #9575cd !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z'/%3E%3C/svg%3E") !important;
    background-size: 8px !important;
    background-repeat: no-repeat !important;
    background-position: center !important;
  }
  
  /* AI sparkle icon on RIGHT */
  .xtm-highlight.xtm-ai-discovered::after {
    content: '' !important;
    position: absolute !important;
    right: 2px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 10px !important;
    height: 10px !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%239575cd'%3E%3Cpath d='M19,8L20.5,11.5L24,13L20.5,14.5L19,18L17.5,14.5L14,13L17.5,11.5L19,8M11.1,5L13.6,10.4L19,12.9L13.6,15.4L11.1,20.8L8.6,15.4L3.2,12.9L8.6,10.4L11.1,5Z'/%3E%3C/svg%3E") !important;
    background-size: contain !important;
    background-repeat: no-repeat !important;
  }
  
  .xtm-highlight.xtm-ai-discovered:hover {
    background: rgba(149, 117, 205, 0.35) !important;
    outline-color: #673ab7 !important;
  }
  
  /* Selected AI-discovered entity */
  .xtm-highlight.xtm-ai-discovered.xtm-selected {
    outline-color: #0fbcff !important;
    background: rgba(15, 188, 255, 0.25) !important;
  }

  /* ========================================
     INVESTIGATION MODE - Purple style
     ======================================== */
  .xtm-highlight.xtm-investigation {
    background: rgba(103, 58, 183, 0.2) !important;
    outline: 2px solid #7c4dff !important;
    padding: 1px 4px !important;
    cursor: pointer !important;
  }
  
  .xtm-highlight.xtm-investigation:hover {
    background: rgba(103, 58, 183, 0.35) !important;
    outline-color: #651fff !important;
  }
  
  /* Selected state for investigation */
  .xtm-highlight.xtm-investigation.xtm-selected {
    background: rgba(103, 58, 183, 0.35) !important;
    outline-color: #651fff !important;
  }

  /* ========================================
     ATOMIC TESTING MODE - Visual-only highlights (non-clickable)
     Colors match the panel: yellow/lime for attack patterns, teal for domains
     ======================================== */
  .xtm-highlight.xtm-atomic-testing {
    background: rgba(212, 225, 87, 0.2) !important;
    outline: 2px solid #d4e157 !important;
    padding: 1px 4px !important;
    cursor: default !important;
    pointer-events: none !important;
  }
  
  /* No pseudo-elements for atomic testing */
  .xtm-highlight.xtm-atomic-testing::before,
  .xtm-highlight.xtm-atomic-testing::after {
    display: none !important;
    content: none !important;
  }
  
  /* Domain/hostname variant - cyan/teal color */
  .xtm-highlight.xtm-atomic-testing.xtm-atomic-domain {
    background: rgba(0, 188, 212, 0.2) !important;
    outline-color: #00bcd4 !important;
  }
  
  /* Attack pattern variant - lime/yellow color */
  .xtm-highlight.xtm-atomic-testing.xtm-atomic-attack-pattern {
    background: rgba(212, 225, 87, 0.2) !important;
    outline-color: #d4e157 !important;
  }

  /* ========================================
     SCENARIO MODE - Visual-only highlights (non-clickable)
     ======================================== */
  .xtm-highlight.xtm-scenario {
    background: rgba(212, 225, 87, 0.2) !important;
    outline: 2px solid #d4e157 !important;
    padding: 1px 4px !important;
    cursor: default !important;
    pointer-events: none !important;
  }
  
  /* No pseudo-elements for scenario */
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
    background: #070d19 !important;
    color: rgba(255, 255, 255, 0.9) !important;
    padding: 12px 16px !important;
    border-radius: 4px !important;
    font-size: 13px !important;
    font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    z-index: 2147483647 !important;
    pointer-events: none !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5) !important;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    max-width: 320px !important;
    min-width: 150px !important;
    opacity: 0 !important;
    visibility: hidden !important;
    transition: opacity 0.2s ease, visibility 0.2s ease !important;
  }
  
  .xtm-tooltip.visible {
    opacity: 1 !important;
    visibility: visible !important;
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

  /* Flash animation for scroll-to highlight - rapid pulsing glow */
  @keyframes xtm-flash {
    0%, 100% { 
      box-shadow: 0 0 0 0 rgba(15, 188, 255, 0);
      outline-color: currentColor;
    }
    /* 3 gentle pulses over 3 seconds */
    15%, 45%, 75% { 
      box-shadow: 0 0 10px 5px rgba(15, 188, 255, 0.8), 0 0 20px 10px rgba(15, 188, 255, 0.4);
      outline-color: #0fbcff;
    }
    30%, 60%, 90% { 
      box-shadow: 0 0 0 0 rgba(15, 188, 255, 0);
      outline-color: currentColor;
    }
  }
  
  .xtm-highlight.xtm-flash {
    animation: xtm-flash 3s ease-in-out;
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
    width: ${PANEL_WIDTH_PX}px !important;
    min-width: ${PANEL_WIDTH_PX}px !important;
    max-width: ${PANEL_WIDTH_PX}px !important;
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
    /* Note: Do NOT use visibility:hidden here - Edge won't load iframe content if hidden */
    pointer-events: none !important;
  }
  
  /* Panel overlay - purely visual, pointer-events none so highlights remain clickable */
  .xtm-panel-overlay {
    all: initial !important;
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: ${PANEL_WIDTH_PX}px !important;
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

`;