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

print("🏭 [사각함대 자동화 공장] 가동 시작...")

try:
    # 원본 읽기
    with open('source.html', 'r', encoding='utf-8') as f:
        original_code = f.read()

    # 압축 수행
    minified_code = minify_html(original_code)

    # 배포용 파일 생성
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(minified_code)

    print(f"✅ [성공] 'source.html'을 압축하여 'index.html'을 생산했습니다.")
    print(f"📉 [압축률] {len(original_code)} → {len(minified_code)} bytes")

except Exception as e:
    print(f"❌ [오류] {e}")
