"""Rebuild web assets and verify the complete Russian/Kazakh character set."""
from pathlib import Path
import json
from fontTools.ttLib import TTFont
from fontTools import subset
from PIL import Image

root = Path(__file__).resolve().parents[1]
chars = 'ӘәҒғҚқҢңӨөҰұҮүҺһІіЁё№₸«»—–0123456789'
report = {}
for source, target in [('noto-serif-display.ttf', 'ot-display.woff2'), ('noto-sans.ttf', 'ot-sans.woff2')]:
    font = TTFont(root / 'public/fonts' / source)
    missing = [c for c in chars if ord(c) not in font.getBestCmap()]
    report[target] = {'missing': missing}
    assert not missing, missing
    options = subset.Options()
    options.flavor = 'woff2'
    worker = subset.Subsetter(options=options)
    worker.populate(unicodes=list(range(0x20, 0x250)) + list(range(0x400, 0x530)) + list(range(0x2000, 0x2080)) + [0x20b8, 0x2116])
    worker.subset(font)
    font.flavor = 'woff2'
    font.save(root / 'public/fonts' / target)
    check = TTFont(root / 'public/fonts' / target)
    assert all(ord(c) in check.getBestCmap() for c in chars)

im = Image.open(root / 'public/images/editorial/knowledge-city.png')
report['image'] = im.size
for width in [960, 1920]:
    size = (width, round(im.height * width / im.width))
    im.resize(size).save(root / f'public/images/editorial/knowledge-city-{width}.webp', quality=88, method=6)
(root / 'artifacts/editorial/assets-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
