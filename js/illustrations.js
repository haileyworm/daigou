// ============================================================
//  卡片用的內建 SVG 插圖（平塗＋墨灰粗線）
//  想加新的：照格式加一個 key 即可，viewBox 統一 0 0 160 120
// ============================================================
const S = 'stroke="#3E3A39" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
const wrap = (inner, bg) => `<svg viewBox="0 0 160 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="0" y="0" width="160" height="120" fill="${bg}"/>${inner}</svg>`;

export const ILLUSTRATIONS = {
  bag: {
    label: '購物袋',
    svg: wrap(`
      <path d="M62 46 C62 30 98 30 98 46" fill="none" ${S}/>
      <rect x="48" y="44" width="64" height="56" rx="10" fill="#F2A497" ${S}/>
      <circle cx="68" cy="68" r="3" fill="#3E3A39"/><circle cx="92" cy="68" r="3" fill="#3E3A39"/>
      <path d="M74 78 Q80 84 86 78" fill="none" ${S}/>
      <ellipse cx="62" cy="80" rx="5" ry="3" fill="#FFFCF6" opacity=".7"/><ellipse cx="98" cy="80" rx="5" ry="3" fill="#FFFCF6" opacity=".7"/>
      <path d="M28 30 l4 -8 l4 8 l8 4 l-8 4 l-4 8 l-4 -8 l-8 -4 z" fill="#F6D27A" ${S}/>`, '#A8D3E6'),
  },
  gift: {
    label: '禮物盒',
    svg: wrap(`
      <rect x="46" y="54" width="68" height="46" rx="8" fill="#B9DAA5" ${S}/>
      <rect x="40" y="40" width="80" height="18" rx="6" fill="#B9DAA5" ${S}/>
      <rect x="74" y="40" width="12" height="60" fill="#F2A497" ${S}/>
      <path d="M80 40 C66 22 52 34 62 40 Z M80 40 C94 22 108 34 98 40 Z" fill="#F2A497" ${S}/>
      <circle cx="128" cy="30" r="6" fill="#FFFCF6" ${S}/>`, '#F6D27A'),
  },
  plane: {
    label: '飛機',
    svg: wrap(`
      <path d="M30 66 Q80 46 132 56 Q140 60 132 64 Q80 74 30 66 Z" fill="#FFFCF6" ${S}/>
      <path d="M76 58 L60 34 L72 34 L96 58 Z" fill="#F2A497" ${S}/>
      <path d="M78 66 L64 90 L76 90 L98 66 Z" fill="#F2A497" ${S}/>
      <path d="M34 64 L26 48 L36 48 L46 62 Z" fill="#F6D27A" ${S}/>
      <circle cx="112" cy="58" r="3" fill="#3E3A39"/><circle cx="100" cy="59" r="3" fill="#3E3A39"/>
      <path d="M18 92 Q30 84 42 92 Q54 100 66 92" fill="none" ${S}/>`, '#A8D3E6'),
  },
  cat: {
    label: '貓咪',
    svg: wrap(`
      <path d="M50 54 L54 28 L72 44 Q80 42 88 44 L106 28 L110 54 Q116 92 80 96 Q44 92 50 54 Z" fill="#F6D27A" ${S}/>
      <circle cx="68" cy="66" r="3.5" fill="#3E3A39"/><circle cx="92" cy="66" r="3.5" fill="#3E3A39"/>
      <path d="M76 76 Q80 80 84 76" fill="none" ${S}/>
      <ellipse cx="60" cy="76" rx="6" ry="3.5" fill="#F2A497"/><ellipse cx="100" cy="76" rx="6" ry="3.5" fill="#F2A497"/>
      <path d="M30 70 h12 M30 80 h12 M118 70 h12 M118 80 h12" ${S}/>`, '#FBE3DE'),
  },
  box: {
    label: '紙箱',
    svg: wrap(`
      <path d="M40 50 L80 36 L120 50 L80 64 Z" fill="#F6D27A" ${S}/>
      <path d="M40 50 L40 90 L80 104 L80 64 Z" fill="#F2A497" ${S}/>
      <path d="M120 50 L120 90 L80 104 L80 64 Z" fill="#F7C0B5" ${S}/>
      <circle cx="56" cy="76" r="2.5" fill="#3E3A39"/><circle cx="66" cy="80" r="2.5" fill="#3E3A39"/>
      <path d="M57 86 Q61 89 65 87" fill="none" ${S}/>`, '#B9DAA5'),
  },
};

export const DEFAULT_ILLUSTRATION = 'bag';
export const illustration = (key) => (ILLUSTRATIONS[key] || ILLUSTRATIONS[DEFAULT_ILLUSTRATION]).svg;
