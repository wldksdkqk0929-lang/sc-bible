(function(){
        // 1. 헤더에 구역장 버튼 삽입
        const optGroup = document.querySelector('.opt-group');
        if (!document.getElementById('btnDistrictMode')) {
            const newBtn = document.createElement('button');
            newBtn.id = 'btnDistrictMode';
            newBtn.className = 'icon-btn';
            newBtn.innerHTML = '👨‍🎓';
            newBtn.title = '구역장 모드';
            // [Fix] 지연 실행을 위한 화살표 함수 래핑 (ReferenceError 방지)
            newBtn.onclick = () => window.openDistrictLogin(); 
            optGroup.insertBefore(newBtn, optGroup.firstElementChild); 
        }

        // [Fix 3] 데이터 분할 및 줄바꿈 적용

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
    
            // 사령관님 지시: 부서별 보안 코드 (자문회~24부서 포함)
                const codes = { 
                    '장년회': '1001', 
                    '부녀회': '2002', 
                    '청년회': '3003', 
                    '자문회': '4004',
                    '학생회': '5005',
                    '지역': '6006',
                    '24부서': '7007'
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

            db['special'] = specialData['2월 시험'];
            load('special'); 
            
            const toast = document.getElementById('modeToast');
            toast.innerHTML = `👨‍🎓 <b>구역장 모드 (${groupName})</b><br>환영합니다.`;
            toast.style.opacity = 1;
            setTimeout(()=>toast.style.opacity=0, 2000);
        };

        window.loadSpecialData = function() {
            load('special');
        };

    })();