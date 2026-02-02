import re
import os
import base64

def high_security_process(content):
    print("   ... 1단계: HTML 주석 제거 및 주석 소거 완료")
    # HTML 주석 제거
    content = re.sub(r'', '', content, flags=re.DOTALL)
    
    print("   ... 2단계: 스크립트 엔진 암호화 (한글 깨짐 방지 통역기 탑재)")
    def hide_logic(match):
        code = match.group(1)
        if not code.strip(): return match.group(0)
        
        # UTF-8로 인코딩하여 Base64 변환
        encoded = base64.b64encode(code.encode('utf-8')).decode('utf-8')
        
        # JS에서 한글을 안전하게 복원하는 특수 엔진 주입
        return f'<script>eval(decodeURIComponent(escape(window.atob("{encoded}"))));</script>'
    
    content = re.sub(r'<script>(.*?)</script>', hide_logic, content, flags=re.DOTALL)
    return content

print("🛡️ [사각함대 보안 공장] 한글 복구 및 최종 보안 빌드 시작...")
try:
    target_file = 'source.html'
    output_file = 'index.html'

    if not os.path.exists(target_file):
        if os.path.exists('index.html'):
            target_file = 'index.html' 
            print("⚠️ [주의] source.html이 없어 index.html을 원본으로 사용합니다.")
        else:
            print("❌ [비상] 원본 파일을 찾을 수 없습니다.")
            exit()

    with open(target_file, 'r', encoding='utf-8') as f:
        source = f.read()
    
    secured = high_security_process(source)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(secured)
        
    print(f"✅ [작전 성공] 한글 복구 및 보안 적용 완료: '{output_file}'")
except Exception as e:
    print(f"❌ [시스템 오류] {e}")
