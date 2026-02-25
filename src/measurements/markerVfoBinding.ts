export type VfoBindingId = 'main' | 'aux';

export const resolveVfoDisplayFrequencyHz = (
  activeVfoId: VfoBindingId,
  tunedDisplayFrequencyHz: number,
  secondaryVfoEnabled: boolean,
  secondaryVfoOffsetHz: number
): number => {
  if (activeVfoId === 'aux' && secondaryVfoEnabled) {
    return Math.round(tunedDisplayFrequencyHz + secondaryVfoOffsetHz);
  }

  return Math.round(tunedDisplayFrequencyHz);
};

export const resolveSecondaryOffsetFromMarkerHz = (
  markerFrequencyHz: number,
  tunedDisplayFrequencyHz: number
): number => {
  return Math.round(markerFrequencyHz - tunedDisplayFrequencyHz);
};
