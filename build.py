import re
import os
import base64

def high_security_process(content):
    print("   ... 1단계: HTML 주석만 안전하게 제거")
    content = re.sub(r'', '', content, flags=re.DOTALL)
    
    print("   ... 2단계: 스크립트 엔진 암호화 (Base64)")
    def hide_logic(match):
        code = match.group(1)
        if not code.strip(): return match.group(0)
        encoded = base64.b64encode(code.encode('utf-8')).decode('utf-8')
        return f'<script>eval(atob("{encoded}"));</script>'
    
    content = re.sub(r'<script>(.*?)</script>', hide_logic, content, flags=re.DOTALL)
    return content

print("🛡️ [사각함대 보안 공장] V10.6 긴급 복구 빌드 시작...")
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
    print(f"✅ [작전 성공] '{output_file}' 복구 및 보안 적용 완료.")
except Exception as e:
    print(f"❌ [시스템 오류] {e}")
