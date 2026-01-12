// Helper function to get tile image path from tile ID
export const getTileImagePath = (tileId: string): string => {
  if (!tileId) return '/mahjong-tiles/Front.svg';

  // Man tiles
  if (tileId.startsWith('M')) {
    if (tileId === 'M5R') return '/mahjong-tiles/Man5-Dora.svg';
    const num = tileId.substring(1);
    return `/mahjong-tiles/Man${num}.svg`;
  }
  
  // Pin tiles
  if (tileId.startsWith('P')) {
    if (tileId === 'P5R') return '/mahjong-tiles/Pin5-Dora.svg';
    const num = tileId.substring(1);
    return `/mahjong-tiles/Pin${num}.svg`;
  }
  
  // Sou tiles
  if (tileId.startsWith('S') && tileId !== 'S') {
    if (tileId === 'S5R') return '/mahjong-tiles/Sou5-Dora.svg';
    const num = tileId.substring(1);
    return `/mahjong-tiles/Sou${num}.svg`;
  }
  
  // Winds
  if (tileId === 'E') return '/mahjong-tiles/Ton.svg'; // East
  if (tileId === 'S') return '/mahjong-tiles/Nan.svg'; // South
  if (tileId === 'W') return '/mahjong-tiles/Shaa.svg'; // West
  if (tileId === 'N') return '/mahjong-tiles/Pei.svg'; // North
  
  // Dragons
  if (tileId === 'r') return '/mahjong-tiles/Chun.svg'; // Red Dragon
  if (tileId === 'w') return '/mahjong-tiles/Haku.svg'; // White Dragon
  if (tileId === 'g') return '/mahjong-tiles/Hatsu.svg'; // Green Dragon
  
  // Fallback
  console.error('Unknown tile ID:', tileId);
  return '/mahjong-tiles/Front.svg';
};

