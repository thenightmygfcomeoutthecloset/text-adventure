/**
 * 八字排盘引擎 (BaZi / Four Pillars of Destiny Engine)
 * 
 * 核心功能：
 * - 四柱（年月日时）天干地支计算
 * - 五行分析与统计
 * - 十神推导
 * - 日主强弱判断 & 喜用神推导（简化版）
 * - 2026下半年流月数据
 */

// ============================================================
//  常量定义
// ============================================================

/** 十天干 */
export const TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

/** 十二地支 */
export const DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/** 五行名称 */
export const WU_XING_NAMES = ['木', '火', '土', '金', '水'];

/** 五行英文（用于CSS类名） */
export const WU_XING_EN = ['wood', 'fire', 'earth', 'metal', 'water'];

/** 天干→五行索引映射: 甲乙→木(0), 丙丁→火(1), 戊己→土(2), 庚辛→金(3), 壬癸→水(4) */
export const STEM_TO_ELEMENT = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];

/** 地支→五行索引映射: 子→水, 丑→土, 寅→木, 卯→木, 辰→土, 巳→火, 午→火, 未→土, 申→金, 酉→金, 戌→土, 亥→水 */
export const BRANCH_TO_ELEMENT = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];

/** 天干阴阳: 偶数索引为阳, 奇数索引为阴 */
export function isYang(stemIndex) {
    return stemIndex % 2 === 0;
}

/** 地支藏干（主气在前） */
export const BRANCH_HIDDEN_STEMS = [
    [9],        // 子: 癸
    [5, 9, 7],  // 丑: 己癸辛
    [0, 2, 4],  // 寅: 甲丙戊
    [1],        // 卯: 乙
    [4, 1, 9],  // 辰: 戊乙癸
    [2, 4, 6],  // 巳: 丙戊庚
    [3, 5],     // 午: 丁己
    [5, 3, 1],  // 未: 己丁乙
    [6, 4, 8],  // 申: 庚戊壬
    [7],        // 酉: 辛
    [4, 7, 3],  // 戌: 戊辛丁
    [8, 0],     // 亥: 壬甲
];

/** 地支藏干权重 (主气, 中气, 余气) */
const HIDDEN_STEM_WEIGHTS = [1.0, 0.3, 0.15];

/** 十神名称 */
export const TEN_GODS = ['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印'];

/** 十二时辰名称与时间范围 */
export const SHI_CHEN = [
    { name: '子时', range: '23:00-00:59', branch: 0 },
    { name: '丑时', range: '01:00-02:59', branch: 1 },
    { name: '寅时', range: '03:00-04:59', branch: 2 },
    { name: '卯时', range: '05:00-06:59', branch: 3 },
    { name: '辰时', range: '07:00-08:59', branch: 4 },
    { name: '巳时', range: '09:00-10:59', branch: 5 },
    { name: '午时', range: '11:00-12:59', branch: 6 },
    { name: '未时', range: '13:00-14:59', branch: 7 },
    { name: '申时', range: '15:00-16:59', branch: 8 },
    { name: '酉时', range: '17:00-18:59', branch: 9 },
    { name: '戌时', range: '19:00-20:59', branch: 10 },
    { name: '亥时', range: '21:00-22:59', branch: 11 },
];

/** 五行生克关系 */
const SHENG = { 0: 1, 1: 2, 2: 3, 3: 4, 4: 0 }; // 木→火→土→金→水→木
const KE   = { 0: 2, 1: 3, 2: 4, 3: 0, 4: 1 };   // 木→土, 火→金, 土→水, 金→木, 水→火
const SHENG_BY = { 0: 4, 1: 0, 2: 1, 3: 2, 4: 3 }; // 生我: 木←水, 火←木, ...
const KE_BY   = { 0: 3, 1: 4, 2: 0, 3: 1, 4: 2 };  // 克我: 木←金, 火←水, ...

/**
 * 2026年丙午年 下半年流月数据 (7月-12月)
 * 月份基于节气：小暑→立秋→白露→寒露→立冬→大雪
 */
export const H2_2026_MONTHS = [
    { index: 0, stem: 1, branch: 7,  ganZhi: '乙未', monthName: '七月',   element: '木/土', period: '小暑 — 立秋',   gregorian: '7月7日 — 8月6日',   season: '盛夏' },
    { index: 1, stem: 2, branch: 8,  ganZhi: '丙申', monthName: '八月',   element: '火/金', period: '立秋 — 白露',   gregorian: '8月7日 — 9月7日',   season: '初秋' },
    { index: 2, stem: 3, branch: 9,  ganZhi: '丁酉', monthName: '九月',   element: '火/金', period: '白露 — 寒露',   gregorian: '9月8日 — 10月7日',  season: '仲秋' },
    { index: 3, stem: 4, branch: 10, ganZhi: '戊戌', monthName: '十月',   element: '土/土', period: '寒露 — 立冬',   gregorian: '10月8日 — 11月6日', season: '深秋' },
    { index: 4, stem: 5, branch: 11, ganZhi: '己亥', monthName: '十一月', element: '土/水', period: '立冬 — 大雪',   gregorian: '11月7日 — 12月6日', season: '初冬' },
    { index: 5, stem: 6, branch: 0,  ganZhi: '庚子', monthName: '十二月', element: '金/水', period: '大雪 — 小寒',   gregorian: '12月7日 — 1月5日',  season: '隆冬' },
];


// ============================================================
//  核心计算函数
// ============================================================

/**
 * 公历日期 → 儒略日数 (Julian Day Number)
 * 使用标准格里历→JDN公式
 */
function gregorianToJDN(year, month, day) {
    const a = Math.floor((14 - month) / 12);
    const y = year + 4800 - a;
    const m = month + 12 * a - 3;
    return day + Math.floor((153 * m + 2) / 5) + 365 * y
        + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

/**
 * 计算年柱
 * 以立春(约2月4日)为年界
 */
function getYearPillar(year, month, day) {
    let adjustedYear = year;
    if (month < 2 || (month === 2 && day < 4)) {
        adjustedYear -= 1;
    }
    const stem = ((adjustedYear - 4) % 10 + 10) % 10;
    const branch = ((adjustedYear - 4) % 12 + 12) % 12;
    return { stem, branch };
}

/**
 * 计算月柱
 * 根据节气划分月份，由年干推月干（五虎遁月）
 */
function getMonthPillar(year, month, day, yearStem) {
    // 节气近似日期与对应月支
    const dateNum = month * 100 + day;
    let monthBranch;

    if (dateNum >= 204 && dateNum < 306)       monthBranch = 2;   // 立春→惊蛰 → 寅月
    else if (dateNum >= 306 && dateNum < 405)  monthBranch = 3;   // 惊蛰→清明 → 卯月
    else if (dateNum >= 405 && dateNum < 506)  monthBranch = 4;   // 清明→立夏 → 辰月
    else if (dateNum >= 506 && dateNum < 606)  monthBranch = 5;   // 立夏→芒种 → 巳月
    else if (dateNum >= 606 && dateNum < 707)  monthBranch = 6;   // 芒种→小暑 → 午月
    else if (dateNum >= 707 && dateNum < 807)  monthBranch = 7;   // 小暑→立秋 → 未月
    else if (dateNum >= 807 && dateNum < 908)  monthBranch = 8;   // 立秋→白露 → 申月
    else if (dateNum >= 908 && dateNum < 1008) monthBranch = 9;   // 白露→寒露 → 酉月
    else if (dateNum >= 1008 && dateNum < 1107) monthBranch = 10; // 寒露→立冬 → 戌月
    else if (dateNum >= 1107 && dateNum < 1207) monthBranch = 11; // 立冬→大雪 → 亥月
    else if (dateNum >= 1207 || dateNum < 106)  monthBranch = 0;  // 大雪→小寒 → 子月
    else monthBranch = 1;                                          // 小寒→立春 → 丑月

    // 五虎遁月: 甲己→丙寅(2), 乙庚→戊寅(4), 丙辛→庚寅(6), 丁壬→壬寅(8), 戊癸→甲寅(0)
    const monthStemStarts = [2, 4, 6, 8, 0];
    const monthStemStart = monthStemStarts[yearStem % 5];
    const monthOrder = ((monthBranch - 2) + 12) % 12;
    const stem = (monthStemStart + monthOrder) % 10;

    return { stem, branch: monthBranch };
}

/**
 * 计算日柱
 * 通过儒略日数推算日干支
 */
function getDayPillar(year, month, day) {
    const jdn = gregorianToJDN(year, month, day);
    const stem = ((jdn + 9) % 10 + 10) % 10;
    const branch = ((jdn + 1) % 12 + 12) % 12;
    return { stem, branch };
}

/**
 * 计算时柱
 * 由日干推时干（五鼠遁时）
 * @param {number} hourBranch - 时辰地支索引 (0=子时, 1=丑时, ...)
 * @param {number} dayStem - 日干索引
 */
function getHourPillar(hourBranch, dayStem) {
    // 五鼠遁时: 甲己→甲子(0), 乙庚→丙子(2), 丙辛→戊子(4), 丁壬→庚子(6), 戊癸→壬子(8)
    const hourStemStarts = [0, 2, 4, 6, 8];
    const hourStemStart = hourStemStarts[dayStem % 5];
    const stem = (hourStemStart + hourBranch) % 10;
    return { stem, branch: hourBranch };
}


// ============================================================
//  十神计算
// ============================================================

/**
 * 计算十神关系
 * @param {number} dayStem - 日主天干索引
 * @param {number} otherStem - 其他天干索引
 * @returns {string} 十神名称
 */
export function getTenGod(dayStem, otherStem) {
    if (dayStem === otherStem) return '比肩';

    const dayEl = STEM_TO_ELEMENT[dayStem];
    const otherEl = STEM_TO_ELEMENT[otherStem];
    const samePolarity = (dayStem % 2) === (otherStem % 2);

    // 同我: 比肩/劫财
    if (dayEl === otherEl) {
        return samePolarity ? '比肩' : '劫财';
    }
    // 我生: 食神/伤官
    if (SHENG[dayEl] === otherEl) {
        return samePolarity ? '食神' : '伤官';
    }
    // 生我: 偏印/正印
    if (SHENG_BY[dayEl] === otherEl) {
        return samePolarity ? '偏印' : '正印';
    }
    // 我克: 偏财/正财
    if (KE[dayEl] === otherEl) {
        return samePolarity ? '偏财' : '正财';
    }
    // 克我: 七杀/正官
    if (KE_BY[dayEl] === otherEl) {
        return samePolarity ? '七杀' : '正官';
    }

    return '未知';
}

/**
 * 获取十神对应的英文标识（用于分类）
 */
export function getTenGodCategory(tenGod) {
    const map = {
        '比肩': 'companion', '劫财': 'rob',
        '食神': 'eating',    '伤官': 'hurting',
        '偏财': 'indirect_wealth', '正财': 'direct_wealth',
        '七杀': 'seven_kill',     '正官': 'direct_officer',
        '偏印': 'indirect_seal',  '正印': 'direct_seal',
    };
    return map[tenGod] || 'unknown';
}


// ============================================================
//  五行分析
// ============================================================

/**
 * 统计八字中五行分布
 * 考虑天干、地支和地支藏干（加权）
 * @returns {{ counts: number[], dominant: number, weak: number, names: string[] }}
 */
function analyzeWuXing(pillars) {
    const counts = [0, 0, 0, 0, 0]; // 木火土金水

    for (const p of pillars) {
        // 天干五行 (权重 1.0)
        counts[STEM_TO_ELEMENT[p.stem]] += 1.0;
        // 地支五行 (权重 0.7)
        counts[BRANCH_TO_ELEMENT[p.branch]] += 0.7;
        // 地支藏干 (加权)
        const hidden = BRANCH_HIDDEN_STEMS[p.branch];
        hidden.forEach((s, i) => {
            counts[STEM_TO_ELEMENT[s]] += HIDDEN_STEM_WEIGHTS[i] * 0.5;
        });
    }

    // 找最强和最弱
    let dominant = 0, weak = 0;
    for (let i = 1; i < 5; i++) {
        if (counts[i] > counts[dominant]) dominant = i;
        if (counts[i] < counts[weak]) weak = i;
    }

    return {
        counts: counts.map(c => Math.round(c * 100) / 100),
        dominant,
        weak,
        names: WU_XING_NAMES,
    };
}


// ============================================================
//  日主强弱 & 喜用神（简化版）
// ============================================================

/**
 * 判断日主强弱，推导喜用神
 * 简化逻辑：统计生扶日主和克泄日主的力量对比
 */
function analyzeDayMaster(dayStem, pillars) {
    const dayElement = STEM_TO_ELEMENT[dayStem];
    const producesMe = SHENG_BY[dayElement]; // 生我的五行
    const sameAsMe = dayElement;             // 同我的五行

    let supportPower = 0;  // 生扶力量
    let drainPower = 0;    // 克泄耗力量

    for (const p of pillars) {
        const stemEl = STEM_TO_ELEMENT[p.stem];
        const branchEl = BRANCH_TO_ELEMENT[p.branch];

        for (const el of [stemEl, branchEl]) {
            if (el === sameAsMe || el === producesMe) {
                supportPower += 1;
            } else {
                drainPower += 1;
            }
        }
    }

    const isStrong = supportPower >= drainPower;

    // 喜用神推导（简化）
    // 日主强 → 喜克泄耗（官杀、食伤、财星）→ 喜用神为克我/我生/我克的五行
    // 日主弱 → 喜生扶（印星、比劫）→ 喜用神为生我/同我的五行
    let xiYong, jiYong; // 喜神, 用神
    if (isStrong) {
        xiYong = KE_BY[dayElement];  // 克我 → 官杀
        jiYong = SHENG[dayElement];  // 我生 → 食伤
    } else {
        xiYong = SHENG_BY[dayElement]; // 生我 → 印星
        jiYong = dayElement;            // 同我 → 比劫
    }

    // 忌神
    let jiShen;
    if (isStrong) {
        jiShen = dayElement; // 同我加重身强
    } else {
        jiShen = KE_BY[dayElement]; // 克我加重身弱
    }

    return {
        element: dayElement,
        elementName: WU_XING_NAMES[dayElement],
        isStrong,
        strengthLabel: isStrong ? '身强' : '身弱',
        xiYong: { index: xiYong, name: WU_XING_NAMES[xiYong] },
        jiYong: { index: jiYong, name: WU_XING_NAMES[jiYong] },
        jiShen: { index: jiShen, name: WU_XING_NAMES[jiShen] },
        supportPower,
        drainPower,
    };
}


// ============================================================
//  纳音 (可选装饰性信息)
// ============================================================

const NA_YIN_TABLE = [
    '海中金', '海中金', '炉中火', '炉中火', '大林木', '大林木',
    '路旁土', '路旁土', '剑锋金', '剑锋金', '山头火', '山头火',
    '涧下水', '涧下水', '城头土', '城头土', '白蜡金', '白蜡金',
    '杨柳木', '杨柳木', '泉中水', '泉中水', '屋上土', '屋上土',
    '霹雳火', '霹雳火', '松柏木', '松柏木', '长流水', '长流水',
    '砂石金', '砂石金', '山下火', '山下火', '平地木', '平地木',
    '壁上土', '壁上土', '金箔金', '金箔金', '覆灯火', '覆灯火',
    '天河水', '天河水', '大驿土', '大驿土', '钗环金', '钗环金',
    '桑柘木', '桑柘木', '大溪水', '大溪水', '沙中土', '沙中土',
    '天上火', '天上火', '石榴木', '石榴木', '大海水', '大海水',
];

/**
 * 获取纳音
 */
function getNaYin(stem, branch) {
    const ganZhiIndex = (stem % 10) + ((branch - stem % 12 + 12) % 12);
    // 正确计算六十甲子序号
    // 甲子=0, 乙丑=1, ..., 癸亥=59
    // 公式: 找到同时满足 index%10=stem 且 index%12=branch 的最小非负整数
    for (let i = 0; i < 60; i++) {
        if (i % 10 === stem && i % 12 === branch) {
            return NA_YIN_TABLE[i];
        }
    }
    return '';
}


// ============================================================
//  生肖
// ============================================================

export const SHENG_XIAO = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

export function getZodiac(branchIndex) {
    return SHENG_XIAO[branchIndex];
}


// ============================================================
//  主入口：排盘
// ============================================================

/**
 * 计算完整八字排盘
 * @param {number} year  - 公历年
 * @param {number} month - 公历月 (1-12)
 * @param {number} day   - 公历日 (1-31)
 * @param {number} hourBranch - 时辰地支索引 (0=子时 ~ 11=亥时)，-1表示不选时辰
 * @param {string} gender - 'male' | 'female'
 * @returns {object} 完整排盘结果
 */
export function calculateBaZi(year, month, day, hourBranch, gender = 'male') {
    // 1. 四柱计算
    const yearPillar = getYearPillar(year, month, day);
    const monthPillar = getMonthPillar(year, month, day, yearPillar.stem);
    const dayPillar = getDayPillar(year, month, day);

    let hourPillar = null;
    if (hourBranch >= 0) {
        hourPillar = getHourPillar(hourBranch, dayPillar.stem);
    }

    // 构造柱数据
    const makePillarData = (pillar, label) => ({
        label,
        stem: pillar.stem,
        branch: pillar.branch,
        stemChar: TIAN_GAN[pillar.stem],
        branchChar: DI_ZHI[pillar.branch],
        ganZhi: TIAN_GAN[pillar.stem] + DI_ZHI[pillar.branch],
        stemElement: WU_XING_NAMES[STEM_TO_ELEMENT[pillar.stem]],
        branchElement: WU_XING_NAMES[BRANCH_TO_ELEMENT[pillar.branch]],
        stemElementIndex: STEM_TO_ELEMENT[pillar.stem],
        branchElementIndex: BRANCH_TO_ELEMENT[pillar.branch],
        naYin: getNaYin(pillar.stem, pillar.branch),
        hiddenStems: BRANCH_HIDDEN_STEMS[pillar.branch].map(s => ({
            stem: s,
            char: TIAN_GAN[s],
            element: WU_XING_NAMES[STEM_TO_ELEMENT[s]],
        })),
    });

    const pillarsArray = [yearPillar, monthPillar, dayPillar];
    if (hourPillar) pillarsArray.push(hourPillar);

    const fourPillars = {
        year: makePillarData(yearPillar, '年柱'),
        month: makePillarData(monthPillar, '月柱'),
        day: makePillarData(dayPillar, '日柱'),
        hour: hourPillar ? makePillarData(hourPillar, '时柱') : null,
    };

    // 2. 日主信息
    const dayStem = dayPillar.stem;
    const dayMaster = {
        stem: dayStem,
        char: TIAN_GAN[dayStem],
        element: WU_XING_NAMES[STEM_TO_ELEMENT[dayStem]],
        elementIndex: STEM_TO_ELEMENT[dayStem],
        yinYang: isYang(dayStem) ? '阳' : '阴',
        description: `${isYang(dayStem) ? '阳' : '阴'}${WU_XING_NAMES[STEM_TO_ELEMENT[dayStem]]}`,
    };

    // 3. 十神（以日干为中心，对其他柱的天干求十神）
    const tenGods = {
        year: getTenGod(dayStem, yearPillar.stem),
        month: getTenGod(dayStem, monthPillar.stem),
        hour: hourPillar ? getTenGod(dayStem, hourPillar.stem) : null,
    };

    // 4. 五行分析
    const wuXing = analyzeWuXing(pillarsArray);

    // 5. 日主强弱 & 喜用神
    const dayMasterAnalysis = analyzeDayMaster(dayStem, pillarsArray);

    // 6. 生肖
    const zodiac = getZodiac(yearPillar.branch);

    // 7. 2026下半年流月十神
    const monthlyTenGods = H2_2026_MONTHS.map(m => ({
        ...m,
        stemTenGod: getTenGod(dayStem, m.stem),
        branchTenGod: getTenGod(dayStem, BRANCH_HIDDEN_STEMS[m.branch][0]), // 用月支主气藏干
    }));

    return {
        input: { year, month, day, hourBranch, gender },
        fourPillars,
        dayMaster,
        dayMasterAnalysis,
        tenGods,
        wuXing,
        zodiac,
        monthlyTenGods,
    };
}
