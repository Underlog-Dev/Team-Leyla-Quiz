/* Theme definitions: label, icon, backdrop colours and decorative emoji (all local, no network). */
window.THEMES = {
  general:      { label: 'General Knowledge', icon: '❓', c1: '#b9a7f5', c2: '#e9defc', decor: ['❓','❔','✨','⭐','💡'] },
  football:     { label: 'Football', icon: '⚽', c1: '#7cc98f', c2: '#d6f1d9', decor: ['⚽','🥅','👟','🏆','🥽'], pitch: true },
  sports:       { label: 'Other Sports', icon: '🏀', c1: '#f6c88b', c2: '#fdebd2', decor: ['🏀','🎾','🏈','⛳','🏏','🏉','🥊'] },
  geography:    { label: 'Geography', icon: '🌍', c1: '#7fc4d6', c2: '#d9f0f5', decor: ['🌍','🗺️','🧭','🏔️','⛵'] },
  nature:       { label: 'Nature & Animals', icon: '🌿', c1: '#a8dcb8', c2: '#e6f7ea', decor: ['🌿','🦋','🌸','🐦','🐾','🍄'] },
  science:      { label: 'Science', icon: '🔬', c1: '#9cc2f0', c2: '#e3eefc', decor: ['⚛️','🔬','🧪','🧬','🔭'] },
  history:      { label: 'History', icon: '🏛️', c1: '#d9bf8f', c2: '#f5ead3', decor: ['📜','📚','🏛️','⚔️','🗝️'] },
  movies:       { label: 'Movies', icon: '🎬', c1: '#c9a0c9', c2: '#f0e0f0', decor: ['🎬','🍿','🎥','🎞️','⭐'] },
  tv:           { label: 'Television', icon: '📺', c1: '#f0a8b8', c2: '#fce3e8', decor: ['📺','📡','🍿','🎭'] },
  music:        { label: 'Music', icon: '🎵', c1: '#e29be0', c2: '#f7e0f6', decor: ['🎵','🎶','🎸','🎧','🥁','🎹'] },
  celebrities:  { label: 'Celebrities', icon: '⭐', c1: '#f5d56b', c2: '#fdf3c9', decor: ['⭐','🌟','📸','🎤','👑'] },
  gaming:       { label: 'Gaming', icon: '🎮', c1: '#8f9cf0', c2: '#e0e4fc', decor: ['🎮','🕹️','👾','🧩','🎲'] },
  food:         { label: 'Food & Drink', icon: '🍕', c1: '#f5b48a', c2: '#fde3d0', decor: ['🍕','🍔','🍩','☕','🍣','🍓'] },
  tech:         { label: 'Technology', icon: '💻', c1: '#8fd0d0', c2: '#dcf3f3', decor: ['💻','📱','🤖','🔌','💾'] },
  space:        { label: 'Space', icon: '🚀', c1: '#4a3f8f', c2: '#8d82d6', decor: ['🚀','🪐','⭐','🌑','🛸','☄️'], dark: true }
};
window.THEME_ORDER = ['general','football','sports','geography','nature','science','history','movies','tv','music','celebrities','gaming','food','tech','space'];

window.CHICK_SVG = '<svg viewBox="0 0 100 100" aria-hidden="true" class="chick-svg"><ellipse cx="50" cy="92" rx="28" ry="5" fill="rgba(0,0,0,.12)"/><path d="M20 60c0-22 13-38 30-38s30 16 30 38c0 17-13 28-30 28S20 77 20 60z" fill="#ffd93d"/><path d="M26 66c5 8 15 13 24 13s19-5 24-13c-3 14-13 22-24 22S29 80 26 66z" fill="#ffc400" opacity=".55"/><circle cx="38" cy="52" r="5" fill="#2b2140"/><circle cx="62" cy="52" r="5" fill="#2b2140"/><circle cx="39.7" cy="50.3" r="1.7" fill="#fff"/><circle cx="63.7" cy="50.3" r="1.7" fill="#fff"/><ellipse cx="30" cy="62" rx="5" ry="3.2" fill="#ff9eb0" opacity=".8"/><ellipse cx="70" cy="62" rx="5" ry="3.2" fill="#ff9eb0" opacity=".8"/><path d="M44 58l6 6 6-6c-2-3-10-3-12 0z" fill="#ff9a3c"/><path d="M50 22c-3-8 2-13 6-12-1 4-2 7-3 12zM46 22c-5-6-1-12 3-12 0 4 0 8-1 12z" fill="#ffc400"/><path d="M16 62c-8-3-10-12-5-17 2 7 6 10 11 11zM84 62c8-3 10-12 5-17-2 7-6 10-11 11z" fill="#ffc400"/></svg>';
