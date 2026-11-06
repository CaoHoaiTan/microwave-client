export function blocked(map, objects, x, y) {
  return x - 9 < 0 || x + 9 > map.w * map.tile || y - 8 < 0 || y > map.h * map.tile ||
    objects.some(o => o.solid && x + 9 > o.px && x - 9 < o.px + o.pw && y > o.py && y - 8 < o.py + o.ph);
}

// Search on an 8px grid anchored at the current position; no snapping/teleporting.
export function findPath(map, objects, start, task) {
  const origin = {x: Math.round(start.x), y: Math.round(start.y)};
  if (blocked(map, objects, origin.x, origin.y)) throw new Error('Current position is blocked');
  const nodes = [{...origin, parent: -1}];
  const seen = new Set([`${origin.x},${origin.y}`]);
  for (let i = 0; i < nodes.length; i++) {
    const p = nodes[i];
    const nearest = objects.filter(o => o.task).map(o => ({o, d: Math.hypot(p.x-o.cx, p.y-o.cy)})).sort((a,b) => a.d-b.d)[0];
    if (nearest?.o.task === task && nearest.d < map.tile * 1.8) {
      const result = [];
      for (let j = i; nodes[j].parent !== -1; j = nodes[j].parent) result.push({x:nodes[j].x,y:nodes[j].y});
      return result.reverse();
    }
    for (const [dx,dy] of [[8,0],[-8,0],[0,8],[0,-8]]) {
      const x = p.x+dx, y = p.y+dy, key = `${x},${y}`;
      // Check intermediate points too, so thin obstacles cannot be crossed.
      if (seen.has(key) || Array.from({length:8},(_,n)=>n+1).some(n=>blocked(map,objects,p.x+dx*n/8,p.y+dy*n/8))) continue;
      seen.add(key); nodes.push({x,y,parent:i});
    }
  }
  throw new Error(`No accessible location for ${task}`);
}

export function arithmetic(question) {
  const match = String(question).trim().replace(/\s*=\s*\??$/, '').match(/^(-?\d+)\s*([+−\-×x*÷/])\s*(-?\d+)$/);
  if (!match) return null;
  const [,a,op,b] = match, x=Number(a), y=Number(b);
  const value = ['+'].includes(op) ? x+y : ['-','−'].includes(op) ? x-y : ['*','×','x'].includes(op) ? x*y : x/y;
  return Number.isFinite(value) ? String(value) : null;
}
