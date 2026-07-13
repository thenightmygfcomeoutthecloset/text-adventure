import re
with open('样式.css', 'r', encoding='utf-8') as f:
    content = f.read()
matches = re.finditer(r'(narrative-area|message)[^{]*\{[^}]*\}', content)
for m in matches:
    print(m.group(0))
