/**
 * 前端交互主模块
 * 
 * 职责：
 * - 星空粒子动画
 * - 表单初始化与交互
 * - 调用排盘引擎 & 运势分析
 * - 动态渲染所有结果区域
 * - 趋势图表绘制
 * - 滚动动画触发
 */

import { calculateBaZi, WU_XING_NAMES, WU_XING_EN, TIAN_GAN, DI_ZHI } from './bazi-engine.js';
import { analyzeFortune } from './fortune-analyzer.js';

// ============================================================
//  星空粒子背景
// ============================================================

function initStarCanvas() {
    const canvas = document.getElementById('starCanvas');
    const ctx = canvas.getContext('2d');
    let stars = [];
    let shootingStars = [];
    let animId;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function createStars(count = 200) {
        stars = [];
        for (let i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                radius: Math.random() * 1.5 + 0.3,
                alpha: Math.random() * 0.8 + 0.2,
                speed: Math.random() * 0.0008 + 0.0002,
                phase: Math.random() * Math.PI * 2,
            });
        }
    }

    function maybeShootingStar() {
        if (Math.random() < 0.003 && shootingStars.length < 2) {
            shootingStars.push({
                x: Math.random() * canvas.width * 0.8,
                y: Math.random() * canvas.height * 0.3,
                len: Math.random() * 80 + 40,
                speed: Math.random() * 6 + 4,
                angle: Math.PI / 4 + (Math.random() - 0.5) * 0.3,
                alpha: 1,
            });
        }
    }

    function draw(time) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 普通星星
        for (const s of stars) {
            const twinkle = Math.sin(time * s.speed + s.phase) * 0.3 + 0.7;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(220, 220, 255, ${s.alpha * twinkle})`;
            ctx.fill();
        }

        // 流星
        maybeShootingStar();
        for (let i = shootingStars.length - 1; i >= 0; i--) {
            const ss = shootingStars[i];
            const dx = Math.cos(ss.angle) * ss.speed;
            const dy = Math.sin(ss.angle) * ss.speed;

            const gradient = ctx.createLinearGradient(
                ss.x, ss.y,
                ss.x - Math.cos(ss.angle) * ss.len,
                ss.y - Math.sin(ss.angle) * ss.len
            );
            gradient.addColorStop(0, `rgba(212, 168, 83, ${ss.alpha})`);
            gradient.addColorStop(1, `rgba(212, 168, 83, 0)`);

            ctx.beginPath();
            ctx.moveTo(ss.x, ss.y);
            ctx.lineTo(
                ss.x - Math.cos(ss.angle) * ss.len,
                ss.y - Math.sin(ss.angle) * ss.len
            );
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ss.x += dx;
            ss.y += dy;
            ss.alpha -= 0.012;

            if (ss.alpha <= 0 || ss.x > canvas.width || ss.y > canvas.height) {
                shootingStars.splice(i, 1);
            }
        }

        animId = requestAnimationFrame(draw);
    }

    resize();
    createStars();
    draw(0);

    window.addEventListener('resize', () => {
        resize();
        createStars();
    });
}

// ============================================================
//  表单初始化
// ============================================================

function initForm() {
    const yearSelect = document.getElementById('birthYear');
    const monthSelect = document.getElementById('birthMonth');
    const daySelect = document.getElementById('birthDay');

    // 年份 1940-2026
    for (let y = 2026; y >= 1940; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = `${y}年`;
        if (y === 1990) opt.selected = true;
        yearSelect.appendChild(opt);
    }

    // 月份
    for (let m = 1; m <= 12; m++) {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = `${m}月`;
        monthSelect.appendChild(opt);
    }

    // 日期
    function updateDays() {
        const y = parseInt(yearSelect.value);
        const m = parseInt(monthSelect.value);
        const daysInMonth = new Date(y, m, 0).getDate();
        const currentDay = parseInt(daySelect.value) || 1;

        daySelect.innerHTML = '';
        for (let d = 1; d <= daysInMonth; d++) {
            const opt = document.createElement('option');
            opt.value = d;
            opt.textContent = `${d}日`;
            if (d === Math.min(currentDay, daysInMonth)) opt.selected = true;
            daySelect.appendChild(opt);
        }
    }

    yearSelect.addEventListener('change', updateDays);
    monthSelect.addEventListener('change', updateDays);
    updateDays();

    // 性别切换
    const genderMale = document.getElementById('genderMale');
    const genderFemale = document.getElementById('genderFemale');

    genderMale.addEventListener('click', () => {
        genderMale.classList.add('active');
        genderFemale.classList.remove('active');
    });
    genderFemale.addEventListener('click', () => {
        genderFemale.classList.add('active');
        genderMale.classList.remove('active');
    });

    // 表单提交
    document.getElementById('birthForm').addEventListener('submit', handleSubmit);

    // 重新测算
    document.getElementById('restartBtn').addEventListener('click', handleRestart);
}

// ============================================================
//  提交处理
// ============================================================

function handleSubmit(e) {
    e.preventDefault();

    const year = parseInt(document.getElementById('birthYear').value);
    const month = parseInt(document.getElementById('birthMonth').value);
    const day = parseInt(document.getElementById('birthDay').value);
    const hourBranch = parseInt(document.getElementById('birthHour').value);
    const gender = document.querySelector('input[name="gender"]:checked').value;

    // 显示加载动画
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.add('active');

    // 模拟推演过程
    setTimeout(() => {
        try {
            // 排盘
            const baziResult = calculateBaZi(year, month, day, hourBranch, gender);
            // 运势分析
            const fortuneResult = analyzeFortune(baziResult);

            // 渲染结果
            renderResults(baziResult, fortuneResult);

            // 隐藏加载，显示结果
            overlay.classList.remove('active');
            document.getElementById('inputSection').style.display = 'none';
            document.querySelector('.hero-section .hero-subtitle').textContent = '命盘已成，请查看你的运势解析';

            const resultSection = document.getElementById('resultSection');
            resultSection.classList.add('visible');

            // 触发入场动画
            setTimeout(() => triggerScrollAnimations(), 200);
        } catch (err) {
            console.error('排盘出错:', err);
            overlay.classList.remove('active');
            alert('排盘计算出现问题，请检查输入信息后重试。');
        }
    }, 1800);
}

function handleRestart() {
    document.getElementById('inputSection').style.display = '';
    document.getElementById('resultSection').classList.remove('visible');
    document.querySelector('.hero-section .hero-subtitle').innerHTML = '输入你的生辰，解锁专属命盘<br>洞悉未来六个月的运势密码';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
//  渲染结果
// ============================================================

function renderResults(bazi, fortune) {
    renderFourPillars(bazi);
    renderDayMaster(bazi, fortune);
    renderWuXing(bazi);
    renderLucky(fortune);
    renderMonthCards(fortune);
    renderTrend(fortune);
}

// ---- 四柱 ----
function renderFourPillars(bazi) {
    const container = document.getElementById('fourPillars');
    const pillars = ['year', 'month', 'day', 'hour'];
    const labels = ['年柱', '月柱', '日柱', '时柱'];
    const elClassMap = { '木': 'el-wood', '火': 'el-fire', '土': 'el-earth', '金': 'el-metal', '水': 'el-water' };

    container.innerHTML = '';

    pillars.forEach((key, idx) => {
        const p = bazi.fourPillars[key];
        if (!p) return;

        const tenGod = key === 'day' ? '日主' : (bazi.tenGods[key] || '');

        const card = document.createElement('div');
        card.className = 'pillar-card';
        card.dataset.pillar = key;
        card.style.transitionDelay = `${idx * 0.12}s`;

        card.innerHTML = `
            <div class="pillar-label">${labels[idx]}</div>
            <div class="pillar-stem ${elClassMap[p.stemElement]}">${p.stemChar}</div>
            <div class="pillar-branch ${elClassMap[p.branchElement]}">${p.branchChar}</div>
            <div class="pillar-element">${p.stemElement}${p.stemChar} / ${p.branchElement}${p.branchChar}</div>
            <div class="pillar-nayin">${p.naYin}</div>
            ${tenGod ? `<div class="pillar-ten-god">${tenGod}</div>` : ''}
            <div class="pillar-hidden-stems">
                <div class="pillar-hidden-label">藏干</div>
                <div class="pillar-hidden-list">
                    ${p.hiddenStems.map(h => `<span class="pillar-hidden-item ${elClassMap[h.element]}">${h.char}</span>`).join('')}
                </div>
            </div>
        `;

        container.appendChild(card);
    });
}

// ---- 日主解析 ----
function renderDayMaster(bazi, fortune) {
    const card = document.getElementById('dayMasterCard');
    const dm = fortune.dayMasterDesc;
    const elClassMap = { '木': 'el-wood', '火': 'el-fire', '土': 'el-earth', '金': 'el-metal', '水': 'el-water' };

    card.innerHTML = `
        <div class="daymaster-header">
            <div class="daymaster-icon ${elClassMap[dm.element]}">${bazi.dayMaster.char}</div>
            <div class="daymaster-info">
                <h3>${dm.title} · ${dm.yinYang}${dm.element}</h3>
                <div class="tags">
                    <span class="daymaster-tag">日主 ${bazi.dayMaster.char}</span>
                    <span class="daymaster-tag">${dm.strength}</span>
                    <span class="daymaster-tag">生肖${bazi.zodiac}</span>
                    <span class="daymaster-tag">喜用 ${dm.xiYong}</span>
                </div>
            </div>
        </div>
        <div class="daymaster-desc">${dm.description}</div>
        <div class="daymaster-strength">${dm.strengthDesc}</div>
    `;
}

// ---- 五行分布 ----
function renderWuXing(bazi) {
    const card = document.getElementById('wuXingCard');
    const wx = bazi.wuXing;
    const maxCount = Math.max(...wx.counts, 1);
    const elNames = ['木', '火', '土', '金', '水'];
    const elClasses = ['el-wood', 'el-fire', 'el-earth', 'el-metal', 'el-water'];
    const analysis = bazi.dayMasterAnalysis;

    let barsHtml = '<div class="wuxing-bars">';
    elNames.forEach((name, i) => {
        const pct = Math.round((wx.counts[i] / maxCount) * 100);
        barsHtml += `
            <div class="wuxing-bar-row">
                <div class="wuxing-bar-label ${elClasses[i]}">${name}</div>
                <div class="wuxing-bar-track">
                    <div class="wuxing-bar-fill ${elClasses[i]}" data-width="${pct}"></div>
                </div>
                <div class="wuxing-bar-value">${wx.counts[i]}</div>
            </div>
        `;
    });
    barsHtml += '</div>';

    // 喜用忌神提示
    barsHtml += `
        <div class="wuxing-xi-yong">
            <div class="xi-yong-item">
                <div class="xi-yong-label">喜 神</div>
                <div class="xi-yong-value ${elClasses[analysis.xiYong.index]}">${analysis.xiYong.name}</div>
            </div>
            <div class="xi-yong-item">
                <div class="xi-yong-label">用 神</div>
                <div class="xi-yong-value ${elClasses[analysis.jiYong.index]}">${analysis.jiYong.name}</div>
            </div>
            <div class="xi-yong-item">
                <div class="xi-yong-label">忌 神</div>
                <div class="xi-yong-value ${elClasses[analysis.jiShen.index]}">${analysis.jiShen.name}</div>
            </div>
            <div class="xi-yong-item">
                <div class="xi-yong-label">日 主</div>
                <div class="xi-yong-value ${elClasses[analysis.element]}">${analysis.strengthLabel}</div>
            </div>
        </div>
    `;

    card.innerHTML = barsHtml;

    // 延迟触发动画
    setTimeout(() => {
        card.querySelectorAll('.wuxing-bar-fill').forEach(bar => {
            bar.style.width = bar.dataset.width + '%';
        });
    }, 400);
}

// ---- 幸运提示 ----
function renderLucky(fortune) {
    const card = document.getElementById('luckyCard');
    const lucky = fortune.luckyInfo;

    card.innerHTML = `
        <div class="lucky-grid">
            <div class="lucky-item">
                <div class="lucky-icon">🎨</div>
                <div class="lucky-label">幸运颜色</div>
                <div class="lucky-value">${lucky.colors.join('、')}</div>
            </div>
            <div class="lucky-item">
                <div class="lucky-icon">🧭</div>
                <div class="lucky-label">吉利方位</div>
                <div class="lucky-value">${lucky.direction}</div>
            </div>
            <div class="lucky-item">
                <div class="lucky-icon">🔢</div>
                <div class="lucky-label">幸运数字</div>
                <div class="lucky-value">${lucky.numbers.join('、')}</div>
            </div>
            <div class="lucky-item">
                <div class="lucky-icon">🍜</div>
                <div class="lucky-label">开运食物</div>
                <div class="lucky-value">${lucky.foods.join('、')}</div>
            </div>
        </div>
    `;
}

// ---- 月度运势卡片 ----
function renderMonthCards(fortune) {
    const container = document.getElementById('monthCards');
    container.innerHTML = '';

    fortune.months.forEach((m, idx) => {
        const card = document.createElement('div');
        card.className = 'month-card';
        card.style.transitionDelay = `${idx * 0.1}s`;

        // 星星渲染
        const renderStars = (score) => {
            let html = '';
            for (let i = 1; i <= 5; i++) {
                if (score >= i) {
                    html += '<span class="star filled">★</span>';
                } else if (score >= i - 0.5) {
                    html += '<span class="star half">★</span>';
                } else {
                    html += '<span class="star">★</span>';
                }
            }
            return html;
        };

        card.innerHTML = `
            <div class="month-card-header">
                <div class="month-header-left">
                    <div class="month-icon">${m.theme.icon}</div>
                    <div class="month-name-block">
                        <div class="month-name">${m.monthName}</div>
                        <div class="month-ganzhi">${m.ganZhi}月 · ${m.gregorian} · ${m.season}</div>
                    </div>
                    <div class="month-theme-badge" style="color: ${m.theme.color}; border-color: ${m.theme.color}30; background: ${m.theme.color}10;">
                        ${m.theme.theme}
                    </div>
                </div>
                <div class="month-header-right">
                    <div>
                        <div class="month-avg-score">${m.avgScore}</div>
                        <div class="month-avg-label">综合评分</div>
                    </div>
                    <div class="month-expand-icon">▼</div>
                </div>
            </div>
            <div class="month-card-body">
                <div class="month-card-content">
                    <div class="month-overall">${m.overall}</div>
                    <div class="dimension-list">
                        ${m.dimensions.map(d => `
                            <div class="dimension-item">
                                <div class="dimension-header">
                                    <div class="dimension-label">${d.icon} ${d.label}</div>
                                    <div class="dimension-stars">${renderStars(d.score)}</div>
                                </div>
                                <div class="dimension-text">${d.text}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        // 展开/折叠
        card.querySelector('.month-card-header').addEventListener('click', () => {
            card.classList.toggle('expanded');
        });

        container.appendChild(card);
    });
}

// ---- 趋势图 (纯 Canvas) ----
function renderTrend(fortune) {
    const canvas = document.getElementById('trendChart');
    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;

    // 高DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const padding = { top: 30, right: 30, bottom: 40, left: 40 };
    const chartW = W - padding.left - padding.right;
    const chartH = H - padding.top - padding.bottom;

    const data = fortune.overall.avgScores;
    const labels = fortune.months.map(m => m.monthName);
    const minVal = 1, maxVal = 5;

    function getX(i) { return padding.left + (i / (data.length - 1)) * chartW; }
    function getY(v) { return padding.top + chartH - ((v - minVal) / (maxVal - minVal)) * chartH; }

    // 背景网格
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let v = 1; v <= 5; v++) {
        const y = getY(v);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(W - padding.right, y);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = '11px "Noto Sans SC"';
        ctx.textAlign = 'right';
        ctx.fillText(v.toFixed(1), padding.left - 8, y + 4);
    }

    // X轴标签
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '12px "Noto Sans SC"';
    ctx.textAlign = 'center';
    data.forEach((_, i) => {
        ctx.fillText(labels[i], getX(i), H - 8);
    });

    // 渐变填充区域
    const gradient = ctx.createLinearGradient(0, padding.top, 0, H - padding.bottom);
    gradient.addColorStop(0, 'rgba(212, 168, 83, 0.2)');
    gradient.addColorStop(1, 'rgba(212, 168, 83, 0)');

    ctx.beginPath();
    ctx.moveTo(getX(0), getY(data[0]));
    for (let i = 1; i < data.length; i++) {
        const cpx = (getX(i - 1) + getX(i)) / 2;
        ctx.bezierCurveTo(cpx, getY(data[i - 1]), cpx, getY(data[i]), getX(i), getY(data[i]));
    }
    ctx.lineTo(getX(data.length - 1), H - padding.bottom);
    ctx.lineTo(getX(0), H - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // 曲线
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(data[0]));
    for (let i = 1; i < data.length; i++) {
        const cpx = (getX(i - 1) + getX(i)) / 2;
        ctx.bezierCurveTo(cpx, getY(data[i - 1]), cpx, getY(data[i]), getX(i), getY(data[i]));
    }
    ctx.strokeStyle = '#d4a853';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 数据点
    data.forEach((v, i) => {
        const x = getX(i);
        const y = getY(v);

        // 光晕
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 12);
        glow.addColorStop(0, 'rgba(212, 168, 83, 0.4)');
        glow.addColorStop(1, 'rgba(212, 168, 83, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fill();

        // 点
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#d4a853';
        ctx.fill();
        ctx.strokeStyle = '#0a0a1a';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 数值
        ctx.fillStyle = '#f0d68a';
        ctx.font = 'bold 13px "Noto Sans SC"';
        ctx.textAlign = 'center';
        ctx.fillText(v.toFixed(1), x, y - 14);
    });

    // 趋势统计
    const summary = document.getElementById('trendSummary');
    summary.innerHTML = `
        <div class="trend-stat">
            <div class="trend-stat-label">整体趋势</div>
            <div class="trend-stat-value">${fortune.overall.trendLabel}</div>
        </div>
        <div class="trend-stat">
            <div class="trend-stat-label">最佳月份</div>
            <div class="trend-stat-value">${fortune.overall.bestMonth.name} (${fortune.overall.bestMonth.score})</div>
        </div>
        <div class="trend-stat">
            <div class="trend-stat-label">需留意月份</div>
            <div class="trend-stat-value">${fortune.overall.worstMonth.name} (${fortune.overall.worstMonth.score})</div>
        </div>
    `;
}

// ============================================================
//  滚动入场动画
// ============================================================

function triggerScrollAnimations() {
    // 四柱卡片
    document.querySelectorAll('.pillar-card').forEach((card, i) => {
        setTimeout(() => card.classList.add('animate-in'), i * 150);
    });

    // 五行能量条
    setTimeout(() => {
        document.querySelectorAll('.wuxing-bar-fill').forEach(bar => {
            bar.style.width = bar.dataset.width + '%';
        });
    }, 600);

    // 月度卡片 — 滚动观察
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });

    document.querySelectorAll('.month-card').forEach(card => {
        observer.observe(card);
    });
}

// ============================================================
//  初始化
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    initStarCanvas();
    initForm();
});
