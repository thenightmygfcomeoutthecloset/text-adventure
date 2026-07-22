/**
 * 塔罗占卜引擎 (Tarot Engine)
 */
import { MAJOR_ARCANA, TAROT_SPREADS } from './tarot-data.js';

export function shuffleDeck() {
    const deck = MAJOR_ARCANA.map(card => ({ ...card }));
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck.map(card => {
        const isReversed = Math.random() < 0.3;
        return {
            ...card,
            isReversed,
            orientationLabel: isReversed ? '逆位' : '正位',
            keywords: isReversed ? card.keywordsReversed : card.keywordsUpright,
            meaningDesc: isReversed ? card.reversedDesc : card.uprightDesc,
        };
    });
}

export function performReading(spreadId, selectedIndexes, shuffledDeck) {
    const spread = TAROT_SPREADS.find(s => s.id === spreadId) || TAROT_SPREADS[0];
    const drawnCards = selectedIndexes.map((deckIndex, posIndex) => {
        const card = shuffledDeck[deckIndex];
        const positionInfo = spread.positions[posIndex] || { label: `位置 ${posIndex + 1}` };
        return {
            ...card,
            positionIndex: posIndex,
            positionLabel: positionInfo.label,
        };
    });

    const elementCounts = { '火': 0, '水': 0, '风': 0, '土': 0 };
    let uprightCount = 0, reversedCount = 0;

    drawnCards.forEach(c => {
        if (elementCounts[c.element] !== undefined) elementCounts[c.element]++;
        if (c.isReversed) reversedCount++;
        else uprightCount++;
    });

    let dominantElement = '火', maxCount = 0;
    for (const [el, count] of Object.entries(elementCounts)) {
        if (count > maxCount) {
            maxCount = count;
            dominantElement = el;
        }
    }

    let adviceText = `抽取出的核心能量牌为【${drawnCards[0].name}${drawnCards[0].orientationLabel}】。建议保持【${dominantElement}】元素的专注与坚定，顺应当下能量变化前行。`;

    return {
        spread,
        drawnCards,
        energyAnalysis: { elementCounts, uprightCount, reversedCount, dominantElement },
        overallAdvice: adviceText,
    };
}
