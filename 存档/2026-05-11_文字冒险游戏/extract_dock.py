import re

with open('样式.css', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = r'([\.#a-zA-Z0-9_-]+)\s*\{([^}]+)\}'
blocks = []
for match in re.finditer(pattern, content):
    selector = match.group(1).strip()
    if 'input-dock' in selector or 'input-area' in selector or 'narrative-area' in selector or 'suggestion-bar' in selector:
        blocks.append(match.group(0))

with open('dock_styles.txt', 'w', encoding='utf-8') as out:
    out.write("\n\n".join(blocks))
