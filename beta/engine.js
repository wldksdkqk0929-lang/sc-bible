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
// 3. 테마 제어 (주야간 모드)
// =========================================
function initTheme() {
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

// =========================================
// 5. 렌더링 엔진 (Core Load)
// =========================================
function load(ch, mode = 'top') {
    if (typeof isTestMode !== 'undefined' && isTestMode) toggleTestMode();
    if(!db[ch]) return;
    
    currentChapter = ch; 
    document.querySelectorAll('.ch-btn').forEach((b,i) => {
        if (typeof ch === 'number') {
            b.classList.toggle('active', i+1 === ch);
        } else {
            b.classList.toggle('active', b.innerText === '2월 시험');
        }
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
            card.innerHTML = `<div class="v-num">${v.n}</div><div class="verse-text">${displayTxt}</div>`;
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
function moveSection(dir) {
    const sections = document.querySelectorAll('.section-group');
    let nextIdx = currentSecIndex + dir;
    isAutoScrolling = true;
    
    if (nextIdx < 0) {
        if (typeof currentChapter === 'number' && currentChapter > 1) load(currentChapter - 1, 'bottom');
    } else if (nextIdx >= sections.length) {
        if (typeof currentChapter === 'number' && currentChapter < 22) load(currentChapter + 1, 'top');
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
    if (hasHidden) {
        btn.innerHTML = '<span>🙈</span>';
    } else {
        btn.innerHTML = '<span>👁️</span>';
    }
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
    const chName = typeof currentChapter === 'string' ? currentChapter : currentChapter + "장";
    
    if(hasHidden) {
        pc.innerText = `👁️ ${chName} 전체보기`;
        mo.innerText = `👁️ 전체보기`;
    } else {
        pc.innerText = `🙈 ${chName} 전체숨김`;
        mo.innerText = `🙈 전체숨김`;
    }
}

// =========================================
// 7. 검색 엔진
// =========================================
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

// =========================================
// 8. 시험 모드 (STT & Diff)
// =========================================
function toggleTestMode() {
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
        if(typeof isMarkingMode !== 'undefined' && isMarkingMode) toggleEditMode();
        
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
                    <button type="button" class="v15-btn mic-btn" onclick="startStt(this)">
                        <span>🎙️</span> 음성 입력
                    </button>
                    <button type="button" class="v15-btn check-btn" onclick="gradeVerse(this, \`${escapeText(originalText)}\`)">
                        <span>💯</span> 채점 하기
                    </button>
                </div>
                <div class="grade-result"></div>
            `;
            card.appendChild(wrapper);
        });
    } else {
        btn.innerHTML = '📝';
        btn.classList.remove('active');
        if(isListening && recognition) {
            recognition.stop();
            recognition = null; 
            isListening = false;
        }
        document.querySelectorAll('.test-wrapper').forEach(el => el.remove());
        document.querySelectorAll('.verse-card').forEach(c => c.classList.remove('test-mode'));
        document.querySelectorAll('.verse-text').forEach(el => el.style.display = 'block');
    }
}

function escapeText(text) { return text.replace(/`/g, "").replace(/"/g, "&quot;").replace(/\n/g, " "); }

window.startStt = function(btnElement) {
    if (/Android|iPhone|iPad/i.test(navigator.userAgent) && location.protocol === 'file:') {
        alert("⛔ [보안 경고]\n모바일 '내 파일'에서는 마이크가 차단됩니다.\nHTTPS 주소로 접속해주세요.");
        return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("이 브라우저는 음성 인식을 지원하지 않습니다."); 
        return;
    }
    
    const wrapper = btnElement.closest('.test-wrapper');
    const inputArea = wrapper.querySelector('.test-input');
    
    if (isListening) {
        if(recognition) {
            recognition.stop();
            recognition = null;
        }
        isListening = false;
        btnElement.classList.remove('listening');
        btnElement.innerHTML = "<span>🎙️</span> 음성 입력";
        return;
    }
    
    try {
        recognition = new SpeechRecognition();
        recognition.lang = 'ko-KR';
        recognition.continuous = true; 
        recognition.interimResults = false; 
        
        recognition.onstart = function() {
            isListening = true;
            btnElement.classList.add('listening');
            btnElement.innerHTML = "<span>🛑</span> 마침";
        };
        recognition.onend = function() {
            isListening = false;
            btnElement.classList.remove('listening');
            btnElement.innerHTML = "<span>🎙️</span> 음성 입력";
        };
        recognition.onresult = function(event) {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript + ' ';
                }
            }
            inputArea.value += finalTranscript;
            inputArea.scrollTop = inputArea.scrollHeight;
        };
        recognition.onerror = function(event) {
            console.error("Mic Error:", event.error);
            if(isListening) {
                recognition.stop();
                isListening = false;
                btnElement.classList.remove('listening');
                btnElement.innerHTML = "<span>🎙️</span> 음성 입력";
            }
            if(event.error === 'not-allowed') alert("마이크 권한을 허용해주세요.");
        };
        recognition.start();
    } catch (e) {
        alert("마이크 실행 오류: " + e.message);
        isListening = false;
    }
};

window.gradeVerse = function(btnElement, originalRaw) {
    const wrapper = btnElement.parentElement.parentElement;
    const userText = wrapper.querySelector('.test-input').value.trim();
    const resultDiv = wrapper.querySelector('.grade-result');
    
    if (!userText) {
        alert("내용을 입력해주세요!");
        return;
    }
    
    const cleanOrg = originalRaw.replace(/[.,?!'"\(\)\[\]]/g, "").replace(/\s+/g, "");
    const cleanUser = userText.replace(/[.,?!'"\(\)\[\]]/g, "").replace(/\s+/g, "");
    
    const dmp = new diff_match_patch();
    const diffs = dmp.diff_main(cleanOrg, cleanUser);
    dmp.diff_cleanupSemantic(diffs);
    
    let htmlBuilder = "";
    let wrongPoints = 0;
    let totalLen = cleanOrg.length;
    
    for (let i = 0; i < diffs.length; i++) {
        const [type, text] = diffs[i];
        if (type === 0) {
            htmlBuilder += `<span class="diff-perfect">${text}</span>`;
        } else if (type === -1) {
            if (i + 1 < diffs.length && diffs[i+1][0] === 1) {
                const nextText = diffs[i+1][1];
                if (text.length >= 2 && nextText.length >= 1 && text[0] === nextText[0]) {
                    htmlBuilder += `<span class="diff-particle">${nextText}</span>`;
                    wrongPoints += (text.length * 0.3);
                } else {
                    htmlBuilder += `<span class="diff-missing">[${text}]</span>`;
                    htmlBuilder += `<span class="diff-wrong">${nextText}</span>`; 
                    wrongPoints += text.length;
                }
                i++;
            } else {
                htmlBuilder += `<span class="diff-missing">[${text}]</span>`;
                wrongPoints += text.length;
            }
        } else if (type === 1) {
            htmlBuilder += `<span class="diff-wrong">${text}</span>`;
            wrongPoints += text.length;
        }
    }
    
    let score = Math.max(0, Math.round(((totalLen - wrongPoints) / totalLen) * 100));
    let badgeColor = score >= 90 ? '#00b894' : (score >= 70 ? '#fdcb6e' : '#ff7675');
    
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `
        <div style="background:${badgeColor}; color:#2d3436; display:inline-block; padding:6px 12px; border-radius:20px; font-weight:900; margin-bottom:10px; font-size:15px; box-shadow:0 2px 5px rgba(0,0,0,0.2);">
            점수: ${score}점
        </div>
        <div style="margin-top:5px; word-break:break-all;">${htmlBuilder}</div>
    `;
};

// =========================================
// 9. 보안 게이트 (Auth)
// =========================================
(function(){
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
        document.getElementById('security-gate').style.display = 'none';
    }
})();

window.unlockGate = function() {
    const input = document.getElementById('gate-code');
    const gate = document.getElementById('security-gate');
    const card = document.querySelector('.gate-card');
    
    if(input.value === '1440') {
        sessionStorage.setItem('isLoggedIn', 'true');
        gate.style.opacity = '0';
        gate.style.visibility = 'hidden';
        setTimeout(() => gate.style.display = 'none', 500);
    } else {
        card.classList.add('gate-shake');
        setTimeout(() => card.classList.remove('gate-shake'), 400);
        input.value = '';
        input.focus();
    }
};

const gInput = document.getElementById('gate-code');
if(gInput) {
    gInput.addEventListener('keypress', function(e) {
        if(e.key === 'Enter') unlockGate();
    });
}

// =========================================
// 10. 사용법 매뉴얼 제어
// =========================================
let currentStep = 0;

window.openManual = function() {
    const overlay = document.getElementById('manualOverlay');
    overlay.style.display = 'flex';
    setTimeout(() => {
        overlay.classList.add('show');
        overlay.style.opacity = '1';
    }, 10);
    currentStep = 0;
    renderStep();
};

window.closeManual = function() {
    const overlay = document.getElementById('manualOverlay');
    overlay.classList.remove('show');
    overlay.style.opacity = '0';
    setTimeout(() => {
        overlay.style.display = 'none';
    }, 300);
};

window.renderStep = function() {
    const data = manualData[currentStep]; // data.js 참조
    document.getElementById('mStepBadge').innerText = `Step ${currentStep + 1} / ${manualData.length}`;
    document.getElementById('mTitle').innerText = data.title;
    document.getElementById('mDesc').innerText = data.desc;
    
    const vZone = document.getElementById('mVisualZone');
    vZone.innerHTML = `<div class="visual-item active">${data.html}</div>`;
    
    const btnPrev = document.querySelector('.btn-prev');
    const btnNext = document.querySelector('.btn-next');
    const btnStart = document.querySelector('.btn-start');
    
    btnPrev.style.visibility = currentStep === 0 ? 'hidden' : 'visible';
    
    if(currentStep === manualData.length - 1) {
        btnNext.style.display = 'none';
        btnStart.style.display = 'block';
    } else {
        btnNext.style.display = 'block';
        btnStart.style.display = 'none';
    }
    
    const dotsBox = document.getElementById('mDots');
    dotsBox.innerHTML = ''; 
    manualData.forEach((_, i) => {
        const dot = document.createElement('div');
        dot.className = 'm-dot';
        if(i === currentStep) dot.classList.add('active');
        dotsBox.appendChild(dot);
    });
};

window.nextStep = function() { if(currentStep < manualData.length - 1) { currentStep++; renderStep(); } };
window.prevStep = function() { if(currentStep > 0) { currentStep--; renderStep(); } };

// =========================================
// 11. 구역장 모드 제어 (District Leader Mode)
// =========================================
(function(){
    const optGroup = document.querySelector('.opt-group');
    if (!document.getElementById('btnDistrictMode') && optGroup) {
        const newBtn = document.createElement('button');
        newBtn.id = 'btnDistrictMode';
        newBtn.className = 'icon-btn';
        newBtn.innerHTML = '👨‍🎓';
        newBtn.title = '구역장 모드';
        newBtn.onclick = () => window.openDistrictLogin(); 
        optGroup.insertBefore(newBtn, optGroup.firstElementChild); 
    }
})();

window.openDistrictLogin = function() {
    document.getElementById('districtModal').style.display = 'block';
    document.getElementById('dmPass').value = '';
    document.getElementById('dmPass').focus();
};

window.closeDistrictLogin = function() {
    document.getElementById('districtModal').style.display = 'none';
};

window.checkDistrictLogin = function() {
    const group = document.getElementById('dmGroup').value;
    const pass = document.getElementById('dmPass').value;

    const codes = { 
        '장년회': '1001', '부녀회': '2002', '청년회': '3003', '자문회': '4004',
        '학생회': '5005', '지역': '6006', '24부서': '7007'
    };
    
    if (codes[group] === pass) {
        activateDistrictMode(group);
        closeDistrictLogin();
    } else {
        alert('⛔ 비밀번호가 일치하지 않습니다.');
        document.getElementById('dmPass').value = '';
    }
};

window.activateDistrictMode = function(groupName) {
    document.body.classList.add('mode-district');
    const wmText = `순천 ${groupName} 천국고시 준비자료`;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' transform='rotate(-45 150 150)' fill='%232c3e50' font-size='18' font-weight='bold' font-family='sans-serif'>${wmText}</text></svg>`;
    const encoded = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    document.querySelector('.watermark').style.backgroundImage = `url("${encoded}")`;
    
    const nav = document.getElementById('chNav');
    nav.innerHTML = ''; 
    
    const exitBtn = document.createElement('button');
    exitBtn.className = 'ch-btn';
    exitBtn.innerText = '⬅ 나가기';
    exitBtn.onclick = function() { location.reload(); }; 
    nav.appendChild(exitBtn);

    const btn = document.createElement('button');
    btn.className = 'ch-btn active';
    btn.innerText = '2월 시험';
    btn.onclick = function() { loadSpecialData(); };
    nav.appendChild(btn);

    db['special'] = specialData['2월 시험']; // data.js 참조
    load('special');
    
    const toast = document.getElementById('modeToast');
    toast.innerHTML = `👨‍🎓 <b>구역장 모드 (${groupName})</b><br>환영합니다.`;
    toast.style.opacity = 1;
    setTimeout(()=>toast.style.opacity=0, 2000);
};

window.loadSpecialData = function() {
    load('special');
};

// =========================================
// 12. 초기화 및 이벤트 리스너 (OnLoad)
// =========================================
window.addEventListener('load', function() {
    initTheme();
    document.addEventListener('selectionchange', handleSelection);
    
    const nav = document.getElementById('chNav');
    for(let i=1; i<=22; i++) {
        const b = document.createElement('button');
        b.className = `ch-btn ${i===1?'active':''}`;
        b.innerText = i + "장"; 
        b.onclick = () => load(i);
        nav.appendChild(b);
    }
    
    setTimeout(() => load(1), 100);
    
    document.body.addEventListener('touchstart', function(e) {
        const btn = e.target.closest('button');
        if (btn && (btn.innerText.includes('저장') || btn.innerText.includes('🖍'))) {
            e.preventDefault(); 
            btn.click();
        }
    }, { passive: false });
    
    (function forceDayModeStart() {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
    })();
    
    if (sessionStorage.getItem('isLoggedIn') !== 'true') {
        setTimeout(() => {
            const el = document.getElementById('gate-code');
            if(el) el.focus();
        }, 500);
    }
});