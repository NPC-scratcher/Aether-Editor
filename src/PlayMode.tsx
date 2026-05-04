import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';

export default function PlayMode({ 
  map, 
  customBlocks, 
  customSprites, 
  customCharacters,
  onExit
}: { 
  map: any; 
  customBlocks: any[]; 
  customSprites: any[]; 
  customCharacters: any[];
  onExit: () => void;
}) {
  const [playerPos, setPlayerPos] = useState({ x: 0, y: 0 });
  const [joystick, setJoystick] = useState({ x: 0, y: 0, active: false, originX: 0, originY: 0 });
  
  const GRID_SIZE = 40;
  
  const playableChar = map.characters?.find((c: any) => {
    const def = customCharacters.find((def) => def.id === c.characterId);
    return def?.isPlayable;
  });

  const playerSprite = playableChar 
    ? customSprites.find((s) => s.id === customCharacters.find((def) => def.id === playableChar.characterId)?.spriteId)?.dataUrl 
    : undefined;

  useEffect(() => {
    if (playableChar) {
       setPlayerPos({ x: playableChar.x * GRID_SIZE, y: playableChar.y * GRID_SIZE });
    }
  }, [playableChar]);

  useEffect(() => {
    let animationFrameId: number;
    let keys = { w: false, a: false, s: false, d: false };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase().replace('arrowup', 'w').replace('arrowdown', 's').replace('arrowleft', 'a').replace('arrowright', 'd');
      if (['w', 'a', 's', 'd'].includes(key)) {
        keys[key as keyof typeof keys] = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase().replace('arrowup', 'w').replace('arrowdown', 's').replace('arrowleft', 'a').replace('arrowright', 'd');
      if (['w', 'a', 's', 'd'].includes(key)) {
        keys[key as keyof typeof keys] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const update = () => {
      let dx = 0; let dy = 0;
      const speed = 4;
      
      // Keyboard
      if (keys.w) dy -= speed;
      if (keys.s) dy += speed;
      if (keys.a) dx -= speed;
      if (keys.d) dx += speed;
      
      // Joystick (mobile)
      setJoystick(prev => {
         if (prev.active) {
            dx += (prev.x / 40) * speed;
            dy += (prev.y / 40) * speed;
         }
         return prev;
      });

      if (dx !== 0 || dy !== 0) {
         setPlayerPos(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      }
      animationFrameId = requestAnimationFrame(update);
    };
    update();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
     const touch = e.touches[0];
     setJoystick({ active: true, originX: touch.clientX, originY: touch.clientY, x: 0, y: 0 });
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
     const touch = e.touches[0];
     setJoystick(prev => {
        if (!prev.active) return prev;
        let dx = touch.clientX - prev.originX;
        let dy = touch.clientY - prev.originY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 40;
        if (dist > maxDist) {
           dx = (dx / dist) * maxDist;
           dy = (dy / dist) * maxDist;
        }
        return { ...prev, x: dx, y: dy };
     });
  };

  const handleTouchEnd = () => {
     setJoystick({ active: false, originX: 0, originY: 0, x: 0, y: 0 });
  };

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col overflow-hidden text-white sm:touch-auto touch-none"
         onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
    >
      <div className="absolute top-4 left-4 z-50">
        <button onClick={onExit} className="p-3 bg-black/50 hover:bg-black/80 rounded-full backdrop-blur transition"><ArrowLeft className="w-6 h-6"/></button>
      </div>

      <div className="flex-1 relative w-full h-full" style={{ backgroundColor: map.backgroundColor || '#1e3a8a' }}>
         <div className="absolute top-0 left-0 w-full h-full">
              {(map.blocks || []).map((b: any) => {
                  const blockDef = customBlocks.find(ab => ab.id === b.blockId);
                  const sprite = blockDef?.spriteId ? customSprites.find((s: any) => s.id === blockDef.spriteId)?.dataUrl : null;
                  return blockDef ? (
                      <div 
                          key={`${b.x}-${b.y}`}
                          className="absolute pointer-events-none"
                          style={{
                              left: b.x * GRID_SIZE,
                              top: b.y * GRID_SIZE,
                              width: GRID_SIZE + 1,
                              height: GRID_SIZE + 1,
                              backgroundImage: sprite ? `url(${sprite})` : 'none',
                              backgroundSize: '100% 100%',
                              imageRendering: 'pixelated'
                          }}
                      />
                  ) : null;
              })}

              {(map.characters || []).map((c: any, idx: number) => {
                  if (c === playableChar) return null;
                  const charDef = customCharacters.find(ac => ac.id === c.characterId);
                  const sprite = charDef?.spriteId ? customSprites.find((s: any) => s.id === charDef.spriteId)?.dataUrl : null;
                  return charDef ? (
                      <div 
                          key={c.id || idx}
                          className="absolute pointer-events-none z-10"
                          style={{
                              left: c.x * GRID_SIZE,
                              top: c.y * GRID_SIZE,
                              width: GRID_SIZE + 1,
                              height: GRID_SIZE + 1,
                              backgroundImage: sprite ? `url(${sprite})` : 'none',
                              backgroundSize: '100% 100%',
                              imageRendering: 'pixelated'
                          }}
                      >
                         {!sprite && <div className="bg-red-500 w-3/4 h-3/4 rounded-full" />}
                      </div>
                  ) : null;
              })}

              {playableChar && (
                 <div className="absolute z-20 pointer-events-none"
                      style={{
                          left: playerPos.x,
                          top: playerPos.y,
                          width: GRID_SIZE + 1,
                          height: GRID_SIZE + 1,
                          backgroundImage: playerSprite ? `url(${playerSprite})` : 'none',
                          backgroundSize: '100% 100%',
                          imageRendering: 'pixelated'
                      }}>
                      {!playerSprite && <div className="bg-blue-500 w-full h-full rounded-full" />}
                  </div>
              )}
              
              {!playableChar && (
                 <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/70 px-4 py-2 rounded text-sm pointer-events-none text-center">
                   Agrega un personaje jugable para moverte<br/>por el mapa
                 </div>
              )}
         </div>
      </div>
      
      {/* Virtual Joystick */}
      {joystick.active && (
         <div className="absolute rounded-full border-2 border-white/30 bg-black/20"
              style={{
                 left: joystick.originX - 40,
                 top: joystick.originY - 40,
                 width: 80, height: 80
              }}>
             <div className="absolute rounded-full bg-white/50"
                  style={{
                     left: 40 + joystick.x - 20,
                     top: 40 + joystick.y - 20,
                     width: 40, height: 40
                  }}/>
         </div>
      )}
    </div>
  );
}
