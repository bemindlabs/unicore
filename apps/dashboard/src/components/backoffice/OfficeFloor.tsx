'use client';

import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { BackofficeAgent } from '@/lib/backoffice/types';
import { PixelAvatar } from './PixelAvatar';

interface Props {
  agents: BackofficeAgent[];
  onSelectAgent: (agent: BackofficeAgent) => void;
}

// 2D Map dimensions
const MAP_WIDTH = 1000;
const MAP_HEIGHT = 600;

function getRandomPos(rect: { x: number, y: number, w: number, h: number }) {
  return {
    x: rect.x + 20 + Math.random() * (rect.w - 40),
    y: rect.y + 30 + Math.random() * (rect.h - 60),
  };
}

/* --- Pixel Art Decor Props --- */

function PixelVendingMachine() {
  return (
    <div className="flex flex-col items-center drop-shadow-md z-10 hover:scale-105 transition-transform group">
      <div className="w-8 h-4 border-[3px] flex items-center justify-center bg-[var(--retrodesk-surface)] border-[var(--retrodesk-pink)] text-[var(--retrodesk-pink)] font-mono text-[8px] uppercase tracking-tighter">
        DRINK
      </div>
      <div className="w-8 h-10 border-[3px] border-t-0 border-[var(--retrodesk-pink)] bg-[var(--retrodesk-surface)] relative overflow-hidden">
        <div className="absolute top-1 left-1 right-1 h-3 bg-black/10 flex gap-0.5 p-0.5">
          <div className="w-1.5 h-1.5 bg-[var(--retrodesk-blue)]" />
          <div className="w-1.5 h-1.5 bg-[var(--retrodesk-yellow)]" />
          <div className="w-1.5 h-1.5 bg-[var(--retrodesk-green)]" />
        </div>
        <div className="absolute top-5 left-1 right-1 h-3 bg-black/10 flex gap-0.5 p-0.5">
          <div className="w-1.5 h-1.5 bg-[var(--retrodesk-pink)]" />
          <div className="w-1.5 h-1.5 bg-[var(--retrodesk-orange)]" />
          <div className="w-1.5 h-1.5 bg-[var(--retrodesk-blue)]" />
        </div>
        <div className="absolute bottom-1 left-2 w-3 h-2 bg-black/20 group-hover:bg-[var(--retrodesk-pink)] transition-colors" />
      </div>
      <div className="w-8 h-1.5 bg-[var(--retrodesk-border)]" />
    </div>
  );
}

function PixelFlowerDeco() {
  return (
    <div className="flex flex-col items-center drop-shadow-md z-10 hover:scale-110 transition-transform">
      <div className="flex gap-[1px]">
        <div className="w-2.5 h-2.5 bg-[var(--retrodesk-pink)]" />
        <div className="w-2.5 h-2.5 bg-[var(--retrodesk-orange)]" />
        <div className="w-2.5 h-2.5 bg-[var(--retrodesk-pink)]" />
      </div>
      <div className="w-2.5 h-2.5 bg-[var(--retrodesk-yellow)]" />
      <div className="w-1.5 h-4 bg-[var(--retrodesk-green)] shadow-sm" />
      <div className="w-5 h-4 border-2 border-[#8b6914] bg-[#d4a76a]" />
    </div>
  );
}

function PixelBookshelf() {
  const colors = ['var(--retrodesk-pink)', 'var(--retrodesk-blue)', 'var(--retrodesk-yellow)', 'var(--retrodesk-green)', 'var(--retrodesk-orange)'];
  return (
    <div className="w-12 h-20 border-[3px] p-1 flex flex-col gap-1 justify-end shadow-md z-10" style={{ borderColor: 'var(--retrodesk-border)', background: 'var(--retrodesk-surface)' }}>
      {[0, 1, 2, 3].map(row => (
        <div key={row} className="flex gap-1 h-3 items-end">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex-1 transition-transform hover:-translate-y-1" style={{ height: `${60 + Math.random() * 40}%`, background: colors[(row * 3 + i) % colors.length] }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function PixelComputerDesk() {
  return (
    <div className="w-24 h-16 border-[3px] flex flex-col relative shadow-md z-10 hover:scale-105 transition-transform" style={{ background: 'var(--retrodesk-bg)', borderColor: 'var(--retrodesk-border)' }}>
      {/* Monitor */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-10 h-6 border-[3px] shadow-lg flex items-center justify-center" style={{ background: 'var(--retrodesk-text)', borderColor: 'var(--retrodesk-border)' }}>
         {/* Screen glow */}
         <div className="w-8 h-4 bg-cyan-400/20 animate-pulse border border-cyan-300/40" />
      </div>
      {/* Keyboard */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-8 h-2 border border-black/10 bg-black/5" />
      <div className="absolute bottom-2 right-2 w-2 h-2 border border-black/10 bg-black/5 rounded-full" />
    </div>
  );
}

function PixelServerRack() {
  return (
    <div className="w-12 h-24 border-[3px] p-1 flex flex-col gap-1 shadow-lg z-10" style={{ background: '#1a1a2e', borderColor: 'var(--retrodesk-border)' }}>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="flex-1 bg-[#0a1628] border border-black/50 rounded-sm flex items-center px-1 gap-1">
          <div className="w-1 h-1 rounded-full bg-green-400 animate-pulse shadow-[0_0_4px_#4ade80]" style={{ animationDelay: `${i * 0.3}s` }} />
          <div className="w-1 h-1 rounded-full bg-cyan-400/50" />
          <div className="w-1 h-full bg-blue-500/20 ml-auto" />
        </div>
      ))}
    </div>
  );
}

function PixelBed() {
  return (
    <div className="w-16 h-28 border-[3px] shadow-sm flex flex-col z-10 hover:scale-105 transition-transform" style={{ background: 'var(--retrodesk-bg)', borderColor: 'var(--retrodesk-border)' }}>
      {/* Pillow area */}
      <div className="h-8 border-b-[3px] flex justify-center items-center" style={{ background: 'var(--retrodesk-surface)', borderColor: 'var(--retrodesk-border)' }}>
         <div className="w-10 h-3 border-2 rounded-sm" style={{ borderColor: 'var(--retrodesk-border)', background: 'var(--retrodesk-bg)' }} />
      </div>
      {/* Blanket */}
      <div className="flex-1 relative overflow-hidden" style={{ background: 'var(--retrodesk-orange)' }}>
         <div className="absolute inset-0 opacity-30 mix-blend-multiply" style={{ background: 'repeating-linear-gradient(45deg, transparent, transparent 4px, var(--retrodesk-border) 4px, var(--retrodesk-border) 8px)' }} />
         <div className="absolute top-0 w-full h-2 bg-white/20" />
      </div>
    </div>
  );
}

function PixelCoffeeShop() {
  return (
    <div className="w-48 h-32 border-[6px] shadow-2xl z-10 flex flex-col items-center justify-end p-2 relative" style={{ background: '#fef3c7', borderColor: 'var(--retrodesk-border)' }}>
      {/* Awning */}
      <div className="absolute top-0 left-0 right-0 h-6 flex">
         {Array.from({ length: 6 }).map((_, i) => (
           <div key={i} className={`flex-1 h-full shadow-sm rounded-b-sm ${i % 2 === 0 ? 'bg-[var(--retrodesk-orange)]' : 'bg-yellow-100'}`} />
         ))}
      </div>
      {/* Front Counter */}
      <div className="w-full h-10 border-t-4 border-l-4 border-r-4 shadow-inner flex justify-center items-center gap-4" style={{ background: '#d97706', borderColor: '#b45309' }}>
         <div className="w-8 h-6 bg-white/20 border-2 border-white/50 animate-pulse" />
         <div className="w-4 h-6 bg-black/20" />
      </div>
    </div>
  );
}

export function OfficeFloor({ agents, onSelectAgent }: Props) {
  const [currentFloor, setCurrentFloor] = useState<number>(1);

  // Redefine zones to take up whole maps based on floor
  const zones = useMemo(() => ({
    'conference': { x: 40, y: 40, w: 400, h: 520, floor: 3 },
    'bedroom': { x: 460, y: 40, w: 380, h: 520, floor: 3 },
    
    'main-office': { x: 40, y: 40, w: 800, h: 520, floor: 2 },
    
    'standalone': { x: 40, y: 40, w: 460, h: 520, floor: 1 },
    'shop': { x: 520, y: 40, w: 320, h: 520, floor: 1 },
  }), []);

  const [positions, setPositions] = useState<Record<string, { x: number, y: number }>>({});
  const [selectedAgentToMove, setSelectedAgentToMove] = useState<string | null>(null);
  const [manualPosLocks, setManualPosLocks] = useState<Record<string, number>>({});
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      // Calculate scale to fit exactly within container minus small gap
      const s = Math.min(width / MAP_WIDTH, height / MAP_HEIGHT);
      setScale(s);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Clear selection if switching floors
  useEffect(() => {
    setSelectedAgentToMove(null);
  }, [currentFloor]);
  
  // Use a ref so the setInterval doesn't stagger/re-trigger on every select toggle
  const selectedRef = useRef(selectedAgentToMove);
  useEffect(() => { selectedRef.current = selectedAgentToMove; }, [selectedAgentToMove]);

  const manualLocksRef = useRef(manualPosLocks);
  useEffect(() => { manualLocksRef.current = manualPosLocks; }, [manualPosLocks]);
  
  useEffect(() => {
    setPositions(prev => {
      const p = { ...prev };
      let changed = false;
      agents.forEach(a => {
        if (!p[a.id]) {
          let zoneName = a.room || 'standalone';
          if (a.status === 'offline') zoneName = 'bedroom';
          const zone = zones[zoneName as keyof typeof zones] || zones['standalone'];
          p[a.id] = getRandomPos(zone);
          changed = true;
        }
      });
      return changed ? p : prev;
    });

    const id = setInterval(() => {
      setPositions(prev => {
        const next = { ...prev };
        agents.forEach(a => {
          const isSelected = selectedRef.current === a.id;
          const locks = manualLocksRef.current;
          const isManualLocked = locks[a.id] && locks[a.id] > Date.now();
          if (!isSelected && !isManualLocked && (Math.random() > 0.4 || a.status === 'offline')) {
            let zoneName = a.room || 'standalone';
            if (a.status === 'offline') zoneName = 'bedroom';
            const zone = zones[zoneName as keyof typeof zones] || zones['standalone'];
            next[a.id] = getRandomPos(zone);
          }
        });
        return next;
      });
    }, 4500);

    return () => clearInterval(id);
  }, [agents, zones]);

  // WASD Manual Driving Control
  useEffect(() => {
    if (!selectedAgentToMove) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      setPositions(prev => {
        const current = prev[selectedAgentToMove];
        if (!current) return prev;
        
        let { x, y } = current;
        const step = 40; // Pixels per key press

        switch(e.key.toLowerCase()) {
          case 'w':
          case 'arrowup':
             y -= step; break;
          case 's':
          case 'arrowdown':
             y += step; break;
          case 'a':
          case 'arrowleft':
             x -= step; break;
          case 'd':
          case 'arrowright':
             x += step; break;
          case 'escape':
             setSelectedAgentToMove(null);
             return prev;
          default:
             return prev;
        }

        // Clamp to map boundaries
        x = Math.max(20, Math.min(x, MAP_WIDTH - 60));
        y = Math.max(20, Math.min(y, MAP_HEIGHT - 80));

        // Extend their manual lock timer to suppress AI wander logic while being driven
        setManualPosLocks(locks => ({ ...locks, [selectedAgentToMove]: Date.now() + 30000 }));
        return { ...prev, [selectedAgentToMove]: { x, y } };
      });
      
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key) || e.key.toLowerCase() === 'w') {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAgentToMove]);

  const handleFloorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedAgentToMove) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale - 24;
    const y = (e.clientY - rect.top) / scale - 40;
    
    setPositions(prev => ({ ...prev, [selectedAgentToMove]: { x, y } }));
    setManualPosLocks(prev => ({ ...prev, [selectedAgentToMove]: Date.now() + 30000 }));
    setSelectedAgentToMove(null);
  };

  const floors = [
    { id: 3, name: 'F3: Executive & Quarters' },
    { id: 2, name: 'F2: Operations' },
    { id: 1, name: 'F1: Engineering' },
  ];

  return (
    <div data-character-theme="retrodesk" className="w-full h-full relative flex items-center justify-center bg-[var(--retrodesk-bg)] overflow-hidden" ref={containerRef}>
      
      <div className="absolute flex justify-center items-center" style={{ width: MAP_WIDTH, height: MAP_HEIGHT, transform: `scale(${scale})`, transformOrigin: 'center' }}>
        <div 
          className={`relative border-8 shadow-2xl overflow-hidden retrodesk-grid-bg shrink-0 transition-colors ${selectedAgentToMove ? 'cursor-crosshair' : ''}`}
          onClick={handleFloorClick}
          style={{ 
            background: 'var(--retrodesk-bg)',
            width: MAP_WIDTH, 
            height: MAP_HEIGHT,
            borderColor: 'var(--retrodesk-border)',
            backgroundImage: 'linear-gradient(var(--retrodesk-border) 1px, transparent 1px), linear-gradient(90deg, var(--retrodesk-border) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        >
          {/* Elevator Panel securely nested inside rendering context */}
          <div 
            className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 p-3 border-4 shadow-2xl z-50 rounded-xl" 
            style={{ background: 'var(--retrodesk-surface)', borderColor: 'var(--retrodesk-border)', width: 130 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[10px] font-mono font-bold text-center border-b-2 pb-2 mb-2" style={{ borderColor: 'var(--retrodesk-border)', color: 'var(--retrodesk-text)' }}>ELEVATOR</div>
            {floors.map(f => (
              <button 
                key={f.id} 
                onClick={(e) => { e.stopPropagation(); setCurrentFloor(f.id); }}
                className={`px-4 py-3 font-mono text-xs font-bold transition-transform ${currentFloor === f.id ? 'scale-110 shadow-lg' : 'hover:scale-105 opacity-60'}`}
                style={{
                  background: currentFloor === f.id ? 'var(--retrodesk-blue)' : 'var(--retrodesk-bg)',
                  color: currentFloor === f.id ? 'var(--retrodesk-surface)' : 'var(--retrodesk-text)',
                  border: `2px solid var(--retrodesk-border)`
                }}
              >
                {f.name}
              </button>
            ))}
          </div>

          {selectedAgentToMove && (
            <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-[var(--retrodesk-blue)] text-[var(--retrodesk-surface)] px-8 py-3 z-50 animate-bounce border-[6px] border-[var(--retrodesk-surface)] shadow-2xl text-center">
              <div className="font-mono text-[16px] tracking-widest font-bold">[ CLICK TO RELOCATE ]</div>
              <div className="font-mono text-[10px] mt-1.5 opacity-90 uppercase tracking-widest font-bold border-t-2 border-[var(--retrodesk-surface)] pt-1.5">
                ✦ OR USE W A S D / ARROWS TO DRIVE AGENT ✦
              </div>
            </div>
          )}

          <div className="absolute bottom-4 right-44 px-3 py-1 bg-[var(--retrodesk-surface)] border-2 border-[var(--retrodesk-border)] text-xs font-mono tracking-widest uppercase font-bold text-[var(--retrodesk-text)] shadow-sm z-20">
            {floors.find(f => f.id === currentFloor)?.name ?? ''} : OPENCLAW HQ
          </div>

          {/* === FLOOR 3 (Exec & Bedroom) === */}
          {currentFloor === 3 && (
            <>
              {/* Conference Room Zone */}
              <div className="absolute border-[6px] animate-in fade-in duration-500" style={{ background: 'var(--retrodesk-surface)', left: zones['conference'].x, top: zones['conference'].y, width: zones['conference'].w, height: zones['conference'].h, borderColor: 'var(--retrodesk-blue)' }}>
                <div className="absolute inset-4 border-2 border-[var(--retrodesk-border)] opacity-40 mix-blend-multiply" style={{ background: 'repeating-radial-gradient(circle at 0 0, transparent 0, var(--retrodesk-blue) 10px), repeating-linear-gradient(var(--retrodesk-blue), var(--retrodesk-blue))' }} />
                <div className="absolute -top-4 left-6 px-3 py-0.5 border-[3px] text-[10px] text-[var(--retrodesk-blue)] font-bold tracking-widest uppercase font-mono shadow-sm" style={{ background: 'var(--retrodesk-surface)', borderColor: 'var(--retrodesk-blue)' }}>Conference</div>
                
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-32 rounded-full border-[6px] shadow-xl flex items-center justify-center" style={{ background: 'var(--retrodesk-yellow)', borderColor: 'var(--retrodesk-border)' }}>
                  <div className="w-52 h-20 rounded-full border-2 border-dashed opacity-50" style={{ borderColor: 'var(--retrodesk-text)' }} />
                </div>
                
                <div className="absolute top-12 left-12"><PixelFlowerDeco /></div>
                <div className="absolute bottom-12 right-12"><PixelFlowerDeco /></div>
              </div>

              {/* Bedroom Zone */}
              <div className="absolute border-[6px] animate-in fade-in duration-500" style={{ background: 'var(--retrodesk-surface)', left: zones['bedroom'].x, top: zones['bedroom'].y, width: zones['bedroom'].w, height: zones['bedroom'].h, borderColor: 'var(--retrodesk-orange)' }}>
                <div className="absolute inset-3 border-2 border-[var(--retrodesk-border)] opacity-10 mix-blend-multiply" style={{ background: 'repeating-radial-gradient(circle at 10px 10px, var(--retrodesk-orange) 0, transparent 2px)', backgroundSize: '20px 20px' }} />
                <div className="absolute -top-4 right-6 px-3 py-0.5 border-[3px] text-[10px] text-[var(--retrodesk-orange)] font-bold tracking-widest uppercase font-mono shadow-sm" style={{ background: 'var(--retrodesk-surface)', borderColor: 'var(--retrodesk-orange)' }}>Bedroom</div>
                
                <div className="grid grid-cols-2 grid-rows-2 gap-12 py-16 px-16 h-full w-full items-center justify-items-center z-10">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <PixelBed key={i} />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* === FLOOR 2 (Command Center) === */}
          {currentFloor === 2 && (
            <>
              {/* Command Center Zone */}
              <div className="absolute border-[6px] animate-in fade-in duration-500" style={{ background: 'var(--retrodesk-surface)', left: zones['main-office'].x, top: zones['main-office'].y, width: zones['main-office'].w, height: zones['main-office'].h, borderColor: 'var(--retrodesk-pink)' }}>
                <div className="absolute inset-4 border-2 border-[var(--retrodesk-border)] opacity-30 mix-blend-multiply" style={{ background: 'repeating-linear-gradient(45deg, transparent, transparent 10px, var(--retrodesk-pink) 10px, var(--retrodesk-pink) 20px)' }} />
                <div className="absolute -top-4 left-6 px-3 py-0.5 border-[3px] text-[10px] text-[var(--retrodesk-pink)] font-bold tracking-widest uppercase font-mono shadow-sm" style={{ background: 'var(--retrodesk-surface)', borderColor: 'var(--retrodesk-pink)' }}>Command Center</div>
                
                {/* Giant Console Desk */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-32 border-[6px] flex justify-between px-8 py-4 shadow-2xl items-center" style={{ background: 'var(--retrodesk-blue)', borderColor: 'var(--retrodesk-border)' }}>
                  <div className="w-20 h-10 border-[3px] shadow-lg relative overflow-hidden" style={{ background: 'var(--retrodesk-bg)', borderColor: 'var(--retrodesk-border)' }}>
                    <div className="absolute inset-0.5 bg-[var(--retrodesk-text)] flex flex-col justify-between p-0.5 opacity-80">
                        <div className="w-full h-1.5 bg-green-400" /><div className="w-2/3 h-1.5 bg-cyan-400" /><div className="w-full h-1.5 bg-green-400" />
                    </div>
                  </div>
                  <div className="w-20 h-10 border-[3px] shadow-lg relative overflow-hidden" style={{ background: 'var(--retrodesk-bg)', borderColor: 'var(--retrodesk-border)' }}>
                    <div className="absolute inset-0.5 bg-[var(--retrodesk-text)] flex justify-center items-center opacity-80"><div className="w-6 h-6 rounded-full bg-red-500 animate-pulse shadow-[0_0_12px_#ef4444]" /></div>
                  </div>
                  <div className="w-20 h-10 border-[3px] shadow-lg relative overflow-hidden" style={{ background: 'var(--retrodesk-bg)', borderColor: 'var(--retrodesk-border)' }}>
                    <div className="absolute inset-0.5 bg-[var(--retrodesk-text)] p-1 opacity-80">
                        <div className="w-full h-full border-t border-b border-yellow-400" />
                    </div>
                  </div>
                  
                  {/* Keyboard block */}
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-6 border-2 border-b-0 flex gap-1 p-1 bg-black/10" style={{ borderColor: 'var(--retrodesk-border)' }}>
                    {Array.from({length:12}).map((_,i) => <div key={i} className="flex-1 bg-white/20" />)}
                  </div>
                </div>
                
                {/* Server Banks */}
                <div className="absolute top-12 left-1/2 -translate-x-1/2 flex gap-4">
                  {Array.from({ length: 6 }).map((_, i) => <PixelServerRack key={i} />)}
                </div>
                <div className="absolute bottom-12 left-12"><PixelVendingMachine /></div>
                <div className="absolute bottom-12 left-32"><PixelVendingMachine /></div>
              </div>
            </>
          )}

          {/* === FLOOR 1 (Engineering) === */}
          {currentFloor === 1 && (
            <>
              {/* Workstations Zone */}
              <div className="absolute border-[6px] animate-in fade-in duration-500" style={{ background: 'var(--retrodesk-surface)', left: zones['standalone'].x, top: zones['standalone'].y, width: zones['standalone'].w, height: zones['standalone'].h, borderColor: 'var(--retrodesk-green)' }}>
                <div className="absolute inset-4 border-2 border-[var(--retrodesk-border)] opacity-20 mix-blend-multiply" style={{ background: 'radial-gradient(circle, var(--retrodesk-green) 20%, transparent 20%), radial-gradient(circle, transparent 20%, var(--retrodesk-green) 20%, transparent 30%)', backgroundSize: '20px 20px' }} />
                <div className="absolute -top-4 left-6 px-3 py-0.5 border-[3px] text-[10px] text-[var(--retrodesk-green)] font-bold tracking-widest uppercase font-mono shadow-sm" style={{ background: 'var(--retrodesk-surface)', borderColor: 'var(--retrodesk-green)' }}>Workstations</div>
                
                {/* Desks grid massive */}
                <div className="grid grid-cols-2 grid-rows-3 gap-x-12 gap-y-16 py-16 px-12 h-full w-full items-center justify-items-center z-10">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <PixelComputerDesk key={i} />
                  ))}
                </div>
                
                <div className="absolute right-8 top-8"><PixelBookshelf /></div>
              </div>

              {/* Shop / Cafe Zone */}
              <div className="absolute border-[6px] animate-in fade-in duration-500" style={{ background: 'var(--retrodesk-surface)', left: zones['shop'].x, top: zones['shop'].y, width: zones['shop'].w, height: zones['shop'].h, borderColor: 'var(--retrodesk-orange)' }}>
                <div className="absolute inset-4 border-2 border-[var(--retrodesk-border)] opacity-20 mix-blend-multiply" style={{ background: 'repeating-linear-gradient(90deg, transparent, transparent 10px, var(--retrodesk-orange) 10px, var(--retrodesk-orange) 20px)' }} />
                <div className="absolute -top-4 left-6 px-3 py-0.5 border-[3px] text-[10px] text-[var(--retrodesk-orange)] font-bold tracking-widest uppercase font-mono shadow-sm" style={{ background: 'var(--retrodesk-surface)', borderColor: 'var(--retrodesk-orange)' }}>Coffee Shop</div>
                
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"><PixelCoffeeShop /></div>
                <div className="absolute bottom-8 left-8"><PixelVendingMachine /></div>
                <div className="absolute top-12 right-12"><PixelFlowerDeco /></div>
              </div>
            </>
          )}

          {/* --- Render Agents that are ONLY on the Current Floor --- */}
          {agents.filter(agent => {
            let zName = agent.room || 'standalone';
            if (agent.status === 'offline') zName = 'bedroom';
            const f = zones[zName as keyof typeof zones]?.floor || 1;
            return f === currentFloor;
          }).map(agent => {
            const pos = positions[agent.id] || { x: -100, y: -100 };
            const isSelectedForMove = selectedAgentToMove === agent.id;
            return (
              <button
                key={agent.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedAgentToMove(prev => prev === agent.id ? null : agent.id);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onSelectAgent(agent);
                }}
                className={`absolute group transition-all transform hover:scale-125 focus:outline-none z-30 animate-in zoom-in duration-300 ${isSelectedForMove ? 'scale-125 z-40' : ''}`}
                style={{
                  left: pos.x,
                  top: pos.y,
                  transitionDuration: isSelectedForMove ? '150ms' : '2500ms',
                  transitionTimingFunction: isSelectedForMove ? 'linear' : 'cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                <div className="flex flex-col items-center gap-1 drop-shadow-xl relative">
                  {isSelectedForMove && (
                     <div className="absolute -bottom-2 w-16 h-4 border-2 border-[var(--retrodesk-blue)] rounded-[100%] animate-pulse" style={{ borderStyle: 'dashed' }} />
                  )}
                  <div className="relative">
                    {agent.status === 'working' && (
                      <div className="absolute -top-4 -right-3 w-4 h-4 bg-green-400 rounded-full border-2 border-[var(--retrodesk-surface)] animate-bounce shadow-md flex items-center justify-center">
                         <span className="text-[6px] font-bold text-green-900">✓</span>
                      </div>
                    )}
                    {agent.status === 'idle' && (
                      <div className="absolute -top-4 -right-3 text-[12px] font-mono animate-pulse text-[var(--retrodesk-blue)] drop-shadow-md font-bold z-10">zZ</div>
                    )}
                    {agent.status === 'offline' && (
                      <div className="absolute -top-4 -right-3 text-[12px] font-mono animate-pulse text-[var(--retrodesk-orange)] drop-shadow-md font-bold z-10">zZ</div>
                    )}
                    <PixelAvatar name={agent.name} color={agent.color} status={agent.status} size="lg" className="drop-shadow-lg" />
                  </div>
                  <div className="mt-1 px-3 py-1 border-2 text-[10px] font-bold tracking-widest uppercase rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 pointer-events-none text-center" style={{ background: 'var(--retrodesk-surface)', borderColor: 'var(--retrodesk-border)', color: 'var(--retrodesk-text)' }}>
                    <div>{agent.name}</div>
                    <div className="text-[8px] opacity-70 normal-case tracking-normal">Click: Move | Dbl-Click: Edit</div>
                    <div className="absolute -top-[5px] left-1/2 -translate-x-1/2 w-2 h-2 border-t-2 border-l-2 bg-[var(--retrodesk-surface)] rotate-45" style={{ borderColor: 'var(--retrodesk-border)' }} />
                  </div>
                </div>
              </button>
            );
          })}

          {/* --- CRT Scanlines Overlay --- */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-50 mix-blend-overlay" style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #000 2px, #000 4px)' }} />
        </div>
      </div>
    </div>
  );
}
