// ==========================================
// 1. 전역 변수 및 스토리지 (마킹 기능)
// ==========================================
const db = {}; 
let currentChapter = 1;
let currentSecIndex = 0;
let observer = null;
let isMarkingMode = false;
let selectedText = ""; 
let isAutoScrolling = false; 
let isTestMode = false;
let recognition = null;
let isListening = false;

const Storage = {
    get: () => JSON.parse(localStorage.getItem('my_marks') || '{}'),
    set: (data) => localStorage.setItem('my_marks', JSON.stringify(data)),
    add: (ch, verseIdx, text) => {
        const data = Storage.get();
        const key = `${ch}-${verseIdx}`;
        if(!data[key]) data[key] = [];
        if(!data[key].includes(text)) data[key].push(text);
        Storage.set(data);
    },
    remove: (ch, verseIdx, text) => {
        const data = Storage.get();
        const key = `${ch}-${verseIdx}`;
        if(data[key]) {
            data[key] = data[key].filter(t => t !== text);
            if(data[key].length === 0) delete data[key];
            Storage.set(data);
        }
    }
};

// ==========================================
// 2. 오디오 엔진 (Firebase)
// ==========================================
let currentAudio = null;
let activeAudioBtn = null;

window.playBibleAudio = function(btn, ch, vNum) {
    const card = btn.closest('.verse-card');
    const speed = parseFloat(card.querySelector('.speed-sel').value);
    const repeatTarget = parseInt(card.querySelector('.repeat-inp').value);
    let playCount = 1;

    const chStr = String(ch);
    const vStr = String(vNum).padStart(2, '0');
    
    let fileName = '';
    if (chStr === 'special' || chStr === '2월 시험') {
        fileName = `special_${vStr}.m4a`; 
    } else {
        fileName = `rev_${chStr.padStart(2, '0')}_${vStr}.m4a`;
    }
    
    const audioUrl = `https://firebasestorage.googleapis.com/v0/b/sc-bible-7a046.firebasestorage.app/o/rev%2F${fileName}?alt=media`;

    if (currentAudio) {
        currentAudio.pause();
        if (activeAudioBtn) activeAudioBtn.innerText = "🔊";
        if (currentAudio.src.includes(encodeURIComponent(fileName))) { currentAudio = null; return; }
    }

    currentAudio = new Audio(audioUrl);
    currentAudio.playbackRate = speed;
    activeAudioBtn = btn;
    btn.innerText = "⏹️";

    currentAudio.onended = () => {
        if (playCount < repeatTarget) { playCount++; currentAudio.play(); }
        else { btn.innerText = "🔊"; currentAudio = null; }
    };

    currentAudio.play().catch(e => {
        console.error(e);
        alert("음성 파일을 찾을 수 없습니다: " + fileName);
        btn.innerText = "🔊";
        currentAudio = null;
    });
};

// ==========================================
// 3. 화면 렌더링 (load 함수)
// ==========================================
// 데이터 주입을 위한 인터페이스
window.addBibleData = function(ch, data) { db[ch] = data; if(currentChapter === ch) load(ch); };

function load(ch, mode = 'top') {
    if (isTestMode) toggleTestMode();
    if(!db[ch]) return;
    currentChapter = ch; 
    
    document.querySelectorAll('.ch-btn').forEach((b,i) => {
        if (typeof ch === 'number') { b.classList.toggle('active', i+1 === ch); } 
        else { b.classList.toggle('active', b.innerText === '2월 시험'); }
    });
    
    const main = document.getElementById('content');
    const subNav = document.getElementById('subNav');
    main.innerHTML = ''; subNav.innerHTML = '';
    const savedMarks = Storage.get();
    
    db[ch].sections.forEach((s, idx) => {
        const sb = document.createElement('button');
        sb.className = 'sub-btn'; sb.innerText = s.t;
        sb.onclick = () => { 
            isAutoScrolling = true; currentSecIndex = idx; updateActiveButton(idx);
            document.getElementById('s'+idx).scrollIntoView({behavior:'smooth', block:'start'});
            setTimeout(() => isAutoScrolling = false, 800); 
        };
        subNav.appendChild(sb);

        const grp = document.createElement('div');
        grp.className = 'section-group'; grp.id = 's'+idx;
        grp.innerHTML = `
            <div class="sec-header">
                <div class="sec-btn-group">
                    <span class="pill-badge info">${s.r}</span>
                    <button class="pill-badge eye-btn" onclick="toggleAll(this)"><span>👁️</span></button>
                </div>
                <span class="sec-title-text">${s.t}</span>
            </div>`;
        
        s.v.forEach((v) => {
            const card = document.createElement('div');
            card.className = isMarkingMode ? 'verse-card' : 'verse-card hidden';
            card.setAttribute('data-v-idx', v.n); 
            
            let displayTxt = v.t;
            const marks = savedMarks[`${ch}-${v.n}`]; 
            if(marks && marks.length > 0) {
                marks.forEach(markTxt => {
                    const regex = new RegExp(`(${markTxt})`, 'g');
                    displayTxt = displayTxt.replace(regex, `<span class="user-mark" onclick="deleteMark(this, ${v.n}, '${markTxt}')">$1</span>`);
                });
            }
            
            card.innerHTML = `
                <div class="v-num-wrapper" onclick="event.stopPropagation();">
                    <button class="audio-btn" onclick="playBibleAudio(this, '${ch}', '${v.n}')">🔊</button>
                    <div class="v-num">${v.n}</div>
                </div>
                <div class="verse-content" style="flex-grow:1;">
                    <div class="verse-text">${displayTxt}</div>
                    <div class="audio-ctrl-panel" onclick="event.stopPropagation();">
                        <select class="speed-sel"><option value="0.8">0.8x</option><option value="1.0" selected>1.0x</option><option value="1.2">1.2x</option></select>
                        <span style="font-weight:700; opacity:0.6; font-size:10px;">배속</span>
                        <input type="number" class="repeat-inp" value="1" min="1" max="99">
                        <span style="font-weight:700; opacity:0.6; font-size:10px;">회 반복</span>
                    </div>
                </div>`;
            card.onclick = function() { if(!isMarkingMode) { this.classList.toggle('hidden'); updateMasterButtonState(); }};
            grp.appendChild(card);
        });
        main.appendChild(grp);
    });
    
    if(observer) observer.disconnect();
    observer = new IntersectionObserver((entries) => {
        if(isAutoScrolling) return; 
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                currentSecIndex = parseInt(entry.target.id.replace('s', ''));
                document.querySelectorAll('.sub-btn').forEach((btn, i) => { btn.classList.toggle('active-sub', i === currentSecIndex); });
            }
        });
    }, {rootMargin:'-40% 0px -40% 0px'}); 
    document.querySelectorAll('.section-group').forEach(group => observer.observe(group));
    
    if(mode === 'bottom') { window.scrollTo(0, document.body.scrollHeight); currentSecIndex = db[ch].sections.length - 1; } 
    else { window.scrollTo(0, 0); currentSecIndex = 0; }
    updateMasterButtonState();
}

// ==========================================
// 4. 모든 부가 기능들 (검색, 마킹, 시험 등)
// ==========================================
function updateActiveButton(idx) { document.querySelectorAll('.sub-btn').forEach((btn, i) => { btn.classList.toggle('active-sub', i === idx); }); }
function moveSection(dir) {
    const sections = document.querySelectorAll('.section-group');
    let nextIdx = currentSecIndex + dir;
    isAutoScrolling = true;
    if (nextIdx < 0) { if (typeof currentChapter === 'number' && currentChapter > 1) load(currentChapter - 1, 'bottom'); } 
    else if (nextIdx >= sections.length) { if (typeof currentChapter === 'number' && currentChapter < 22) load(currentChapter + 1, 'top'); } 
    else { currentSecIndex = nextIdx; sections[nextIdx].scrollIntoView({behavior:'smooth', block:'start'}); updateActiveButton(nextIdx); }
    setTimeout(() => isAutoScrolling = false, 800);
}
function toggleAll(btn) {
    const group = btn.closest('.section-group');
    const cards = group.querySelectorAll('.verse-card');
    let hasHidden = Array.from(cards).some(c => c.classList.contains('hidden'));
    cards.forEach(c => c.classList.toggle('hidden', !hasHidden));
    btn.innerHTML = hasHidden ? '<span>🙈</span>' : '<span>👁️</span>';
    updateMasterButtonState();
}
function toggleChapter() {
    if(isMarkingMode) return;
    const allCards = document.querySelectorAll('.verse-card');
    let hasHidden = Array.from(allCards).some(c => c.classList.contains('hidden'));
    allCards.forEach(c => c.classList.toggle('hidden', !hasHidden));
    document.querySelectorAll('.pill-badge.eye-btn').forEach(btn => btn.innerHTML = hasHidden ? '<span>🙈</span>' : '<span>👁️</span>');
    updateMasterButtonState(); 
}
function updateMasterButtonState() {
    const allCards = document.querySelectorAll('.verse-card');
    if(allCards.length === 0) return;
    const hasHidden = Array.from(allCards).some(c => c.classList.contains('hidden'));
    const pc = document.querySelector('#masterBtn .pc-text');
    const mo = document.querySelector('#masterBtn .mobile-text');
    if(hasHidden) { if(pc) pc.innerText = `👁️ 전체보기`; if(mo) mo.innerText = `👁️ 전체보기`; } 
    else { if(pc) pc.innerText = `🙈 전체숨김`; if(mo) mo.innerText = `🙈 전체숨김`; }
}
function toggleTheme() {
    const doc = document.documentElement;
    const next = doc.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    doc.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
}
function toggleEditMode() {
    isMarkingMode = !isMarkingMode;
    document.body.classList.toggle('mode-marking', isMarkingMode);
    document.body.classList.toggle('mode-memorize', !isMarkingMode);
    document.getElementById('editModeBtn').classList.toggle('active', isMarkingMode);
    if(isMarkingMode) document.querySelectorAll('.verse-card').forEach(c => c.classList.remove('hidden'));
    else { window.getSelection().removeAllRanges(); document.getElementById('saveMarkBtn').style.display = 'none'; document.getElementById('masterBtn').style.display = 'flex'; }
}

function handleSelection() {
    if(!isMarkingMode) return;
    const selection = window.getSelection();
    const text = selection.toString().trim();
    const saveBtn = document.getElementById('saveMarkBtn');
    const masterBtn = document.getElementById('masterBtn');
    if(text.length > 0 && selection.anchorNode && selection.anchorNode.parentElement.closest('.verse-card')) {
        selectedText = text; saveBtn.style.display = 'flex'; masterBtn.style.display = 'none'; 
    } else { selectedText = ""; saveBtn.style.display = 'none'; masterBtn.style.display = 'flex'; }
}
document.addEventListener('selectionchange', handleSelection);

window.saveMark = function() {
    if(!selectedText) return;
    const selection = window.getSelection();
    const verseNode = selection.anchorNode.parentElement.closest('.verse-card');
    if(!verseNode) return;
    const absoluteVIdx = verseNode.getAttribute('data-v-idx'); 
    if(absoluteVIdx !== null) {
        const currentScrollY = window.scrollY;
        Storage.add(currentChapter, absoluteVIdx, selectedText);
        load(currentChapter); 
        window.scrollTo(0, currentScrollY);
        document.getElementById('saveMarkBtn').style.display = 'none';
        document.getElementById('masterBtn').style.display = 'flex';
    }
};

window.deleteMark = function(el, vIdx, text) {
    if(!isMarkingMode) return;
    event.stopPropagation();
    if(confirm(`'${text}' 마킹을 삭제하시겠습니까?`)) {
        const currentScrollY = window.scrollY;
        Storage.remove(currentChapter, vIdx, text);
        load(currentChapter);
        window.scrollTo(0, currentScrollY);
    }
};

function openSearch() { document.getElementById('searchModal').style.display = 'flex'; setTimeout(()=>document.getElementById('searchInput').focus(),100); }
function closeSearch() { document.getElementById('searchModal').style.display = 'none'; }
function doSearch() {
    const rawQuery = document.getElementById('searchInput').value.trim();
    if(!rawQuery) return;
    const query = rawQuery.replace(/\s+/g,''); 
    const resBox = document.getElementById('searchResults');
    resBox.innerHTML = '';
    let count = 0, html = '';
    for(let ch=1; ch<=22; ch++){
        if(!db[ch]) continue;
        db[ch].sections.forEach((sec,sIdx)=>{
            sec.v.forEach((v,vIdx)=>{
                if(v.t.replace(/\s+/g,'').includes(query)){
                    count++;
                    const regex = new RegExp(`(${rawQuery})`, 'gi');
                    const highlightedText = v.t.replace(regex, '<span class="res-highlight">$1</span>');
                    html += `<div class="result-card" onclick="jumpToResult(${ch},${sIdx},${vIdx})">
                        <div class="res-info">계${ch}:${v.n} (${sec.t})</div>
                        <div class="res-text">${highlightedText}</div>
                    </div>`;
                }
            });
        });
    }
    document.getElementById('searchStatusBox').style.display = 'block';
    document.getElementById('searchCount').innerHTML = `총 <b>${count}</b>건 검색`;
    resBox.innerHTML = html || '<div style="text-align:center;padding:20px;">결과 없음</div>';
}
window.jumpToResult = function(ch, sIdx, vIdx) {
    closeSearch(); isMarkingMode = false;
    document.body.classList.remove('mode-marking'); document.body.classList.add('mode-memorize');
    document.getElementById('editModeBtn').classList.remove('active');
    load(ch);
    setTimeout(()=>{
        const allCards = document.querySelectorAll('.verse-card');
        allCards.forEach(c=>c.classList.remove('hidden'));
        updateMasterButtonState();
        const targetSec = document.getElementById('s'+sIdx);
        if(targetSec){
            const targetCard = targetSec.querySelectorAll('.verse-card')[vIdx];
            if(targetCard){
                targetCard.scrollIntoView({behavior:'smooth', block:'center'});
                targetCard.classList.add('highlight-match');
                setTimeout(()=>targetCard.classList.remove('highlight-match'), 2000);
            }
        }
    },100);
}

function unlockGate() {
    const input = document.getElementById('gate-code');
    if(input.value === '1440') { sessionStorage.setItem('isLoggedIn', 'true'); document.getElementById('security-gate').style.display = 'none'; } 
    else { alert("보안 코드가 틀렸습니다."); input.value = ''; }
}

window.openDistrictLogin = function() { document.getElementById('districtModal').style.display = 'block'; };
window.closeDistrictLogin = function() { document.getElementById('districtModal').style.display = 'none'; };
window.checkDistrictLogin = function() {
    const group = document.getElementById('dmGroup').value;
    const pass = document.getElementById('dmPass').value;
    const codes = { '장년회': '1001', '부녀회': '2002', '청년회': '3003', '자문회': '4004', '학생회': '5005', '지역': '6006', '24부서': '7007' };
    if (codes[group] === pass) {
        document.body.classList.add('mode-district');
        const nav = document.getElementById('chNav');
        nav.innerHTML = '<button class="ch-btn" onclick="location.reload()">⬅ 나가기</button><button class="ch-btn active" onclick="load(\'special\')">2월 시험</button>';
        db['special'] = specialData['2월 시험'];
        load('special'); 
        closeDistrictLogin();
    } else { alert('⛔ 비밀번호가 일치하지 않습니다.'); }
};

function toggleTestMode() {
    isTestMode = !isTestMode;
    const btn = document.getElementById('testModeBtn');
    const cards = document.querySelectorAll('.verse-card');
    if (cards.length === 0) { isTestMode = !isTestMode; return; }
    if (isTestMode) {
        btn.innerHTML = '❌'; btn.classList.add('active');
        if(isMarkingMode) toggleEditMode();
        cards.forEach(card => {
            card.classList.add('test-mode');
            const contentEl = card.querySelector('.verse-text');
            if (!contentEl) return;
            const originalText = contentEl.innerText.trim();
            contentEl.style.display = 'none';
            if(card.querySelector('.test-wrapper')) return;
            const wrapper = document.createElement('div');
            wrapper.className = 'test-wrapper';
            wrapper.innerHTML = `
                <textarea class="test-input" placeholder="여기를 터치하여 입력하거나, [음성 입력]을 사용하세요."></textarea>
                <div class="test-controls">
                    <button type="button" class="v15-btn mic-btn" onclick="startStt(this)"><span>🎙️</span> 음성 입력</button>
                    <button type="button" class="v15-btn check-btn" onclick="gradeVerse(this, '${escapeText(originalText)}')"><span>💯</span> 채점 하기</button>
                </div>
                <div class="grade-result"></div>
            `;
            card.querySelector('.verse-content').appendChild(wrapper);
        });
    } else {
        btn.innerHTML = '📝'; btn.classList.remove('active');
        if(isListening && recognition) { recognition.stop(); recognition = null; isListening = false; }
        document.querySelectorAll('.test-wrapper').forEach(el => el.remove());
        document.querySelectorAll('.verse-card').forEach(c => c.classList.remove('test-mode'));
        document.querySelectorAll('.verse-text').forEach(el => el.style.display = 'block');
    }
}
function escapeText(text) { return text.replace(/'/g, "\\\'").replace(/"/g, "&quot;").replace(/\n/g, " "); }
function openManual() { alert("매뉴얼 기능은 현재 오디오 통합 버전에서 최적화 중입니다."); }

// [음성 인식 기능]
window.startStt = function(btn) {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) { alert("현재 브라우저는 음성 인식을 지원하지 않습니다."); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (isListening && recognition) { recognition.stop(); return; }
    recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR'; recognition.interimResults = true; recognition.continuous = true;
    let activeMicBtn = btn;
    const textarea = btn.closest('.test-wrapper').querySelector('.test-input');
    let finalTranscript = textarea.value;
    recognition.onstart = function() { isListening = true; btn.classList.add('listening'); btn.innerHTML = '<span>🛑</span> 인식 중...'; };
    recognition.onresult = function(event) {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript + ' ';
            else interimTranscript += event.results[i][0].transcript;
        }
        textarea.value = finalTranscript + interimTranscript;
    };
    recognition.onend = function() { isListening = false; btn.classList.remove('listening'); btn.innerHTML = '<span>🎙️</span> 음성 입력'; };
    recognition.start();
};

// [채점 기능]
window.gradeVerse = function(btn, originalText) {
    const wrapper = btn.closest('.test-wrapper');
    const userInput = wrapper.querySelector('.test-input').value.trim();
    const resultBox = wrapper.querySelector('.grade-result');
    if(!userInput) { alert("암기한 내용을 먼저 입력해주세요!"); return; }
    const dmp = new diff_match_patch();
    const diffs = dmp.diff_main(originalText, userInput);
    dmp.diff_cleanupSemantic(diffs);
    let html = '', wrongCount = 0;
    diffs.forEach(part => {
        const op = part[0], text = part[1];
        if(op === 0) html += `<span class="diff-perfect">${text}</span>`;
        else if(op === -1) { html += `<span class="diff-missing">${text}</span>`; wrongCount += text.length; }
        else if(op === 1) { html += `<span class="diff-wrong">${text}</span>`; wrongCount += Math.floor(text.length / 2); }
    });
    const score = Math.max(0, 100 - (wrongCount * 2));
    let gradeMsg = score === 100 ? "🎉 완벽합니다!" : score >= 80 ? "👏 아주 좋습니다!" : "💪 다시 한번 도전해보세요!";
    resultBox.innerHTML = `<div style="font-weight:900; font-size:18px; color:var(--text-num); margin-bottom:10px;">점수: ${score}점 <span style="font-size:14px; color:var(--text-sub);">${gradeMsg}</span></div><div style="line-height:2.0;">${html}</div>`;
    resultBox.style.display = 'block';
};

// ==========================================
// 5. 초기 실행
// ==========================================
window.onload = function() {
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
        const gate = document.getElementById('security-gate');
        if(gate) gate.style.display = 'none';
    }
    const nav = document.getElementById('chNav');
    for(let i=1; i<=22; i++) {
        const b = document.createElement('button');
        b.className = `ch-btn ${i===1?'active':''}`;
        b.innerText = i + "장"; b.onclick = () => load(i);
        nav.appendChild(b);
    }
    setTimeout(() => load(1), 100);
};
