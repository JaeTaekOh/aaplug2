/* AA Plug 2 — 분석 결과로 스토어 자료를 만드는 결정적(템플릿) 생성기
   API 키·외부 AI 없이 동작. 언어: en (기본) / ko / th / zh / hi */
(function () {
  'use strict';
  const LANGS = ['en', 'ko', 'th', 'zh', 'hi'];
  const clip = (s, n) => { s = String(s || '').trim(); if (s.length <= n) return s; const hard = s.slice(0, n - 1); const soft = hard.replace(/[\s,.;:–-]+\S*$/, ''); return (soft.length >= n * .6 ? soft : hard).trim() + '…'; };
  const today = () => new Date().toISOString().slice(0, 10);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const CAT = {
    finance:      { ko: ['가계부', '금융'], en: ['Budget tracker', 'Finance'], th: ['บันทึกรายรับรายจ่าย', 'การเงิน'], zh: ['记账', '财务'], hi: ['बजट ट्रैकर', 'वित्त'], play: 'Finance', apple: 'Finance',
                    benefit: { ko: '지출을 쉽게 기록하고 예산을 똑똑하게 관리하세요', en: 'Track spending easily and stay on budget', th: 'จดรายจ่ายง่าย ๆ และคุมงบได้อย่างชาญฉลาด', zh: '轻松记录支出，聪明管理预算', hi: 'खर्च आसानी से लिखें और बजट में रहें' },
                    kw: { ko: '가계부,지출,예산,영수증,용돈,돈관리,절약,소비,기록', en: 'budget,expense,receipt,money,spending,tracker,savings,finance', th: 'รายจ่าย,งบประมาณ,ใบเสร็จ,บัญชี,ออมเงิน,การเงิน', zh: '记账,支出,预算,收据,理财,省钱,消费,财务', hi: 'बजट,खर्च,रसीद,पैसा,बचत,वित्त,हिसाब' },
                    who: { ko: ['매달 어디에 돈이 나가는지 궁금한 분', '영수증을 모아 두기만 하고 정리를 못 하는 분', '예산 안에서 생활하고 싶은 분'], en: ['Anyone who wonders where their money goes each month', 'People with a wallet full of unsorted receipts', 'Anyone trying to live within a budget'], th: ['คนที่อยากรู้ว่าเงินแต่ละเดือนหายไปไหน', 'คนที่เก็บใบเสร็จไว้เต็มกระเป๋าแต่ไม่เคยจด', 'คนที่อยากใช้เงินให้อยู่ในงบ'], zh: ['想知道每个月钱花到哪里的人', '收据堆了一堆却从不整理的人', '想在预算内生活的人'], hi: ['जो जानना चाहते हैं कि हर महीने पैसा कहाँ जाता है', 'जिनके बटुए में बिना हिसाब की रसीदें भरी हैं', 'जो बजट में रहकर जीना चाहते हैं'] } },
    health:       { ko: ['건강 관리', '건강'], en: ['Health tracker', 'Health & Fitness'], th: ['ดูแลสุขภาพ', 'สุขภาพ'], zh: ['健康管理', '健康'], hi: ['हेल्थ ट्रैकर', 'स्वास्थ्य और फ़िटनेस'], play: 'Health & Fitness', apple: 'Health & Fitness',
                    benefit: { ko: '매일의 건강 습관을 가볍게 기록하고 관리하세요', en: 'Build healthy daily habits with simple tracking', th: 'สร้างนิสัยสุขภาพดีด้วยการบันทึกง่าย ๆ ทุกวัน', zh: '轻松记录，养成每天的健康习惯', hi: 'आसान ट्रैकिंग से रोज़ की सेहतमंद आदतें बनाएँ' },
                    kw: { ko: '건강,운동,습관,기록,다이어트,수면', en: 'health,fitness,habit,tracker,workout,sleep', th: 'สุขภาพ,ออกกำลังกาย,นิสัย,บันทึก', zh: '健康,运动,习惯,记录,减肥,睡眠', hi: 'सेहत,फ़िटनेस,आदत,ट्रैकर,व्यायाम,नींद' }, who: { ko: ['건강 습관을 만들고 싶은 분'], en: ['Anyone building healthier habits'], th: ['คนที่อยากมีสุขภาพดีขึ้น'], zh: ['想养成健康习惯的人'], hi: ['जो सेहतमंद आदतें बनाना चाहते हैं'] } },
    education:    { ko: ['학습', '교육'], en: ['Learning app', 'Education'], th: ['การเรียนรู้', 'การศึกษา'], zh: ['学习', '教育'], hi: ['लर्निंग ऐप', 'शिक्षा'], play: 'Education', apple: 'Education',
                    benefit: { ko: '짧은 시간에도 꾸준히 배우는 학습 도우미', en: 'Learn a little every day, wherever you are', th: 'เรียนรู้ทีละนิดได้ทุกวัน ทุกที่', zh: '每天学一点，随时随地', hi: 'हर दिन थोड़ा सीखें, कहीं भी' },
                    kw: { ko: '공부,학습,단어,퀴즈,교육', en: 'learn,study,quiz,education,lesson', th: 'เรียน,ศึกษา,คำศัพท์,แบบทดสอบ', zh: '学习,单词,测验,教育,课程', hi: 'पढ़ाई,सीखना,क्विज़,शिक्षा,पाठ' }, who: { ko: ['꾸준히 공부하고 싶은 분'], en: ['Learners who want a daily habit'], th: ['ผู้ที่อยากเรียนรู้อย่างสม่ำเสมอ'], zh: ['想每天坚持学习的人'], hi: ['जो रोज़ सीखने की आदत चाहते हैं'] } },
    productivity: { ko: ['생산성', '생산성'], en: ['Productivity', 'Productivity'], th: ['เพิ่มประสิทธิภาพ', 'ประสิทธิภาพการทำงาน'], zh: ['效率', '效率'], hi: ['प्रोडक्टिविटी', 'प्रोडक्टिविटी'], play: 'Productivity', apple: 'Productivity',
                    benefit: { ko: '해야 할 일을 더 빠르고 깔끔하게 끝내세요', en: 'Get things done faster, with less effort', th: 'ทำสิ่งที่ต้องทำให้เสร็จเร็วขึ้นและง่ายขึ้น', zh: '更快、更轻松地完成要做的事', hi: 'कम मेहनत में काम जल्दी पूरा करें' },
                    kw: { ko: '생산성,정리,기록,메모,도구', en: 'productivity,organize,notes,planner,tool', th: 'จัดระเบียบ,บันทึก,วางแผน,เครื่องมือ', zh: '效率,整理,笔记,计划,工具', hi: 'प्रोडक्टिविटी,व्यवस्थित,नोट्स,प्लानर,टूल' }, who: { ko: ['일상을 깔끔하게 정리하고 싶은 분'], en: ['Anyone who likes to stay organized'], th: ['คนที่ชอบจัดระเบียบชีวิต'], zh: ['喜欢井井有条的人'], hi: ['जो चीज़ें व्यवस्थित रखना पसंद करते हैं'] } },
    photography:  { ko: ['사진', '사진'], en: ['Photo app', 'Photography'], th: ['ภาพถ่าย', 'ภาพถ่าย'], zh: ['照片', '摄影'], hi: ['फ़ोटो ऐप', 'फ़ोटोग्राफ़ी'], play: 'Photography', apple: 'Photo & Video',
                    benefit: { ko: '사진을 더 쉽고 멋지게', en: 'Make your photos shine, easily', th: 'ทำให้รูปของคุณสวยขึ้นได้ง่าย ๆ', zh: '轻松让照片更出彩', hi: 'अपनी फ़ोटो को आसानी से निखारें' }, kw: { ko: '사진,카메라,편집', en: 'photo,camera,editor', th: 'รูปภาพ,กล้อง,แต่งรูป', zh: '照片,相机,编辑', hi: 'फ़ोटो,कैमरा,एडिटर' }, who: { ko: ['사진을 즐기는 분'], en: ['Photo lovers'], th: ['คนรักการถ่ายภาพ'], zh: ['热爱摄影的人'], hi: ['फ़ोटो के शौकीन'] } },
    travel:       { ko: ['여행', '여행'], en: ['Travel app', 'Travel'], th: ['ท่องเที่ยว', 'ท่องเที่ยว'], zh: ['旅行', '旅游'], hi: ['ट्रैवल ऐप', 'यात्रा'], play: 'Travel & Local', apple: 'Travel',
                    benefit: { ko: '여행 준비부터 이동까지 한 번에', en: 'Plan and enjoy your trips in one place', th: 'วางแผนและเที่ยวสนุกในแอปเดียว', zh: '在一个应用里规划并享受旅行', hi: 'एक ही जगह यात्रा की योजना बनाएँ और मज़े करें' }, kw: { ko: '여행,지도,일정', en: 'travel,trip,map,planner', th: 'เที่ยว,แผนที่,ทริป', zh: '旅行,行程,地图,计划', hi: 'यात्रा,ट्रिप,नक्शा,प्लानर' }, who: { ko: ['여행을 자주 다니는 분'], en: ['Frequent travelers'], th: ['คนชอบเที่ยว'], zh: ['经常旅行的人'], hi: ['अक्सर यात्रा करने वाले'] } },
    food:         { ko: ['음식', '음식'], en: ['Food app', 'Food & Drink'], th: ['อาหาร', 'อาหารและเครื่องดื่ม'], zh: ['美食', '美食佳饮'], hi: ['फ़ूड ऐप', 'खाना-पीना'], play: 'Food & Drink', apple: 'Food & Drink',
                    benefit: { ko: '맛있는 선택을 더 쉽게', en: 'Delicious choices made easy', th: 'เลือกของอร่อยได้ง่ายขึ้น', zh: '轻松做出美味选择', hi: 'स्वादिष्ट चुनाव, अब आसान' }, kw: { ko: '음식,요리,메뉴,카페', en: 'food,recipe,menu,cafe', th: 'อาหาร,เมนู,คาเฟ่', zh: '美食,菜谱,菜单,咖啡馆', hi: 'खाना,रेसिपी,मेन्यू,कैफ़े' }, who: { ko: ['맛있는 걸 좋아하는 분'], en: ['Food lovers'], th: ['คนรักอาหาร'], zh: ['美食爱好者'], hi: ['खाने के शौकीन'] } },
    shopping:     { ko: ['쇼핑', '쇼핑'], en: ['Shopping app', 'Shopping'], th: ['ช้อปปิ้ง', 'ช้อปปิ้ง'], zh: ['购物', '购物'], hi: ['शॉपिंग ऐप', 'शॉपिंग'], play: 'Shopping', apple: 'Shopping',
                    benefit: { ko: '똑똑한 쇼핑을 위한 도우미', en: 'Your smart shopping companion', th: 'ผู้ช่วยช้อปปิ้งอย่างชาญฉลาด', zh: '你的聪明购物助手', hi: 'आपका स्मार्ट शॉपिंग साथी' }, kw: { ko: '쇼핑,할인,쿠폰', en: 'shopping,deals,coupons', th: 'ช้อป,ส่วนลด,คูปอง', zh: '购物,优惠,优惠券', hi: 'शॉपिंग,डील,कूपन' }, who: { ko: ['알뜰 쇼핑을 원하는 분'], en: ['Smart shoppers'], th: ['นักช้อปสายประหยัด'], zh: ['精明的购物者'], hi: ['समझदार खरीदार'] } },
    tools:        { ko: ['도구', '도구'], en: ['Utility', 'Tools'], th: ['เครื่องมือ', 'เครื่องมือ'], zh: ['实用工具', '工具'], hi: ['यूटिलिटी', 'टूल्स'], play: 'Tools', apple: 'Utilities',
                    benefit: { ko: '꼭 필요한 기능만 빠르고 가볍게', en: 'Just the tools you need, fast and light', th: 'เครื่องมือที่จำเป็น ใช้ง่าย เร็ว และเบา', zh: '只要你需要的功能，快速又轻巧', hi: 'बस ज़रूरी टूल, तेज़ और हल्के' }, kw: { ko: '도구,유틸리티,간편', en: 'tool,utility,simple', th: 'เครื่องมือ,ยูทิลิตี้,ใช้ง่าย', zh: '工具,实用,简单', hi: 'टूल,यूटिलिटी,आसान' }, who: { ko: ['간단한 도구를 찾는 분'], en: ['Anyone who wants a simple tool'], th: ['คนที่อยากได้เครื่องมือใช้ง่าย'], zh: ['想要简单工具的人'], hi: ['जिन्हें आसान टूल चाहिए'] } },
    games:        { ko: ['게임', '게임'], en: ['Game', 'Games'], th: ['เกม', 'เกม'], zh: ['游戏', '游戏'], hi: ['गेम', 'गेम्स'], play: 'Casual', apple: 'Games',
                    benefit: { ko: '언제 어디서나 가볍게 즐기는 게임', en: 'A fun game to enjoy anytime', th: 'เกมสนุก เล่นได้ทุกที่ทุกเวลา', zh: '随时随地轻松畅玩的游戏', hi: 'कभी भी खेलने लायक मज़ेदार गेम' }, kw: { ko: '게임,퍼즐,캐주얼', en: 'game,puzzle,casual', th: 'เกม,ปริศนา,แคชชวล', zh: '游戏,益智,休闲', hi: 'गेम,पहेली,कैज़ुअल' }, who: { ko: ['짧게 즐길 게임을 찾는 분'], en: ['Casual gamers'], th: ['สายเกมแคชชวล'], zh: ['休闲玩家'], hi: ['कैज़ुअल गेमर'] } },
    lifestyle:    { ko: ['라이프스타일', '라이프스타일'], en: ['Lifestyle', 'Lifestyle'], th: ['ไลฟ์สไตล์', 'ไลฟ์สไตล์'], zh: ['生活', '生活'], hi: ['लाइफ़स्टाइल', 'लाइफ़स्टाइल'], play: 'Lifestyle', apple: 'Lifestyle',
                    benefit: { ko: '일상을 조금 더 편하게', en: 'Make everyday life a little easier', th: 'ทำให้ชีวิตประจำวันง่ายขึ้นอีกนิด', zh: '让日常生活更轻松一点', hi: 'रोज़ की ज़िंदगी थोड़ी आसान बनाएँ' }, kw: { ko: '일상,습관,기록', en: 'lifestyle,daily,habit', th: 'ชีวิตประจำวัน,นิสัย,บันทึก', zh: '生活,日常,习惯', hi: 'लाइफ़स्टाइल,रोज़ाना,आदत' }, who: { ko: ['일상을 가꾸고 싶은 분'], en: ['Anyone improving their daily routine'], th: ['คนที่อยากดูแลชีวิตประจำวัน'], zh: ['想改善日常作息的人'], hi: ['जो अपनी दिनचर्या बेहतर बनाना चाहते हैं'] } }
  };

  /* 기능 문구: 감지한 SDK·권한·카테고리로 고른다 */
  function features(A, lang) {
    const s = A.sdk, fin = A.categories[0] === 'finance', out = [];
    const S = A.strings[lang] || (lang === 'en' ? A.strings.default : null) || {};
    const F = {
      scan: { ko: fin ? '카메라로 영수증을 찍으면 금액과 항목을 자동으로 읽어요 (기기 안에서 처리)' : '카메라로 찍으면 글자를 자동으로 읽어요 (기기 안에서 처리)', en: fin ? 'Snap a receipt and the amount and items are read automatically — processed on your device' : 'Point your camera and text is recognized automatically — processed on your device', th: fin ? 'ถ่ายรูปใบเสร็จ แอปอ่านยอดเงินและรายการให้อัตโนมัติ (ประมวลผลในเครื่อง)' : 'ถ่ายรูปแล้วแอปอ่านข้อความให้อัตโนมัติ (ประมวลผลในเครื่อง)', zh: fin ? '拍下收据，自动读取金额和明细（在设备上处理）' : '用相机一拍，自动识别文字（在设备上处理）', hi: fin ? 'रसीद की फ़ोटो लें, रकम और आइटम अपने आप पढ़े जाते हैं (डिवाइस पर प्रोसेस)' : 'कैमरा दिखाएँ, टेक्स्ट अपने आप पहचाना जाता है (डिवाइस पर प्रोसेस)' },
      camera: { ko: '카메라로 바로 기록해요', en: 'Capture instantly with your camera', th: 'บันทึกได้ทันทีด้วยกล้อง', zh: '用相机即时记录', hi: 'कैमरे से तुरंत कैप्चर करें' },
      budget: { ko: '월 예산을 정하고 얼마나 썼는지 한눈에 확인해요', en: 'Set a monthly budget and see your progress at a glance', th: 'ตั้งงบรายเดือนและดูว่าใช้ไปเท่าไรได้ในพริบตา', zh: '设置每月预算，进度一目了然', hi: 'मासिक बजट तय करें और प्रगति एक नज़र में देखें' },
      category: { ko: '장보기·외식·교통처럼 항목을 자동으로 추천해요', en: 'Smart category suggestions — groceries, dining, transport and more', th: 'แนะนำหมวดหมู่ให้อัตโนมัติ เช่น ของใช้ อาหาร การเดินทาง', zh: '智能推荐分类——买菜、外出就餐、交通等', hi: 'स्मार्ट श्रेणी सुझाव — किराना, बाहर खाना, आना-जाना और भी' },
      reports: { ko: '항목별·월별 리포트를 간단한 차트로 보여 줘요', en: 'Simple charts by category and by month', th: 'รายงานแยกตามหมวดหมู่และรายเดือนด้วยกราฟที่เข้าใจง่าย', zh: '按类别和月份展示简单图表', hi: 'श्रेणी और महीने के हिसाब से आसान चार्ट' },
      notif: { ko: S.notif_rationale || '필요한 순간에 알림으로 알려 드려요', en: S.notif_rationale || 'Helpful reminders at the right moment', th: S.notif_rationale || 'แจ้งเตือนในเวลาที่เหมาะสม', zh: S.notif_rationale || '在合适的时候贴心提醒', hi: S.notif_rationale || 'सही समय पर काम की याद दिलाना' },
      sync: { ko: 'Google 계정으로 로그인하면 기록을 안전하게 백업·동기화해요 (선택)', en: 'Sign in with Google to back up and sync your data (optional)', th: 'ลงชื่อเข้าใช้ด้วย Google เพื่อสำรองและซิงก์ข้อมูล (ไม่บังคับ)', zh: '用 Google 账号登录即可备份和同步数据（可选）', hi: 'Google से साइन इन करके डेटा का बैकअप और सिंक करें (वैकल्पिक)' },
      offline: { ko: '인터넷이 없어도 사용할 수 있어요', en: 'Works offline', th: 'ใช้งานได้แม้ไม่มีอินเทอร์เน็ต', zh: '没有网络也能使用', hi: 'बिना इंटरनेट के भी चलता है' },
      location: { ko: '내 위치를 기준으로 더 편하게 사용해요', en: 'Location-aware features', th: 'ฟีเจอร์ตามตำแหน่งของคุณ', zh: '基于位置的功能', hi: 'लोकेशन पर आधारित सुविधाएँ' },
      simple: { ko: '복잡한 설정 없이 바로 시작해요', en: 'No complicated setup — just open and go', th: 'ไม่ต้องตั้งค่าซับซ้อน เปิดแล้วใช้ได้เลย', zh: '无需复杂设置，打开即用', hi: 'कोई जटिल सेटअप नहीं — खोलें और शुरू करें' }
    };
    if (s.ocr && s.camera) out.push('scan'); else if (s.camera) out.push('camera');
    if (fin) out.push('budget', 'category');
    const reportish = /report|chart|stat|리포트|통계|รายงาน|报表|统计|图表|रिपोर्ट/i.test(JSON.stringify(A.strings) + A.readme.features.join(' '));
    if (reportish) out.push('reports');
    if (s.notifications) out.push('notif');
    if (s.auth && s.cloudDb) out.push('sync');
    if (s.localDb) out.push('offline');
    if (s.location) out.push('location');
    if (out.length < 3) out.push('simple');
    return out.map(k => F[k][lang]);
  }

  const nameOf = (A, lang) => A.names[lang] || A.names.en || A.appName;
  const tagOf = (A, lang) => A.tagline[lang] || (lang === 'en' ? A.tagline.en : null) || CAT[A.categories[0]].benefit[lang];

  const STOP = lang => ({ th: '', zh: '。', hi: '।' }[lang] ?? '.');   /* sentence end per language */
  function listing(A, lang, tone) {
    const c = CAT[A.categories[0]] || CAT.tools, name = nameOf(A, lang), tag = tagOf(A, lang), feats = features(A, lang);
    const titles = [...new Set([
      clip(name, 30),
      [name + ' - ' + tag, name + ' - ' + c[lang][0], name + ' - ' + c[lang][1]].find(x => x.length <= 30) || clip(name + ' - ' + tag, 30),
      (name.toLowerCase().includes(c[lang][0].toLowerCase()) ? null : clip(name + (lang === 'en' ? ' – ' : ' ') + c[lang][0], 30))
    ].filter(Boolean))];
    const shorts = [...new Set([
      clip(tag + (/[.!?。！？।]$/.test(tag) ? '' : STOP(lang)), 80),
      clip(c.benefit[lang] + STOP(lang), 80),
      clip(feats[0].replace(/\s*[(（].*[)）]$/, ''), 80)
    ])];
    const B = tone === 'pro' ? '•' : '✔';
    const H = {
      ko: { feat: tone === 'pro' ? '주요 기능' : '이런 걸 할 수 있어요', who: '이런 분께 추천해요', priv: '개인정보 보호', privTxt: A.sdk.ocr ? '영수증 사진은 기기 안에서만 처리되고 서버에 저장하지 않아요.' : '꼭 필요한 정보만 사용하고, 자세한 내용은 개인정보처리방침에서 확인할 수 있어요.', contact: '문의', intro: tone === 'pro' ? `${name} — ${tag}. ${c.benefit.ko}. 복잡한 설정 없이 바로 시작할 수 있어요.` : `${tag}! ${name}로 ${c.benefit.ko}.` },
      en: { feat: tone === 'pro' ? 'Key features' : 'What you can do', who: 'Perfect for', priv: 'Your privacy', privTxt: A.sdk.ocr ? 'Receipt photos are processed on your device and are never uploaded to our servers.' : 'We only use what the app needs. See our privacy policy for details.', contact: 'Contact', intro: (A.readme.summary && tone === 'pro') ? A.readme.summary : `${tag}. ${name} helps you ${c.benefit.en.charAt(0).toLowerCase() + c.benefit.en.slice(1)} — in just a few taps.` },
      th: { feat: tone === 'pro' ? 'ฟีเจอร์หลัก' : 'ทำอะไรได้บ้าง', who: 'เหมาะสำหรับ', priv: 'ความเป็นส่วนตัว', privTxt: A.sdk.ocr ? 'รูปใบเสร็จประมวลผลในเครื่องของคุณเท่านั้น ไม่ถูกอัปโหลดไปยังเซิร์ฟเวอร์' : 'แอปใช้เฉพาะข้อมูลที่จำเป็น ดูรายละเอียดได้ในนโยบายความเป็นส่วนตัว', contact: 'ติดต่อ', intro: `${tag} ${name} ช่วยให้คุณ${c.benefit.th}` },
      zh: { feat: tone === 'pro' ? '主要功能' : '你可以这样用', who: '推荐给', priv: '隐私保护', privTxt: A.sdk.ocr ? '收据照片只在你的设备上处理，绝不会上传到我们的服务器。' : '我们只使用应用必需的信息，详情请查看隐私政策。', contact: '联系', intro: tag === c.benefit.zh ? (tone === 'pro' ? `${name} —— ${tag}。无需复杂设置，打开即可开始。` : `用 ${name}，${tag}——只需轻点几下。`) : (tone === 'pro' ? `${name} —— ${tag}。${c.benefit.zh}，无需复杂设置，打开即可开始。` : `${tag}！用 ${name}，${c.benefit.zh}。`) },
      hi: { feat: tone === 'pro' ? 'मुख्य सुविधाएँ' : 'आप क्या कर सकते हैं', who: 'किनके लिए बढ़िया', priv: 'आपकी गोपनीयता', privTxt: A.sdk.ocr ? 'रसीद की फ़ोटो आपके डिवाइस पर ही प्रोसेस होती हैं और कभी हमारे सर्वर पर अपलोड नहीं होतीं।' : 'हम सिर्फ़ वही इस्तेमाल करते हैं जो ऐप के लिए ज़रूरी है। विवरण के लिए हमारी गोपनीयता नीति देखें।', contact: 'संपर्क', intro: tag === c.benefit.hi ? (tone === 'pro' ? `${name} — ${tag}। बिना किसी जटिल सेटअप के तुरंत शुरू करें।` : `${name} के साथ — ${tag}, बस कुछ टैप में।`) : (tone === 'pro' ? `${name} — ${tag}। ${c.benefit.hi}। बिना किसी जटिल सेटअप के तुरंत शुरू करें।` : `${tag}! ${name} के साथ — ${c.benefit.hi}, बस कुछ टैप में।`) }
    }[lang];
    const email = A.developer.email;
    const full = [H.intro, '', H.feat, ...feats.map(f => `${B} ${f}`), '', H.who, ...c.who[lang].map(w => `${B} ${w}`), '', H.priv, H.privTxt, ...(email ? ['', `${H.contact}: ${email}`] : [])].join('\n');
    const kwBase = c.kw[lang].split(',');
    let kw = []; for (const k of kwBase.filter(k => !name.toLowerCase().includes(k.toLowerCase()))) { if ((kw.concat(k).join(',')).length <= 100 && !kw.includes(k)) kw.push(k); }
    return { titles, shorts, full: clip(full, 4000), ios: { subtitle: clip(tag, 30), keywords: kw.join(','), promo: clip(shorts[0], 170) } };
  }

  /* ---------- 수집 데이터 (Play 데이터 보안 / Apple 앱 개인정보) ---------- */
  function dataItems(A) {
    const s = A.sdk, fin = A.categories[0] === 'finance', D = [];
    if (s.auth) D.push({ id: 'name', play: ['Personal info', 'Name'], apple: ['Contact Info', 'Name'], purposes: ['account', 'func'], optional: true, linked: true },
                       { id: 'email', play: ['Personal info', 'Email address'], apple: ['Contact Info', 'Email Address'], purposes: ['account', 'func'], optional: true, linked: true },
                       { id: 'uid', play: ['Personal info', 'User IDs'], apple: ['Identifiers', 'User ID'], purposes: ['account', 'func'], optional: true, linked: true });
    if (s.cloudDb) D.push(fin ? { id: 'fin', play: ['Financial info', 'Other financial info'], apple: ['Financial Info', 'Other Financial Info'], purposes: ['func'], optional: true, linked: true }
                              : { id: 'ugc', play: ['App activity', 'Other user-generated content'], apple: ['User Content', 'Other User Content'], purposes: ['func'], optional: true, linked: true });
    if (s.location) D.push({ id: 'loc', play: ['Location', 'Approximate location'], apple: ['Location', 'Coarse Location'], purposes: ['func'], optional: true, linked: false });
    if (s.analytics) D.push({ id: 'usage', play: ['App activity', 'App interactions'], apple: ['Usage Data', 'Product Interaction'], purposes: ['analytics'], optional: false, linked: false });
    if (s.crash) D.push({ id: 'crash', play: ['App info and performance', 'Crash logs'], apple: ['Diagnostics', 'Crash Data'], purposes: ['analytics'], optional: false, linked: false },
                        { id: 'diag', play: ['App info and performance', 'Diagnostics'], apple: ['Diagnostics', 'Performance Data'], purposes: ['analytics'], optional: false, linked: false });
    if (s.ads) D.push({ id: 'adid', play: ['Device or other IDs', 'Device or other IDs'], apple: ['Identifiers', 'Device ID'], purposes: ['ads', 'analytics'], optional: false, linked: false, shared: true });
    return D;
  }
  const PURPOSE = {
    account: { ko: '계정 관리', en: 'Account management', th: 'การจัดการบัญชี', zh: '账号管理', hi: 'अकाउंट प्रबंधन' }, func: { ko: '앱 기능', en: 'App functionality', th: 'ฟังก์ชันของแอป', zh: '应用功能', hi: 'ऐप की कार्यक्षमता' },
    analytics: { ko: '분석', en: 'Analytics', th: 'การวิเคราะห์', zh: '数据分析', hi: 'एनालिटिक्स' }, ads: { ko: '광고 또는 마케팅', en: 'Advertising or marketing', th: 'การโฆษณาหรือการตลาด', zh: '广告或营销', hi: 'विज्ञापन या मार्केटिंग' }
  };
  const DATA_LABEL = {
    name: { ko: '이름', en: 'Name', th: 'ชื่อ', zh: '姓名', hi: 'नाम' }, email: { ko: '이메일 주소', en: 'Email address', th: 'อีเมล', zh: '电子邮件地址', hi: 'ईमेल पता' }, uid: { ko: '사용자 ID', en: 'User IDs', th: 'รหัสผู้ใช้', zh: '用户 ID', hi: 'यूज़र ID' },
    fin: { ko: '기타 금융 정보 (지출 기록)', en: 'Other financial info (expense records)', th: 'ข้อมูลทางการเงินอื่น ๆ (บันทึกรายจ่าย)', zh: '其他财务信息（支出记录）', hi: 'अन्य वित्तीय जानकारी (खर्च का रिकॉर्ड)' }, ugc: { ko: '사용자가 만든 콘텐츠', en: 'User-generated content', th: 'เนื้อหาที่ผู้ใช้สร้าง', zh: '用户生成的内容', hi: 'उपयोगकर्ता द्वारा बनाई गई सामग्री' },
    loc: { ko: '대략적인 위치', en: 'Approximate location', th: 'ตำแหน่งโดยประมาณ', zh: '大致位置', hi: 'अनुमानित लोकेशन' }, usage: { ko: '앱 사용 기록', en: 'App interactions', th: 'การโต้ตอบกับแอป', zh: '应用互动', hi: 'ऐप इंटरैक्शन' },
    crash: { ko: '비정상 종료 기록', en: 'Crash logs', th: 'บันทึกข้อขัดข้อง', zh: '崩溃日志', hi: 'क्रैश लॉग' }, diag: { ko: '진단 정보', en: 'Diagnostics', th: 'ข้อมูลการวินิจฉัย', zh: '诊断信息', hi: 'डायग्नोस्टिक्स' }, adid: { ko: '기기 ID (광고 ID)', en: 'Device or other IDs (advertising ID)', th: 'รหัสอุปกรณ์ (รหัสโฆษณา)', zh: '设备 ID（广告 ID）', hi: 'डिवाइस ID (विज्ञापन ID)' }
  };
  function dataSafety(A, lang) {
    const D = dataItems(A);
    return {
      rows: D.map(d => ({ id: d.id, label: DATA_LABEL[d.id][lang], playType: d.play.join(' › '), appleType: d.apple.join(' › '), collected: true, shared: !!d.shared, optional: d.optional, linked: d.linked, tracking: d.id === 'adid', purposes: d.purposes.map(p => PURPOSE[p][lang]).join(', ') })),
      encrypted: !(A.android && A.android.cleartext) || true, deletable: !!A.sdk.auth,
      onDevice: A.sdk.ocr ? { ko: '영수증 사진: 기기 안에서만 처리 → "수집" 아님', en: 'Receipt photos: processed on device only → not "collected"', th: 'รูปใบเสร็จ: ประมวลผลในเครื่องเท่านั้น → ไม่ถือว่า "เก็บรวบรวม"', zh: '收据照片：仅在设备上处理 → 不属于“收集”', hi: 'रसीद की फ़ोटो: सिर्फ़ डिवाइस पर प्रोसेस → “संग्रह” नहीं' }[lang] : null
    };
  }
  function dataSafetyCsv(A) {
    const r = dataSafety(A, 'en').rows;
    return ['Data type (Play),Data type (Apple),Collected,Shared,Optional,Linked to user,Used for tracking,Purposes', ...r.map(x => [x.playType, x.appleType, 'Yes', x.shared ? 'Yes' : 'No', x.optional ? 'Yes' : 'No', x.linked ? 'Yes' : 'No', x.tracking ? 'Yes' : 'No', x.purposes].map(v => `"${v}"`).join(','))].join('\n')
      + '\n\n"Is all user data encrypted in transit?","Yes"\n"Do you provide a way for users to request data deletion?","' + (A.sdk.auth ? 'Yes' : 'No') + '"\n';
  }

  /* ---------- 콘텐츠 등급 (IARC 설문 답) ---------- */
  function rating(A, lang) {
    const L = (ko, en, th, zh, hi) => ({ ko, en, th, zh, hi }[lang]);
    const game = A.categories[0] === 'games';
    const qa = [
      [L('앱 분류', 'App category', 'หมวดหมู่แอป', '应用类别', 'ऐप श्रेणी'), game ? L('게임', 'Game', 'เกม', '游戏', 'गेम') : L('기타 앱 (유틸리티·생산성·금융 등)', 'All other app types (utility, productivity, finance...)', 'แอปประเภทอื่น ๆ (ยูทิลิตี้ ประสิทธิภาพ การเงิน ฯลฯ)', '其他所有应用类型（实用工具、效率、财务等）', 'अन्य सभी ऐप प्रकार (यूटिलिटी, प्रोडक्टिविटी, वित्त आदि)')],
      [L('폭력적인 내용', 'Violence', 'ความรุนแรง', '暴力', 'हिंसा'), L('없음', 'No', 'ไม่มี', '否', 'नहीं')],
      [L('성적인 내용·노출', 'Sexuality / nudity', 'เนื้อหาทางเพศ', '性内容 / 裸露', 'यौन सामग्री / नग्नता'), L('없음', 'No', 'ไม่มี', '否', 'नहीं')],
      [L('욕설·거친 말', 'Language', 'ภาษาหยาบคาย', '粗俗语言', 'अपशब्द'), L('없음', 'No', 'ไม่มี', '否', 'नहीं')],
      [L('술·담배·약물', 'Controlled substances', 'สารควบคุม', '管制物品（烟酒、药物）', 'नियंत्रित पदार्थ'), L('없음', 'No', 'ไม่มี', '否', 'नहीं')],
      [L('도박·모의 도박', 'Gambling', 'การพนัน', '赌博', 'जुआ'), L('없음', 'No', 'ไม่มี', '否', 'नहीं')],
      [L('사용자끼리 대화·공유', 'Users can interact or share content', 'ผู้ใช้โต้ตอบหรือแชร์เนื้อหากัน', '用户可以互动或分享内容', 'उपयोगकर्ता आपस में बातचीत या सामग्री साझा कर सकते हैं'), L('아니요', 'No', 'ไม่', '否', 'नहीं')],
      [L('현재 위치를 다른 사람과 공유', 'Shares user location with others', 'แชร์ตำแหน่งกับผู้อื่น', '与他人分享用户位置', 'उपयोगकर्ता की लोकेशन दूसरों से साझा करता है'), L('아니요', 'No', 'ไม่', '否', 'नहीं')],
      [L('디지털 상품 구매', 'Digital purchases', 'การซื้อสินค้าดิจิทัล', '数字商品购买', 'डिजिटल खरीदारी'), A.sdk.billing ? L('예', 'Yes', 'ใช่', '是', 'हाँ') : L('아니요', 'No', 'ไม่', '否', 'नहीं')],
      [L('광고 포함', 'Contains ads', 'มีโฆษณา', '包含广告', 'विज्ञापन शामिल हैं'), A.sdk.ads ? L('예', 'Yes', 'ใช่', '是', 'हाँ') : L('아니요', 'No', 'ไม่', '否', 'नहीं')]
    ];
    return { qa, result: { play: L('전체이용가 (IARC 3+ / ESRB Everyone / PEGI 3)', 'Everyone (IARC 3+ / ESRB Everyone / PEGI 3)', 'ทุกวัย (IARC 3+ / ESRB Everyone / PEGI 3)', '适合所有人 (IARC 3+ / ESRB Everyone / PEGI 3)', 'सभी के लिए (IARC 3+ / ESRB Everyone / PEGI 3)'), apple: '4+' }, needCheck: game };
  }

  /* ---------- 개인정보처리방침 HTML ---------- */
  function privacyPolicy(A, lang, opts) {
    const o = opts || {}; const name = o.appName || nameOf(A, lang); const dev = A.developer.name || name; const email = A.developer.email || '';
    const s = A.sdk, fin = A.categories[0] === 'finance';
    const T = {
      ko: { h: `${name} 개인정보처리방침`, eff: '시행일', intro: `${dev}(이하 "개발자")는 ${name} 앱(이하 "앱")을 이용하는 분의 개인정보를 소중히 다룹니다. 이 방침은 앱이 어떤 정보를 왜 사용하는지 설명합니다.`,
        collect: '1. 수집하는 정보와 이용 목적', none: '앱은 개인을 식별할 수 있는 정보를 수집하지 않습니다.',
        it: { account: 'Google 로그인을 선택하면 이름, 이메일 주소, 사용자 ID를 받아 계정 관리와 백업·동기화에 사용합니다. 로그인은 선택 사항입니다.', cloud: fin ? '로그인한 경우 입력한 지출 기록을 클라우드(Google Firebase)에 저장해 기기 간 동기화에 사용합니다.' : '로그인한 경우 입력한 내용을 클라우드(Google Firebase)에 저장해 동기화에 사용합니다.', camera: s.ocr ? '카메라로 찍은 영수증 사진은 기기 안에서 글자 인식(Google ML Kit, 기기 내 처리)에만 쓰이며 서버로 전송하거나 저장하지 않습니다.' : '카메라는 사용자가 기능을 사용할 때만 쓰이며, 사진은 서버로 전송하지 않습니다.', photos: '사용자가 고른 사진만 앱 안에서 읽고, 서버로 보내지 않습니다.', analytics: '앱 개선을 위해 화면 이동·버튼 사용 같은 익명 사용 기록을 Google Firebase Analytics로 수집합니다.', crash: '오류를 고치기 위해 비정상 종료 기록과 진단 정보를 Google Firebase Crashlytics로 수집합니다.', ads: '앱에는 Google AdMob 광고가 표시되며, 광고 제공을 위해 광고 ID 등 기기 식별자가 사용될 수 있습니다. 기기 설정에서 광고 ID를 재설정하거나 맞춤 광고를 끌 수 있습니다.', location: '위치 기능을 사용할 때만 대략적인 위치를 사용합니다.', notif: '알림은 기기 안에서 예약되며 별도의 개인정보를 수집하지 않습니다.' },
        third: '2. 제3자 서비스', thirdTxt: '앱은 아래 서비스를 사용하며, 각 서비스의 개인정보처리방침이 함께 적용됩니다.',
        keep: '3. 보관 기간과 삭제', keepTxt: s.auth ? '계정 정보와 클라우드에 저장된 기록은 계정을 삭제할 때까지 보관하며, 삭제 요청 시 30일 이내에 지웁니다. 앱의 설정 > 계정 삭제 또는 아래 계정 삭제 안내 페이지에서 요청할 수 있습니다.' : '앱 데이터는 기기 안에 저장되며, 앱을 삭제하면 함께 지워집니다.',
        kids: '4. 아동', kidsTxt: '앱은 만 13세 미만 아동을 대상으로 하지 않으며, 아동의 개인정보를 고의로 수집하지 않습니다.',
        sec: '5. 안전 조치', secTxt: '모든 통신은 암호화(HTTPS)되며, 정보 접근은 필요한 범위로 제한합니다.',
        chg: '6. 방침 변경', chgTxt: '방침이 바뀌면 이 페이지에 새 시행일과 함께 알립니다.', ct: '7. 문의', ctTxt: '개인정보 관련 문의는 아래 이메일로 연락해 주세요.' },
      en: { h: `${name} Privacy Policy`, eff: 'Effective date', intro: `${dev} ("we") respects the privacy of everyone who uses the ${name} app (the "App"). This policy explains what information the App uses and why.`,
        collect: '1. Information we collect and why', none: 'The App does not collect personally identifiable information.',
        it: { account: 'If you choose to sign in with Google, we receive your name, email address and user ID to manage your account and back up/sync your data. Signing in is optional.', cloud: fin ? 'When signed in, the expense records you enter are stored in the cloud (Google Firebase) to sync across your devices.' : 'When signed in, the content you create is stored in the cloud (Google Firebase) to sync across devices.', camera: s.ocr ? 'Receipt photos taken with the camera are used only for on-device text recognition (Google ML Kit, processed on your device). They are never uploaded or stored on our servers.' : 'The camera is used only when you use a camera feature. Photos are not uploaded to our servers.', photos: 'The App reads only the photos you pick and does not upload them.', analytics: 'To improve the App, we collect anonymous usage events (such as screens viewed and buttons tapped) with Google Firebase Analytics.', crash: 'To fix problems, we collect crash logs and diagnostics with Google Firebase Crashlytics.', ads: 'The App shows ads from Google AdMob. Device identifiers such as the advertising ID may be used to serve ads. You can reset your advertising ID or opt out of personalized ads in your device settings.', location: 'Approximate location is used only while you use location features.', notif: 'Reminders are scheduled on your device; no personal data is collected for them.' },
        third: '2. Third-party services', thirdTxt: 'The App uses the services below; their privacy policies also apply.',
        keep: '3. Retention and deletion', keepTxt: s.auth ? 'Account information and cloud records are kept until you delete your account and are erased within 30 days of a deletion request. You can request deletion in Settings > Delete account or on the account deletion page below.' : 'App data is stored on your device and is removed when you uninstall the App.',
        kids: "4. Children", kidsTxt: 'The App is not directed to children under 13 and does not knowingly collect their personal information.',
        sec: '5. Security', secTxt: 'All network communication is encrypted (HTTPS) and access to data is limited to what is necessary.',
        chg: '6. Changes', chgTxt: 'If this policy changes, we will post the update on this page with a new effective date.', ct: '7. Contact', ctTxt: 'For privacy questions, contact us at the email below.' },
      th: { h: `นโยบายความเป็นส่วนตัวของ ${name}`, eff: 'วันที่มีผล', intro: `${dev} ("เรา") ให้ความสำคัญกับความเป็นส่วนตัวของผู้ใช้แอป ${name} ("แอป") นโยบายนี้อธิบายว่าแอปใช้ข้อมูลอะไรและเพื่ออะไร`,
        collect: '1. ข้อมูลที่เก็บและวัตถุประสงค์', none: 'แอปไม่เก็บข้อมูลที่ระบุตัวบุคคลได้',
        it: { account: 'หากคุณเลือกลงชื่อเข้าใช้ด้วย Google เราจะได้รับชื่อ อีเมล และรหัสผู้ใช้ เพื่อจัดการบัญชีและสำรอง/ซิงก์ข้อมูล การลงชื่อเข้าใช้ไม่บังคับ', cloud: fin ? 'เมื่อลงชื่อเข้าใช้ บันทึกรายจ่ายที่คุณกรอกจะถูกเก็บบนคลาวด์ (Google Firebase) เพื่อซิงก์ระหว่างอุปกรณ์' : 'เมื่อลงชื่อเข้าใช้ เนื้อหาที่คุณสร้างจะถูกเก็บบนคลาวด์ (Google Firebase) เพื่อซิงก์', camera: s.ocr ? 'รูปใบเสร็จที่ถ่ายด้วยกล้องใช้เพื่ออ่านข้อความในเครื่องเท่านั้น (Google ML Kit ประมวลผลในเครื่อง) ไม่ถูกอัปโหลดหรือเก็บบนเซิร์ฟเวอร์' : 'กล้องจะถูกใช้เมื่อคุณใช้ฟีเจอร์กล้องเท่านั้น รูปไม่ถูกอัปโหลด', photos: 'แอปอ่านเฉพาะรูปที่คุณเลือก และไม่อัปโหลด', analytics: 'เพื่อพัฒนาแอป เราเก็บข้อมูลการใช้งานแบบไม่ระบุตัวตนผ่าน Google Firebase Analytics', crash: 'เพื่อแก้ไขปัญหา เราเก็บบันทึกข้อขัดข้องและข้อมูลวินิจฉัยผ่าน Google Firebase Crashlytics', ads: 'แอปแสดงโฆษณาจาก Google AdMob อาจมีการใช้รหัสอุปกรณ์ เช่น รหัสโฆษณา เพื่อแสดงโฆษณา คุณสามารถรีเซ็ตรหัสโฆษณาหรือปิดโฆษณาที่ปรับตามบุคคลได้ในการตั้งค่าอุปกรณ์', location: 'ใช้ตำแหน่งโดยประมาณเฉพาะเมื่อคุณใช้ฟีเจอร์ตำแหน่ง', notif: 'การแจ้งเตือนตั้งเวลาในเครื่อง ไม่มีการเก็บข้อมูลส่วนบุคคล' },
        third: '2. บริการของบุคคลที่สาม', thirdTxt: 'แอปใช้บริการด้านล่าง และนโยบายความเป็นส่วนตัวของบริการเหล่านั้นมีผลด้วย',
        keep: '3. ระยะเวลาเก็บรักษาและการลบ', keepTxt: s.auth ? 'ข้อมูลบัญชีและบันทึกบนคลาวด์จะเก็บไว้จนกว่าคุณจะลบบัญชี และจะถูกลบภายใน 30 วันหลังได้รับคำขอ ขอลบได้ที่ ตั้งค่า > ลบบัญชี หรือหน้าคำแนะนำการลบบัญชีด้านล่าง' : 'ข้อมูลแอปเก็บในเครื่อง และจะถูกลบเมื่อถอนการติดตั้งแอป',
        kids: '4. เด็ก', kidsTxt: 'แอปไม่ได้มุ่งเป้าไปที่เด็กอายุต่ำกว่า 13 ปี และไม่เก็บข้อมูลของเด็กโดยเจตนา',
        sec: '5. ความปลอดภัย', secTxt: 'การสื่อสารทั้งหมดเข้ารหัส (HTTPS) และจำกัดการเข้าถึงข้อมูลเท่าที่จำเป็น',
        chg: '6. การเปลี่ยนแปลง', chgTxt: 'หากนโยบายเปลี่ยนแปลง เราจะแจ้งในหน้านี้พร้อมวันที่มีผลใหม่', ct: '7. ติดต่อ', ctTxt: 'หากมีคำถามเรื่องความเป็นส่วนตัว ติดต่อเราทางอีเมลด้านล่าง' },
      zh: { h: `${name} 隐私政策`, eff: '生效日期', intro: `${dev}（以下简称“我们”）尊重每一位 ${name} 应用（以下简称“本应用”）用户的隐私。本政策说明本应用使用哪些信息以及原因。`,
        collect: '1. 我们收集的信息及用途', none: '本应用不收集可识别个人身份的信息。',
        it: { account: '如果你选择使用 Google 登录，我们会获取你的姓名、电子邮件地址和用户 ID，用于管理账号和备份/同步数据。登录是可选的。', cloud: fin ? '登录后，你输入的支出记录会存储在云端（Google Firebase），用于在你的设备间同步。' : '登录后，你创建的内容会存储在云端（Google Firebase），用于在设备间同步。', camera: s.ocr ? '用相机拍摄的收据照片仅用于设备上的文字识别（Google ML Kit，在你的设备上处理），绝不会上传或存储到我们的服务器。' : '只有在你使用相机功能时才会使用相机，照片不会上传到我们的服务器。', photos: '本应用只读取你选择的照片，且不会上传。', analytics: '为了改进本应用，我们通过 Google Firebase Analytics 收集匿名使用事件（如浏览的页面和点击的按钮）。', crash: '为了修复问题，我们通过 Google Firebase Crashlytics 收集崩溃日志和诊断信息。', ads: '本应用展示 Google AdMob 广告，可能会使用广告 ID 等设备标识符来投放广告。你可以在设备设置中重置广告 ID 或关闭个性化广告。', location: '仅在你使用位置功能时使用大致位置。', notif: '提醒在你的设备上安排，不会为此收集个人数据。' },
        third: '2. 第三方服务', thirdTxt: '本应用使用以下服务，其隐私政策同样适用。',
        keep: '3. 保留与删除', keepTxt: s.auth ? '账号信息和云端记录会保留到你删除账号为止，并在收到删除请求后 30 天内清除。你可以在“设置 > 删除账号”或下方的账号删除页面中申请删除。' : '应用数据存储在你的设备上，卸载本应用时会一并删除。',
        kids: '4. 儿童', kidsTxt: '本应用不面向 13 岁以下儿童，也不会故意收集儿童的个人信息。',
        sec: '5. 安全', secTxt: '所有网络通信均经过加密（HTTPS），对数据的访问仅限于必要范围。',
        chg: '6. 政策变更', chgTxt: '如本政策有变更，我们会在此页面公布更新并注明新的生效日期。', ct: '7. 联系我们', ctTxt: '如有隐私相关问题，请通过以下邮箱联系我们。' },
      hi: { h: `${name} गोपनीयता नीति`, eff: 'लागू होने की तारीख', intro: `${dev} ("हम") ${name} ऐप ("ऐप") का इस्तेमाल करने वाले हर व्यक्ति की गोपनीयता का सम्मान करता है। यह नीति बताती है कि ऐप कौन-सी जानकारी इस्तेमाल करता है और क्यों।`,
        collect: '1. हम कौन-सी जानकारी लेते हैं और क्यों', none: 'ऐप व्यक्तिगत पहचान वाली कोई जानकारी इकट्ठा नहीं करता।',
        it: { account: 'अगर आप Google से साइन इन करना चुनते हैं, तो हमें आपका नाम, ईमेल पता और यूज़र ID मिलता है, जिससे हम आपका अकाउंट संभालते हैं और डेटा का बैकअप/सिंक करते हैं। साइन इन वैकल्पिक है।', cloud: fin ? 'साइन इन होने पर, आपके डाले गए खर्च के रिकॉर्ड क्लाउड (Google Firebase) में रखे जाते हैं ताकि आपके डिवाइसों में सिंक हो सकें।' : 'साइन इन होने पर, आपकी बनाई सामग्री क्लाउड (Google Firebase) में रखी जाती है ताकि डिवाइसों में सिंक हो सके।', camera: s.ocr ? 'कैमरे से ली गई रसीद की फ़ोटो सिर्फ़ डिवाइस पर टेक्स्ट पहचानने (Google ML Kit, आपके डिवाइस पर प्रोसेस) के लिए इस्तेमाल होती हैं। वे कभी हमारे सर्वर पर अपलोड या स्टोर नहीं होतीं।' : 'कैमरा सिर्फ़ तब इस्तेमाल होता है जब आप कैमरा सुविधा इस्तेमाल करते हैं। फ़ोटो हमारे सर्वर पर अपलोड नहीं होतीं।', photos: 'ऐप सिर्फ़ आपकी चुनी हुई फ़ोटो पढ़ता है और उन्हें अपलोड नहीं करता।', analytics: 'ऐप को बेहतर बनाने के लिए हम Google Firebase Analytics से गुमनाम उपयोग इवेंट (जैसे देखी गई स्क्रीन और टैप किए गए बटन) इकट्ठा करते हैं।', crash: 'समस्याएँ ठीक करने के लिए हम Google Firebase Crashlytics से क्रैश लॉग और डायग्नोस्टिक्स इकट्ठा करते हैं।', ads: 'ऐप में Google AdMob के विज्ञापन दिखते हैं। विज्ञापन दिखाने के लिए विज्ञापन ID जैसे डिवाइस पहचानकर्ता इस्तेमाल हो सकते हैं। आप अपने डिवाइस की सेटिंग में विज्ञापन ID रीसेट कर सकते हैं या व्यक्तिगत विज्ञापन बंद कर सकते हैं।', location: 'अनुमानित लोकेशन सिर्फ़ तब इस्तेमाल होती है जब आप लोकेशन सुविधाएँ इस्तेमाल करते हैं।', notif: 'रिमाइंडर आपके डिवाइस पर ही शेड्यूल होते हैं; इनके लिए कोई निजी डेटा इकट्ठा नहीं होता।' },
        third: '2. तीसरे पक्ष की सेवाएँ', thirdTxt: 'ऐप नीचे दी गई सेवाएँ इस्तेमाल करता है; उनकी गोपनीयता नीतियाँ भी लागू होती हैं।',
        keep: '3. डेटा रखना और डिलीट करना', keepTxt: s.auth ? 'अकाउंट की जानकारी और क्लाउड रिकॉर्ड तब तक रखे जाते हैं जब तक आप अपना अकाउंट डिलीट नहीं करते, और डिलीट के अनुरोध के 30 दिनों के अंदर मिटा दिए जाते हैं। आप सेटिंग > अकाउंट डिलीट करें में या नीचे दिए अकाउंट डिलीट पेज पर अनुरोध कर सकते हैं।' : 'ऐप का डेटा आपके डिवाइस पर रहता है और ऐप अनइंस्टॉल करने पर हट जाता है।',
        kids: '4. बच्चे', kidsTxt: 'यह ऐप 13 साल से कम उम्र के बच्चों के लिए नहीं है और जानबूझकर उनकी निजी जानकारी इकट्ठा नहीं करता।',
        sec: '5. सुरक्षा', secTxt: 'सारा नेटवर्क संचार एन्क्रिप्टेड (HTTPS) है और डेटा तक पहुँच सिर्फ़ ज़रूरत भर तक सीमित है।',
        chg: '6. बदलाव', chgTxt: 'अगर यह नीति बदलती है, तो हम नई लागू होने की तारीख के साथ इस पेज पर अपडेट डालेंगे।', ct: '7. संपर्क', ctTxt: 'गोपनीयता से जुड़े सवालों के लिए नीचे दिए ईमेल पर संपर्क करें।' }
    }[lang];
    const items = [];
    if (s.auth) items.push(T.it.account); if (s.cloudDb && s.auth) items.push(T.it.cloud); if (s.camera) items.push(T.it.camera);
    if (s.photos && !(o.photoRemoved)) items.push(T.it.photos); if (s.location) items.push(T.it.location); if (s.analytics) items.push(T.it.analytics); if (s.crash) items.push(T.it.crash); if (s.ads) items.push(T.it.ads); if (s.notifications) items.push(T.it.notif);
    const third = [];
    if (s.auth || s.cloudDb || s.analytics || s.crash) third.push(['Google Firebase', 'https://firebase.google.com/support/privacy']);
    if (s.ads) third.push(['Google AdMob', 'https://policies.google.com/technologies/ads']);
    if (s.ocr) third.push(['Google ML Kit', 'https://developers.google.com/ml-kit/terms']);
    const delUrl = o.deletionUrl || 'account-deletion.html';
    return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(T.h)}</title>
<style>body{font:16px/1.7 system-ui,-apple-system,"Segoe UI",sans-serif;max-width:760px;margin:0 auto;padding:32px 20px;color:#1b1d21}h1{font-size:26px;line-height:1.3}h2{font-size:18px;margin-top:28px}li{margin:6px 0}.muted{color:#666}a{color:#0b5c4f}</style></head>
<body>
<h1>${esc(T.h)}</h1>
<p class="muted">${T.eff}: ${today()}</p>
<p>${esc(T.intro)}</p>
<h2>${T.collect}</h2>
${items.length ? '<ul>' + items.map(i => `<li>${esc(i)}</li>`).join('') + '</ul>' : `<p>${T.none}</p>`}
${third.length ? `<h2>${T.third}</h2><p>${T.thirdTxt}</p><ul>${third.map(t => `<li><a href="${t[1]}">${t[0]}</a></li>`).join('')}</ul>` : ''}
<h2>${T.keep}</h2><p>${esc(T.keepTxt)}</p>${s.auth ? `<p><a href="${esc(delUrl)}">${esc(delUrl)}</a></p>` : ''}
<h2>${T.kids}</h2><p>${T.kidsTxt}</p>
<h2>${T.sec}</h2><p>${T.secTxt}</p>
<h2>${T.chg}</h2><p>${T.chgTxt}</p>
<h2>${T.ct}</h2><p>${T.ctTxt}</p><p>${email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : '[contact email]'}</p>
</body></html>
`;
  }

  function deletionPage(A, lang) {
    const name = nameOf(A, lang), email = A.developer.email || '[contact email]';
    const T = {
      ko: [`${name} 계정 및 데이터 삭제`, '앱에서 삭제하기', ['앱을 열고 설정으로 이동합니다.', '"계정 삭제"를 누릅니다.', '확인하면 계정과 클라우드 기록이 바로 삭제 요청됩니다.'], '앱 없이 요청하기', `가입한 이메일 주소로 ${email} 에 "계정 삭제 요청"이라고 보내 주세요.`, '삭제되는 데이터', '이름, 이메일, 사용자 ID, 클라우드에 저장된 기록. 30일 이내에 모두 지워집니다. 법에 따라 보관해야 하는 정보는 없습니다.'],
      en: [`Delete your ${name} account and data`, 'Delete in the app', ['Open the app and go to Settings.', 'Tap "Delete account".', 'Confirm — your account and cloud records are scheduled for deletion.'], 'Request without the app', `Email ${email} from your sign-in address with the subject "Account deletion request".`, 'What is deleted', 'Name, email, user ID and records stored in the cloud — all erased within 30 days. No data is retained.'],
      th: [`ลบบัญชีและข้อมูล ${name}`, 'ลบในแอป', ['เปิดแอปแล้วไปที่ ตั้งค่า', 'แตะ "ลบบัญชี"', 'ยืนยัน บัญชีและข้อมูลบนคลาวด์จะถูกลบ'], 'ขอลบโดยไม่ใช้แอป', `ส่งอีเมลจากอีเมลที่ใช้ลงชื่อเข้าใช้ไปที่ ${email} หัวข้อ "ขอลบบัญชี"`, 'ข้อมูลที่ถูกลบ', 'ชื่อ อีเมล รหัสผู้ใช้ และบันทึกบนคลาวด์ ทั้งหมดจะถูกลบภายใน 30 วัน'],
      zh: [`删除你的 ${name} 账号和数据`, '在应用内删除', ['打开应用，进入“设置”。', '点击“删除账号”。', '确认后，你的账号和云端记录将被安排删除。'], '不通过应用申请', `请用你登录时使用的邮箱发送邮件至 ${email}，主题为“账号删除申请”。`, '会删除哪些数据', '姓名、电子邮件、用户 ID 以及存储在云端的记录——全部在 30 天内清除，不保留任何数据。'],
      hi: [`अपना ${name} अकाउंट और डेटा डिलीट करें`, 'ऐप में डिलीट करें', ['ऐप खोलें और सेटिंग में जाएँ।', '“अकाउंट डिलीट करें” पर टैप करें।', 'पुष्टि करें — आपका अकाउंट और क्लाउड रिकॉर्ड डिलीट के लिए तय हो जाएँगे।'], 'ऐप के बिना अनुरोध करें', `अपने साइन-इन वाले ईमेल से ${email} पर “अकाउंट डिलीट अनुरोध” विषय के साथ ईमेल भेजें।`, 'क्या डिलीट होता है', 'नाम, ईमेल, यूज़र ID और क्लाउड में रखे रिकॉर्ड — सब 30 दिनों के अंदर मिटा दिए जाते हैं। कोई डेटा नहीं रखा जाता।']
    }[lang];
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(T[0])}</title>
<style>body{font:16px/1.7 system-ui,sans-serif;max-width:720px;margin:0 auto;padding:32px 20px;color:#1b1d21}h1{font-size:24px}h2{font-size:18px;margin-top:24px}</style></head><body>
<h1>${esc(T[0])}</h1><h2>${T[1]}</h2><ol>${T[2].map(x => `<li>${esc(x)}</li>`).join('')}</ol><h2>${T[3]}</h2><p>${esc(T[4])}</p><h2>${T[5]}</h2><p>${esc(T[6])}</p></body></html>
`;
  }

  /* ---------- 코드 수정안 ---------- */
  function patches(A, lang) {
    const out = {}; const an = A.android, io = A.ios;
    if (an && an.gradlePath && (!an.targetSdk || an.targetSdk < 36)) {
      const eq = an.gradleKts ? ' = ' : ' ';
      out['patch-gradle'] = { file: an.gradlePath, diff: `--- a/${an.gradlePath}\n+++ b/${an.gradlePath}\n@@ android {\n-    compileSdk${eq}${an.compileSdk || '?'}\n+    compileSdk${eq}36\n@@ defaultConfig {\n-        targetSdk${eq}${an.targetSdk || '?'}\n+        targetSdk${eq}36\n` };
    }
    if (an && an.manifestPath) {
      if (an.cleartext) out['patch-manifest-cleartext'] = { file: an.manifestPath, diff: `--- a/${an.manifestPath}\n+++ b/${an.manifestPath}\n@@ <application\n-        android:usesCleartextTraffic="true">\n+        android:usesCleartextTraffic="false">\n` };
      if (an.debuggable) out['patch-manifest-debug'] = { file: an.manifestPath, diff: `--- a/${an.manifestPath}\n+++ b/${an.manifestPath}\n-        android:debuggable="true"\n` };
      const ph = an.permissions.filter(p => /READ_MEDIA_IMAGES|READ_MEDIA_VIDEO/.test(p));
      if (ph.length) out['patch-manifest-photo'] = { file: an.manifestPath, diff: `--- a/${an.manifestPath}\n+++ b/${an.manifestPath}\n${ph.map(p => `-    <uses-permission android:name="${p}" />`).join('\n')}\n\n// ${{ ko: '사진 고르기는 권한이 필요 없는 Android 사진 선택 도구로 바꿉니다:', en: 'Use the Android Photo Picker instead (no permission needed):', th: 'ใช้ Android Photo Picker แทน (ไม่ต้องขอสิทธิ์):', zh: '改用 Android 照片选择器（无需权限）：', hi: 'इसकी जगह Android Photo Picker इस्तेमाल करें (कोई अनुमति नहीं चाहिए):' }[lang]}\n+ val pick = registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri -> /* ... */ }\n+ pick.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))\n` };
    }
    if (io && io.plistPath) {
      const empty = Object.entries(io.usage).filter(([, v]) => !String(v).trim()).map(([k]) => k);
      const tx = { NSPhotoLibraryUsageDescription: 'Choose a receipt photo from your library to add an expense.', NSCameraUsageDescription: 'Camera access is needed to scan your receipts.', NSLocationWhenInUseUsageDescription: 'Your location is used to show nearby results.', NSMicrophoneUsageDescription: 'The microphone is used for voice input.' };
      if (A.categories[0] !== 'finance') tx.NSPhotoLibraryUsageDescription = 'Choose a photo from your library to use in the app.';
      if (empty.length) out['patch-plist'] = { file: io.plistPath, diff: `--- a/${io.plistPath}\n+++ b/${io.plistPath}\n` + empty.map(k => `     <key>${k}</key>\n-    <string></string>\n+    <string>${tx[k] || 'This permission is used for a feature you choose to use.'}</string>`).join('\n') + '\n' };
    }
    return out;
  }
  function xcprivacy(A) {
    const types = [];
    const t = (type, linked, track, purpose) => `\t\t<dict>\n\t\t\t<key>NSPrivacyCollectedDataType</key><string>${type}</string>\n\t\t\t<key>NSPrivacyCollectedDataTypeLinked</key><${linked}/>\n\t\t\t<key>NSPrivacyCollectedDataTypeTracking</key><${track}/>\n\t\t\t<key>NSPrivacyCollectedDataTypePurposes</key><array><string>${purpose}</string></array>\n\t\t</dict>`;
    if (A.sdk.auth) types.push(t('NSPrivacyCollectedDataTypeEmailAddress', 'true', 'false', 'NSPrivacyCollectedDataTypePurposeAppFunctionality'), t('NSPrivacyCollectedDataTypeName', 'true', 'false', 'NSPrivacyCollectedDataTypePurposeAppFunctionality'), t('NSPrivacyCollectedDataTypeUserID', 'true', 'false', 'NSPrivacyCollectedDataTypePurposeAppFunctionality'));
    if (A.sdk.cloudDb && A.categories[0] === 'finance') types.push(t('NSPrivacyCollectedDataTypeOtherFinancialInfo', 'true', 'false', 'NSPrivacyCollectedDataTypePurposeAppFunctionality'));
    if (A.sdk.analytics) types.push(t('NSPrivacyCollectedDataTypeProductInteraction', 'false', 'false', 'NSPrivacyCollectedDataTypePurposeAnalytics'));
    if (A.sdk.crash) types.push(t('NSPrivacyCollectedDataTypeCrashData', 'false', 'false', 'NSPrivacyCollectedDataTypePurposeAppFunctionality'));
    if (A.sdk.ads) types.push(t('NSPrivacyCollectedDataTypeDeviceID', 'false', 'false', 'NSPrivacyCollectedDataTypePurposeThirdPartyAdvertising'));
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>NSPrivacyTracking</key><false/>
\t<key>NSPrivacyTrackingDomains</key><array/>
\t<key>NSPrivacyCollectedDataTypes</key>
\t<array>
${types.join('\n')}
\t</array>
\t<key>NSPrivacyAccessedAPITypes</key>
\t<array>
\t\t<dict>
\t\t\t<key>NSPrivacyAccessedAPIType</key><string>NSPrivacyAccessedAPICategoryUserDefaults</string>
\t\t\t<key>NSPrivacyAccessedAPITypeReasons</key><array><string>CA92.1</string></array>
\t\t</dict>
\t</array>
</dict>
</plist>
`;
  }

  /* ---------- 심사 거절 대응 ---------- */
  const REJECTIONS = [
    { id: 'apple-21-demo', store: 'apple', match: /2\.1|information needed|demo account|sign[- ]in credentials|log ?in/i,
      sample: 'Guideline 2.1 - Information Needed\n\nWe were unable to review your app because it requires users to sign in, but no demo account was provided in App Review Information. Please provide a demo account and password, or explain how to access all features without signing in.',
      plan: { ko: ['로그인 없이도 모든 핵심 기능(스캔·예산·리포트)을 쓸 수 있다는 점을 설명합니다.', '백업 기능 확인용 Google 테스트 계정 정보를 App Store Connect > 앱 심사 정보에 넣습니다.', '아래 답장을 심사 센터(Resolution Center)에 보내고 다시 제출합니다.'], en: ['Explain that every core feature (scan, budget, reports) works without signing in.', 'Add a Google test account for the backup feature in App Store Connect > App Review Information.', 'Send the reply below in the Resolution Center and resubmit.'], th: ['อธิบายว่าฟีเจอร์หลักทั้งหมด (สแกน งบประมาณ รายงาน) ใช้ได้โดยไม่ต้องลงชื่อเข้าใช้', 'ใส่บัญชี Google สำหรับทดสอบฟีเจอร์สำรองข้อมูลใน App Store Connect > App Review Information', 'ส่งข้อความตอบกลับด้านล่างใน Resolution Center แล้วส่งตรวจอีกครั้ง'], zh: ['说明所有核心功能（扫描、预算、报表）无需登录即可使用。', '在 App Store Connect > App 审核信息中添加用于测试备份功能的 Google 测试账号。', '在解决方案中心（Resolution Center）发送下面的回复，然后重新提交。'], hi: ['बताएँ कि हर मुख्य सुविधा (स्कैन, बजट, रिपोर्ट) बिना साइन इन के चलती है।', 'बैकअप सुविधा के लिए App Store Connect > App Review Information में एक Google टेस्ट अकाउंट जोड़ें।', 'Resolution Center में नीचे दिया जवाब भेजें और दोबारा सबमिट करें।'] },
      reply: n => `Hello App Review team,\n\nThank you for reviewing ${n}. Signing in is optional: all core features — receipt scanning, budgets and reports — are available without an account on the first screen ("Skip").\n\nSign-in is only used for the optional cloud backup. To test it, please use the demo account we have added to App Review Information:\n• Email: (see App Review Information)\n• Password: (see App Review Information)\n\nPlease let us know if you need anything else.\n\nBest regards` },
    { id: 'play-photo', store: 'play', match: /photo and video|READ_MEDIA_IMAGES|photo picker/i,
      sample: 'Issue found: Photo and Video Permissions policy\n\nYour app requests READ_MEDIA_IMAGES but its core functionality does not require persistent access to photos. Please remove the permission and use the Android Photo Picker.',
      plan: { ko: ['READ_MEDIA_IMAGES 권한을 지우고, 권한이 필요 없는 Android 사진 선택 도구로 바꿉니다 (수정안 준비됨).', 'versionCode를 1 올려 새 빌드를 만듭니다.', 'Play Console > 앱 콘텐츠 > 사진 및 동영상 권한 신고를 "사용 안 함"으로 바꾸고 다시 제출합니다.'], en: ['Remove READ_MEDIA_IMAGES and switch to the Android Photo Picker (patch ready).', 'Increase versionCode by 1 and build again.', 'Update the Photo and video permissions declaration in Play Console and resubmit.'], th: ['ลบสิทธิ์ READ_MEDIA_IMAGES และเปลี่ยนเป็น Android Photo Picker (เตรียมแพตช์ไว้แล้ว)', 'เพิ่ม versionCode อีก 1 แล้วบิลด์ใหม่', 'อัปเดตการประกาศสิทธิ์รูปภาพและวิดีโอใน Play Console แล้วส่งใหม่'], zh: ['移除 READ_MEDIA_IMAGES，改用 Android 照片选择器（修改方案已准备好）。', '将 versionCode 加 1 并重新构建。', '在 Play Console 中更新照片和视频权限声明，然后重新提交。'], hi: ['READ_MEDIA_IMAGES हटाएँ और Android Photo Picker पर जाएँ (पैच तैयार है)।', 'versionCode को 1 बढ़ाएँ और फिर से बिल्ड करें।', 'Play Console में फ़ोटो और वीडियो अनुमति की घोषणा अपडेट करें और दोबारा सबमिट करें।'] },
      reply: n => `Hello Google Play team,\n\nThank you for the review of ${n}. We have removed the READ_MEDIA_IMAGES permission and now use the Android Photo Picker, which requires no broad photo access. A new build (higher versionCode) has been submitted.\n\nBest regards` },
    { id: 'play-datasafety', store: 'play', match: /data safety|advertising id|AD_ID|user data policy/i,
      sample: 'Issue found: Invalid Data safety form\n\nWe found that your app collects Device or other IDs (Advertising ID) but it is not disclosed in the Data safety form.',
      plan: { ko: ['데이터 보안 양식에 "기기 또는 기타 ID — 광고·분석, 제3자 공유"를 추가합니다 (답안 준비됨).', '광고 ID 신고를 "예"로 맞춥니다.', '저장 후 검토를 위해 제출합니다. 새 빌드는 필요 없어요.'], en: ['Add "Device or other IDs — advertising & analytics, shared" to the Data safety form (answers ready).', 'Set the Advertising ID declaration to "Yes".', 'Save and send for review. No new build is needed.'], th: ['เพิ่ม "รหัสอุปกรณ์หรือรหัสอื่น ๆ — โฆษณาและการวิเคราะห์ แชร์กับบุคคลที่สาม" ในแบบฟอร์มความปลอดภัยของข้อมูล', 'ตั้งค่าการประกาศรหัสโฆษณาเป็น "ใช่"', 'บันทึกแล้วส่งตรวจ ไม่ต้องบิลด์ใหม่'], zh: ['在数据安全表单中添加“设备或其他 ID——广告和分析，共享”（答案已准备好）。', '将广告 ID 声明设为“是”。', '保存并发送以供审核，无需新构建。'], hi: ['डेटा सुरक्षा फ़ॉर्म में “डिवाइस या अन्य ID — विज्ञापन और एनालिटिक्स, साझा” जोड़ें (जवाब तैयार हैं)।', 'विज्ञापन ID की घोषणा को “हाँ” पर सेट करें।', 'सेव करें और समीक्षा के लिए भेजें। नए बिल्ड की ज़रूरत नहीं।'] },
      reply: n => `Hello Google Play team,\n\nThank you for reviewing ${n}. We have updated the Data safety form to disclose Device or other IDs (Advertising ID), collected and shared with Google AdMob for advertising and analytics. The Advertising ID declaration has also been updated.\n\nBest regards` },
    { id: 'apple-511', store: 'apple', match: /5\.1\.1|account deletion|delete (the|their) account/i,
      sample: 'Guideline 5.1.1(v) - Data Collection and Storage\n\nThe app supports account creation but does not include an option to initiate account deletion.',
      plan: { ko: ['앱 설정에 "계정 삭제" 버튼을 넣습니다 (안내 페이지 준비됨).', '삭제 화면 위치를 심사 메모에 적습니다.', '새 빌드를 올리고 답장과 함께 다시 제출합니다.'], en: ['Add a "Delete account" button in Settings (help page ready).', 'Describe where to find it in the review notes.', 'Upload a new build and resubmit with the reply.'], th: ['เพิ่มปุ่ม "ลบบัญชี" ในตั้งค่า (มีหน้าคำแนะนำพร้อมแล้ว)', 'ระบุตำแหน่งในบันทึกถึงผู้ตรวจ', 'อัปโหลดบิลด์ใหม่และส่งพร้อมข้อความตอบกลับ'], zh: ['在应用的设置中添加“删除账号”按钮（说明页面已准备好）。', '在审核备注中说明该功能的位置。', '上传新构建，并连同回复一起重新提交。'], hi: ['सेटिंग में “अकाउंट डिलीट करें” बटन जोड़ें (सहायता पेज तैयार है)।', 'समीक्षा नोट्स में बताएँ कि यह कहाँ मिलेगा।', 'नया बिल्ड अपलोड करें और जवाब के साथ दोबारा सबमिट करें।'] },
      reply: n => `Hello App Review team,\n\n${n} now lets users delete their account in Settings > Delete account. Deletion removes the account and all cloud data. A new build has been submitted.\n\nBest regards` }
  ];
  function matchRejection(text, store) {
    const t = String(text || '');
    return REJECTIONS.find(r => (!store || r.store === store) && r.match.test(t)) || REJECTIONS.find(r => r.match.test(t)) || null;
  }

  window.AAPGen = { LANGS, CAT, listing, features, dataSafety, dataSafetyCsv, rating, privacyPolicy, deletionPage, patches, xcprivacy, REJECTIONS, matchRejection, nameOf, tagOf, clip, esc };
})();
