/**
 * Dark Theme - Ported from OpenCTI's ThemeDark.ts
 */

import type { ThemeOptions } from '@mui/material/styles';
import { hexToRGB } from './colors';

export const THEME_DARK_DEFAULT_BACKGROUND = '#070d19';
export const THEME_DARK_DEFAULT_PRIMARY = '#0fbcff';
export const THEME_DARK_DEFAULT_SECONDARY = '#00f1bd';
export const THEME_DARK_DEFAULT_ACCENT = '#0f1e38';
export const THEME_DARK_DEFAULT_PAPER = '#09101e';
export const THEME_DARK_DEFAULT_NAV = '#070d19';

const ThemeDark = (
  background: string | null = null,
  paper: string | null = null,
  nav: string | null = null,
  primary: string | null = null,
  secondary: string | null = null,
  accent: string | null = null,
  text_color = 'rgba(255, 255, 255, 0.7)',
): ThemeOptions => ({
  palette: {
    mode: 'dark',
    common: { white: '#ffffff' },
    error: {
      main: '#f44336',
      dark: '#c62828',
    },
    warning: {
      main: '#ffa726',
    },
    success: { main: '#03a847' },
    primary: { main: primary || THEME_DARK_DEFAULT_PRIMARY },
    secondary: { main: secondary || THEME_DARK_DEFAULT_SECONDARY },
    background: {
      default: background || THEME_DARK_DEFAULT_BACKGROUND,
      paper: paper || THEME_DARK_DEFAULT_PAPER,
    },
    text: {
      primary: text_color,
      secondary: 'rgba(255, 255, 255, 0.5)',
    },
  },
  typography: {
    fontFamily: '"IBM Plex Sans", sans-serif',
    body2: {
      fontSize: '0.8rem',
      lineHeight: '1.2rem',
      color: text_color,
    },
    body1: {
      fontSize: '0.9rem',
      color: text_color,
    },
    h1: {
      margin: '0 0 10px 0',
      padding: 0,
      fontWeight: 400,
      fontSize: 22,
      fontFamily: '"Geologica", sans-serif',
      color: text_color,
    },
    h2: {
      margin: '0 0 10px 0',
      padding: 0,
      fontWeight: 500,
      fontSize: 16,
      textTransform: 'uppercase',
      fontFamily: '"Geologica", sans-serif',
      color: text_color,
    },
    h3: {
      margin: '0 0 10px 0',
      padding: 0,
      fontWeight: 400,
      fontSize: 13,
      fontFamily: '"Geologica", sans-serif',
      color: text_color,
    },
    h4: {
      height: 15,
      margin: '0 0 10px 0',
      padding: 0,
      textTransform: 'uppercase',
      fontSize: 12,
      fontWeight: 500,
      color: text_color,
    },
    h6: {
      fontWeight: 400,
      fontSize: 18,
      color: text_color,
      fontFamily: '"Geologica", sans-serif',
    },
  },
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.7)',
        },
        arrow: {
          color: 'rgba(0,0,0,0.7)',
        },
      },
    },
    MuiFormControl: {
      defaultProps: {
        variant: 'standard',
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'standard',
      },
    },
    MuiSelect: {
      defaultProps: {
        variant: 'standard',
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          '&.Mui-selected': {
            boxShadow: `2px 0 ${primary || THEME_DARK_DEFAULT_PRIMARY} inset`,
            backgroundColor: `${hexToRGB(primary || THEME_DARK_DEFAULT_PRIMARY, 0.24)}`,
          },
          '&.Mui-selected:hover': {
            boxShadow: `2px 0 ${primary || THEME_DARK_DEFAULT_PRIMARY} inset`,
            backgroundColor: `${hexToRGB(primary || THEME_DARK_DEFAULT_PRIMARY, 0.32)}`,
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: `${background || THEME_DARK_DEFAULT_BACKGROUND} ${accent || THEME_DARK_DEFAULT_ACCENT}`,
          scrollbarWidth: 'thin',
          '&::-webkit-scrollbar': {
            width: 8,
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: 4,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4,
        },
      },
    },
  },
});

export default ThemeDark;

