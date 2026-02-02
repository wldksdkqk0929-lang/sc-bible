import re
import os

def minify_html(content):
    # 1. 주석 제거
    content = re.sub(r'', '', content, flags=re.DOTALL)
    # 2. 불필요한 공백/줄바꿈 제거
    content = re.sub(r'\s+', ' ', content)
    # 3. 태그 사이 공백 밀착
    content = re.sub(r'>\s+<', '><', content)
    return content.strip()

print("🏭 [사각함대 자동화 공장] 가동 시작 (난독화 Only)...")

try:
    if not os.path.exists('source.html'):
        print("❌ [오류] source.html이 없습니다. 1단계에서 파일을 제대로 만드셨나요?")
        exit()

    with open('source.html', 'r', encoding='utf-8') as f:
        original_code = f.read()
    
    minified_code = minify_html(original_code)
    
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(minified_code)
        
    print(f"✅ [성공] 'source.html'(22장 원본)을 압축하여 'index.html'(배포용)을 생산했습니다.")

except Exception as e:
    print(f"❌ [오류] {e}")
