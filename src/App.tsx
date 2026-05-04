import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Plus, Settings, X, Map as MapIcon, ChevronRight, PenSquare, Trash2, Package, ArrowLeft, Home, Folder, MousePointer2, Palette, Hand, Square, Eraser, Pencil } from 'lucide-react';
import Cropper from 'react-easy-crop';
import PlayMode from './PlayMode';

interface GameBlock {
  x: number;
  y: number;
  blockId: string;
}

interface MapCharacter {
  id: string;
  x: number;
  y: number;
  characterId: string;
}

interface GameMap {
  id: string;
  name: string;
  description: string;
  backgroundColor?: string;
  blocks?: GameBlock[];
  characters?: MapCharacter[];
}

const GRID_SIZE = 40;

interface CustomBlock {
  id: string;
  name: string;
  description?: string;
  isPassable?: boolean;
  passableDirections?: {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
  };
  spriteId: string | null;
}

interface CustomSprite {
  id: string;
  name: string;
  pixels: string[];
  dataUrl: string;
}

interface CustomCharacter {
  id: string;
  name: string;
  description: string;
  spriteId: string | null;
  isPlayable: boolean;
  movementType: 'platformer' | 'rpg';
}

interface Project {
  id: string;
  name: string;
  icon?: string | null;
  maps: GameMap[];
  customBlocks?: CustomBlock[];
  customSprites?: CustomSprite[];
  customCharacters?: CustomCharacter[];
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('blockMakerProjects');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse projects from localStorage', e);
      }
    }
    return [];
  });
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  
  useEffect(() => {
    localStorage.setItem('blockMakerProjects', JSON.stringify(projects));
  }, [projects]);
  
  const [editingMapId, setEditingMapId] = useState<string | null>(null);
  const [renamingMapId, setRenamingMapId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [projectRenameValue, setProjectRenameValue] = useState('');

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  // Extra Editors State
  const [isBlockEditorOpen, setIsBlockEditorOpen] = useState(false);
  const [blockForm, setBlockForm] = useState<CustomBlock>({
    id: '', name: 'Nuevo Bloque', description: '', isPassable: false, passableDirections: { top: false, right: false, bottom: false, left: false }, spriteId: null
  });

  const [isCharacterEditorOpen, setIsCharacterEditorOpen] = useState(false);
  const [characterForm, setCharacterForm] = useState<CustomCharacter>({
    id: '', name: 'Nuevo Personaje', description: 'Un personaje en el juego.', spriteId: null, isPlayable: false, movementType: 'platformer'
  });

  const [isSpriteSelectorOpen, setIsSpriteSelectorOpen] = useState(false);
  const [spriteSelectionCallback, setSpriteSelectionCallback] = useState<{ onSelect: (spriteId: string) => void } | null>(null);

  const [editingIconProjectId, setEditingIconProjectId] = useState<string | null>(null);

  // Sprite Editor State
  const [isSpriteEditorOpen, setIsSpriteEditorOpen] = useState(false);
  const [spriteForm, setSpriteForm] = useState<{ 
    id: string | null; 
    name: string; 
    pixels: string[];
    type: 'sprite' | 'project_icon';
  }>({ 
    id: null, 
    name: 'Nuevo', 
    pixels: Array(256).fill(''),
    type: 'sprite'
  });
  const [spriteColor, setSpriteColor] = useState('#8b4513');
  const [spriteTool, setSpriteTool] = useState<'pencil' | 'eraser'>('pencil');
  const isDrawingPixel = useRef(false);

  // Map Editor State
  const [activeTool, setActiveTool] = useState<'pan' | 'block' | 'character' | 'eraser'>('pan');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });
  const [isBlockSelectorOpen, setIsBlockSelectorOpen] = useState(false);
  const [isAssetsManagerOpen, setIsAssetsManagerOpen] = useState(false);
  const [activeAssetCategory, setActiveAssetCategory] = useState<'blocks' | 'sprites' | 'characters' | 'props' | 'objects'>('blocks');
  
  const isDragging = useRef(false);
  const startDragPos = useRef({ x: 0, y: 0 });

  const [isMapSettingsOpen, setIsMapSettingsOpen] = useState(false);
  const [mapSettingsForm, setMapSettingsForm] = useState({ name: '', backgroundColor: '#1e3a8a' });

  // Crop State
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropProjectId, setCropProjectId] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isPlayingLevel, setIsPlayingLevel] = useState(false);

  const currentProject = projects.find(p => p.id === currentProjectId);

  const getSpriteDataUrl = (spriteId: string | null) => {
    if (!spriteId || !currentProject) return undefined;
    return currentProject.customSprites?.find(s => s.id === spriteId)?.dataUrl;
  };

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      isDrawingPixel.current = false;
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, []);

  // Project Functions
  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;
    const newProject: Project = {
      id: Date.now().toString(),
      name: newProjectName.trim(),
      maps: [],
      customBlocks: []
    };
    setProjects([...projects, newProject]);
    setIsNewProjectModalOpen(false);
    setNewProjectName('');
  };

  const handleIconUpload = (projectId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        if (img.width === img.height) {
          setProjects(projects.map(p => p.id === projectId ? { ...p, icon: dataUrl } : p));
        } else {
          setCropImageSrc(dataUrl);
          setCropProjectId(projectId);
          setCrop({ x: 0, y: 0 });
          setZoom(1);
        }
      };
      img.src = dataUrl;
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createCroppedImage = async () => {
    if (!cropImageSrc || !croppedAreaPixels || !cropProjectId) return;
    try {
      const img = new Image();
      img.src = cropImageSrc;
      await new Promise((resolve) => { img.onload = resolve; });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;

      ctx.drawImage(
        img,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      );

      const base64Image = canvas.toDataURL('image/jpeg');
      setProjects(projects.map(p => p.id === cropProjectId ? { ...p, icon: base64Image } : p));
      setCropImageSrc(null);
      setCropProjectId(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveIcon = (projectId: string) => {
    setProjects(projects.map(p => p.id === projectId ? { ...p, icon: undefined } : p));
  };

  const openSpriteEditor = (type: 'sprite' | 'project_icon', item?: CustomSprite, projectId?: string) => {
    if (type === 'project_icon' && projectId) {
      setEditingIconProjectId(projectId);
    } else {
      setEditingIconProjectId(null);
    }

    if (item) {
      setSpriteForm({ 
        id: item.id, 
        name: item.name, 
        pixels: [...item.pixels],
        type
      });
    } else {
      setSpriteForm({ 
        id: null, 
        name: type === 'project_icon' ? 'Icono del Proyecto' : 'Nuevo Sprite', 
        pixels: Array(256).fill(''),
        type 
      });
    }
    setIsSpriteEditorOpen(true);
  };

  const saveSprite = () => {
    const targetProjectId = editingIconProjectId || currentProject?.id;
    if (!targetProjectId || !spriteForm.name.trim()) return;

    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      spriteForm.pixels.forEach((color, i) => {
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(i % 16, Math.floor(i / 16), 1, 1);
        }
      });
    }
    const dataUrl = canvas.toDataURL('image/png');

    setProjects(projects.map(p => {
      if (p.id !== targetProjectId) return p;

      if (spriteForm.type === 'project_icon') {
        return { ...p, icon: dataUrl };
      } else {
        const newSprite: CustomSprite = {
          id: spriteForm.id || Date.now().toString(),
          name: spriteForm.name.trim(),
          pixels: spriteForm.pixels,
          dataUrl
        };
        const sprites = p.customSprites || [];
        const index = sprites.findIndex(s => s.id === newSprite.id);
        const newCustomSprites = index >= 0 ? [...sprites] : [...sprites, newSprite];
        if (index >= 0) newCustomSprites[index] = newSprite;
        return { ...p, customSprites: newCustomSprites };
      }
    }));
    
    setIsSpriteEditorOpen(false);
  };

  const openBlockEditor = (block?: CustomBlock) => {
    if (block) {
      setBlockForm({ ...block });
    } else {
      setBlockForm({
        id: '', name: 'Nuevo Bloque', description: '', isPassable: false, passableDirections: { top: false, right: false, bottom: false, left: false }, spriteId: null
      });
    }
    setIsBlockEditorOpen(true);
  };

  const saveBlock = () => {
    if (!currentProject || !blockForm.name.trim()) return;

    setProjects(projects.map(p => {
      if (p.id !== currentProject.id) return p;
      const newBlock: CustomBlock = { ...blockForm, id: blockForm.id || Date.now().toString() };
      const blocks = p.customBlocks || [];
      const index = blocks.findIndex(b => b.id === newBlock.id);
      const newCustomBlocks = index >= 0 ? [...blocks] : [...blocks, newBlock];
      if (index >= 0) newCustomBlocks[index] = newBlock;
      return { ...p, customBlocks: newCustomBlocks };
    }));
    
    setIsBlockEditorOpen(false);
  };

  const openCharacterEditor = (character?: CustomCharacter) => {
    if (character) {
      setCharacterForm({ ...character });
    } else {
      setCharacterForm({
        id: '', name: 'Nuevo Personaje', description: 'Un personaje en el juego.', spriteId: null, isPlayable: false, movementType: 'platformer'
      });
    }
    setIsCharacterEditorOpen(true);
  };

  const saveCharacter = () => {
    if (!currentProject || !characterForm.name.trim()) return;

    setProjects(projects.map(p => {
      if (p.id !== currentProject.id) return p;
      const newChar: CustomCharacter = { ...characterForm, id: characterForm.id || Date.now().toString() };
      const chars = p.customCharacters || [];
      const index = chars.findIndex(c => c.id === newChar.id);
      const newCustomChars = index >= 0 ? [...chars] : [...chars, newChar];
      if (index >= 0) newCustomChars[index] = newChar;
      return { ...p, customCharacters: newCustomChars };
    }));
    
    setIsCharacterEditorOpen(false);
  };

  const deleteCustomCharacter = (charId: string) => {
    if (!currentProject) return;
    setProjects(projects.map(p => {
      if (p.id !== currentProject.id) return p;
      return { 
          ...p, 
          customCharacters: (p.customCharacters || []).filter(c => c.id !== charId)
      };
    }));
  };

  const deleteCustomBlock = (blockId: string) => {
    if (!currentProject) return;
    setProjects(projects.map(p => {
      if (p.id !== currentProject.id) return p;
      return { 
          ...p, 
          customBlocks: (p.customBlocks || []).filter(b => b.id !== blockId),
          maps: p.maps.map(m => ({
              ...m,
              blocks: (m.blocks || []).filter(b => b.blockId !== blockId)
          }))
      };
    }));
    if (selectedBlockId === blockId) setSelectedBlockId(null);
  };

  const deleteCustomSprite = (spriteId: string) => {
    if (!currentProject) return;
    setProjects(projects.map(p => {
      if (p.id !== currentProject.id) return p;
      return { 
          ...p, 
          customSprites: (p.customSprites || []).filter(s => s.id !== spriteId)
      };
    }));
  };

  const paintPixel = (index: number) => {
    setSpriteForm(prev => {
      const newPixels = [...prev.pixels];
      newPixels[index] = spriteTool === 'pencil' ? spriteColor : '';
      return { ...prev, pixels: newPixels };
    });
  };

  const handleSpritePointerDown = (index: number, e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    isDrawingPixel.current = true;
    paintPixel(index);
  };

  const handleSpritePointerEnter = (index: number) => {
    if (isDrawingPixel.current) paintPixel(index);
  };

  const handleDeleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjects(projects.filter(p => p.id !== id));
    if (currentProjectId === id) {
      setCurrentProjectId(null);
    }
  };

  // Tools & Canvas Functions
  const handleToolSelect = (tool: 'pan' | 'block' | 'object' | 'eraser') => {
    setActiveTool(tool);
    if (tool === 'block' && !selectedBlockId) {
      setIsBlockSelectorOpen(true);
    }
  };

  const placeBlock = (e: React.PointerEvent) => {
    if (!selectedBlockId || !currentProjectId || !editingMapId) return;

    setProjects(prevProjects => {
      const proj = prevProjects.find(p => p.id === currentProjectId);
      if (!proj) return prevProjects;
      const map = proj.maps.find(m => m.id === editingMapId);
      if (!map) return prevProjects;

      const gridX = Math.floor((e.clientX - cameraOffset.x) / GRID_SIZE);
      const gridY = Math.floor((e.clientY - cameraOffset.y) / GRID_SIZE);

      const existingIdx = (map.blocks || []).findIndex(b => b.x === gridX && b.y === gridY);
      if (existingIdx >= 0 && map.blocks![existingIdx].blockId === selectedBlockId) {
        return prevProjects; // No change
      }

      const newBlocks = [...(map.blocks || [])];
      if (existingIdx >= 0) {
        newBlocks[existingIdx] = { x: gridX, y: gridY, blockId: selectedBlockId };
      } else {
        newBlocks.push({ x: gridX, y: gridY, blockId: selectedBlockId });
      }

      return prevProjects.map(p => 
        p.id === currentProjectId 
          ? { ...p, maps: p.maps.map(m => m.id === editingMapId ? { ...m, blocks: newBlocks } : m) } 
          : p
      );
    });
  };

  const placeCharacter = (e: React.PointerEvent) => {
    if (!selectedCharacterId || !currentProjectId || !editingMapId) return;

    setProjects(prevProjects => {
      const proj = prevProjects.find(p => p.id === currentProjectId);
      if (!proj) return prevProjects;
      const map = proj.maps.find(m => m.id === editingMapId);
      if (!map) return prevProjects;

      const gridX = Math.floor((e.clientX - cameraOffset.x) / GRID_SIZE);
      const gridY = Math.floor((e.clientY - cameraOffset.y) / GRID_SIZE);

      const existingIdx = (map.characters || []).findIndex(c => c.x === gridX && c.y === gridY);
      if (existingIdx >= 0 && map.characters![existingIdx].characterId === selectedCharacterId) {
        return prevProjects; // No change
      }

      const newChars = [...(map.characters || [])];
      if (existingIdx >= 0) {
        newChars[existingIdx] = { ...newChars[existingIdx], characterId: selectedCharacterId };
      } else {
        newChars.push({ id: Date.now().toString(), x: gridX, y: gridY, characterId: selectedCharacterId });
      }

      return prevProjects.map(p => 
        p.id === currentProjectId 
          ? { ...p, maps: p.maps.map(m => m.id === editingMapId ? { ...m, characters: newChars } : m) } 
          : p
      );
    });
  };

  const eraseBlock = (e: React.PointerEvent) => {
    if (!currentProjectId || !editingMapId) return;

    setProjects(prevProjects => {
      const proj = prevProjects.find(p => p.id === currentProjectId);
      if (!proj) return prevProjects;
      const map = proj.maps.find(m => m.id === editingMapId);
      if (!map) return prevProjects;

      const gridX = Math.floor((e.clientX - cameraOffset.x) / GRID_SIZE);
      const gridY = Math.floor((e.clientY - cameraOffset.y) / GRID_SIZE);

      const newBlocks = (map.blocks || []).filter(b => !(b.x === gridX && b.y === gridY));
      const newChars = (map.characters || []).filter(c => !(c.x === gridX && c.y === gridY));

      if (newBlocks.length === (map.blocks || []).length && newChars.length === (map.characters || []).length) {
        return prevProjects; // No change
      }

      return prevProjects.map(p => 
        p.id === currentProjectId 
          ? { ...p, maps: p.maps.map(m => m.id === editingMapId ? { ...m, blocks: newBlocks, characters: newChars } : m) } 
          : p
      );
    });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, .ui-layer, .modal')) return;
    isDragging.current = true;
    startDragPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    if (activeTool === 'block') placeBlock(e);
    if (activeTool === 'character') placeCharacter(e);
    if (activeTool === 'eraser') eraseBlock(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    if (activeTool === 'pan') {
      const dx = e.clientX - startDragPos.current.x;
      const dy = e.clientY - startDragPos.current.y;
      setCameraOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      startDragPos.current = { x: e.clientX, y: e.clientY };
    } else if (activeTool === 'block') {
      placeBlock(e);
    } else if (activeTool === 'character') {
      placeCharacter(e);
    } else if (activeTool === 'eraser') {
      eraseBlock(e);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  // Map Functions
  const startRenamingProject = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingProjectId(project.id);
    setProjectRenameValue(project.name);
  };

  const saveRenameProject = (id: string) => {
    setProjects(projects.map(p => 
      p.id === id ? { ...p, name: projectRenameValue || 'Sin nombre' } : p
    ));
    setRenamingProjectId(null);
  };

  const handleKeyDownProject = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') saveRenameProject(id);
    if (e.key === 'Escape') setRenamingProjectId(null);
  };

  const handleAddMap = () => {
    if (!currentProject) return;
    const newMap: GameMap = {
      id: Date.now().toString(),
      name: `Nuevo Mapa ${currentProject.maps.length + 1}`,
      description: 'Sin descripción',
      backgroundColor: '#1e3a8a'
    };
    setProjects(projects.map(p => 
      p.id === currentProjectId 
        ? { ...p, maps: [...p.maps, newMap] } 
        : p
    ));
  };

  const handleDeleteMap = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentProject) return;
    setProjects(projects.map(p => 
      p.id === currentProjectId 
        ? { ...p, maps: p.maps.filter(m => m.id !== id) } 
        : p
    ));
  };

  const startRenamingMap = (map: GameMap, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingMapId(map.id);
    setRenameValue(map.name);
  };

  const saveRenameMap = (id: string) => {
    if (!currentProject) return;
    setProjects(projects.map(p => 
      p.id === currentProjectId 
        ? { ...p, maps: p.maps.map(m => m.id === id ? { ...m, name: renameValue || 'Sin nombre' } : m) } 
        : p
    ));
    setRenamingMapId(null);
  };

  const updateProjectName = (newName: string) => {
    if (!currentProject) return;
    setProjects(projects.map(p => 
      p.id === currentProjectId ? { ...p, name: newName } : p
    ));
  };

  const handleKeyDownMap = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') saveRenameMap(id);
    if (e.key === 'Escape') setRenamingMapId(null);
  };

  const openMapSettings = () => {
    if (!currentProject || !editingMapId) return;
    const map = currentProject.maps.find(m => m.id === editingMapId);
    if (map) {
      setMapSettingsForm({ name: map.name, backgroundColor: map.backgroundColor || '#1e3a8a' });
      setIsMapSettingsOpen(true);
    }
  };

  const saveMapSettings = () => {
    if (!currentProject || !editingMapId) return;
    setProjects(projects.map(p => 
      p.id === currentProjectId 
        ? { ...p, maps: p.maps.map(m => m.id === editingMapId ? { ...m, name: mapSettingsForm.name || 'Sin nombre', backgroundColor: mapSettingsForm.backgroundColor } : m) } 
        : p
    ));
    setIsMapSettingsOpen(false);
  };

  const cropModal = cropImageSrc && (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-[60] pointer-events-auto modal">
      <div className="bg-[#111] border border-[#333] rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col h-[500px]">
        <div className="p-4 border-b border-[#222] flex justify-between items-center bg-[#151515]">
          <h3 className="font-medium text-white tracking-wide">Recortar Icono</h3>
          <button 
            onClick={() => { setCropImageSrc(null); setCropProjectId(null); }} 
            className="text-gray-500 hover:text-white transition-colors p-1 rounded hover:bg-[#222]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 relative bg-[#080808]">
          <Cropper
            image={cropImageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
            classes={{ containerClassName: 'absolute inset-0' }}
          />
        </div>
        <div className="p-4 border-t border-[#222] bg-[#151515] flex flex-col gap-4">
          <input
            type="range"
            value={zoom}
            min={1}
            max={3}
            step={0.1}
            aria-labelledby="Zoom"
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-[#C9CEEC]"
          />
          <div className="flex justify-end gap-3">
            <button 
              onClick={() => { setCropImageSrc(null); setCropProjectId(null); }}
              className="px-4 py-2 text-gray-400 font-medium text-sm rounded hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={createCroppedImage}
              className="px-5 py-2 bg-[#C9CEEC] text-black font-medium text-sm rounded shadow-lg hover:brightness-110 active:scale-95 transition-all"
            >
              Recortar y Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // === RENDER EDITOR ===
  if (editingMapId && currentProject) {
    const map = currentProject.maps.find(m => m.id === editingMapId);
    return (
      <div className="relative w-full h-screen bg-[#080808] text-[#D4D4D4] font-sans overflow-hidden select-none">
        
        {/* Editor Canvas Area */}
        <div 
          className="absolute inset-0 overflow-hidden touch-none" 
          style={{ 
            backgroundColor: map?.backgroundColor || '#1e3a8a',
            cursor: activeTool === 'pan' ? (isDragging.current ? 'grabbing' : 'grab') : 'crosshair'
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* The Grid Background */}
          <div 
              className="absolute inset-0 pointer-events-none opacity-20"
              style={{
                  backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
                  backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
                  backgroundPosition: `${cameraOffset.x}px ${cameraOffset.y}px`
              }}
          />

          {/* Blocks container */}
          <div 
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
              style={{ transform: `translate(${cameraOffset.x}px, ${cameraOffset.y}px)` }}
          >
              {(map?.blocks || []).map(b => {
                  const blockDef = currentProject?.customBlocks?.find(ab => ab.id === b.blockId);
                  return blockDef ? (
                      <div 
                          key={`${b.x}-${b.y}`}
                          className="absolute pointer-events-none"
                          style={{
                              left: b.x * GRID_SIZE,
                              top: b.y * GRID_SIZE,
                              width: GRID_SIZE + 1,
                              height: GRID_SIZE + 1,
                              backgroundImage: blockDef.spriteId ? `url(${getSpriteDataUrl(blockDef.spriteId)})` : 'none',
                              backgroundSize: '100% 100%',
                              imageRendering: 'pixelated',
                              border: '1px solid rgba(0,0,0,0.1)'
                          }}
                      />
                  ) : null;
              })}
              {(map?.characters || []).map((c, idx) => {
                  const charDef = currentProject?.customCharacters?.find(ac => ac.id === c.characterId);
                  return charDef ? (
                      <div 
                          key={c.id || idx}
                          className="absolute pointer-events-none flex items-center justify-center z-10"
                          style={{
                              left: c.x * GRID_SIZE,
                              top: c.y * GRID_SIZE,
                              width: GRID_SIZE + 1,
                              height: GRID_SIZE + 1,
                              backgroundImage: charDef.spriteId ? `url(${getSpriteDataUrl(charDef.spriteId)})` : 'none',
                              backgroundSize: '100% 100%',
                              imageRendering: 'pixelated'
                          }}
                      >
                         {!charDef.spriteId && <div className="bg-red-500 w-3/4 h-3/4 rounded-full opacity-50" />}
                      </div>
                  ) : null;
              })}
          </div>
        </div>

        {/* UI FIJA SUPERPUESTA PARA EL EDITOR */}
        <div className="absolute top-6 left-6 flex items-center gap-3 ui-layer">
          <button 
            onClick={() => {
              setEditingMapId(null);
              setCurrentProjectId(null);
            }}
            className="flex items-center gap-2 p-3 bg-[#1a1a1a] text-gray-400 hover:text-white rounded-lg border border-[#333] transition-transform hover:scale-105 active:scale-95 shadow-lg hover:bg-[#222] pointer-events-auto"
            title="Inicio (Proyectos)"
          >
            <Home className="w-5 h-5" />
          </button>
          
          <button 
            onClick={() => setEditingMapId(null)}
            className="flex items-center gap-2 p-3 pr-4 bg-[#1a1a1a] text-gray-400 hover:text-white rounded-lg border border-[#333] transition-transform hover:scale-105 active:scale-95 shadow-lg hover:bg-[#222] pointer-events-auto"
            title="Volver a Mapas"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Volver a Mapas</span>
          </button>

          <div className="bg-[#1a1a1a]/80 backdrop-blur px-5 py-3 border border-[#333] rounded-lg shadow-lg text-sm font-medium tracking-wide">
            {currentProject.name} <span className="text-gray-600 mx-2">/</span> {map?.name}
          </div>
        </div>

        {/* Acciones Superiores Derechas */}
        <div className="absolute top-6 right-6 flex items-center gap-3 ui-layer">
          {activeTool === 'block' && (
             <div className="flex bg-[#1a1a1a] border border-[#333] rounded-lg p-1.5 shadow-lg pointer-events-auto items-center gap-3 mr-2">
                 <div className="flex items-center gap-2 px-2">
                     <span className="text-xs text-gray-400 uppercase tracking-widest hidden sm:inline">Bloque actual:</span>
                     {selectedBlockId && currentProject?.customBlocks?.find(b => b.id === selectedBlockId) ? (
                         <div 
                             className="w-5 h-5 rounded-sm shadow-inner" 
                             style={{ 
                                 backgroundImage: `url(${getSpriteDataUrl(currentProject.customBlocks.find(b => b.id === selectedBlockId)?.spriteId || null)})`,
                                 backgroundSize: 'cover',
                                 imageRendering: 'pixelated'
                             }} 
                         />
                     ) : (
                         <span className="text-xs text-rose-400">Ninguno</span>
                     )}
                 </div>
                 <button
                     onClick={() => setIsBlockSelectorOpen(true)}
                     className="bg-[#333] hover:bg-[#444] text-white px-3 py-1.5 rounded-md text-sm transition-colors"
                 >
                     Cambiar
                 </button>
             </div>
          )}

          {activeTool === 'character' && (
             <div className="flex bg-[#1a1a1a] border border-[#333] rounded-lg p-1.5 shadow-lg pointer-events-auto items-center gap-3 mr-2">
                 <div className="flex items-center gap-2 px-2">
                     <span className="text-xs text-gray-400 uppercase tracking-widest hidden sm:inline">Personaje:</span>
                     {selectedCharacterId && currentProject?.customCharacters?.find(c => c.id === selectedCharacterId) ? (
                         <div 
                             className="w-5 h-5 rounded-sm shadow-inner" 
                             style={{ 
                                 backgroundImage: `url(${getSpriteDataUrl(currentProject.customCharacters.find(c => c.id === selectedCharacterId)?.spriteId || null)})`,
                                 backgroundSize: 'cover',
                                 imageRendering: 'pixelated'
                             }} 
                         />
                     ) : (
                         <span className="text-xs text-rose-400">Ninguno</span>
                     )}
                 </div>
                 <button
                     onClick={() => { setIsAssetsManagerOpen(true); setActiveAssetCategory('characters'); }}
                     className="bg-[#333] hover:bg-[#444] text-white px-3 py-1.5 rounded-md text-sm transition-colors"
                 >
                     Elegir en Assets
                 </button>
             </div>
          )}

          <button 
            onClick={openMapSettings}
            className="p-3 bg-[#1a1a1a] text-gray-400 hover:text-white rounded-lg border border-[#333] transition-transform hover:scale-105 active:scale-95 shadow-lg hover:bg-[#222] pointer-events-auto"
            title="Configuración del Mapa"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        <button 
          onClick={() => setIsPlayingLevel(true)}
          className="absolute bottom-6 left-6 flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-black transition-transform hover:scale-105 active:scale-95 shadow-lg pointer-events-auto ui-layer"
          style={{ backgroundColor: '#C9CEEC' }}
        >
          <Play className="w-4 h-4 fill-current" />
          Probar Nivel
        </button>

        {isPlayingLevel && (
           <PlayMode 
              map={map}
              customBlocks={currentProject.customBlocks || []}
              customSprites={currentProject.customSprites || []}
              customCharacters={currentProject.customCharacters || []}
              onExit={() => setIsPlayingLevel(false)}
           />
        )}

        {/* Herramientas (Abajo a la derecha) */}
        <div className="absolute bottom-6 right-6 flex flex-col gap-3 ui-layer">
            <button
                onClick={() => handleToolSelect('pan')}
                className={`p-4 rounded-xl shadow-lg transition-transform hover:scale-105 active:scale-95 pointer-events-auto flex items-center justify-center border ${activeTool === 'pan' ? 'bg-[#C9CEEC] text-black border-[#C9CEEC]' : 'bg-[#1a1a1a] text-gray-400 border-[#333] hover:text-white hover:bg-[#222]'}`}
                title="Moverse por el mapa"
            >
                <Hand className="w-6 h-6" />
            </button>
            <button
                onClick={() => handleToolSelect('block')}
                className={`p-4 rounded-xl shadow-lg transition-transform hover:scale-105 active:scale-95 pointer-events-auto flex items-center justify-center border ${activeTool === 'block' ? 'bg-[#C9CEEC] text-black border-[#C9CEEC]' : 'bg-[#1a1a1a] text-gray-400 border-[#333] hover:text-white hover:bg-[#222]'}`}
                title="Añadir bloques"
            >
                <Square className="w-6 h-6" />
            </button>
            <button
                onClick={() => handleToolSelect('character')}
                className={`p-4 rounded-xl shadow-lg transition-transform hover:scale-105 active:scale-95 pointer-events-auto flex items-center justify-center border ${activeTool === 'character' ? 'bg-[#C9CEEC] text-black border-[#C9CEEC]' : 'bg-[#1a1a1a] text-gray-400 border-[#333] hover:text-white hover:bg-[#222]'}`}
                title="Añadir personajes"
            >
                <div className="w-6 h-6 flex items-center justify-center -mt-1"><Package className="w-5 h-5"/></div>
            </button>
            <button
                onClick={() => handleToolSelect('eraser')}
                className={`p-4 rounded-xl shadow-lg transition-transform hover:scale-105 active:scale-95 pointer-events-auto flex items-center justify-center border ${activeTool === 'eraser' ? 'bg-[#C9CEEC] text-black border-[#C9CEEC]' : 'bg-[#1a1a1a] text-gray-400 border-[#333] hover:text-white hover:bg-[#222]'}`}
                title="Borrador"
            >
                <Eraser className="w-6 h-6" />
            </button>
            <button
                onClick={() => setIsAssetsManagerOpen(true)}
                className={`p-4 rounded-xl shadow-lg transition-transform hover:scale-105 active:scale-95 pointer-events-auto flex items-center justify-center border bg-[#1a1a1a] text-gray-400 border-[#333] hover:text-white hover:bg-[#222]`}
                title="Gestor de Assets / Objetos"
            >
                <Package className="w-6 h-6" />
            </button>
        </div>

        {/* Modal Selector de Bloques */}
        {isBlockSelectorOpen && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto modal">
            <div className="bg-[#111] border border-[#333] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b border-[#222] flex justify-between items-center bg-[#151515]">
                <h3 className="font-medium text-white tracking-wide">Seleccionar Bloque</h3>
                <button 
                  onClick={() => setIsBlockSelectorOpen(false)} 
                  className="text-gray-500 hover:text-white transition-colors p-1 rounded hover:bg-[#222]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 grid grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto">
                  {(currentProject?.customBlocks || []).length === 0 ? (
                      <div className="col-span-4 text-center py-4 text-gray-500 text-sm">
                          No has creado bloques. Puedes crearlos en el Gestor de Assets.
                      </div>
                  ) : (
                      (currentProject?.customBlocks || []).map(block => (
                          <button
                              key={block.id}
                              onClick={() => {
                                  setSelectedBlockId(block.id);
                                  setIsBlockSelectorOpen(false);
                              }}
                              className={`flex flex-col items-center gap-2 p-2 rounded-lg border-2 transition-all ${selectedBlockId === block.id ? 'border-[#C9CEEC] bg-[#222]' : 'border-transparent hover:bg-[#1a1a1a]'}`}
                              title={block.name}
                          >
                              <div className="w-12 h-12 rounded-md shadow-sm border border-white/10" style={{ backgroundImage: `url(${getSpriteDataUrl(block.spriteId)})`, backgroundSize: 'cover', imageRendering: 'pixelated' }} />
                              <span className="text-[10px] uppercase tracking-wider text-gray-400 text-center truncate w-full">{block.name}</span>
                          </button>
                      ))
                  )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Configuración del Mapa */}
        {isMapSettingsOpen && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto modal">
            <div className="bg-[#111] border border-[#333] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col transform transition-all scale-100 opacity-100">
              <div className="p-4 border-b border-[#222] flex justify-between items-center bg-[#151515]">
                <h3 className="font-medium text-white tracking-wide flex items-center gap-2">
                  <MapIcon className="w-4 h-4" />
                  Configuración del Mapa
                </h3>
                <button 
                  onClick={() => setIsMapSettingsOpen(false)} 
                  className="text-gray-500 hover:text-white transition-colors p-1 rounded hover:bg-[#222]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] uppercase tracking-widest text-gray-500">Nombre del Mapa</label>
                  <input 
                    type="text" 
                    value={mapSettingsForm.name}
                    onChange={(e) => setMapSettingsForm({ ...mapSettingsForm, name: e.target.value })}
                    className="bg-[#1a1a1a] border border-[#333] text-white px-4 py-2.5 rounded text-sm focus:outline-none focus:border-[#C9CEEC] transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] uppercase tracking-widest text-gray-500 flex items-center gap-1">
                    <Palette className="w-3 h-3" />
                    Color de Fondo
                  </label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="color" 
                      value={mapSettingsForm.backgroundColor}
                      onChange={(e) => setMapSettingsForm({ ...mapSettingsForm, backgroundColor: e.target.value })}
                      className="w-10 h-10 rounded cursor-pointer bg-transparent border-0 p-0"
                    />
                    <span className="text-sm text-gray-400 uppercase">{mapSettingsForm.backgroundColor}</span>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-[#222] bg-[#151515] flex justify-end gap-3">
                <button 
                  onClick={() => setIsMapSettingsOpen(false)}
                  className="px-4 py-2 text-gray-400 font-medium text-sm rounded hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={saveMapSettings}
                  className="px-5 py-2 bg-[#C9CEEC] text-black font-medium text-sm rounded shadow-lg hover:brightness-110 active:scale-95 transition-all"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Gestor de Assets / Objetos */}
        {isAssetsManagerOpen && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto modal">
            <div className="bg-[#111] border border-[#333] rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex h-[80vh] flex-col">
              <div className="p-4 border-b border-[#222] flex justify-between items-center bg-[#151515]">
                <h3 className="font-medium text-white tracking-wide flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Gestor de Assets
                </h3>
                <button 
                  onClick={() => setIsAssetsManagerOpen(false)} 
                  className="text-gray-500 hover:text-white transition-colors p-1 rounded hover:bg-[#222]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex flex-1 overflow-hidden">
                <div className="w-48 bg-[#151515] border-r border-[#222] flex flex-col p-2 gap-1">
                  <button 
                    onClick={() => setActiveAssetCategory('blocks')}
                    className={`text-left px-4 py-2 rounded text-sm font-medium transition-colors ${activeAssetCategory === 'blocks' ? 'bg-[#333] text-white' : 'text-gray-400 hover:bg-[#222] hover:text-gray-200'}`}
                  >
                    Bloques
                  </button>
                  <button 
                    onClick={() => setActiveAssetCategory('sprites')}
                    className={`text-left px-4 py-2 rounded text-sm font-medium transition-colors ${activeAssetCategory === 'sprites' ? 'bg-[#333] text-white' : 'text-gray-400 hover:bg-[#222] hover:text-gray-200'}`}
                  >
                    Sprites
                  </button>
                  <button 
                    onClick={() => setActiveAssetCategory('characters')}
                    className={`text-left px-4 py-2 rounded text-sm font-medium transition-colors ${activeAssetCategory === 'characters' ? 'bg-[#333] text-white' : 'text-gray-400 hover:bg-[#222] hover:text-gray-200'}`}
                  >
                    Personajes
                  </button>
                  <button 
                    onClick={() => setActiveAssetCategory('props')}
                    className={`text-left px-4 py-2 rounded text-sm font-medium transition-colors ${activeAssetCategory === 'props' ? 'bg-[#333] text-white' : 'text-gray-400 hover:bg-[#222] hover:text-gray-200'}`}
                  >
                    Props
                  </button>
                  <button 
                    onClick={() => setActiveAssetCategory('objects')}
                    className={`text-left px-4 py-2 rounded text-sm font-medium transition-colors ${activeAssetCategory === 'objects' ? 'bg-[#333] text-white' : 'text-gray-400 hover:bg-[#222] hover:text-gray-200'}`}
                  >
                    Objetos (Armas/Usables)
                  </button>
                </div>
                <div className="flex-1 bg-[#111] p-6 overflow-y-auto">
                  {activeAssetCategory === 'blocks' && (
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-white font-medium">Tus Bloques Personalizados</h4>
                        <button 
                          onClick={() => openBlockEditor()}
                          className="flex items-center gap-2 px-3 py-1.5 bg-[#C9CEEC] text-[#080808] text-sm font-medium rounded hover:brightness-110 transition-all shadow-lg active:scale-95"
                        >
                          <Plus className="w-4 h-4" />
                          Nuevo Bloque
                        </button>
                      </div>
                      <p className="text-sm text-gray-500 mb-6">Los bloques son elementos que se ajustan a la cuadrícula del mapa (Grid).</p>
                      
                      {(currentProject?.customBlocks || []).length === 0 ? (
                        <div className="text-center py-10 opacity-50 flex flex-col items-center border border-dashed border-[#333] rounded-xl p-8">
                          <Square className="w-12 h-12 text-gray-600 mb-3" />
                          <p className="text-gray-400 font-medium">No hay bloques aún</p>
                          <p className="text-sm text-gray-500 mt-1 max-w-xs">Crea tu primer bloque de terreno para empezar a construir tus mapas.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-4">
                          {(currentProject?.customBlocks || []).map(block => (
                            <div key={block.id} className="group relative flex flex-col items-center gap-2 p-3 bg-[#1a1a1a] rounded-lg border border-[#222] hover:border-[#C9CEEC] transition-colors cursor-pointer" onClick={() => openBlockEditor(block)}>
                              <div className="w-16 h-16 rounded shadow-sm overflow-hidden" style={{ backgroundImage: `url(${getSpriteDataUrl(block.spriteId)})`, backgroundSize: 'cover', imageRendering: 'pixelated' }} />
                              <span className="text-xs uppercase tracking-wider text-gray-400 text-center truncate w-full">{block.name}</span>
                              <button 
                                onClick={(e) => { e.stopPropagation(); deleteCustomBlock(block.id); }}
                                className="absolute -top-2 -right-2 p-1.5 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all hover:scale-110 shadow-lg"
                                title="Eliminar bloque"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {activeAssetCategory === 'sprites' && (
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-white font-medium">Gestor de Sprites</h4>
                        <button 
                          onClick={() => openSpriteEditor('sprite')}
                          className="flex items-center gap-2 px-3 py-1.5 bg-[#C9CEEC] text-[#080808] text-sm font-medium rounded hover:brightness-110 transition-all shadow-lg active:scale-95"
                        >
                          <Plus className="w-4 h-4" />
                          Nuevo Sprite
                        </button>
                      </div>
                      <p className="text-sm text-gray-500 mb-6">Diseña texturas sueltas que luego podrás usar para personajes o props.</p>
                      
                      {(currentProject?.customSprites || []).length === 0 ? (
                        <div className="text-center py-10 opacity-50 flex flex-col items-center border border-dashed border-[#333] rounded-xl p-8">
                          <Palette className="w-12 h-12 text-gray-600 mb-3" />
                          <p className="text-gray-400 font-medium">No hay sprites aún</p>
                          <p className="text-sm text-gray-500 mt-1 max-w-xs">Empieza a dibujar texturas independientes.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-4">
                          {(currentProject?.customSprites || []).map(sprite => (
                            <div key={sprite.id} className="group relative flex flex-col items-center gap-2 p-3 bg-[#1a1a1a] rounded-lg border border-[#222] hover:border-[#C9CEEC] transition-colors cursor-pointer" onClick={() => openSpriteEditor('sprite', sprite)}>
                              <div className="w-16 h-16 rounded shadow-sm overflow-hidden" style={{ backgroundImage: `url(${sprite.dataUrl})`, backgroundSize: 'cover', imageRendering: 'pixelated' }} />
                              <span className="text-xs uppercase tracking-wider text-gray-400 text-center truncate w-full">{sprite.name}</span>
                              <button 
                                onClick={(e) => { e.stopPropagation(); deleteCustomSprite(sprite.id); }}
                                className="absolute -top-2 -right-2 p-1.5 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all hover:scale-110 shadow-lg"
                                title="Eliminar sprite"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {activeAssetCategory === 'characters' && (
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-white font-medium">Personajes</h4>
                        <button 
                          onClick={() => openCharacterEditor()}
                          className="flex items-center gap-2 px-3 py-1.5 bg-[#C9CEEC] text-[#080808] text-sm font-medium rounded hover:brightness-110 transition-all shadow-lg active:scale-95"
                        >
                          <Plus className="w-4 h-4" />
                          Nuevo Personaje
                        </button>
                      </div>
                      <p className="text-sm text-gray-500 mb-6">Los personajes son controlados por el jugador o tienen comportamientos.</p>
                      
                      {(currentProject?.customCharacters || []).length === 0 ? (
                        <div className="text-center py-10 opacity-50 flex flex-col items-center border border-dashed border-[#333] rounded-xl p-8">
                          <Package className="w-12 h-12 text-gray-600 mb-3" />
                          <p className="text-gray-400 font-medium">No hay personajes aún</p>
                          <p className="text-sm text-gray-500 mt-1 max-w-xs">Crea tu primer personaje.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-4">
                          {(currentProject?.customCharacters || []).map(char => (
                            <div key={char.id} className="group relative flex flex-col items-center gap-2 p-3 bg-[#1a1a1a] rounded-lg border border-[#222] hover:border-[#C9CEEC] transition-colors cursor-pointer" onClick={() => openCharacterEditor(char)}>
                              <div className="w-16 h-16 rounded shadow-sm overflow-hidden flex items-center justify-center bg-[#111] relative" style={{ backgroundImage: char.spriteId ? `url(${getSpriteDataUrl(char.spriteId)})` : 'none', backgroundSize: 'cover', imageRendering: 'pixelated' }}>
                                {!char.spriteId && <span className="text-[10px] text-gray-600">Sin Sprite</span>}
                                {activeTool === 'character' && (
                                  <button
                                     onClick={(e) => { e.stopPropagation(); setSelectedCharacterId(char.id); setIsAssetsManagerOpen(false); }}
                                     className="absolute inset-0 bg-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold text-[#C9CEEC] uppercase"
                                  >
                                     Elegir
                                  </button>
                                )}
                              </div>
                              <span className="text-xs uppercase tracking-wider text-gray-400 text-center truncate w-full">{char.name}</span>
                              <button 
                                onClick={(e) => { e.stopPropagation(); deleteCustomCharacter(char.id); }}
                                className="absolute -top-2 -right-2 p-1.5 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all hover:scale-110 shadow-lg"
                                title="Eliminar personaje"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {activeAssetCategory === 'props' && (
                    <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
                      <Package className="w-16 h-16 text-gray-600 mb-4" />
                      <p className="text-gray-400">Próximamente: Añadir y gestionar Props.</p>
                      <p className="text-sm text-gray-500 mt-2 max-w-sm">Los props son elementos del escenario que no se pegan a la cuadrícula y pueden tener físicas o ser recolectables.</p>
                    </div>
                  )}
                  {activeAssetCategory === 'objects' && (
                    <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
                      <Package className="w-16 h-16 text-gray-600 mb-4" />
                      <p className="text-gray-400">Próximamente: Añadir y gestionar Objetos Mágicos y Armas.</p>
                      <p className="text-sm text-gray-500 mt-2 max-w-sm">Items que los personajes pueden usar, equipar o soltar libremente por el mundo.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Editor de Sprites */}
        {isSpriteEditorOpen && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[70] pointer-events-auto modal">
            <div className="bg-[#111] border border-[#333] rounded-xl shadow-2xl overflow-hidden flex flex-col w-[800px] h-[600px]">
              <div className="p-4 border-b border-[#222] flex justify-between items-center bg-[#151515]">
                <div className="flex items-center gap-4">
                  <h3 className="font-medium text-white tracking-wide">Editor de Sprites</h3>
                  <input 
                    type="text" 
                    value={spriteForm.name}
                    onChange={(e) => setSpriteForm({ ...spriteForm, name: e.target.value })}
                    className="bg-[#1a1a1a] border border-[#333] text-white px-3 py-1 text-sm rounded focus:outline-none focus:border-[#C9CEEC] transition-colors w-48"
                    placeholder="Nombre del Bloque"
                  />
                </div>
                <button 
                  onClick={() => setIsSpriteEditorOpen(false)} 
                  className="text-gray-500 hover:text-white transition-colors p-1 rounded hover:bg-[#222]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex flex-1 p-6 gap-6 bg-[#0a0a0a] overflow-hidden">
                {/* Herramientas */}
                <div className="flex flex-col gap-4 w-16 bg-[#151515] p-2 rounded-xl border border-[#222]">
                  <button
                    onClick={() => setSpriteTool('pencil')}
                    className={`p-3 rounded-lg flex items-center justify-center transition-all ${spriteTool === 'pencil' ? 'bg-[#C9CEEC] text-black shadow-md' : 'text-gray-400 hover:text-white hover:bg-[#222]'}`}
                    title="Lápiz"
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setSpriteTool('eraser')}
                    className={`p-3 rounded-lg flex items-center justify-center transition-all ${spriteTool === 'eraser' ? 'bg-[#C9CEEC] text-black shadow-md' : 'text-gray-400 hover:text-white hover:bg-[#222]'}`}
                    title="Borrador"
                  >
                    <Eraser className="w-5 h-5" />
                  </button>
                  <div className="flex justify-center mt-2">
                    <input 
                      type="color" 
                      value={spriteColor}
                      onChange={(e) => { setSpriteColor(e.target.value); setSpriteTool('pencil'); }}
                      className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
                      title="Color"
                    />
                  </div>
                </div>

                {/* Lienzo */}
                <div className="flex-1 flex flex-col items-center justify-center bg-[#050505] rounded-xl border border-[#222] overflow-hidden p-4 sm:p-8 shadow-inner">
                  <div 
                    className="grid bg-[#1a1a1a] aspect-square w-full max-w-[320px] sm:max-w-[400px]"
                    style={{ gridTemplateColumns: 'repeat(16, 1fr)', gridTemplateRows: 'repeat(16, 1fr)' }}
                  >
                    {spriteForm.pixels.map((color, i) => (
                      <div
                        key={i}
                        onPointerDown={(e) => handleSpritePointerDown(i, e)}
                        onPointerEnter={() => handleSpritePointerEnter(i)}
                        className="border-[0.5px] border-white/5 cursor-crosshair touch-none transition-colors duration-75"
                        style={{ backgroundColor: color || 'transparent' }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-[#222] bg-[#151515] flex justify-end gap-3">
                <button 
                  onClick={() => setIsSpriteEditorOpen(false)}
                  className="px-4 py-2 text-gray-400 font-medium text-sm rounded hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={saveSprite}
                  disabled={!spriteForm.name.trim()}
                  className="px-5 py-2 bg-[#C9CEEC] text-black font-medium text-sm rounded shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Editor de Bloques */}
        {isBlockEditorOpen && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[70] pointer-events-auto modal">
            <div className="bg-[#111] border border-[#333] rounded-xl shadow-2xl overflow-hidden flex flex-col w-[600px] h-[550px]">
              <div className="p-4 border-b border-[#222] flex justify-between items-center bg-[#151515]">
                <h3 className="font-medium text-white tracking-wide">Propiedades del Bloque</h3>
                <button onClick={() => setIsBlockEditorOpen(false)} className="text-gray-500 hover:text-white transition-colors p-1 rounded hover:bg-[#222]"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 p-6 overflow-y-auto flex gap-6">
                <div className="flex-1 flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-gray-400">Nombre</label>
                    <input type="text" value={blockForm.name} onChange={(e) => setBlockForm({ ...blockForm, name: e.target.value })} className="bg-[#1a1a1a] border border-[#333] text-white px-3 py-2 text-sm rounded focus:outline-none focus:border-[#C9CEEC]" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-gray-400">Descripción</label>
                    <textarea value={blockForm.description} onChange={(e) => setBlockForm({ ...blockForm, description: e.target.value })} className="bg-[#1a1a1a] border border-[#333] text-white text-sm px-3 py-2 rounded focus:outline-none focus:border-[#C9CEEC] resize-none h-20" placeholder="Info adicional..." />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input type="checkbox" id="isPassableBlock" checked={blockForm.isPassable} onChange={(e) => setBlockForm({ ...blockForm, isPassable: e.target.checked })} className="w-4 h-4 accent-[#C9CEEC]" />
                    <label htmlFor="isPassableBlock" className="text-sm text-gray-300">¿Es traspasable?</label>
                  </div>
                  {blockForm.isPassable && (
                    <div className="flex flex-col gap-2 p-3 bg-[#111] rounded border border-[#333]">
                      <p className="text-xs text-gray-400 mb-1">Caras traspasables:</p>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-300 px-2 pl-4">
                        <label className="flex items-center gap-2"><input type="checkbox" checked={blockForm.passableDirections?.top} onChange={(e) => setBlockForm({ ...blockForm, passableDirections: { ...blockForm.passableDirections!, top: e.target.checked } })} className="accent-[#C9CEEC]" /> Arriba</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={blockForm.passableDirections?.bottom} onChange={(e) => setBlockForm({ ...blockForm, passableDirections: { ...blockForm.passableDirections!, bottom: e.target.checked } })} className="accent-[#C9CEEC]" /> Abajo</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={blockForm.passableDirections?.left} onChange={(e) => setBlockForm({ ...blockForm, passableDirections: { ...blockForm.passableDirections!, left: e.target.checked } })} className="accent-[#C9CEEC]" /> Izquierda</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={blockForm.passableDirections?.right} onChange={(e) => setBlockForm({ ...blockForm, passableDirections: { ...blockForm.passableDirections!, right: e.target.checked } })} className="accent-[#C9CEEC]" /> Derecha</label>
                      </div>
                    </div>
                  )}
                </div>
                <div className="w-64 flex flex-col gap-4 border-l border-[#222] pl-6">
                  <label className="text-xs text-gray-400">Sprite del Bloque</label>
                  <div className="w-full aspect-square bg-[#1a1a1a] rounded-xl border border-[#333] flex items-center justify-center relative overflow-hidden group">
                    {blockForm.spriteId ? (
                      <div className="w-24 h-24 bg-white/5 shadow-sm overflow-hidden" style={{ backgroundImage: `url(${getSpriteDataUrl(blockForm.spriteId)})`, backgroundSize: 'cover', imageRendering: 'pixelated' }} />
                    ) : (
                      <div className="text-center text-gray-600 flex flex-col items-center">
                        <Palette className="w-10 h-10 mb-2 opacity-50" />
                        <span className="text-xs uppercase tracking-widest font-medium">Sin Sprite</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                       <button onClick={() => {
                          setSpriteSelectionCallback({ onSelect: (id) => setBlockForm({ ...blockForm, spriteId: id }) });
                          setIsSpriteSelectorOpen(true);
                       }} className="text-xs bg-[#222] hover:bg-[#333] text-white px-3 py-1.5 rounded transition">Seleccionar</button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-[#222] bg-[#151515] flex justify-end gap-3">
                <button onClick={() => setIsBlockEditorOpen(false)} className="px-4 py-2 text-gray-400 font-medium text-sm rounded hover:text-white transition-colors">Cancelar</button>
                <button onClick={saveBlock} disabled={!blockForm.name.trim()} className="px-5 py-2 bg-[#C9CEEC] text-black font-medium text-sm rounded shadow-lg hover:brightness-110 active:scale-95 transition-all">Guardar Bloque</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Editor de Personajes */}
        {isCharacterEditorOpen && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[70] pointer-events-auto modal">
            <div className="bg-[#111] border border-[#333] rounded-xl shadow-2xl overflow-hidden flex flex-col w-[600px] h-[450px]">
              <div className="p-4 border-b border-[#222] flex justify-between items-center bg-[#151515]">
                <h3 className="font-medium text-white tracking-wide">Propiedades del Personaje</h3>
                <button onClick={() => setIsCharacterEditorOpen(false)} className="text-gray-500 hover:text-white transition-colors p-1 rounded hover:bg-[#222]"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 p-6 overflow-y-auto flex gap-6">
                <div className="flex-1 flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-gray-400">Nombre</label>
                    <input type="text" value={characterForm.name} onChange={(e) => setCharacterForm({ ...characterForm, name: e.target.value })} className="bg-[#1a1a1a] border border-[#333] text-white px-3 py-2 text-sm rounded focus:outline-none focus:border-[#C9CEEC]" />
                  </div>
                  <div className="flex flex-col gap-1.5 mt-2">
                    <label className="text-xs text-gray-400">Descripción</label>
                    <textarea value={characterForm.description || ''} onChange={(e) => setCharacterForm({ ...characterForm, description: e.target.value })} className="bg-[#1a1a1a] border border-[#333] text-white text-sm px-3 py-2 rounded focus:outline-none focus:border-[#C9CEEC] resize-none h-16" placeholder="Info del personaje..." />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input type="checkbox" id="isPlayableChar" checked={characterForm.isPlayable} onChange={(e) => setCharacterForm({ ...characterForm, isPlayable: e.target.checked })} className="w-4 h-4 accent-[#C9CEEC]" />
                    <label htmlFor="isPlayableChar" className="text-sm text-gray-300">¿Controlable por el jugador?</label>
                  </div>
                  <div className="flex flex-col gap-1.5 mt-2">
                    <label className="text-xs text-gray-400">Tipo de Movimiento</label>
                    <select value={characterForm.movementType} onChange={(e) => setCharacterForm({ ...characterForm, movementType: e.target.value as 'platformer' | 'rpg' })} className="bg-[#1a1a1a] border border-[#333] text-white text-sm px-3 py-2 rounded focus:outline-none focus:border-[#C9CEEC] outline-none">
                      <option value="platformer">Plataformas (2D Side-scroller)</option>
                      <option value="rpg">RPG (Vista Superior)</option>
                    </select>
                  </div>
                </div>
                <div className="w-64 flex flex-col gap-4 border-l border-[#222] pl-6">
                  <label className="text-xs text-gray-400">Sprite</label>
                  <div className="w-full aspect-square bg-[#1a1a1a] rounded-xl border border-[#333] flex items-center justify-center relative overflow-hidden group">
                    {characterForm.spriteId ? (
                      <div className="w-24 h-24 bg-white/5 shadow-sm overflow-hidden" style={{ backgroundImage: `url(${getSpriteDataUrl(characterForm.spriteId)})`, backgroundSize: 'cover', imageRendering: 'pixelated' }} />
                    ) : (
                      <div className="text-center text-gray-600 flex flex-col items-center">
                        <Palette className="w-10 h-10 mb-2 opacity-50" />
                        <span className="text-xs uppercase tracking-widest font-medium">Sin Sprite</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                       <button onClick={() => {
                          setSpriteSelectionCallback({ onSelect: (id) => setCharacterForm({ ...characterForm, spriteId: id }) });
                          setIsSpriteSelectorOpen(true);
                       }} className="text-xs bg-[#222] hover:bg-[#333] text-white px-3 py-1.5 rounded transition">Seleccionar</button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-[#222] bg-[#151515] flex justify-end gap-3">
                <button onClick={() => setIsCharacterEditorOpen(false)} className="px-4 py-2 text-gray-400 font-medium text-sm rounded hover:text-white transition-colors">Cancelar</button>
                <button onClick={saveCharacter} disabled={!characterForm.name.trim()} className="px-5 py-2 bg-[#C9CEEC] text-black font-medium text-sm rounded shadow-lg hover:brightness-110 active:scale-95 transition-all">Guardar Personaje</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Selector de Sprite */}
        {isSpriteSelectorOpen && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur flex items-center justify-center z-[80] pointer-events-auto modal">
            <div className="bg-[#111] border border-[#333] rounded-xl shadow-2xl flex flex-col w-[600px] h-[500px]">
              <div className="p-4 border-b border-[#222] flex justify-between items-center bg-[#151515]">
                <h3 className="font-medium text-white">Selecciona o Dibuja un Sprite</h3>
                <button onClick={() => setIsSpriteSelectorOpen(false)} className="text-gray-500 hover:text-white transition-colors p-1 rounded hover:bg-[#222]"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 p-6 overflow-y-auto">
                {(currentProject?.customSprites || []).length === 0 ? (
                   <div className="text-center py-10 opacity-50 flex flex-col items-center">
                     <Palette className="w-12 h-12 text-gray-600 mb-3" />
                     <p className="text-gray-400 font-medium">No hay sprites disponibles</p>
                   </div>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
                    {(currentProject?.customSprites || []).map(sprite => (
                      <div key={sprite.id} className="group relative flex flex-col items-center gap-2 p-3 bg-[#1a1a1a] rounded-lg border border-[#333] hover:border-[#C9CEEC] transition-colors cursor-pointer" onClick={() => {
                         if (spriteSelectionCallback) spriteSelectionCallback.onSelect(sprite.id);
                         setIsSpriteSelectorOpen(false);
                      }}>
                        <div className="w-12 h-12 rounded shadow-sm overflow-hidden" style={{ backgroundImage: `url(${sprite.dataUrl})`, backgroundSize: 'cover', imageRendering: 'pixelated' }} />
                        <span className="text-[10px] uppercase tracking-wider text-gray-400 text-center truncate w-full">{sprite.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-[#222] bg-[#151515] flex justify-center gap-3">
                 <button onClick={() => {
                    // Open sprite editor directly. We can't immediately bind it without it being saved first,
                    // but since the user creates it, they can select it next time. 
                    // Actually, modifying `spriteForm.id` and tracking might be complex, so let's just create one.
                    setIsSpriteSelectorOpen(false);
                    openSpriteEditor('sprite');
                 }} className="flex items-center gap-2 px-4 py-2 bg-[#222] text-white text-sm font-medium rounded hover:bg-[#333] transition-all">
                    <PenSquare className="w-4 h-4" />
                    Dibujar Nuevo Sprite
                 </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // === RENDER PROJECT LIST ===
  if (!currentProjectId) {
    return (
      <div className="relative w-full h-screen bg-[#080808] text-[#D4D4D4] font-sans flex flex-col overflow-hidden select-none">
        <div className="flex-1 overflow-y-auto px-6 py-28 max-w-4xl mx-auto w-full">
          <div className="mb-10 text-center sm:text-left">
            <h2 className="text-3xl font-serif italic text-white mb-2">Tus Proyectos</h2>
            <p className="text-sm text-gray-500 uppercase tracking-widest">Gestiona tus juegos</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {projects.map(project => (
              <div 
                key={project.id}
                onClick={() => setCurrentProjectId(project.id)}
                className="group p-6 bg-[#111] border border-[#222] hover:border-[#444] rounded-2xl transition-all hover:bg-[#151515] hover:shadow-lg hover:-translate-y-1 cursor-pointer flex flex-col"
              >
                <div 
                  className="w-16 h-16 bg-[#1a1a1a] rounded-xl border border-[#333] flex items-center justify-center text-[#C9CEEC] transition-transform mb-4 relative overflow-hidden group/icon"
                >
                  {project.icon ? (
                    <img src={project.icon} alt={project.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                  ) : (
                    <Folder className="w-8 h-8 group-hover:scale-110 transition-transform" />
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/icon:opacity-100 flex flex-col gap-1 items-center justify-center transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); document.getElementById(`upload-icon-${project.id}`)?.click(); }} className="text-[10px] text-white font-medium uppercase tracking-widest text-center hover:text-[#C9CEEC]">Subir</button>
                    <button onClick={(e) => { e.stopPropagation(); openSpriteEditor('project_icon', undefined, project.id); }} className="text-[10px] text-white font-medium uppercase tracking-widest text-center hover:text-[#C9CEEC]">Dibujar</button>
                  </div>
                  <input 
                    id={`upload-icon-${project.id}`}
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={(e) => handleIconUpload(project.id, e)}
                  />
                </div>
                {renamingProjectId === project.id ? (
                  <input 
                    type="text"
                    value={projectRenameValue}
                    onChange={(e) => setProjectRenameValue(e.target.value)}
                    onBlur={() => saveRenameProject(project.id)}
                    onKeyDown={(e) => handleKeyDownProject(e, project.id)}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    className="text-lg font-medium bg-[#1a1a1a] border border-[#C9CEEC] text-white px-2 py-0.5 rounded focus:outline-none w-full max-w-full mb-1"
                  />
                ) : (
                  <h3 className="text-lg font-medium text-white mb-1 group-hover:text-[#C9CEEC] transition-colors line-clamp-1">{project.name}</h3>
                )}
                <p className="text-sm text-gray-500 mb-6">{project.maps.length} mapas</p>
                
                <div className="mt-auto flex items-center justify-between pt-4 border-t border-[#222]">
                  <span className="text-xs font-medium text-gray-400 group-hover:text-white transition-colors">Abrir proyecto</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => startRenamingProject(project, e)}
                      className="p-2 text-gray-400 hover:text-white hover:bg-[#222] rounded-lg transition-colors"
                      title="Renombrar proyecto"
                    >
                      <PenSquare className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => handleDeleteProject(project.id, e)}
                      className="p-2 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Eliminar proyecto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <div 
              onClick={() => setIsNewProjectModalOpen(true)}
              className="group p-6 border-2 border-dashed border-[#222] hover:border-[#444] rounded-2xl transition-all hover:bg-[#111] cursor-pointer flex flex-col items-center justify-center text-center h-[240px]"
            >
              <div className="w-16 h-16 bg-[#1a1a1a] rounded-xl border border-[#333] flex items-center justify-center text-gray-400 group-hover:text-[#C9CEEC] group-hover:scale-110 transition-all mb-4">
                <Plus className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-medium text-gray-400 group-hover:text-white transition-colors">Nuevo Proyecto</h3>
            </div>
          </div>
        </div>

        {/* Modal Nuevo Proyecto */}
        {isNewProjectModalOpen && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto modal">
            <div className="bg-[#111] border border-[#333] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col transform transition-all scale-100 opacity-100">
              <div className="p-4 border-b border-[#222] flex justify-between items-center bg-[#151515]">
                <h3 className="font-medium text-white tracking-wide">Crear Proyecto</h3>
                <button 
                  onClick={() => setIsNewProjectModalOpen(false)} 
                  className="text-gray-500 hover:text-white transition-colors p-1 rounded hover:bg-[#222]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] uppercase tracking-widest text-gray-500">Nombre del Juego</label>
                  <input 
                    type="text" 
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateProject(); }}
                    className="bg-[#1a1a1a] border border-[#333] text-white px-4 py-2.5 rounded text-sm focus:outline-none focus:border-[#C9CEEC] transition-colors"
                    placeholder="Ej. Mi Super Juego"
                    autoFocus
                  />
                </div>
              </div>
              <div className="p-4 border-t border-[#222] bg-[#151515] flex justify-end gap-3">
                <button 
                  onClick={() => setIsNewProjectModalOpen(false)}
                  className="px-4 py-2 text-gray-400 font-medium text-sm rounded hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleCreateProject}
                  disabled={!newProjectName.trim()}
                  className="px-5 py-2 bg-[#C9CEEC] text-black font-medium text-sm rounded shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Crear
                </button>
              </div>
            </div>
          </div>
        )}
        {cropModal}
      </div>
    );
  }

  // === RENDER MAPS LIST (Inside a Project) ===
  return (
    <div className="relative w-full h-screen bg-[#080808] text-[#D4D4D4] font-sans flex flex-col overflow-hidden select-none">
      
      {/* Contenido Principal: Lista de Mapas */}
      <div className="flex-1 overflow-y-auto px-6 py-28 max-w-4xl mx-auto w-full">
        <div className="mb-10 flex flex-col gap-2 text-center sm:text-left">
          <h2 className="text-3xl font-serif italic text-white line-clamp-1">{currentProject?.name} - Mapas</h2>
          <p className="text-sm text-gray-500 uppercase tracking-widest">Gestiona los niveles y escenas</p>
        </div>

        <div className="flex flex-col gap-4">
          {!currentProject?.maps || currentProject.maps.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-[#222] rounded-xl text-gray-500">
              No hay mapas. Haz clic en "Añadir mapa" para comenzar.
            </div>
          ) : (
            currentProject.maps.map(map => (
              <div 
                key={map.id}
                onClick={() => setEditingMapId(map.id)}
                className="group flex items-center justify-between p-5 bg-[#111] border border-[#222] hover:border-[#444] rounded-xl transition-all hover:bg-[#151515] hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
              >
                <div className="flex items-center gap-5 flex-1 w-full max-w-full overflow-hidden">
                  <div className="w-12 h-12 bg-[#1a1a1a] rounded-lg border border-[#333] flex items-center justify-center text-[#C9CEEC] group-hover:scale-110 transition-transform flex-shrink-0">
                    <MapIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {renamingMapId === map.id ? (
                      <input 
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => saveRenameMap(map.id)}
                        onKeyDown={(e) => handleKeyDownMap(e, map.id)}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        className="text-lg font-medium bg-[#1a1a1a] border border-[#C9CEEC] text-white px-2 py-0.5 rounded focus:outline-none w-full max-w-xs mb-1"
                      />
                    ) : (
                      <h3 className="text-lg font-medium text-white mb-1 group-hover:text-[#C9CEEC] transition-colors truncate">{map.name}</h3>
                    )}
                    <p className="text-xs text-gray-500 truncate">{map.description}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button 
                    className="p-2 text-gray-400 hover:text-white hover:bg-[#222] rounded-lg transition-colors"
                    title="Renombrar mapa"
                    onClick={(e) => startRenamingMap(map, e)}
                  >
                    <PenSquare className="w-4 h-4" />
                  </button>
                  <button 
                    className="p-2 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                    title="Eliminar mapa"
                    onClick={(e) => handleDeleteMap(map.id, e)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="w-px h-6 bg-[#333] mx-2 hidden sm:block"></div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setEditingMapId(map.id); }}
                    className="hidden sm:flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] text-white rounded-lg border border-[#333] hover:bg-[#222] transition-colors"
                  >
                    <span>Editar</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* UI FIJA SUPERPUESTA */}

      {/* Panel Superior Izquierdo (Configuración y Nombre) */}
      <div className="absolute top-6 left-6 flex items-center gap-3">
        <button 
          onClick={() => setCurrentProjectId(null)}
          className="p-3 bg-[#1a1a1a] text-gray-400 hover:text-white rounded-lg border border-[#333] transition-transform hover:scale-105 active:scale-95 shadow-lg hover:bg-[#222] pointer-events-auto"
          title="Volver a Proyectos"
        >
          <Home className="w-5 h-5" />
        </button>
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className="p-3 bg-[#1a1a1a] text-gray-400 hover:text-white rounded-lg border border-[#333] transition-transform hover:scale-105 active:scale-95 shadow-lg hover:bg-[#222] pointer-events-auto"
          title="Configuración"
        >
          <Settings className="w-5 h-5" />
        </button>
        <button 
          className="p-3 bg-[#1a1a1a] text-gray-400 hover:text-white rounded-lg border border-[#333] transition-transform hover:scale-105 active:scale-95 shadow-lg hover:bg-[#222] pointer-events-auto"
          title="Assets"
        >
          <Package className="w-5 h-5" />
        </button>
        <div className="bg-[#1a1a1a]/80 backdrop-blur px-5 py-3 border border-[#333] rounded-lg shadow-lg text-sm font-medium tracking-wide max-w-[200px] truncate">
          {currentProject?.name}
        </div>
      </div>

      {/* Botones Inferiores */}
      <button 
        onClick={() => {
           if (currentProject?.maps?.length) {
              setEditingMapId(currentProject.maps[0].id);
              setIsPlayingLevel(true);
           } else {
              alert("Añade un mapa primero.");
           }
        }}
        className="absolute bottom-6 left-6 flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-black transition-transform hover:scale-105 active:scale-95 shadow-lg pointer-events-auto"
        style={{ backgroundColor: '#C9CEEC' }}
      >
        <Play className="w-4 h-4 fill-current" />
        Probar Proyecto
      </button>

      <button 
        onClick={handleAddMap}
        className="absolute bottom-6 right-6 flex items-center gap-2 px-6 py-3 rounded-lg font-medium bg-[#1a1a1a] text-[#C9CEEC] border border-[#333] transition-transform hover:scale-105 active:scale-95 shadow-lg hover:bg-[#222] pointer-events-auto"
      >
        <Plus className="w-4 h-4" />
        Añadir mapa
      </button>

      {/* Modal de Configuración */}
      {isSettingsOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto modal">
          <div className="bg-[#111] border border-[#333] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col transform transition-all scale-100 opacity-100">
            <div className="p-4 border-b border-[#222] flex justify-between items-center bg-[#151515]">
              <h3 className="font-medium text-white tracking-wide">Configuración del Proyecto</h3>
              <button 
                onClick={() => setIsSettingsOpen(false)} 
                className="text-gray-500 hover:text-white transition-colors p-1 rounded hover:bg-[#222]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-6">
              
              <div className="flex flex-col gap-3">
                <label className="text-[10px] uppercase tracking-widest text-gray-500">Icono del Juego</label>
                <div className="flex transform items-center gap-4">
                  <div 
                    className="w-16 h-16 bg-[#1a1a1a] rounded-xl border border-[#333] flex items-center justify-center text-[#C9CEEC] relative overflow-hidden cursor-pointer group/icon flex-shrink-0"
                    onClick={() => document.getElementById('settings-upload-icon')?.click()}
                  >
                    {currentProject?.icon ? (
                      <img src={currentProject.icon} alt={currentProject?.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                    ) : (
                      <Folder className="w-8 h-8 group-hover:scale-110 transition-transform" />
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/icon:opacity-100 flex items-center justify-center transition-opacity">
                      <span className="text-[10px] text-white font-medium uppercase tracking-widest text-center">Cambiar</span>
                    </div>
                    <input 
                      id="settings-upload-icon"
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        if (currentProject) handleIconUpload(currentProject.id, e);
                      }}
                    />
                  </div>
                  <div className="flex flex-col items-start">
                    <p className="text-xs text-gray-400 mb-2">Sube una imagen o dibuja el icono ahora.</p>
                    <div className="flex gap-2">
                       <button
                         onClick={() => { setIsSettingsOpen(false); openSpriteEditor('project_icon'); }}
                         className="text-xs px-2 py-1 bg-[#222] rounded hover:bg-[#333] transition"
                       >
                         Dibujar
                       </button>
                      {currentProject?.icon && (
                        <button 
                          onClick={() => currentProject && handleRemoveIcon(currentProject.id)}
                          className="text-xs text-rose-500 hover:text-rose-400 transition-colors px-2 py-1"
                        >
                          Eliminar icono
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-px bg-[#222] w-full"></div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase tracking-widest text-gray-500">Nombre del Proyecto</label>
                <input 
                  type="text" 
                  value={currentProject?.name || ''}
                  onChange={(e) => updateProjectName(e.target.value)}
                  className="bg-[#1a1a1a] border border-[#333] text-white px-4 py-2.5 rounded text-sm focus:outline-none focus:border-[#C9CEEC] transition-colors"
                  placeholder="Ej. Mi Aventura"
                />
              </div>

            </div>
            <div className="p-4 border-t border-[#222] bg-[#151515] flex justify-end">
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="px-5 py-2 bg-[#C9CEEC] text-black font-medium text-sm rounded shadow-lg hover:brightness-110 active:scale-95 transition-all"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
      {cropModal}
    </div>
  );
}
