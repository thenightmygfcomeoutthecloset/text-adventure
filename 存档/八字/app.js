/**
 * 命运星盘 — 统一应用控制器 (app.js)
 * 
 * 核心功能：
 * - 首页 Portal 与 导航模式切换 ('portal' | 'bazi' | 'tarot')
 * - 八字表单初始化、城市经度加载、真太阳时 (True Solar Time) 实时换算
 * - 塔罗牌 3D 洗牌、选择、翻牌动画与报告
 */

import { calculateBaZi, CITY_LONGITUDES } from './bazi-engine.js';
import { analyzeFortune } from './fortune-analyzer.js';
import { TAROT_SPREADS, generateCardSvg } from './tarot-data.js';
import { shuffleDeck, performReading } from './tarot-engine.js';

// 全局状态
let activeMode = 'portal'; // 'portal' | 'bazi' | 'tarot'

// 塔罗状态
let tarotSpread = TAROT_SPREADS[0];
let tarotDeck = [];
let tarotSelectedIndexes = [];
let tarotStep = 'init';

// ============================================================
//  1. 页面模式与导航控制器
// ============================================================

function switchMode(mode) {
    activeMode = mode;

    const portalSection = document.getElementById('portalSection');
    const baziSection = document.getElementById('baziSection');
    const tarotSection = document.getElementById('tarotSection');

    const navBtns = {
        portal: document.getElementById('navHomeBtn'),
        bazi: document.getElementById('navBaziBtn'),
        tarot: document.getElementById('navTarotBtn'),
    };

    // 按钮样式
    Object.keys(navBtns).forEach(k => {
        if (navBtns[k]) {
            if (k === mode) navBtns[k].classList.add('active');
            else navBtns[k].classList.remove('active');
        }
    });

    // 区域隐藏与展示
    portalSection.classList.add('hidden');
    baziSection.classList.add('hidden');
    tarotSection.classList.add('hidden');

    if (mode === 'portal') {
        portalSection.classList.remove('hidden');
    } else if (mode === 'bazi') {
        baziSection.classList.remove('hidden');
    } else if (mode === 'tarot') {
        tarotSection.classList.remove('hidden');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function initNavigation() {
    document.getElementById('navLogo').addEventListener('click', () => switchMode('portal'));
    document.getElementById('navHomeBtn').addEventListener('click', () => switchMode('portal'));
    document.getElementById('navBaziBtn').addEventListener('click', () => switchMode('bazi'));
    document.getElementById('navTarotBtn').addEventListener('click', () => switchMode('tarot'));

    document.getElementById('portalBaziCard').addEventListener('click', () => switchMode('bazi'));
    document.getElementById('portalTarotCard').addEventListener('click', () => switchMode('tarot'));
}

// ============================================================
//  2. 八字模块 (含出生城市与真太阳时计算)
// ============================================================

function initBaziForm() {
    const yearSelect = document.getElementById('birthYear');
    const monthSelect = document.getElementById('birthMonth');
    const daySelect = document.getElementById('birthDay');
    const hourSelect = document.getElementById('birthHour');
    const minuteSelect = document.getElementById('birthMinute');
    const citySelect = document.getElementById('birthCity');

    // 年
    for (let y = 2026; y >= 1940; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = `${y}年`;
        if (y === 1995) opt.selected = true;
        yearSelect.appendChild(opt);
    }

    // 月
    for (let m = 1; m <= 12; m++) {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = `${m}月`;
        monthSelect.appendChild(opt);
    }

    // 日
    function updateDays() {
        const y = parseInt(yearSelect.value);
        const m = parseInt(monthSelect.value);
        const daysInMonth = new Date(y, m, 0).getDate();
        const curDay = parseInt(daySelect.value) || 1;

        daySelect.innerHTML = '';
        for (let d = 1; d <= daysInMonth; d++) {
            const opt = document.createElement('option');
            opt.value = d;
            opt.textContent = `${d}日`;
            if (d === Math.min(curDay, daysInMonth)) opt.selected = true;
            daySelect.appendChild(opt);
        }
    }
    yearSelect.addEventListener('change', updateDays);
    monthSelect.addEventListener('change', updateDays);
    updateDays();

    // 小时 (0-23)
    for (let h = 0; h < 24; h++) {
        const opt = document.createElement('option');
        opt.value = h;
        opt.textContent = `${String(h).padStart(2, '0')} 点 (${h}时)`;
        if (h === 12) opt.selected = true;
        hourSelect.appendChild(opt);
    }

    // 分钟 (0-59)
    for (let min = 0; min < 60; min += 5) {
        const opt = document.createElement('option');
        opt.value = min;
        opt.textContent = `${String(min).padStart(2, '0')} 分`;
        minuteSelect.appendChild(opt);
    }

    // 出生城市 (含经度)
    CITY_LONGITUDES.forEach((c, idx) => {
        const opt = document.createElement('option');
        opt.value = c.lng;
        opt.textContent = `${c.province} - ${c.city} (${c.lng}°E)`;
        if (c.city === '北京') opt.selected = true;
        citySelect.appendChild(opt);
    });

    // 性别切换
    const gMale = document.getElementById('genderMale');
    const gFemale = document.getElementById('genderFemale');
    gMale.addEventListener('click', () => { gMale.classList.add('active'); gFemale.classList.remove('active'); });
    gFemale.addEventListener('click', () => { gFemale.classList.add('active'); gMale.classList.remove('active'); });

    // 表单提交
    document.getElementById('baziForm').addEventListener('submit', handleBaziSubmit);
}

function handleBaziSubmit(e) {
    e.preventDefault();

    const year = parseInt(document.getElementById('birthYear').value);
    const month = parseInt(document.getElementById('birthMonth').value);
    const day = parseInt(document.getElementById('birthDay').value);
    const hour = parseInt(document.getElementById('birthHour').value);
    const minute = parseInt(document.getElementById('birthMinute').value);
    const longitude = parseFloat(document.getElementById('birthCity').value);
    const gender = document.querySelector('input[name="gender"]:checked').value;

    showLoading('紫微真太阳时推演中…');

    setTimeout(() => {
        const bazi = calculateBaZi(year, month, day, hour, minute, longitude, gender);
        const fortune = analyzeFortune(bazi);

        renderBaziResults(bazi, fortune);

        hideLoading();
        document.getElementById('baziFormCard').classList.add('hidden');
        document.getElementById('baziResultSection').classList.remove('hidden');
    }, 1500);
}

function renderBaziResults(bazi, fortune) {
    // 1. 真太阳时提示 Banner
    const banner = document.getElementById('solarTimeBanner');
    const ts = bazi.trueSolar;
    const offsetStr = ts.offsetMinutes >= 0 ? `+${ts.offsetMinutes}` : `${ts.offsetMinutes}`;
    
    banner.innerHTML = `
        <strong>🌍 真太阳时校正结果：</strong><br>
        • 输入北京时间：<code>${ts.originalTime}</code><br>
        • 经度校正 (经度 ${ts.longitude}°E)：经度时差约 <code>${offsetStr} 分钟</code><br>
        • 校正后真太阳时：<code>${ts.adjustedTime}</code>（以真太阳时判定时柱与日柱）
    `;

    // 2. 四柱
    const pillarsContainer = document.getElementById('fourPillars');
    pillarsContainer.innerHTML = '';
    const keys = ['year', 'month', 'day', 'hour'];
    const labels = ['年柱', '月柱', '日柱', '时柱'];

    keys.forEach((k, idx) => {
        const p = bazi.fourPillars[k];
        const card = document.createElement('div');
        card.className = 'pillar-card';
        card.innerHTML = `
            <div class="pillar-label">${labels[idx]}</div>
            <div class="pillar-stem">${p.stemChar}</div>
            <div class="pillar-branch">${p.branchChar}</div>
            <div class="pillar-element">${p.stemElement} / ${p.branchElement}</div>
            <div class="pillar-nayin">${p.naYin}</div>
            <div class="pillar-ten-god">${k === 'day' ? '日主' : (bazi.tenGods[k] || '')}</div>
        `;
        pillarsContainer.appendChild(card);
    });

    // 3. 日主
    const dm = fortune.dayMasterDesc;
    document.getElementById('dayMasterCard').innerHTML = `
        <h3 style="color: var(--gold-light); font-family: var(--font-serif); margin-bottom: 8px;">
            日主：${bazi.dayMaster.char} (${dm.title} · ${bazi.dayMaster.yinYang}${bazi.dayMaster.element})
        </h3>
        <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.8; margin-bottom: 12px;">${dm.description}</p>
        <div style="font-size: 0.85rem; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 8px; border-left: 3px solid var(--gold);">
            【${dm.strength}】 ${dm.strengthDesc}
        </div>
    `;

    // 4. 五行
    const wx = bazi.wuXing;
    let wxHtml = '<div style="display: flex; gap: 12px; margin-bottom: 16px;">';
    wx.names.forEach((name, i) => {
        wxHtml += `<div style="flex:1; text-align:center; padding:12px; background:rgba(255,255,255,0.03); border-radius:8px;">
            <div style="font-weight:bold; color:var(--gold-light);">${name}</div>
            <div style="font-size:0.85rem; color:var(--text-secondary);">${wx.counts[i]}</div>
        </div>`;
    });
    wxHtml += '</div>';
    wxHtml += `<div style="font-size:0.88rem; color:var(--gold-light); text-align:center;">
        喜神：<b>${bazi.dayMasterAnalysis.xiYong.name}</b> | 用神：<b>${bazi.dayMasterAnalysis.jiYong.name}</b> | 忌神：<b>${bazi.dayMasterAnalysis.jiShen.name}</b>
    </div>`;
    document.getElementById('wuXingCard').innerHTML = wxHtml;

    // 5. 幸运提示
    const lucky = fortune.luckyInfo;
    document.getElementById('luckyCard').innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; text-align: center;">
            <div><div style="font-size:0.75rem; color:var(--text-muted);">幸运颜色</div><div style="color:var(--gold-light); font-weight:bold;">${lucky.colors.join('、')}</div></div>
            <div><div style="font-size:0.75rem; color:var(--text-muted);">吉利方位</div><div style="color:var(--gold-light); font-weight:bold;">${lucky.direction}</div></div>
            <div><div style="font-size:0.75rem; color:var(--text-muted);">幸运数字</div><div style="color:var(--gold-light); font-weight:bold;">${lucky.numbers.join('、')}</div></div>
            <div><div style="font-size:0.75rem; color:var(--text-muted);">开运食物</div><div style="color:var(--gold-light); font-weight:bold;">${lucky.foods.join('、')}</div></div>
        </div>
    `;

    // 6. 2026下半年逐月
    const monthCards = document.getElementById('monthCards');
    monthCards.innerHTML = fortune.months.map(m => `
        <div style="background:var(--bg-card); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:20px; margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <div style="font-family:var(--font-serif); font-size:1.1rem; color:var(--gold-light);">
                    ${m.theme.icon} ${m.monthName} (${m.ganZhi}月 · ${m.gregorian})
                </div>
                <div style="font-family:var(--font-serif); font-size:1.4rem; color:var(--gold); font-weight:bold;">
                    ${m.avgScore} 分
                </div>
            </div>
            <div style="font-size:0.9rem; color:var(--text-secondary); line-height:1.7;">${m.overall}</div>
        </div>
    `).join('');

    // 7. 趋势总结
    document.getElementById('trendSummary').innerHTML = `
        <div style="text-align:center; padding:16px; background:rgba(255,255,255,0.03); border-radius:12px;">
            <div style="font-size:0.75rem; color:var(--text-muted);">整体走向</div>
            <div style="color:var(--gold-light); font-weight:bold; font-size:1.1rem;">${fortune.overall.trendLabel}</div>
        </div>
        <div style="text-align:center; padding:16px; background:rgba(255,255,255,0.03); border-radius:12px;">
            <div style="font-size:0.75rem; color:var(--text-muted);">最佳月份</div>
            <div style="color:var(--gold-light); font-weight:bold; font-size:1.1rem;">${fortune.overall.bestMonth.name} (${fortune.overall.bestMonth.score}分)</div>
        </div>
    `;
}

// ============================================================
//  3. 塔罗牌模块
// ============================================================

function initTarot() {
    const grid = document.getElementById('spreadGrid');
    grid.innerHTML = TAROT_SPREADS.map((s, idx) => `
        <div class="spread-card ${idx === 0 ? 'active' : ''}" data-id="${s.id}">
            <div class="spread-name">${s.name}</div>
            <div class="spread-desc">${s.description}</div>
        </div>
    `).join('');

    grid.querySelectorAll('.spread-card').forEach(card => {
        card.addEventListener('click', () => {
            grid.querySelectorAll('.spread-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            tarotSpread = TAROT_SPREADS.find(s => s.id === card.dataset.id);
            resetTarotStage();
        });
    });

    resetTarotStage();
    document.getElementById('tarotActionBtn').addEventListener('click', handleTarotShuffle);
    document.getElementById('tarotResetBtn').addEventListener('click', () => {
        document.getElementById('readingStage').style.display = 'block';
        resetTarotStage();
    });
}

function resetTarotStage() {
    tarotStep = 'init';
    tarotSelectedIndexes = [];
    document.getElementById('stageStatus').textContent = '点击下方按钮开启洗牌仪式';
    document.getElementById('tarotActionBtn').textContent = '开 始 洗 牌';
    document.getElementById('tarotActionBtn').style.display = 'inline-block';
    document.getElementById('tarotResultsSection').classList.add('hidden');

    const container = document.getElementById('deckContainer');
    container.innerHTML = '';
    for (let i = 0; i < 6; i++) {
        const c = document.createElement('div');
        c.className = 'tarot-card-3d';
        c.style.transform = `translate(${i * 2}px, ${-i * 2}px)`;
        c.innerHTML = `<div class="card-face card-back"><div class="card-back-symbol">✦</div></div>`;
        container.appendChild(c);
    }
}

function handleTarotShuffle() {
    tarotDeck = shuffleDeck();
    document.getElementById('stageStatus').textContent = '正在洗牌与凝聚能量…';

    const container = document.getElementById('deckContainer');
    container.innerHTML = '';
    const tempCards = [];
    for (let i = 0; i < 10; i++) {
        const c = document.createElement('div');
        c.className = 'tarot-card-3d';
        c.innerHTML = `<div class="card-face card-back"><div class="card-back-symbol">✦</div></div>`;
        container.appendChild(c);
        tempCards.push(c);
    }

    setTimeout(() => {
        tempCards.forEach((c, i) => {
            const tx = (i - 5) * 26;
            c.style.transform = `translate(${tx}px, 0)`;
            c.addEventListener('click', () => onTarotPick(i, c));
        });
        tarotStep = 'picking';
        document.getElementById('stageStatus').textContent = `请凭直觉选择 ${tarotSpread.cardsCount} 张卡牌 (${tarotSelectedIndexes.length}/${tarotSpread.cardsCount})`;
        document.getElementById('tarotActionBtn').style.display = 'none';
    }, 800);
}

function onTarotPick(idx, el) {
    if (tarotStep !== 'picking' || tarotSelectedIndexes.includes(idx)) return;

    tarotSelectedIndexes.push(idx);
    el.style.transform += ' translateY(-25px) scale(1.05)';
    document.getElementById('stageStatus').textContent = `已选择 ${tarotSelectedIndexes.length}/${tarotSpread.cardsCount} 张卡牌`;

    if (tarotSelectedIndexes.length === tarotSpread.cardsCount) {
        tarotStep = 'done';
        setTimeout(displayTarotResults, 600);
    }
}

function displayTarotResults() {
    const reading = performReading(tarotSpread.id, tarotSelectedIndexes, tarotDeck);

    document.getElementById('readingStage').style.display = 'none';
    const resSec = document.getElementById('tarotResultsSection');
    resSec.classList.remove('hidden');

    const cardsGrid = document.getElementById('tarotCardsGrid');
    cardsGrid.innerHTML = reading.drawnCards.map((c, i) => `
        <div class="result-card-item">
            <div style="font-size:0.8rem; color:var(--gold-light); margin-bottom:8px;">${c.positionLabel}</div>
            <div class="tarot-card-3d" id="tarotResCard-${i}" style="position:relative; margin:0 auto 12px;">
                <div class="card-face card-back"><div class="card-back-symbol">✦</div></div>
                <div class="card-face card-front">${generateCardSvg(c, c.isReversed)}</div>
            </div>
            <div style="font-weight:bold; color:var(--gold-light); font-size:0.9rem;">${c.name} (${c.orientationLabel})</div>
        </div>
    `).join('');

    reading.drawnCards.forEach((_, i) => {
        setTimeout(() => {
            const cardEl = document.getElementById(`tarotResCard-${i}`);
            if (cardEl) cardEl.classList.add('flipped');
        }, (i + 1) * 350);
    });

    document.getElementById('tarotReport').innerHTML = `
        <h3 style="color:var(--gold-light); font-family:var(--font-serif); text-align:center; margin-bottom:20px;">
            ${reading.spread.name} · 启示报告
        </h3>
        ${reading.drawnCards.map(c => `
            <div style="background:rgba(255,255,255,0.03); border-radius:12px; padding:16px; margin-bottom:12px;">
                <div style="font-weight:bold; color:var(--gold-light);">${c.positionLabel} — 【${c.name} · ${c.orientationLabel}】</div>
                <div style="font-size:0.85rem; color:var(--text-secondary); margin-top:6px;">${c.meaningDesc}</div>
            </div>
        `).join('')}
        <div style="margin-top:20px; padding:16px; background:rgba(212,168,83,0.1); border-radius:12px; border-left:3px solid var(--gold);">
            <strong>🌌 能量启示：</strong> ${reading.overallAdvice}
        </div>
    `;
}

// ============================================================
//  4. 助手工具与 Canvas 背景
// ============================================================

function showLoading(text) {
    const el = document.getElementById('loadingOverlay');
    document.getElementById('loadingText').textContent = text;
    el.classList.add('active');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('active');
}

function initCanvas() {
    const canvas = document.getElementById('appCanvas');
    const ctx = canvas.getContext('2d');
    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
    });

    const particles = Array.from({ length: 100 }, () => ({
        x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.5, a: Math.random()
    }));

    function animate() {
        ctx.clearRect(0, 0, w, h);
        particles.forEach(p => {
            ctx.fillStyle = `rgba(212, 168, 83, ${p.a})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        });
        requestAnimationFrame(animate);
    }
    animate();
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initCanvas();
    initNavigation();
    initBaziForm();
    initTarot();
});
