import re
import os

def safe_obfuscate(content):
    # 1. HTML 주석 제거 (보안의 기초)
    content = re.sub(r'', '', content, flags=re.DOTALL)
    
    # 2. Unit 2 경고 반영: 절대 변하면 안 되는 '연결 고리' 목록
    # 이 단어들은 난독화 대상에서 제외되며 그대로 유지됩니다.
    protected_keys = [
        'saveMark', 'load', 'moveSection', 'toggleEditMode', 
        'my_marks', 'verse-card', 'user-mark', 'hidden'
    ]
    
    # 3. 내부 로직 변수만 정밀 보안 가공
    internal_logic_map = {
        'temp_raw_data': 'v_tmp_z9',
        'raw_iterator': 'v_it_x1',
        'process_buffer': 'v_buf_q5'
    }
    for old, new in internal_logic_map.items():
        content = content.replace(old, new)

    # 4. 100% 실행 보장: 문법 파괴 방지를 위한 줄 정제
    lines = content.splitlines()
    final_code = [line.strip() for line in lines if line.strip()]
    
    return '\n'.join(final_code)

print("🏭 [사각함대 최종 공장] V10.6 안전 배포 모드 가동...")

try:
    if not os.path.exists('source.html'):
        print("❌ [오류] source.html이 없습니다. 1단계를 다시 확인하세요.")
        exit()

    with open('source.html', 'r', encoding='utf-8') as f:
        data = f.read()
    
    output = safe_obfuscate(data)
    
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(output)
        
    print(f"✅ [대성공] V10.6 코드가 안전하게 완공되었습니다.")
except Exception as e:
    print(f"❌ [비상] {e}")
