export type IqToneMapping = 'iq' | 'qi' | 'i_neg_q' | 'qi_neg_i';

export interface IqIntegrityVariantResult {
    mapping: IqToneMapping;
    phaseStepRad: number;
    phaseErrorRad: number;
    coherence: number;
}

export interface IqIntegrityReport {
    detectedMapping: IqToneMapping;
    bestVariant: IqIntegrityVariantResult;
    variants: IqIntegrityVariantResult[];
    iRms: number;
    qRms: number;
    iqBalanceRatio: number;
    scaleRatio?: number;
    likelySwapped: boolean;
    likelyInvertedQuadrature: boolean;
    mappingError?: number;
}

const wrapPhaseError = (rad: number): number => {
    const twoPi = 2 * Math.PI;
    let wrapped = rad % twoPi;
    if (wrapped > Math.PI) wrapped -= twoPi;
    if (wrapped < -Math.PI) wrapped += twoPi;
    return Math.abs(wrapped);
};

const ci8At = (bytes: Uint8Array, index: number): number => bytes[index] - 128;

const mapIq = (i: number, q: number, mapping: IqToneMapping): [number, number] => {
    switch (mapping) {
        case 'iq':
            return [i, q];
        case 'qi':
            return [q, i];
        case 'i_neg_q':
            return [i, -q];
        case 'qi_neg_i':
            return [q, -i];
    }
};

const analyzeVariant = (
    bytes: Uint8Array,
    mapping: IqToneMapping,
    expectedPhaseStepRad: number
): IqIntegrityVariantResult => {
    let sumRe = 0;
    let sumIm = 0;
    let norm = 0;

    const complexCount = Math.floor(bytes.length / 2);
    for (let n = 0; n < complexCount - 1; n += 1) {
        const i0Raw = ci8At(bytes, n * 2);
        const q0Raw = ci8At(bytes, (n * 2) + 1);
        const i1Raw = ci8At(bytes, (n + 1) * 2);
        const q1Raw = ci8At(bytes, ((n + 1) * 2) + 1);

        const [i0, q0] = mapIq(i0Raw, q0Raw, mapping);
        const [i1, q1] = mapIq(i1Raw, q1Raw, mapping);

        // conj(z0) * z1
        sumRe += (i0 * i1) + (q0 * q1);
        sumIm += (i0 * q1) - (q0 * i1);

        norm += (i0 * i0) + (q0 * q0);
    }

    const phaseStepRad = Math.atan2(sumIm, sumRe);
    const phaseErrorRad = wrapPhaseError(phaseStepRad - expectedPhaseStepRad);
    const coherence = norm > 0
        ? (Math.hypot(sumRe, sumIm) / norm)
        : 0;

    return {
        mapping,
        phaseStepRad,
        phaseErrorRad,
        coherence
    };
};

export const analyzeCi8ToneIntegrity = (
    iqData: Uint8Array,
    expectedPhaseStepRad: number,
    expectedAmplitudeRms?: number,
    expectedReferenceIq?: Uint8Array
): IqIntegrityReport => {
    if (iqData.length < 8 || iqData.length % 2 !== 0) {
        throw new Error('IQ data must be interleaved ci8 with at least 4 complex samples.');
    }

    const variants: IqIntegrityVariantResult[] = [
        analyzeVariant(iqData, 'iq', expectedPhaseStepRad),
        analyzeVariant(iqData, 'qi', expectedPhaseStepRad),
        analyzeVariant(iqData, 'i_neg_q', expectedPhaseStepRad),
        analyzeVariant(iqData, 'qi_neg_i', expectedPhaseStepRad)
    ];

    const phaseBestVariant = variants.reduce((best, candidate) => {
        if (candidate.phaseErrorRad < best.phaseErrorRad) return candidate;
        if (candidate.phaseErrorRad === best.phaseErrorRad && candidate.coherence > best.coherence) return candidate;
        return best;
    });

    const referenceErrorByMapping = new Map<IqToneMapping, number>();
    if (expectedReferenceIq) {
        if (expectedReferenceIq.length !== iqData.length) {
            throw new Error('Expected reference IQ must have the same byte length as IQ data.');
        }

        for (const mapping of ['iq', 'qi', 'i_neg_q', 'qi_neg_i'] as IqToneMapping[]) {
            let totalAbsError = 0;
            for (let n = 0; n < iqData.length; n += 2) {
                const iObsRaw = ci8At(iqData, n);
                const qObsRaw = ci8At(iqData, n + 1);
                const iRef = ci8At(expectedReferenceIq, n);
                const qRef = ci8At(expectedReferenceIq, n + 1);
                const [iObs, qObs] = mapIq(iObsRaw, qObsRaw, mapping);

                totalAbsError += Math.abs(iObs - iRef) + Math.abs(qObs - qRef);
            }
            referenceErrorByMapping.set(mapping, totalAbsError / (iqData.length / 2));
        }
    }

    const bestVariant = referenceErrorByMapping.size > 0
        ? variants.reduce((best, candidate) => {
            const bestError = referenceErrorByMapping.get(best.mapping) ?? Number.POSITIVE_INFINITY;
            const candidateError = referenceErrorByMapping.get(candidate.mapping) ?? Number.POSITIVE_INFINITY;
            if (candidateError < bestError) return candidate;
            if (candidateError === bestError && candidate.phaseErrorRad < best.phaseErrorRad) return candidate;
            return best;
        })
        : phaseBestVariant;

    let iPower = 0;
    let qPower = 0;
    const complexCount = iqData.length / 2;
    for (let n = 0; n < complexCount; n += 1) {
        const i = ci8At(iqData, n * 2);
        const q = ci8At(iqData, (n * 2) + 1);
        iPower += i * i;
        qPower += q * q;
    }

    const iRms = Math.sqrt(iPower / complexCount);
    const qRms = Math.sqrt(qPower / complexCount);
    const iqBalanceRatio = iRms > 0 ? (qRms / iRms) : 0;
    const amplitudeRms = Math.sqrt((iPower + qPower) / complexCount);

    return {
        detectedMapping: bestVariant.mapping,
        bestVariant,
        variants,
        iRms,
        qRms,
        iqBalanceRatio,
        scaleRatio: expectedAmplitudeRms && expectedAmplitudeRms > 0
            ? (amplitudeRms / expectedAmplitudeRms)
            : undefined,
        likelySwapped: bestVariant.mapping === 'qi' || bestVariant.mapping === 'qi_neg_i',
        likelyInvertedQuadrature: bestVariant.mapping === 'i_neg_q' || bestVariant.mapping === 'qi_neg_i',
        mappingError: referenceErrorByMapping.get(bestVariant.mapping)
    };
};
