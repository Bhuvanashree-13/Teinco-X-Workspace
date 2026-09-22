import test from 'node:test'
import assert from 'node:assert/strict'
import { light, dark } from '../mobile/src/palettes'

function luminance(hex: string) {
  const rgb = hex.slice(1).match(/../g)!.map(value => {
    const channel = parseInt(value, 16) / 255
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4
  })
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722
}
for (const [name, palette] of Object.entries({ light, dark })) {
  test(`${name} theme text and action labels meet 4.5:1 contrast`, () => {
    const pairs: [keyof typeof light, keyof typeof light][] = [
      ['onPrimary', 'primary'], ['onDanger', 'danger'],
      ['heroText', 'hero'], ['heroMuted', 'hero'],
      ['primary', 'softBlue'], ['success', 'softGreen'], ['amber', 'softAmber'], ['danger', 'softDanger'],
    ]
    for (const background of ['background', 'surface', 'surfaceRaised'] as const) {
      for (const text of ['ink', 'muted', 'subtle', 'primary', 'accent', 'danger', 'violet', 'cyan'] as const) pairs.push([text, background])
    }
    for (const [foreground, background] of pairs) {
      const a = luminance(palette[foreground]), b = luminance(palette[background])
      const contrast = (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
      assert.ok(contrast >= 4.5, `${name} ${foreground}/${background}: ${contrast.toFixed(2)}:1`)
    }
  })
}
