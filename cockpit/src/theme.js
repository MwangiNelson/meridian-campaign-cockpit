import { theme } from 'antd'

// One place for the look. Type runs a step larger than a typical console (16px base)
// because several viewers have poor eyesight and the tool is shown on a projector.
const shared = {
  fontFamily: "'Inter Variable', Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
  fontSize: 16,
  borderRadius: 6,
  controlHeight: 40,
  wireframe: false,
}

const dark = {
  algorithm: theme.darkAlgorithm,
  token: {
    ...shared,
    colorPrimary: '#3ecf8e',
    colorSuccess: '#3ecf8e',
    colorInfo: '#5aa9f5',
    colorWarning: '#f0b429',
    colorError: '#f2555a',
    colorBgBase: '#171717',
    colorBgLayout: '#121212',
    colorBgContainer: '#1c1c1c',
    colorBgElevated: '#232323',
    colorBorder: '#363636',
    colorBorderSecondary: '#2a2a2a',
    colorText: '#ededed',
    colorTextSecondary: '#b4b4b4',
    colorTextTertiary: '#8f8f8f',
  },
  panel: '#161616',
}

const light = {
  algorithm: theme.defaultAlgorithm,
  token: {
    ...shared,
    colorPrimary: '#0f8a5f',
    colorSuccess: '#0f8a5f',
    colorInfo: '#1d6fd6',
    colorWarning: '#b26a00',
    colorError: '#c9353b',
    colorBgBase: '#ffffff',
    colorBgLayout: '#f8f9f8',
    colorBgContainer: '#ffffff',
    colorBorder: '#d6d9d6',
    colorBorderSecondary: '#e6e8e6',
    colorText: '#171717',
    colorTextSecondary: '#4d524f',
    colorTextTertiary: '#6b706d',
  },
  panel: '#ffffff',
}

export function themeFor(isDark) {
  const t = isDark ? dark : light
  return {
    panel: t.panel,
    config: {
      algorithm: t.algorithm,
      token: t.token,
      components: {
        Layout: { headerBg: t.panel, siderBg: t.panel, bodyBg: t.token.colorBgLayout, headerHeight: 56, headerPadding: 0 },
        Menu: { itemBg: 'transparent', itemHeight: 44, itemBorderRadius: 6, activeBarBorderWidth: 0,
                itemSelectedBg: isDark ? '#242424' : '#eef1ee', itemSelectedColor: t.token.colorText },
        Card: { headerFontSize: 16, headerHeight: 52, paddingLG: 20 },
        Table: { headerBg: 'transparent', headerColor: t.token.colorTextSecondary, headerSplitColor: 'transparent',
                 cellPaddingBlock: 14, cellFontSize: 16, rowHoverBg: isDark ? '#202020' : '#f6f7f6' },
        Statistic: { titleFontSize: 15, contentFontSize: 32 },
        Button: { primaryShadow: 'none', defaultShadow: 'none', fontWeight: 500,
                  ...(isDark ? { colorPrimary: '#006239', colorPrimaryHover: '#00754a', colorPrimaryActive: '#00552f' } : {}) },
        Tag: { defaultBg: 'transparent' },
      },
    },
  }
}
