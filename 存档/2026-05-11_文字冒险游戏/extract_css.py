import re

def extract_css_blocks(filepath, keywords):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    blocks = []
    # match class or id rules containing keywords
    pattern = r'([\.#a-zA-Z0-9_-][^{]*)\{([^}]+)\}'
    for match in re.finditer(pattern, content):
        selector = match.group(1).strip()
        body = match.group(2).strip()
        for kw in keywords:
            if kw in selector or kw in body:
                blocks.append(match.group(0))
                break
                
    # Also extract media queries
    media_pattern = r'(@media[^{]+\{([\s\S]*?})\s*\})'
    media_blocks = []
    for match in re.finditer(media_pattern, content):
        media_blocks.append(match.group(0))

    with open('css_analysis.txt', 'w', encoding='utf-8') as out:
        out.write("=== TARGETED BLOCKS ===\n\n")
        out.write("\n\n".join(blocks))
        out.write("\n\n=== MEDIA QUERIES ===\n\n")
        out.write("\n\n".join(media_blocks))

extract_css_blocks('样式.css', ['overlay', 'modal', 'message', 'narrative', 'dialog'])
