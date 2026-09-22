// Paired semantic colors: use onPrimary/onDanger for filled actions,
// and the matching soft surface for each status color.
export const light = {
  primary: '#3156B5', accent: '#6741B4', violet: '#7040A8', cyan: '#08758B',
  ink: '#262333', muted: '#655F6B', subtle: '#6B6571',
  background: '#FFF9EE', surface: '#FFFDF8', surfaceRaised: '#F2F7FF', border: '#E7DFD5',
  success: '#26734D', danger: '#B52F59', amber: '#805600',
  softBlue: '#E5F3FF', softGreen: '#EAF6EE', softAmber: '#FFF0C7', softDanger: '#FFE8F0',
  sky: '#1976A3', gold: '#8A5B00', pink: '#B12F70', yellow: '#866000',
  softPurple: '#F0E9FF', softPink: '#FFE7F2', softYellow: '#FFF5C9',
  statusBar: '#FFF9EE', onPrimary: '#FFFFFF', onDanger: '#FFFFFF',
  hero: '#334FA3', heroText: '#FFFFFF', heroMuted: '#E2E9FF', shadow: '#27366D',
}
export const dark: typeof light = {
  primary: '#FFF0CF', accent: '#F7DFB1', violet: '#F8E6C7', cyan: '#F4E1BE',
  ink: '#FFF8EA', muted: '#D3CCBE', subtle: '#BCB5A9',
  background: '#101112', surface: '#1A1B1D', surfaceRaised: '#242527', border: '#3C3B38',
  success: '#F2E4C7', danger: '#FFD1D8', amber: '#F3DEB0',
  softBlue: '#292929', softGreen: '#262724', softAmber: '#2C2922', softDanger: '#302528',
  sky: '#F7E6C7', gold: '#F4DDAA', pink: '#F7DCE3', yellow: '#F4E3B8',
  softPurple: '#29282B', softPink: '#2D2729', softYellow: '#2C2A24',
  statusBar: '#101112', onPrimary: '#24201A', onDanger: '#371C21',
  hero: '#232426', heroText: '#FFF8EA', heroMuted: '#D9D1C2', shadow: '#050505',
}
