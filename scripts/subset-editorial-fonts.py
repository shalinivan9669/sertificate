"""Rebuild browser fonts from the retained original WOFF2 sources.

Requires fontTools with Brotli support. Preserve the display width axis used
by the mobile hero, the sans default width, and all 100–900 weights.
"""
import json
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[1]
RANGES = [
    (0x0000, 0x024F),  # Latin, extended Latin, punctuation and currency
    (0x0300, 0x036F),  # Combining accents
    (0x0400, 0x045F),  # Russian/basic Cyrillic; Kazakh is retained by REQUIRED
    (0x1E9E, 0x1E9E),  # Capital sharp S; other extended Latin is above
    (0x2000, 0x206F), (0x20A0, 0x20CF), (0x2100, 0x214F),
    (0x2190, 0x22FF), (0x25A0, 0x25FF), (0xFB00, 0xFB06),
]
REQUIRED = set(map(ord, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюяӘәҒғҚқҢңӨөҰұҮүҺһІі₸№«»–—'))


def main():
    report = []
    for name in ['ot-sans', 'ot-display']:
        source = ROOT / 'public' / 'fonts' / f'{name}.woff2'
        target = source.with_name(f'{name}-ru-kk-latin-v1.woff2')
        font = TTFont(source)
        original_cmap = font.getBestCmap()
        keep = REQUIRED | {cp for cp in original_cmap if any(low <= cp <= high for low, high in RANGES)}
        missing_source = REQUIRED - original_cmap.keys()
        if missing_source:
            raise ValueError(f'{name}: required glyphs absent in source: {sorted(missing_source)}')
        options = subset.Options()
        options.layout_features = ['*']
        options.name_IDs = ['*']
        options.name_legacy = True
        options.name_languages = ['*']
        subsetter = subset.Subsetter(options=options)
        subsetter.populate(unicodes=keep)
        subsetter.subset(font)
        width_samples = [92, 100] if name == 'ot-display' else [100]
        if name == 'ot-sans':
            font = instantiateVariableFont(font, {'wdth': 100}, inplace=True)
        font.flavor = 'woff2'
        font.recalcTimestamp = False
        font.save(target)
        result = TTFont(target)
        assert REQUIRED <= result.getBestCmap().keys(), f'{name}: required glyphs lost'
        expected_axes = [('wght', 100, 900)] + ([('wdth', 62.5, 100)] if name == 'ot-display' else [])
        assert [(axis.axisTag, axis.minValue, axis.maxValue) for axis in result['fvar'].axes] == expected_axes
        original = TTFont(source)
        advance_difference = 0
        for weight in [100, 400, 500, 700, 900]:
            for width in width_samples:
                before = original.getGlyphSet(location={'wght': weight, 'wdth': width})
                after = result.getGlyphSet(location={'wght': weight, 'wdth': width})
                advance_difference = max(advance_difference, max(
                    abs(before[original_cmap[cp]].width - after[result.getBestCmap()[cp]].width)
                    for cp in REQUIRED
                ))
        assert advance_difference < 0.01, f'{name}: character advance widths changed'
        report.append({
            'source': str(source.relative_to(ROOT)),
            'target': str(target.relative_to(ROOT)),
            'sourceBytes': source.stat().st_size,
            'targetBytes': target.stat().st_size,
            'sourceCodepoints': len(original_cmap),
            'targetCodepoints': len(result.getBestCmap()),
            'weightRange': [100, 900], 'testedWidths': width_samples,
            'requiredRussianKazakhLatinGlyphsPresent': True,
            'maxRequiredGlyphAdvanceDifference': advance_difference,
        })
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
