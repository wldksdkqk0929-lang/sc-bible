// =========================================
// 1. 전역 상태 변수 (Global States)
// =========================================
let currentChapter = 1;
let currentSecIndex = 0;
let observer = null;
let isMarkingMode = false;
let selectedText = ""; 
let isAutoScrolling = false;
let isTestMode = false;
var recognition = null;
var isListening = false;

// [오디오 엔진 및 반복 제어 변수]
let currentAudio = null;
let currentPlayingBtn = null;
let audioSpeed = 1.0;
let currentLoop = 0; 

// =========================================
// 2. Storage 제어기 (LocalStorage)
// =========================================
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

// =========================================
// 3. 테마 제어 (기본: 낮 모드 고정)
// =========================================
function initTheme() {
    // [수정] 기본값을 'light'로 설정하며 사용자의 기존 선택이 있다면 존중함
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme) {
    const btns = document.querySelectorAll('.opt-group .icon-btn');
    btns.forEach(btn => {
        if(btn.title === '테마') btn.innerText = theme === 'dark' ? '☀️' : '🌙';
    });
}

window.toggleTheme = function() {
    const doc = document.documentElement;
    const current = doc.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    doc.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeIcon(next);
};

// =========================================
// 4. 마킹 시스템 (형광펜 모드)
// =========================================
const MSG_EDIT_MODE = "🖍️ <b>드래그=저장 / 터치=삭제</b> <span style='font-size:0.85em; opacity:0.9; margin-left:5px;'>(종료: ✏️클릭)</span>";

window.toggleEditMode = function() {
    isMarkingMode = !isMarkingMode;
    const body = document.body;
    const btn = document.getElementById('editModeBtn');
    const toast = document.getElementById('modeToast');
    if(isMarkingMode) {
        body.classList.remove('mode-memorize');
        body.classList.add('mode-marking');
        btn.classList.add('editing');
        document.querySelectorAll('.verse-card').forEach(c => c.classList.remove('hidden'));
        toast.innerHTML = MSG_EDIT_MODE;
        toast.style.opacity = 1;
        toast.style.backgroundColor = "rgba(33, 37, 41, 0.95)";
    } else {
        body.classList.remove('mode-marking');
        body.classList.add('mode-memorize');
        btn.classList.remove('editing'); 
        window.getSelection().removeAllRanges();
        const saveBtn = document.getElementById('saveMarkBtn');
        saveBtn.style.display = 'none';
        saveBtn.innerText = "🖍️ 선택 저장";
        saveBtn.style.background = "";
        document.getElementById('masterBtn').style.display = 'flex';
        toast.innerText = "👆 암기 모드 (터치하여 확인)";
        setTimeout(() => toast.style.opacity = 0, 1500);
    }
};

function handleSelection() {
    if(!isMarkingMode) return;
    const selection = window.getSelection();
    const text = selection.toString().trim();
    const saveBtn = document.getElementById('saveMarkBtn');
    const masterBtn = document.getElementById('masterBtn');
    if(text.length > 0 && selection.anchorNode && selection.anchorNode.parentElement.closest('.verse-card')) {
        selectedText = text;
        saveBtn.style.display = 'flex';    
        masterBtn.style.display = 'none'; 
    } else {
        selectedText = "";
        saveBtn.style.display = 'none';
        masterBtn.style.display = 'flex';
    }
}

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
        const saveBtn = document.getElementById('saveMarkBtn');
        const toast = document.getElementById('modeToast');
        saveBtn.innerHTML = "✅ 저장됨!";
        saveBtn.style.background = "#00b894"; 
        toast.innerHTML = "✅ <b>저장 완료!</b>";
        toast.style.backgroundColor = "#00b894";
        setTimeout(() => {
            if(isMarkingMode) {
                saveBtn.style.display = 'none';
                saveBtn.innerText = "🖍️ 선택 저장";
                saveBtn.style.background = ""; 
                document.getElementById('masterBtn').style.display = 'flex';
                toast.innerHTML = MSG_EDIT_MODE;
                toast.style.backgroundColor = "rgba(33, 37, 41, 0.95)";
            }
            selectedText = "";
            selection.removeAllRanges();
        }, 1000);
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

document.addEventListener('selectionchange', handleSelection);

// =========================================
// 5. 렌더링 엔진 (Core Load)
// =========================================
window.load = function(ch, mode = 'top') {
    if (typeof isTestMode !== 'undefined' && isTestMode) toggleTestMode();
    if(!db[ch]) return;
    currentChapter = ch; 
    
    // [자동 복구] 현재 읽고 있는 장 기억
    localStorage.setItem('lastChapter', ch);

    document.querySelectorAll('.ch-btn').forEach((b,i) => {
        b.classList.toggle('active', i+1 === ch);
    });
    
    const main = document.getElementById('content');
    const subNav = document.getElementById('subNav');
    main.innerHTML = ''; subNav.innerHTML = '';
    const savedMarks = Storage.get();
    
    db[ch].sections.forEach((s, idx) => {
        const sb = document.createElement('button');
        sb.className = 'sub-btn'; sb.innerText = s.t;
        sb.onclick = () => { 
            isAutoScrolling = true;
            currentSecIndex = idx;
            updateActiveButton(idx);
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
            
        s.v.forEach((v, vIdx) => {
            const card = document.createElement('div');
            card.className = isMarkingMode ? 'verse-card' : 'verse-card hidden';
            card.onclick = function() {
                if(isMarkingMode) return; 
                this.classList.toggle('hidden'); 
                updateMasterButtonState();
            };
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
                <div class="v-num-wrapper">
                    <div class="v-num">${v.n}</div>
                    <button class="speaker-btn" onclick="playBibleAudio(event, this, ${ch}, '${v.n}')">🔊</button>
                </div>
                <div class="verse-text">${displayTxt}</div>`;
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
                document.querySelectorAll('.sub-btn').forEach((btn, i) => {
                    btn.classList.toggle('active-sub', i === currentSecIndex);
                });
            }
        });
    }, {rootMargin:'-40% 0px -40% 0px'});
    document.querySelectorAll('.section-group').forEach(group => observer.observe(group));
    
    if(mode === 'bottom') {
        window.scrollTo(0, document.body.scrollHeight);
        currentSecIndex = db[ch].sections.length - 1;
    } else {
        window.scrollTo(0, 0);
        currentSecIndex = 0;
    }
    updateMasterButtonState();
}

// =========================================
// 6. 네비게이션 및 전체 제어
// =========================================
window.moveSection = function(dir) {
    const sections = document.querySelectorAll('.section-group');
    let nextIdx = currentSecIndex + dir;
    isAutoScrolling = true;
    if (nextIdx < 0) {
        if (currentChapter > 1) load(currentChapter - 1, 'bottom');
    } else if (nextIdx >= sections.length) {
        if (currentChapter < 22) load(currentChapter + 1, 'top');
    } else {
        currentSecIndex = nextIdx;
        sections[nextIdx].scrollIntoView({behavior:'smooth', block:'start'});
        updateActiveButton(nextIdx);
    }
    setTimeout(() => isAutoScrolling = false, 800);
}

function updateActiveButton(idx) {
    document.querySelectorAll('.sub-btn').forEach((btn, i) => {
        btn.classList.toggle('active-sub', i === idx);
        if(i === idx && isAutoScrolling) {
            btn.scrollIntoView({behavior:'smooth', inline:'center', block:'nearest'});
        }
    });
}

window.toggleAll = function(btn) {
    const group = btn.closest('.section-group');
    const cards = group.querySelectorAll('.verse-card');
    let hasHidden = Array.from(cards).some(c => c.classList.contains('hidden'));
    cards.forEach(c => c.classList.toggle('hidden', !hasHidden));
    btn.innerHTML = hasHidden ? '<span>🙈</span>' : '<span>👁️</span>';
    updateMasterButtonState();
};

window.toggleChapter = function() {
    if(isMarkingMode) return;
    const allCards = document.querySelectorAll('.verse-card');
    let hasHidden = Array.from(allCards).some(c => c.classList.contains('hidden'));
    allCards.forEach(c => c.classList.toggle('hidden', !hasHidden));
    const allEyeBtns = document.querySelectorAll('.pill-badge.eye-btn');
    allEyeBtns.forEach(btn => {
        btn.innerHTML = hasHidden ? '<span>🙈</span>' : '<span>👁️</span>';
    });
    updateMasterButtonState(); 
};

function updateMasterButtonState() {
    const allCards = document.querySelectorAll('.verse-card');
    if(allCards.length === 0) return;
    const hasHidden = Array.from(allCards).some(c => c.classList.contains('hidden'));
    const mBtn = document.getElementById('masterBtn');
    const pc = mBtn.querySelector('.pc-text');
    const mo = mBtn.querySelector('.mobile-text');
    const chName = currentChapter + "장";
    if(hasHidden) {
        pc.innerText = `👁️ ${chName} 전체보기`;
        mo.innerText = `👁️ 전체보기`;
    } else {
        pc.innerText = `🙈 ${chName} 전체숨김`;
        mo.innerText = `🙈 전체숨김`;
    }
}

// [검색 및 STT/채점 로직 유지]
// 7. 검색 엔진 (생략 가능하나 기능 유지를 위해 포함)
window.openSearch = function() { document.getElementById('searchModal').style.display = 'flex'; setTimeout(()=>document.getElementById('searchInput').focus(),100); }
window.closeSearch = function() { document.getElementById('searchModal').style.display = 'none'; }
window.doSearch = function() {
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
    document.getElementById('searchCount').innerHTML = `총 <b>${count}</b>건 검색 <span class="status-badge" style="margin-left:8px;">👆 클릭 시 해당 위치로 이동</span>`;
    resBox.innerHTML = html || '<div style="text-align:center;padding:20px;">결과 없음</div>';
}

window.jumpToResult = function(ch, sIdx, vIdx) {
    closeSearch();
    isMarkingMode = false;
    document.body.classList.remove('mode-marking');
    document.body.classList.add('mode-memorize');
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

// 8. 시험 모드 (STT & Diff)
window.toggleTestMode = function() {
    isTestMode = !isTestMode;
    const btn = document.getElementById('testModeBtn');
    const cards = document.querySelectorAll('.verse-card');
    if (cards.length === 0) {
        alert("⚠️ 먼저 장(Chapter)을 선택해주세요.");
        isTestMode = !isTestMode; return;
    }
    if (isTestMode) {
        btn.innerHTML = '❌';
        btn.classList.add('active');
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
                <textarea class="test-input" placeholder="직접 입력하거나 음성 인식을 시작하세요."></textarea>
                <div class="test-controls">
                    <button type="button" class="v15-btn mic-btn" onclick="startStt(this)">🎙️ 음성 입력</button>
                    <button type="button" class="v15-btn check-btn" onclick="gradeVerse(this, \`${escapeText(originalText)}\`)">💯 채점</button>
                </div>
                <div class="grade-result"></div>
            `;
            card.appendChild(wrapper);
        });
    } else {
        btn.innerHTML = '📝';
        btn.classList.remove('active');
        if(isListening && recognition) { recognition.stop(); recognition = null; isListening = false; }
        document.querySelectorAll('.test-wrapper').forEach(el => el.remove());
        document.querySelectorAll('.verse-card').forEach(c => c.classList.remove('test-mode'));
        document.querySelectorAll('.verse-text').forEach(el => el.style.display = 'block');
    }
}

function escapeText(text) { return text.replace(/`/g, "").replace(/"/g, "&quot;").replace(/\n/g, " "); }

window.startStt = function(btnElement) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("음성 인식을 지원하지 않는 브라우저입니다."); return; }
    const wrapper = btnElement.closest('.test-wrapper');
    const inputArea = wrapper.querySelector('.test-input');
    if (isListening) { if(recognition) { recognition.stop(); recognition = null; } isListening = false; return; }
    try {
        recognition = new SpeechRecognition();
        recognition.lang = 'ko-KR';
        recognition.continuous = true; 
        recognition.onstart = () => { isListening = true; btnElement.classList.add('listening'); btnElement.innerHTML = "🛑 마침"; };
        recognition.onend = () => { isListening = false; btnElement.classList.remove('listening'); btnElement.innerHTML = "🎙️ 음성 입력"; };
        recognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript + ' ';
            }
            inputArea.value += finalTranscript;
        };
        recognition.start();
    } catch (e) { alert("마이크 실행 오류"); isListening = false; }
};

window.gradeVerse = function(btnElement, originalRaw) {
    const wrapper = btnElement.parentElement.parentElement;
    const userText = wrapper.querySelector('.test-input').value.trim();
    const resultDiv = wrapper.querySelector('.grade-result');
    if (!userText) { alert("내용을 입력해주세요!"); return; }
    const cleanOrg = originalRaw.replace(/[.,?!'"\(\)\[\]]/g, "").replace(/\s+/g, "");
    const cleanUser = userText.replace(/[.,?!'"\(\)\[\]]/g, "").replace(/\s+/g, "");
    const dmp = new diff_match_patch();
    const diffs = dmp.diff_main(cleanOrg, cleanUser);
    dmp.diff_cleanupSemantic(diffs);
    let htmlBuilder = ""; let wrongPoints = 0; let totalLen = cleanOrg.length;
    for (let i = 0; i < diffs.length; i++) {
        const [type, text] = diffs[i];
        if (type === 0) htmlBuilder += `<span>${text}</span>`;
        else if (type === -1) { htmlBuilder += `<span class="diff-missing">[${text}]</span>`; wrongPoints += text.length; }
        else if (type === 1) { htmlBuilder += `<span class="diff-wrong">${text}</span>`; wrongPoints += text.length; }
    }
    let score = Math.max(0, Math.round(((totalLen - wrongPoints) / totalLen) * 100));
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `<div class="score-badge">점수: ${score}점</div><div style="margin-top:5px;">${htmlBuilder}</div>`;
}

// =========================================
// 9. 보안 및 입장 제어 (오픈소스 개량)
// =========================================
window.unlockGate = function() {
    const gate = document.getElementById('security-gate');
    // 세션 저장 후 게이트 제거
    sessionStorage.setItem('isLoggedIn', 'true');
    gate.style.opacity = '0';
    setTimeout(() => { gate.style.display = 'none'; }, 500);
};

// =========================================
// 10. 사용법 매뉴얼 제어
// =========================================
let currentStep = 0;
window.openManual = function() {
    const overlay = document.getElementById('manualOverlay');
    overlay.style.display = 'flex';
    setTimeout(() => { overlay.classList.add('show'); }, 10);
    currentStep = 0; renderStep();
};
window.closeManual = function() {
    const overlay = document.getElementById('manualOverlay');
    overlay.classList.remove('show');
    setTimeout(() => { overlay.style.display = 'none'; }, 300);
};
window.renderStep = function() {
    const data = manualData[currentStep];
    document.getElementById('mStepBadge').innerText = `Step ${currentStep + 1} / ${manualData.length}`;
    document.getElementById('mTitle').innerText = data.title;
    document.getElementById('mDesc').innerText = data.desc;
    document.getElementById('mVisualZone').innerHTML = `<div class="visual-item active">${data.html}</div>`;
    document.querySelector('.btn-prev').style.visibility = currentStep === 0 ? 'hidden' : 'visible';
    const btnNext = document.getElementById('btnNext');
    const btnStart = document.getElementById('btnStart');
    if(currentStep === manualData.length - 1) { btnNext.style.display = 'none'; btnStart.style.display = 'block'; }
    else { btnNext.style.display = 'block'; btnStart.style.display = 'none'; }
    const dotsBox = document.getElementById('mDots');
    dotsBox.innerHTML = ''; manualData.forEach((_, i) => {
        const dot = document.createElement('div'); dot.className = 'm-dot' + (i === currentStep ? ' active' : '');
        dotsBox.appendChild(dot);
    });
};
window.nextStep = function() { if(currentStep < manualData.length - 1) { currentStep++; renderStep(); } };
window.prevStep = function() { if(currentStep > 0) { currentStep--; renderStep(); } };

// =========================================
// 11. 오디오 제어 (Loop Engine)
// =========================================
window.toggleAudioPanel = function() { document.getElementById('audio-popup-panel').classList.toggle('show'); };
window.setAudioSpeed = function(speed, btn) {
    audioSpeed = parseFloat(speed);
    if(currentAudio) currentAudio.playbackRate = audioSpeed;
    document.querySelectorAll('.spd-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
};
window.playBibleAudio = function(event, btn, ch, vNum) {
    if(event) event.stopPropagation();
    const fileName = `rev_${String(ch).padStart(2,'0')}_${String(vNum).padStart(2,'0')}.m4a`;
    const audioUrl = `https://firebasestorage.googleapis.com/v0/b/sc-bible-7a046.firebasestorage.app/o/rev%2F${fileName}?alt=media`;
    if (currentAudio && currentPlayingBtn === btn) {
        currentAudio.pause(); currentAudio = null; currentPlayingBtn = null;
        btn.innerText = "🔊"; btn.classList.remove('playing'); return;
    }
    if (currentAudio) { currentAudio.pause(); if(currentPlayingBtn) { currentPlayingBtn.innerText = "🔊"; currentPlayingBtn.classList.remove('playing'); } }
    const targetLoops = parseInt(document.getElementById('loopCount').value) || 1;
    currentLoop = 1;
    currentAudio = new Audio(audioUrl);
    currentAudio.playbackRate = audioSpeed;
    currentAudio.preservesPitch = true;
    currentPlayingBtn = btn;
    btn.innerText = "⏹️"; btn.classList.add('playing');
    currentAudio.play();
    currentAudio.onended = function() {
        if (currentLoop < targetLoops) { currentLoop++; this.currentTime = 0; this.play(); }
        else { btn.innerText = "🔊"; btn.classList.remove('playing'); currentAudio = null; currentPlayingBtn = null; }
    };
};

// =========================================
// 12. 초기화 이벤트 (OnLoad)
// =========================================
window.addEventListener('load', function() {
    // 1. 테마 적용 (낮 모드 기본)
    initTheme();
    
    // 2. 챕터 네비게이션 생성 (1~22장)
    const nav = document.getElementById('chNav');
    for(let i=1; i<=22; i++) {
        const b = document.createElement('button');
        b.className = `ch-btn ${i===1?'active':''}`;
        b.innerText = i + "장"; 
        b.onclick = () => load(i);
        nav.appendChild(b);
    }

    // 3. 자동 복구: 마지막 읽은 장 로드
    const lastCh = parseInt(localStorage.getItem('lastChapter')) || 1;
    setTimeout(() => load(lastCh), 100);

    // 4. 보안 게이트 체크
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
        document.getElementById('security-gate').style.display = 'none';
    }
    
    // 터치 최적화 등 부가 로직 유지
});

// [V26.2-Open Clean Up 완료]