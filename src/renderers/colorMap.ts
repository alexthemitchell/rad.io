const COLOR_STOPS = [
  [6, 18, 19],
  [15, 48, 65],
  [10, 125, 126],
  [46, 196, 157],
  [239, 204, 93],
  [238, 86, 62],
] as const

export const WATERFALL_LUT = createColorLut()

function createColorLut(): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256 * 4)
  for (let index = 0; index < 256; index += 1) {
    const position = (index / 255) * (COLOR_STOPS.length - 1)
    const low = Math.floor(position)
    const high = Math.min(COLOR_STOPS.length - 1, low + 1)
    const mix = position - low
    const output = index * 4
    for (let channel = 0; channel < 3; channel += 1) {
      lut[output + channel] = Math.round(
        COLOR_STOPS[low][channel] * (1 - mix) +
          COLOR_STOPS[high][channel] * mix,
      )
    }
    lut[output + 3] = 255
  }
  return lut
}

export function spectrumIndex(powerDbfs: number): number {
  return Math.round(Math.max(0, Math.min(1, (powerDbfs + 120) / 110)) * 255)
}