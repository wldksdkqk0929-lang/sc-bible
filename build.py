import re
import os
import base64

def high_security_process(content):
    # 1. HTML 주석 삭제 (정밀 패턴 복구)
    content = re.sub(r'', '', content, flags=re.DOTALL)
    
    # 2. 공백 압축 (줄바꿈 제거하여 한 줄로 통합)
    lines = content.splitlines()
    content = "".join([line.strip() for line in lines if line.strip()])

    # 3. [2호기 제안 보안 핵심] 스크립트 캡슐화
    def hide_logic(match):
        code = match.group(1)
        if not code.strip(): return match.group(0)
        # Base64 인코딩을 통해 사람이 읽을 수 없는 문자열로 변환
        encoded = base64.b64encode(code.encode('utf-8')).decode('utf-8')
        return f'<script>eval(atob("{encoded}"));</script>'
    
    # 인라인 스크립트(<script>내용</script>) 전체를 암호화
    content = re.sub(r'<script>(.*?)</script>', hide_logic, content, flags=re.DOTALL)
    return content

print("🛡️ [사각함대 보안 공장] 2호기 기술 이식 및 최종 빌드 개시...")

try:
    # 지휘관님의 원본 금고(source.html)를 최우선 재료로 선정
    target_file = 'source.html'
    output_file = 'index.html'

    if not os.path.exists(target_file):
        # 만약 source.html이 없으면 현재 index.html을 원본으로 삼음
        if os.path.exists('index.html'):
            target_file = 'index.html'
            print("⚠️ [알림] source.html이 없어 현재 index.html을 원본으로 사용합니다.")
        else:
            print("❌ [비상] 가공할 원본 파일을 찾을 수 없습니다.")
            exit()

    with open(target_file, 'r', encoding='utf-8') as f:
        source = f.read()
    
    # 고강도 은닉화 및 난독화 집행
    secured = high_security_process(source)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(secured)
        
    print(f"✅ [작전 성공] 보안 필터가 적용된 '{output_file}'이 생성되었습니다.")
    print(f"📉 [보안 가공] {len(source)} -> {len(secured)} bytes (난독화 완료)")

except Exception as e:
    print(f"❌ [시스템 오류] {e}")
