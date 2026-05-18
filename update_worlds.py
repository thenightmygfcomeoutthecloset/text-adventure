import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r'E:\claude code library\存档\2026-05-11_文字冒险游戏\index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. HTML: Replace world-screen section
old_world_start = '<h2>选 择 世 界</h2>'
old_world_end = '<button class="btn-random-all" style="margin-top:8px" onclick="randomWorld()">'
idx_start = content.find(old_world_start)
idx_end = content.find(old_world_end)

new_world_html = '''<h2>选 择 世 界</h2>

    <div class="settings-section">
      <h3>选择一个你想踏入的世界</h3>
      <div class="tab-bar">
        <button class="tab-btn active" onclick="switchTab('male')">男频</button>
        <button class="tab-btn" onclick="switchTab('female')">女频</button>
      </div>
      <div class="genre-grid tab-content active" id="tab-male">
        <div class="genre-card" data-genre="仙侠修真"><div class="icon">🏔️</div><div class="name">仙侠修真</div><div class="desc">灵气·功法·宗门·飞升</div></div>
        <div class="genre-card" data-genre="武侠江湖"><div class="icon">🏮</div><div class="name">武侠江湖</div><div class="desc">武功·门派·江湖·恩怨</div></div>
        <div class="genre-card" data-genre="末日废土"><div class="icon">☢️</div><div class="name">末日废土</div><div class="desc">生存·变异·废墟·资源</div></div>
        <div class="genre-card" data-genre="赛博朋克"><div class="icon">🤖</div><div class="name">赛博朋克</div><div class="desc">义体·企业·黑客·霓虹</div></div>
        <div class="genre-card" data-genre="无限流"><div class="icon">♾️</div><div class="name">无限流</div><div class="desc">副本·系统·轮回·进化</div></div>
        <div class="genre-card" data-genre="星际科幻"><div class="icon">🚀</div><div class="name">星际科幻</div><div class="desc">太空·殖民·外星·舰队</div></div>
        <div class="genre-card" data-genre="蒸汽朋克"><div class="icon">⚙️</div><div class="name">蒸汽朋克</div><div class="desc">齿轮·飞艇·维多利亚·炼金</div></div>
        <div class="genre-card" data-genre="权谋高干"><div class="icon">🏛️</div><div class="name">权谋高干</div><div class="desc">权力·博弈·野心·忠诚</div></div>
        <div class="genre-card" data-genre="赘婿逆袭"><div class="icon">🏠</div><div class="name">赘婿逆袭</div><div class="desc">隐忍·打脸·逆袭·豪门</div></div>
        <div class="genre-card" data-genre="兵王归来"><div class="icon">🎖️</div><div class="name">兵王归来</div><div class="desc">退伍·都市·守护·铁血</div></div>
        <div class="genre-card" data-genre="重生崛起"><div class="icon">🔄</div><div class="name">重生崛起</div><div class="desc">重生·先知·布局·巅峰</div></div>
      </div>
      <div class="genre-grid tab-content" id="tab-female">
        <div class="genre-card" data-genre="禁忌情缘"><div class="icon">🌹</div><div class="name">禁忌情缘</div><div class="desc">宫闱·征服·身份·沉沦</div></div>
        <div class="genre-card" data-genre="宫斗宅斗"><div class="icon">👑</div><div class="name">宫斗宅斗</div><div class="desc">后宫·内院·心计·上位</div></div>
        <div class="genre-card" data-genre="霸总言情"><div class="icon">💼</div><div class="name">霸总言情</div><div class="desc">总裁·契约·虐恋·深情</div></div>
        <div class="genre-card" data-genre="重生复仇"><div class="icon">💔</div><div class="name">重生复仇</div><div class="desc">重生·复仇·逆袭·虐渣</div></div>
        <div class="genre-card" data-genre="都市异能"><div class="icon">🌃</div><div class="name">都市异能</div><div class="desc">现代·超能力·隐秘组织</div></div>
        <div class="genre-card" data-genre="西幻史诗"><div class="icon">⚔️</div><div class="name">西幻史诗</div><div class="desc">魔法·龙·冒险者·遗迹</div></div>
        <div class="genre-card" data-genre="克苏鲁"><div class="icon">🐙</div><div class="name">克苏鲁</div><div class="desc">恐怖·未知·理智·古神</div></div>
        <div class="genre-card" data-genre="灵异怪谈"><div class="icon">👻</div><div class="name">灵异怪谈</div><div class="desc">诡异·民俗·禁忌·收容</div></div>
      </div>
      <div class="genre-grid" id="tab-common">
        <div class="genre-card" data-genre="穿越小说"><div class="icon">📖</div><div class="name">穿越小说</div><div class="desc">上传小说·AI解析·穿入书中</div></div>
        <div class="genre-card" data-genre="自定义"><div class="icon">✍️</div><div class="name">自定义</div><div class="desc">书写你自己的世界</div></div>
      </div>
      <button class="btn-random-all" style="margin-top:8px" onclick="randomWorld()">'''

content = content[:idx_start] + new_world_html + content[idx_end + len(old_world_end):]
print("1. HTML world screen: OK")

# 2. CSS: Add tab styles
old_css = """.genre-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 8px;
}"""
tab_css = """.tab-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.tab-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  padding: 6px 24px;
  font-size: 13px;
  font-family: var(--font-ui);
  cursor: pointer;
  border-radius: var(--radius);
  letter-spacing: 2px;
  transition: all 0.3s;
}
.tab-btn:hover { border-color: var(--accent); color: var(--text); }
.tab-btn.active { border-color: var(--accent-bright); color: var(--accent-bright); background: rgba(139,117,40,0.1); box-shadow: 0 0 12px var(--accent-glow); }
.tab-content { display: none; }
.tab-content.active { display: grid; }

.genre-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 8px;
}"""
if old_css in content:
    content = content.replace(old_css, tab_css, 1)
    print("2. CSS: OK")
else:
    print("2. CSS: NOT FOUND")

# 3. JS: Add switchTab function
old_show = "function showScreen(name) {"
new_show = """function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
  document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
  var btns = document.querySelectorAll('.tab-btn');
  if (tab === 'male' && btns[0]) btns[0].classList.add('active');
  if (tab === 'female' && btns[1]) btns[1].classList.add('active');
  var tc = document.getElementById('tab-' + tab);
  if (tc) tc.classList.add('active');
  state.worldGenre = '';
  document.querySelectorAll('.genre-card').forEach(function(c) { c.classList.remove('selected'); });
  var cd = document.getElementById('custom-world-desc');
  var ab = document.getElementById('ai-gen-world-btn');
  var na = document.getElementById('novel-upload-area');
  if (cd) cd.classList.add('hidden');
  if (ab) ab.classList.add('hidden');
  if (na) na.classList.add('hidden');
}

function showScreen(name) {"""
if old_show in content:
    content = content.replace(old_show, new_show)
    print("3. JS switchTab: OK")
else:
    print("3. JS switchTab: NOT FOUND")

# 4. Add new genre descriptions
old_ga_end = "'穿越小说': '这是一个由玩家上传的小说所构建的世界。以下是根据该小说提炼的世界观：',\n  };"
new_ga_insert = """'宫斗宅斗': '这是一个以古代后宫或豪门内院为舞台的权谋世界。有妃嫔争宠、嫡庶之争、家宅内斗、联姻博弈、子嗣争夺、下毒暗害等元素。表面花团锦簇，实则步步惊心。心计、隐忍、借力打力是生存的必修课。',
    '霸总言情': '这是一个以现代都市豪门为背景的情感世界。有霸道总裁、契约婚姻、虐恋情深、强取豪夺、破镜重圆等经典元素。权力与爱情的极致拉扯。感情线是绝对核心，人物丰满立体。描写情感充沛但不低智。',
    '重生复仇': '这是一个重生+复仇的世界。主角带着前世记忆回到过去，手握先知先觉的优势步步为营。复仇的火焰与重生后的救赎交织——让仇人万劫不复，让真心不被辜负。',
    '赘婿逆袭': '这是一个赘婿逆袭的世界。主角入赘豪门受尽屈辱，但隐藏的真实身份一旦揭开会震惊所有人。从卑微到巅峰的逆袭之路，打脸爽文的经典架构。',
    '兵王归来': '这是一个兵王回归都市的世界。主角从战场归来，一身杀伐本领在都市中依然致命。铁血柔情，杀伐果断，爽感来自实力的绝对碾压。',
    '重生崛起': '这是一个重生流世界。主角带着前世记忆回到人生关键节点，凭借先知先觉抢占先机，从籍籍无名到巅峰崛起。',
    '穿越小说': '这是一个由玩家上传的小说所构建的世界。以下是根据该小说提炼的世界观：',
  };"""
if old_ga_end in content:
    content = content.replace(old_ga_end, new_ga_insert)
    print("4. genreAdditions: OK")
else:
    print("4. genreAdditions: NOT FOUND")

# 5. Add new character templates
old_char = "  '权谋高干': ["
new_char_tmpl = """  '宫斗宅斗': [
    { id:'status', label:'身份', desc:'你在这个庭院中的位置', options:['新入宫的秀女','得宠的妃嫔','失势的废妃','王府嫡女','庶出小姐','当家主母','不起眼的洒扫丫鬟'] },
    { id:'leverage', label:'倚仗', desc:'你靠什么立足', options:['绝世容貌','过人心计','家族势力','帝王/家主偏爱','医术/毒术','隐忍与耐心','信息网络'] },
    { id:'goal', label:'目标', desc:'你想要的究竟是什么', options:['登上后位/正室','保护所爱之人','为家族复仇','安稳度日','权势滔天','自由与逃离'] },
    { id:'personality', label:'性情', options:['绵里藏针','锋芒毕露','八面玲珑','隐忍蛰伏','纯善温厚','果断狠厉','外柔内刚'] },
  ],
  '霸总言情': [
    { id:'identity', label:'身份', desc:'你在故事中的位置', options:['契约新娘','落跑甜心','职场精英','豪门千金','普通打工人','带球跑的单亲妈妈','失忆的前任'] },
    { id:'dynamic', label:'感情基调', desc:'你与ta之间的核心张力', options:['契约婚姻·先婚后爱','虐恋情深·追妻火葬场','强取豪夺·身份悬殊','破镜重圆·旧情复燃','欢喜冤家·日久生情','替身情人·虐心纠葛'] },
    { id:'personality', label:'性情', options:['倔强不屈','温柔坚韧','独立清醒','古灵精怪','冷清孤傲','柔弱中的坚强','飒爽果敢'] },
  ],
  '重生复仇': [
    { id:'past', label:'前世结局', desc:'上一世你是如何落幕的', options:['被渣男/渣女背叛至死','被闺蜜/兄弟联手陷害','家族覆灭·孤身一人','含冤入狱·身败名裂','操劳一生被弃如敝履','意外身亡·心有不甘'] },
    { id:'method', label:'复仇手段', desc:'这一世你靠什么翻盘', options:['先知先觉·信息碾压','逐步揭露真相','商业/权谋手段','借力打力·借刀杀人','法律与舆论武器','暗中培养势力'] },
    { id:'personality', label:'性情', options:['冷静克制·不动声色','甜美伪装·腹黑内里','杀伐果断·快意恩仇','外热内冷·步步为营','温柔依旧·暗藏锋芒'] },
  ],
  '赘婿逆袭': [
    { id:'hidden', label:'隐藏身份', desc:'你不为人知的真实身份', options:['隐退兵王','神秘神医','商界巨鳄','古武传人','黑客之神','昔日王者','神秘组织首领'] },
    { id:'reason', label:'入赘原因', desc:'当初为何甘愿入赘', options:['报恩','母亲的遗命','躲避追杀','守护某人','另有隐情','真爱(但被误解)'] },
    { id:'personality', label:'性情', options:['隐忍不发','玩世不恭','冷峻寡言','温和表面下暗藏锋芒','杀伐果断','淡然处之'] },
  ],
  '兵王归来': [
    { id:'origin', label:'来历', desc:'你从何处归来', options:['国际特种部队','神秘暗杀组织','边境战区','隐秘任务中','雇佣兵团','战俘营中归来'] },
    { id:'mission', label:'归来的目的', desc:'为何回到都市', options:['履行与战友的约定','守护当年的她/他','调查战友之死的真相','为家人复仇','奉命执行秘密任务','彻底退役·寻求平静'] },
    { id:'personality', label:'性情', options:['铁血柔情','杀伐果断','沉稳如山','外冷内热','玩世不恭','不苟言笑'] },
  ],
  '重生崛起': [
    { id:'era', label:'重生时代', desc:'回到哪个时间点', options:['回到大学时代','回到初入职场时','回到行业风口前','回到高考/考研前','回到投资失败之前','回到人生最低谷'] },
    { id:'advantage', label:'先知优势', desc:'你带回来的核心资源', options:['未来商业趋势的记忆','技术发展脉络','人事关系的预知','重大事件的先机','前世磨炼出的核心技能','某个被低估的机会'] },
    { id:'personality', label:'性情', options:['沉稳布局','锋芒毕露','低调发育','果断冷酷','精明圆滑','热血追梦'] },
  ],
  '权谋高干': ["""
if old_char in content:
    content = content.replace(old_char, new_char_tmpl)
    print("5. CHAR_TEMPLATES: OK")
else:
    print("5. CHAR_TEMPLATES: NOT FOUND")

# 6. Update randomWorld
old_rand = "'仙侠修真', '西幻史诗', '末日废土', '赛博朋克', '都市异能', '无限流', '克苏鲁'"
new_rand = "'仙侠修真','武侠江湖','末日废土','赛博朋克','无限流','星际科幻','蒸汽朋克','权谋高干','赘婿逆袭','兵王归来','重生崛起','禁忌情缘','宫斗宅斗','霸总言情','重生复仇','都市异能','西幻史诗','克苏鲁','灵异怪谈'"
if old_rand in content:
    content = content.replace(old_rand, new_rand)
    print("6. randomWorld: OK")
else:
    print("6. randomWorld: NOT FOUND")

with open(r'E:\claude code library\存档\2026-05-11_文字冒险游戏\index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("All done!")
