import { useState, useEffect, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import { Search, Plus, Maximize, PanelLeftClose, PanelLeft, ChevronDown, ChevronRight, Star, StarOff, GripVertical, GripHorizontal, Trash2, Play, Edit2, Check, WrapText, Info, FileCode, Save, Clock } from 'lucide-react';

function App() {
  const [activeWorkspace, setActiveWorkspace] = useState('relevance');

  const [library, setLibrary] = useState([]);
  const [relevanceQuery, setRelevanceQuery] = useState('name of operating system');
  const [relevanceResult, setRelevanceResult] = useState('PS C:\\BigFixStudio> Relevance Engine initialized...');
  
  const [actionQuery, setActionQuery] = useState('// Write your ActionScript here...\n// Example:\n// appendfile "Hello World"\n// copy __appendfile C:\\temp\\hello.txt');
  const [actionResult, setActionResult] = useState('PS C:\\BigFixStudio> ActionScript Engine initialized. Awaiting execution...');

  const [loading, setLoading] = useState(false);
  const [wordWrap, setWordWrap] = useState('off');
  const [isSaving, setIsSaving] = useState(false);
  
  const [uiZoom, setUiZoom] = useState(100);

  const [sidebarWidth, setSidebarWidth] = useState(340);
  const [terminalHeight, setTerminalHeight] = useState(280); 
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingTerminal, setIsResizingTerminal] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState({ Favorites: true });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSnippet, setNewSnippet] = useState({ title: '', category: 'Custom', type: 'relevance', description: '', query: '' });
  const [testResult, setTestResult] = useState('// Test output will appear here...');
  const [isTesting, setIsTesting] = useState(false);

  const [activeSnippetId, setActiveSnippetId] = useState(null);
  const [localDescriptions, setLocalDescriptions] = useState(() => {
    const saved = localStorage.getItem('bigfix_local_descriptions');
    return saved ? JSON.parse(saved) : {};
  });

  const [editingDescId, setEditingDescId] = useState(null);
  const [editDescText, setEditDescText] = useState("");

  const [editingTitleId, setEditingTitleId] = useState(null);
  const [editTitleText, setEditTitleText] = useState("");

  const themeColor = activeWorkspace === 'relevance' ? '#1bb7b7' : '#d9822b';
  const themeBgColor = activeWorkspace === 'relevance' ? 'rgba(27, 183, 183, 0.15)' : 'rgba(217, 130, 43, 0.15)';

  // Inverse scale math: If zoom is 80%, width needs to be 125vw to fill the screen.
  const scaleFactor = 100 / (uiZoom / 100);

  useEffect(() => {
    document.body.style.zoom = `${uiZoom}%`;
  }, [uiZoom]);

  useEffect(() => { fetchLibrary(); }, []);

  const fetchLibrary = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:8000/api/library');
      setLibrary(res.data);
      setExpandedCategories(prev => ({ ...prev, Favorites: true }));
    } catch (err) { console.error("Failed to load library:", err); }
  };

  const handleSaveSnippet = async (e) => {
    e.preventDefault();
    if (!newSnippet.title.trim()) {
      alert("Validation Error: Please provide a Title for your snippet before saving.");
      return;
    }
    try {
      await axios.post('http://127.0.0.1:8000/api/library', newSnippet);
      fetchLibrary(); 
      setIsModalOpen(false); 
      setTestResult('// Test output will appear here...');
    } catch (err) { alert("Failed to save snippet."); }
  };

  const handleUpdateCustomQuery = async () => {
    if (!activeSnippetId) return;
    setIsSaving(true);
    const currentQueryText = activeWorkspace === 'relevance' ? relevanceQuery : actionQuery;
    try {
      await axios.put(`http://127.0.0.1:8000/api/library/${activeSnippetId}`, { query: currentQueryText });
      fetchLibrary(); 
    } catch (err) { 
      console.error(err); 
      alert("Failed to save changes."); 
    }
    setIsSaving(false);
  };

  const saveTitleEdit = async (snippetId, e) => {
    e.stopPropagation();
    if (!editTitleText.trim()) {
      alert("Title cannot be blank.");
      return;
    }
    try {
      await axios.put(`http://127.0.0.1:8000/api/library/${snippetId}`, { title: editTitleText });
      setLibrary(prev => prev.map(item => item.id === snippetId ? { ...item, title: editTitleText } : item));
      setEditingTitleId(null);
    } catch (err) { console.error("Failed to update title", err); }
  };

  const handleDeleteSnippet = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this custom item?")) return;
    try {
      await axios.delete(`http://127.0.0.1:8000/api/library/${id}`);
      if (activeSnippetId === id) setActiveSnippetId(null);
      fetchLibrary();
    } catch (err) { console.error("Failed to delete", err); }
  };

  const toggleFavorite = async (snippet, e) => {
    e.stopPropagation();
    try {
      const newStatus = !snippet.isFavorite;
      await axios.put(`http://127.0.0.1:8000/api/library/${snippet.id}`, { isFavorite: newStatus });
      setLibrary(prev => prev.map(item => item.id === snippet.id ? { ...item, isFavorite: newStatus } : item));
    } catch (err) { console.error("Failed to favorite", err); }
  };

  const saveDescriptionEdit = async (snippetId, e) => {
    e.stopPropagation();
    try {
      await axios.put(`http://127.0.0.1:8000/api/library/${snippetId}`, { description: editDescText });
      setLibrary(prev => prev.map(item => item.id === snippetId ? { ...item, description: editDescText } : item));
      setEditingDescId(null);
    } catch (err) { console.error("Failed to update description", err); }
  };

  const handleLocalDescriptionChange = (id, newDesc) => {
    const updated = { ...localDescriptions, [id]: newDesc };
    setLocalDescriptions(updated);
    localStorage.setItem('bigfix_local_descriptions', JSON.stringify(updated));
  };

  const runCode = async () => {
    setLoading(true); 
    
    if (activeWorkspace === 'relevance') {
      setRelevanceResult('PS C:\\BigFixStudio> Executing Relevance...');
      try {
        const response = await axios.post('http://127.0.0.1:8000/api/run-relevance', { query: relevanceQuery });
        setRelevanceResult(response.data.result || 'Executed successfully but returned no standard output.');
      } catch (error) { 
        setRelevanceResult('E: Execution Error - ' + (error.response?.data?.detail || error.message)); 
      }
    } else {
      setActionResult('PS C:\\BigFixStudio> Executing ActionScript...');
      try {
        const response = await axios.post('http://127.0.0.1:8000/api/run-actionscript', { query: actionQuery });
        setActionResult(response.data.result || 'Executed successfully but returned no standard output.');
      } catch (error) { 
        setActionResult('E: Execution Error - ' + (error.response?.data?.detail || error.message)); 
      }
    }
    setLoading(false);
  };

  // --- NEW: Forces the Editor to listen for Ctrl+Enter and physically trigger the Run button ---
  const handleEditorDidMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      document.getElementById('run-btn')?.click();
    });
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setUiZoom(z => Math.min(z + 10, 200));
      }
      if (e.ctrlKey && e.key === '-') {
        e.preventDefault();
        setUiZoom(z => Math.max(z - 10, 50));
      }
      if (e.ctrlKey && e.key === '0') {
        e.preventDefault();
        setUiZoom(100);
      }
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (!loading) runCode();
      }
      if (e.ctrlKey && e.key === 's' && activeSnippetId && activeSnippetId.length > 20) {
        e.preventDefault();
        if (!isSaving) handleUpdateCustomQuery();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [relevanceQuery, actionQuery, activeWorkspace, loading, activeSnippetId, isSaving]);

  const testModalQuery = async () => {
    if (!newSnippet.query) return;
    setIsTesting(true); setTestResult('Testing query locally...');
    try {
      const endpoint = newSnippet.type === 'relevance' ? '/api/run-relevance' : '/api/run-actionscript';
      const response = await axios.post(`http://127.0.0.1:8000${endpoint}`, { query: newSnippet.query });
      setTestResult(response.data.result || 'Executed successfully but returned no standard output.');
    } catch (error) { 
      setTestResult('E: Execution Error - ' + (error.response?.data?.detail || error.message)); 
    }
    setIsTesting(false);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizingSidebar) { setSidebarWidth(Math.max(250, Math.min(e.clientX, window.innerWidth - 400))); }
      if (isResizingTerminal) { setTerminalHeight(Math.max(150, Math.min(window.innerHeight - e.clientY - 30, window.innerHeight * 0.85))); }
    };
    const handleMouseUp = () => { setIsResizingSidebar(false); setIsResizingTerminal(false); };
    if (isResizingSidebar || isResizingTerminal) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = isResizingSidebar ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    } else { document.body.style.cursor = 'default'; document.body.style.userSelect = 'auto'; }
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isResizingSidebar, isResizingTerminal]);

  const toggleFullscreen = () => { 
    if (window.pywebview && window.pywebview.api) {
      window.pywebview.api.toggle_fullscreen();
    } else {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.log(err));
      } else if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const toggleCategory = (category) => setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));

  const filterFn = (item) => {
      const s = searchQuery.toLowerCase();
      const desc = (localDescriptions[item.id] ?? item.description ?? "").toLowerCase();
      return (item.title?.toLowerCase().includes(s) || item.query?.toLowerCase().includes(s) || item.category?.toLowerCase().includes(s) || desc.includes(s));
  };

  const workspaceLibrary = library.filter(item => item.type === activeWorkspace);
  const favorites = workspaceLibrary.filter(item => item.isFavorite && filterFn(item));
  const regularLibrary = workspaceLibrary.filter(item => !item.isFavorite && filterFn(item));
  
  const groupedLibrary = useMemo(() => {
    return regularLibrary.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {});
  }, [regularLibrary]);

  const renderTerminalOutput = (textToRender) => {
    return textToRender.split('\n').map((line, index) => {
      let color = '#b2c3d4'; let fontWeight = 'normal';
      if (line.startsWith('A:')) { color = '#3ae374'; fontWeight = '700'; } 
      else if (line.startsWith('E:')) { color = '#ff3838'; fontWeight = '700'; } 
      else if (line.startsWith('T:')) { color = '#7f8c8d'; } 
      else if (line.startsWith('PS')) { color = activeWorkspace === 'relevance' ? '#17c0c0' : '#d9822b'; } 
      return <div key={index} style={{ color, fontWeight, lineHeight: '1.5', fontSize: '13px', fontFamily: "'JetBrains Mono', monospace" }}>{line}</div>;
    });
  };

  const activeSnippet = library.find(s => s.id === activeSnippetId);

  const SnippetCard = ({ snippet }) => {
    const isActive = activeSnippetId === snippet.id;
    const descToDisplay = localDescriptions[snippet.id] ?? snippet.description ?? "No description available.";
    
    return (
      <div 
        onClick={() => { 
          if (snippet.type === 'relevance') {
            setRelevanceQuery(snippet.query);
          } else {
            setActionQuery(snippet.query);
          }
          setActiveSnippetId(snippet.id); 
        }} 
        className={`snippet-item ${isActive ? 'active' : ''}`}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
          <div style={{ color: isActive ? '#ffffff' : '#e2e8f0', fontSize: '14px', fontWeight: isActive ? '600' : '500', lineHeight: 1.4 }}>
            {snippet.title}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {snippet.id.length > 20 && <Trash2 size={16} color="#ff4757" onClick={(e) => handleDeleteSnippet(snippet.id, e)} className="action-icon" />}
            {snippet.isFavorite ? 
              <Star size={16} fill="#d9822b" color="#d9822b" onClick={(e) => toggleFavorite(snippet, e)} className="action-icon" /> : 
              <StarOff size={16} color="#64748b" onClick={(e) => toggleFavorite(snippet, e)} style={{ opacity: 0.6 }} className="action-icon" />
            }
          </div>
        </div>
        
        <div onClick={(e) => e.stopPropagation()} style={{ cursor: 'default' }}>
          {editingDescId === snippet.id ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input autoFocus type="text" className="neu-input" style={{ padding: '6px 10px', fontSize: '12px', width: '100%' }} value={editDescText} onChange={(e) => setEditDescText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveDescriptionEdit(snippet.id, e)} />
              <button onClick={(e) => saveDescriptionEdit(snippet.id, e)} style={{ background: themeColor, color: '#fff', border: 'none', borderRadius: '4px', padding: '0 8px', cursor: 'pointer' }}><Check size={14} /></button>
            </div>
          ) : (
            <div className="desc-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: isActive ? '#a3b8cc' : '#94a3b8', fontSize: '12px', lineHeight: 1.4, fontStyle: 'italic' }}>
              <span style={{ flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{descToDisplay}</span>
              <Edit2 size={14} color="#6c7a89" onClick={(e) => { e.stopPropagation(); setEditingDescId(snippet.id); setEditDescText(snippet.description || ""); }} className="edit-icon" />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: `${scaleFactor}vw`, height: `${scaleFactor}vh`, backgroundColor: '#1a1d24', overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        #root { max-width: 100% !important; margin: 0 !important; padding: 0 !important; overflow: hidden; box-sizing: border-box; }
        
        body { 
          margin: 0; 
          padding: 0;
          overflow: hidden;
          background-color: #1a1d24; 
          color: #c4cdd5; 
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
          box-sizing: border-box; 
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }
        
        *, *:before, *:after { box-sizing: inherit; } 
        
        .neu-panel { background: #1a1d24; box-shadow: 4px 4px 10px #121419, -4px -4px 10px #22262f; border-radius: 8px; }
        .neu-pressed { background: #1a1d24; box-shadow: inset 4px 4px 8px #121419, inset -4px -4px 8px #22262f; border-radius: 8px; }
        .hover-lift { transition: all 0.15s ease-out; }
        .hover-lift:hover { transform: translateY(-1px); box-shadow: 2px 2px 8px #121419, -2px -2px 8px #22262f; }
        
        .neu-input { width: 100%; padding: 10px 10px 10px 40px; background: #1a1d24; color: #fff; border: none; outline: none; border-radius: 6px; box-shadow: inset 2px 2px 5px #121419, inset -2px -2px 5px #22262f; font-size: 13px; box-sizing: border-box; }
        .neu-input:focus { box-shadow: inset 3px 3px 6px #0f1115, inset -3px -3px 6px #252a33; border-left: 3px solid ${themeColor}; }
        .neu-input::placeholder { color: #64748b; font-weight: 400; }

        .snippet-item { padding: 12px 14px; margin-bottom: 8px; border-radius: 8px; background: transparent; border-left: 3px solid transparent; transition: all 0.15s ease-in-out; }
        .snippet-item:hover { background: #22262f; transform: translateX(3px); }
        .snippet-item.active { background: #1e252e; border-left: 3px solid ${themeColor}; box-shadow: inset 2px 2px 5px #121419, inset -2px -2px 5px #22262f; }
        
        .cat-header { font-size: 13px; font-weight: 600; color: ${themeColor}; letter-spacing: 0.5px; text-transform: uppercase; padding: 12px 10px 6px 10px; display: flex; alignItems: center; gap: 8px; cursor: pointer; transition: color 0.2s; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 10px; }

        .resizer-horizontal { width: 10px; cursor: col-resize; display: flex; align-items: center; justify-content: center; color: #444b59; transition: color 0.1s; z-index: 10; }
        .resizer-vertical { height: 10px; cursor: row-resize; display: flex; align-items: center; justify-content: center; color: #444b59; transition: color 0.1s; z-index: 10; margin: 4px 0; }
        
        .nav-tab { font-size: 14px; font-weight: 600; color: #64748b; cursor: pointer; padding: 8px 16px; transition: all 0.2s; border-bottom: 2px solid transparent; }
        .nav-tab:hover { color: #fff; }
        .nav-tab.active-rel { color: #1bb7b7; border-bottom: 2px solid #1bb7b7; }
        .nav-tab.active-act { color: #d9822b; border-bottom: 2px solid #d9822b; }

        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; z-index: 100; }
        ::-webkit-scrollbar { width: 8px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #353b4a; border-radius: 4px; }

        .action-icon:hover { transform: scale(1.1); filter: brightness(1.2); }
        .edit-icon { opacity: 0; transition: opacity 0.2s; cursor: pointer; }
        .snippet-item:hover .edit-icon { opacity: 1; }
        .title-hover:hover .edit-icon { opacity: 1; }
        .edit-icon:hover { color: ${themeColor} !important; }

        .title-edit-icon { opacity: 0.6; cursor: pointer; transition: all 0.2s; }
        .title-edit-icon:hover { opacity: 1; transform: scale(1.1); color: ${themeColor} !important; }
      `}</style>

      {/* TOP HEADER */}
      <div style={{ height: '60px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', background: '#1a1d24', borderBottom: '1px solid #282c36', zIndex: 50, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} style={{ background:'none', border:'none', color: themeColor, cursor:'pointer', padding: 0 }}>
            {isSidebarOpen ? <PanelLeftClose size={28} /> : <PanelLeft size={28} />}
          </button>
          <img src="/bigfix_logo.png" alt="BigFix Logo" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'contain' }} />
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '800', letterSpacing: '1px', color: '#fff', marginRight: '30px' }}>BIGFIX STUDIO</h1>
          
          <div style={{ display: 'flex', gap: '10px', height: '100%', alignItems: 'flex-end' }}>
            <div onClick={() => { setActiveWorkspace('relevance'); setActiveSnippetId(null); }} className={`nav-tab ${activeWorkspace === 'relevance' ? 'active-rel' : ''}`}>
              Relevance Evaluator
            </div>
            <div onClick={() => { setActiveWorkspace('actionscript'); setActiveSnippetId(null); }} className={`nav-tab ${activeWorkspace === 'actionscript' ? 'active-act' : ''}`}>
              ActionScript Runner
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', color: '#64748b', marginRight: '10px' }}>
            Zoom: {uiZoom}%
          </div>

          <button onClick={() => {
              setNewSnippet({ title: '', category: 'Custom', type: activeWorkspace, description: '', query: '' });
              setIsModalOpen(true);
            }} className="hover-lift" style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 16px', background:'#262b36', color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'13px', fontWeight:'600' }}>
            <Plus size={18} /> {activeWorkspace === 'relevance' ? 'Add Query' : 'Add Actionscript'}
          </button>
          <button onClick={toggleFullscreen} className="hover-lift" style={{ padding:'8px', background:'#262b36', color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer' }}>
            <Maximize size={18} />
          </button>
        </div>
      </div>

      {/* MAIN BODY AREA */}
      <div style={{ display: 'flex', flex: 1, padding: '10px', backgroundColor: '#1a1d24', minHeight: 0 }}>
        
        {/* DYNAMIC SIDEBAR */}
        <div className="neu-panel" style={{ 
          display: isSidebarOpen ? 'flex' : 'none', flexDirection: 'column', padding: '15px',
          width: `${sidebarWidth}px`, minWidth: '250px', flexShrink: 0
        }}>
          <div style={{ position: 'relative', marginBottom: '15px', width: '100%' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '10px', color: '#64748b' }} />
            <input type="text" placeholder="Search snippets..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="neu-input" />
          </div>
          
          <div style={{ overflowY: 'auto', flex: 1, paddingRight: '8px' }}>
            {favorites.length > 0 && (
              <div style={{ marginBottom: '15px' }}>
                <div className="cat-header" onClick={() => toggleCategory('Favorites')} style={{ color: '#d9822b' }}>
                  {expandedCategories['Favorites'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  ★ FAVORITES ({favorites.length})
                </div>
                {expandedCategories['Favorites'] && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {favorites.map(snippet => <SnippetCard key={snippet.id} snippet={snippet} />)}
                  </div>
                )}
              </div>
            )}

            {Object.entries(groupedLibrary).map(([category, items]) => (
              <div key={category} style={{ marginBottom: '15px' }}>
                <div className="cat-header" onClick={() => toggleCategory(category)}>
                  {expandedCategories[category] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  {category} ({items.length})
                </div>
                {expandedCategories[category] && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {items.map(snippet => <SnippetCard key={snippet.id} snippet={snippet} />)}
                  </div>
                )}
              </div>
            ))}

            {Object.keys(groupedLibrary).length === 0 && favorites.length === 0 && (
               <div style={{ textAlign: 'center', marginTop: '30px', color: '#64748b', fontStyle: 'italic', fontSize: '13px' }}>
                 No {activeWorkspace === 'relevance' ? 'Relevance' : 'ActionScript'} queries found.
               </div>
            )}
          </div>
        </div>

        {isSidebarOpen && ( <div className={`resizer-horizontal ${isResizingSidebar ? 'active' : ''}`} onMouseDown={() => setIsResizingSidebar(true)}> <GripVertical size={18} /> </div> )}

        {/* RIGHT SIDE IDE AREA */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          
          <div className="neu-pressed" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '15px', minHeight: 0 }}>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '15px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                {activeSnippetId && activeSnippetId.length > 20 && (
                   <button onClick={handleUpdateCustomQuery} disabled={isSaving} className="hover-lift" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#262b36', color: themeColor, border: `1px solid ${themeColor}`, borderRadius: '6px', cursor: isSaving ? 'wait' : 'pointer', fontSize: '13px', fontWeight: '600' }}>
                     <Save size={16} /> {isSaving ? 'Saving...' : 'Save Code'}
                   </button>
                )}

                <button onClick={() => setWordWrap(w => w === 'on' ? 'off' : 'on')} className="hover-lift" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: wordWrap === 'on' ? themeColor : '#262b36', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                  <WrapText size={16} /> {wordWrap === 'on' ? 'Wrap: ON' : 'Wrap: OFF'}
                </button>

                {/* ADDED id="run-btn" TO THIS BUTTON TO LINK IT TO CTRL+ENTER */}
                <button id="run-btn" onClick={runCode} disabled={loading} className="hover-lift" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6px 24px', background: themeColor, color: '#fff', border: 'none', borderRadius: '6px', cursor: loading ? 'wait' : 'pointer', boxShadow: `0 2px 8px ${themeBgColor}` }}>
                  <span style={{ fontSize: '14px', fontWeight: '700' }}>{loading ? 'EXECUTING...' : '▶ RUN'}</span>
                  <span style={{ fontSize: '10px', fontWeight: '500', opacity: 0.8 }}>(Ctrl+Enter)</span>
                </button>
              </div>
            </div>

            {/* DETAILS PANEL */}
            <div className="neu-panel" style={{ padding: '15px', marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#15171c', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '8px', background: '#1e222b', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileCode size={20} color={themeColor} />
                        </div>
                        <div>
                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px', letterSpacing: '0.5px' }}>Name</div>
                            
                            {editingTitleId === activeSnippet?.id ? (
                               <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                   <input autoFocus type="text" className="neu-input" style={{ padding: '4px 8px', fontSize: '16px', width: '250px', fontWeight: '600', color: '#fff', background: '#1a1d24' }} value={editTitleText} onChange={(e) => setEditTitleText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveTitleEdit(activeSnippet.id, e)} />
                                   <button onClick={(e) => saveTitleEdit(activeSnippet.id, e)} style={{ background: themeColor, color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer' }}><Check size={16} /></button>
                               </div>
                            ) : (
                               <h3 className="title-hover" style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                 {activeSnippet ? activeSnippet.title : 'Scratchpad (Unsaved)'}
                                 {activeSnippet && activeSnippet.id.length > 20 && (
                                    <Edit2 size={14} color="#a3b8cc" onClick={(e) => { e.stopPropagation(); setEditingTitleId(activeSnippet.id); setEditTitleText(activeSnippet.title); }} className="title-edit-icon" title="Edit Name" />
                                 )}
                               </h3>
                            )}
                        </div>
                    </div>

                    {activeSnippet && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                          <span style={{ padding: '4px 8px', background: themeBgColor, color: themeColor, borderRadius: '4px', fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                            {activeSnippet.category}
                          </span>
                          {activeSnippet.updated_at && (
                             <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>
                                 <Clock size={12} /> 
                                 <span>{activeSnippet.updated_at}</span>
                             </div>
                          )}
                      </div>
                    )}
                </div>

                <div style={{ marginTop: '5px' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>Description</div>
                    <textarea
                        value={activeSnippet ? (localDescriptions[activeSnippet.id] ?? activeSnippet.description ?? "") : "Select an item to edit description. Saved locally."}
                        onChange={(e) => activeSnippet && handleLocalDescriptionChange(activeSnippet.id, e.target.value)}
                        disabled={!activeSnippet}
                        placeholder="Add description..."
                        style={{ width: '100%', background: 'transparent', border: '1px solid #282c36', color: '#a3b8cc', padding: '8px', borderRadius: '6px', fontSize: '13px', resize: 'vertical', minHeight: '40px', fontFamily: "'Inter', sans-serif", outline: 'none', transition: 'border 0.2s' }}
                        onFocus={(e) => e.target.style.border = `1px solid ${themeColor}`}
                        onBlur={(e) => e.target.style.border = '1px solid #282c36'}
                    />
                </div>
            </div>
            
            <div style={{ flex: 1, borderRadius: '8px', overflow: 'hidden', background: '#1e1e1e', minHeight: 0 }}>
              <Editor 
                height="100%" 
                language={activeWorkspace === 'relevance' ? 'plaintext' : 'bat'} 
                theme="vs-dark" 
                value={activeWorkspace === 'relevance' ? relevanceQuery : actionQuery} 
                onChange={(value) => activeWorkspace === 'relevance' ? setRelevanceQuery(value) : setActionQuery(value)} 
                
                /* ADDED ONMOUNT PROP HERE */
                onMount={handleEditorDidMount} 
                
                options={{ minimap: { enabled: false }, fontSize: 15, fontFamily: "'JetBrains Mono', monospace", padding: { top: 15 }, lineHeight: 24, wordWrap: wordWrap }} 
              />
            </div>
          </div>

          <div className={`resizer-vertical ${isResizingTerminal ? 'active' : ''}`} onMouseDown={() => setIsResizingTerminal(true)}> <GripHorizontal size={18} /> </div>

          <div className="neu-pressed" style={{ height: `${terminalHeight}px`, display: 'flex', flexDirection: 'column', padding: '15px', flexShrink: 0 }}>
             <div style={{ fontSize: '14px', fontWeight: '700', color: '#6c7a89', letterSpacing: '1px', marginBottom: '10px', display:'flex', justifyContent:'space-between' }}>
                <span>TERMINAL OUTPUT</span>
                <span style={{ cursor:'pointer', color: themeColor }} onClick={() => activeWorkspace === 'relevance' ? setRelevanceResult('Ready...') : setActionResult('Ready...')}>CLEAR CONSOLE</span>
             </div>
             <div style={{ flex: 1, overflowY: 'auto', padding: '10px', background: '#121419', borderRadius: '8px', border: '1px solid #282c36' }}>
                <div style={{ margin: 0 }}>{renderTerminalOutput(activeWorkspace === 'relevance' ? relevanceResult : actionResult)}</div>
             </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="neu-panel" style={{ width: '600px', padding: '25px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, color: '#fff', fontSize: '20px' }}>{activeWorkspace === 'relevance' ? 'Add Query' : 'Add Actionscript'}</h2>
            </div>
            
            <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ flex: 1 }}>
                    <label style={{ fontSize:'13px', color:'#a3b8cc', marginBottom:'6px', display:'block', fontWeight:'600' }}>Title *</label>
                    <input className="neu-input" style={{ padding: '8px' }} value={newSnippet.title} onChange={e => setNewSnippet({...newSnippet, title: e.target.value})} />
                </div>
                <div style={{ flex: 1 }}>
                    <label style={{ fontSize:'13px', color:'#a3b8cc', marginBottom:'6px', display:'block', fontWeight:'600' }}>Category</label>
                    <input className="neu-input" style={{ padding: '8px' }} value={newSnippet.category} onChange={e => setNewSnippet({...newSnippet, category: e.target.value})} />
                </div>
            </div>

            <div>
                <label style={{ fontSize:'13px', color:'#a3b8cc', marginBottom:'6px', display:'block', fontWeight:'600' }}>Description</label>
                <input className="neu-input" style={{ padding: '8px' }} value={newSnippet.description} onChange={e => setNewSnippet({...newSnippet, description: e.target.value})} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button onClick={() => setIsModalOpen(false)} style={{ padding:'8px 16px', background:'transparent', color:'#a3b8cc', border:'none', cursor:'pointer', fontWeight:'600', fontSize:'14px' }}>Cancel</button>
              <button onClick={handleSaveSnippet} className="hover-lift" style={{ padding:'8px 16px', background: themeColor, color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer', fontWeight:'600', fontSize:'14px' }}>Save Item</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;