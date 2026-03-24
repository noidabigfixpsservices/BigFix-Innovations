import { useState, useEffect, useMemo, useRef } from 'react';
import Editor from '@monaco-editor/react';
import axios from 'axios';
// ADDED RefreshCw to the list below:
import { Search, Plus, Maximize, Shrink, PanelLeftClose, PanelLeft, ChevronDown, ChevronRight, Star, StarOff, GripVertical, GripHorizontal, Trash2, Edit2, Check, WrapText, FileCode, Save, Clock, Share2, Zap, History, X, Sun, Moon, Download, Play, Server, Globe, Target, RefreshCw, Copy } from 'lucide-react';
import { getRelevanceSuggestions } from './relevanceSuggestions';

// NEW: Force Monaco to bundle locally instead of using the CDN
import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';
loader.config({ monaco });



function App() {
  const [activeWorkspace, setActiveWorkspace] = useState('relevance');
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('bigfix_theme') || 'dark');
  useEffect(() => { localStorage.setItem('bigfix_theme', themeMode); }, [themeMode]);

  const [library, setLibrary] = useState([]);
  const [historyList, setHistoryList] = useState([]);
  const [terminalSearch, setTerminalSearch] = useState('');

  const defaultRelQuery = 'name of operating system';
  const defaultActQuery = '// Write your ActionScript here...\n// Example:\n// appendfile "Hello World"\n// copy __appendfile C:\\temp\\hello.txt';
  const defaultRelTerminal = 'PS C:\\BigFixStudio> Relevance Engine initialized...';
  const defaultActTerminal = 'PS C:\\BigFixStudio> ActionScript Engine initialized. Awaiting execution...';

  // --- HOT EXIT: PERSISTENT TABS ---
  const [relTabs, setRelTabs] = useState(() => {
      const saved = localStorage.getItem('bigfix_rel_tabs');
      const parsed = saved ? JSON.parse(saved) : [{ id: 'rel-1', title: 'Relevance Scratchpad 1', query: defaultRelQuery, snippetId: null, terminalOutput: defaultRelTerminal, type: 'client-relevance' }];
      return parsed.map(t => ({ ...t, type: t.type || 'client-relevance' }));
  });
  const [actTabs, setActTabs] = useState(() => {
      const saved = localStorage.getItem('bigfix_act_tabs');
      const parsed = saved ? JSON.parse(saved) : [{ id: 'act-1', title: 'ActionScript Scratchpad 1', query: defaultActQuery, snippetId: null, terminalOutput: defaultActTerminal, type: 'actionscript' }];
      return parsed.map(t => ({ ...t, type: 'actionscript' }));
  });
  
  const [activeRelTabId, setActiveRelTabId] = useState(() => localStorage.getItem('bigfix_active_rel_tab') || 'rel-1');
  const [activeActTabId, setActiveActTabId] = useState(() => localStorage.getItem('bigfix_active_act_tab') || 'act-1');

  useEffect(() => { localStorage.setItem('bigfix_rel_tabs', JSON.stringify(relTabs)); }, [relTabs]);
  useEffect(() => { localStorage.setItem('bigfix_act_tabs', JSON.stringify(actTabs)); }, [actTabs]);
  useEffect(() => { localStorage.setItem('bigfix_active_rel_tab', activeRelTabId); }, [activeRelTabId]);
  useEffect(() => { localStorage.setItem('bigfix_active_act_tab', activeActTabId); }, [activeActTabId]);

  const activeTabs = activeWorkspace === 'relevance' ? relTabs : actTabs;
  const activeTabId = activeWorkspace === 'relevance' ? activeRelTabId : activeActTabId;
  const activeTab = activeTabs.find(t => t.id === activeTabId) || activeTabs[0];
  const activeQuery = activeTab?.query || "";
  const activeSnippetId = activeTab?.snippetId || null;
  const activeTabType = activeTab?.type || 'client-relevance';

  const updateActiveTabOutput = (newOutput) => {
    if (activeWorkspace === 'relevance') setRelTabs(prev => prev.map(t => t.id === activeRelTabId ? { ...t, terminalOutput: newOutput } : t));
    else setActTabs(prev => prev.map(t => t.id === activeActTabId ? { ...t, terminalOutput: newOutput } : t));
  };

  const toggleTabType = () => {
      if (activeWorkspace !== 'relevance') return;
      const newType = activeTabType === 'client-relevance' ? 'session-relevance' : 'client-relevance';
      setRelTabs(prev => prev.map(t => t.id === activeRelTabId ? { ...t, type: newType } : t));
  };

  const [loadingType, setLoadingType] = useState(null); // 'local', 'api', 'remote'
  
  // NEW: Ref to hold the active polling timer
  const pollingIntervalRef = useRef(null);

  // NEW: Function to instantly kill the polling loop
  const cancelPolling = () => {
      if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
          setLoadingType(null);
          // FIX: Use activeTab.terminalOutput directly as a string instead of a callback function
          updateActiveTabOutput(activeTab?.terminalOutput + '\n\nE: 🛑 Polling aborted by user.');
      }
  };
  const [wordWrap, setWordWrap] = useState('off');
  const [autoSuggest, setAutoSuggest] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uiZoom, setUiZoom] = useState(100);

  const [sidebarWidth, setSidebarWidth] = useState(340);
  const [terminalHeight, setTerminalHeight] = useState(280); 
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingTerminal, setIsResizingTerminal] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showNewTabMenu, setShowNewTabMenu] = useState(false); // NEW: Dropdown menu state
  
  const [expandedCategories, setExpandedCategories] = useState({ Favorites: true });
  const [masterExpanded, setMasterExpanded] = useState({ client: false, session: false });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSnippet, setNewSnippet] = useState({ title: '', category: 'Custom', type: 'client-relevance', description: '', query: '' });

  // TARGET MODAL STATE
  const [isRemoteModalOpen, setIsRemoteModalOpen] = useState(false);
  const [remoteTarget, setRemoteTarget] = useState(() => localStorage.getItem('bigfix_remote_target') || '');

  const [isBesModalOpen, setIsBesModalOpen] = useState(false);
  const [isBesMaximized, setIsBesMaximized] = useState(false);
  const [besForm, setBesForm] = useState({ title: '', relText: '', actText: '' });
  const [besRelResult, setBesRelResult] = useState('Ready for Relevance testing...');
  const [besActResult, setBesActResult] = useState('Ready for ActionScript testing...');
  const [isBesTestingRel, setIsBesTestingRel] = useState(false);
  const [isBesTestingAct, setIsBesTestingAct] = useState(false);

  const [relSearch, setRelSearch] = useState('');
  const [showRelDropdown, setShowRelDropdown] = useState(false);
  const [actSearch, setActSearch] = useState('');
  const [showActDropdown, setShowActDropdown] = useState(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiSettings, setApiSettings] = useState({ url: '', username: '', password: '' });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [testConnResult, setTestConnResult] = useState('');

  const [localDescriptions, setLocalDescriptions] = useState(() => {
    const saved = localStorage.getItem('bigfix_local_descriptions');
    return saved ? JSON.parse(saved) : {};
  });

  const [editingDescId, setEditingDescId] = useState(null);
  const [editDescText, setEditDescText] = useState("");
  const [editingTitleId, setEditingTitleId] = useState(null);
  const [editTitleText, setEditTitleText] = useState("");

  // DYNAMIC THEME COLORS BASED ON TAB TYPE
  const getTabColor = (type) => {
      if (type === 'session-relevance') return '#8b5cf6'; // Purple
      if (type === 'actionscript') return '#d97706'; // Orange
      return '#0ea5e9'; // Blue (Client)
  };
  const themeColor = getTabColor(activeTabType);
  const themeBgColor = `${themeColor}25`; // Hex transparency
  const scaleFactor = 100 / (uiZoom / 100);

  const isDark = themeMode === 'dark';
  const colors = {
    bgBase: isDark ? '#111827' : '#f1f5f9',       
    panelBg: isDark ? '#1f2937' : '#ffffff',      
    panelInner: isDark ? '#111827' : '#f8fafc',   
    textTitle: isDark ? '#f9fafb' : '#0f172a',    
    textMain: isDark ? '#d1d5db' : '#334155',     
    textMuted: isDark ? '#9ca3af' : '#64748b',
    border: isDark ? '#374151' : '#e2e8f0',       
    buttonBg: isDark ? '#374151' : '#ffffff',
    buttonBorder: isDark ? '#4b5563' : '#cbd5e1', 
    editorBg: isDark ? '#1e1e1e' : '#ffffff',
    terminalBg: isDark ? '#030712' : '#ffffff',
    tabBg: isDark ? '#111827' : '#f1f5f9',
    iconBg: isDark ? '#374151' : '#f1f5f9',
    hover: isDark ? '#374151' : '#f1f5f9',
    active: isDark ? '#1f2937' : '#e0f2fe'        
  };

  const shadows = { neuOut: isDark ? '0 4px 6px -1px rgba(0, 0, 0, 0.3)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', neuInput: isDark ? 'inset 0 2px 4px rgba(0,0,0,0.2)' : 'inset 0 1px 2px rgba(0,0,0,0.05)' };

  useEffect(() => { document.body.style.zoom = `${uiZoom}%`; }, [uiZoom]);
  useEffect(() => { fetchLibrary(); fetchHistory(); fetchSettings(); }, []);

  const fetchLibrary = async () => { try { const res = await axios.get('http://127.0.0.1:8000/api/library'); setLibrary(res.data); } catch (err) { console.error(err); } };
  const fetchHistory = async () => { try { const res = await axios.get('http://127.0.0.1:8000/api/history'); setHistoryList(res.data); } catch (err) { console.error(err); } };
  const fetchSettings = async () => { try { const res = await axios.get('http://127.0.0.1:8000/api/settings'); setApiSettings(res.data); } catch (err) { console.error(err); } };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try { await axios.post('http://127.0.0.1:8000/api/settings', apiSettings); setIsSettingsOpen(false); setTestConnResult(''); } catch (err) { alert("Failed to save."); }
    setIsSavingSettings(false);
  };

  const handleTestConnection = async () => {
    setTestConnResult('Testing connection...');
    try { const res = await axios.post('http://127.0.0.1:8000/api/test-connection', apiSettings); setTestConnResult('✅ ' + res.data.message); } 
    catch (err) { setTestConnResult('❌ ' + (err.response?.data?.detail || err.message)); }
  };

  const clearHistory = async (e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to clear your entire execution history?")) return;
    try { await axios.delete('http://127.0.0.1:8000/api/history'); fetchHistory(); } catch (err) { console.error(err); }
  };

  const handleQueryChange = (newQuery) => {
    if (activeWorkspace === 'relevance') setRelTabs(prev => prev.map(t => t.id === activeRelTabId ? { ...t, query: newQuery } : t));
    else setActTabs(prev => prev.map(t => t.id === activeActTabId ? { ...t, query: newQuery } : t));
  };

  const openSnippetInTab = (snippet) => {
    if (snippet.type === 'client-relevance' || snippet.type === 'session-relevance') {
      const existing = relTabs.find(t => t.snippetId === snippet.id);
      if (existing) { setActiveRelTabId(existing.id); } 
      else {
        const newId = 'rel-' + Date.now();
        setRelTabs(prev => [...prev, { id: newId, title: snippet.title, query: snippet.query, snippetId: snippet.id, terminalOutput: defaultRelTerminal, type: snippet.type }]);
        setActiveRelTabId(newId);
      }
    } else {
      const existing = actTabs.find(t => t.snippetId === snippet.id);
      if (existing) { setActiveActTabId(existing.id); } 
      else {
        const newId = 'act-' + Date.now();
        setActTabs(prev => [...prev, { id: newId, title: snippet.title, query: snippet.query, snippetId: snippet.id, terminalOutput: defaultActTerminal, type: 'actionscript' }]);
        setActiveActTabId(newId);
      }
    }
  };

  const addScratchpad = (type = 'client-relevance') => {
    if (activeWorkspace === 'relevance') {
      const newId = 'rel-' + Date.now();
      setRelTabs(prev => [...prev, { id: newId, title: `Relevance Scratchpad ${prev.length + 1}`, query: '', snippetId: null, terminalOutput: defaultRelTerminal, type: type }]);
      setActiveRelTabId(newId);
    } else {
      const newId = 'act-' + Date.now();
      setActTabs(prev => [...prev, { id: newId, title: `ActionScript Scratchpad ${prev.length + 1}`, query: '', snippetId: null, terminalOutput: defaultActTerminal, type: 'actionscript' }]);
      setActiveActTabId(newId);
    }
    setShowNewTabMenu(false);
  };

  const closeTab = (e, tabId, type) => {
    e.stopPropagation();
    if (type === 'relevance') {
      if (relTabs.length === 1) return; 
      const newTabs = relTabs.filter(t => t.id !== tabId);
      setRelTabs(newTabs);
      if (activeRelTabId === tabId) setActiveRelTabId(newTabs[newTabs.length - 1].id);
    } else {
      if (actTabs.length === 1) return; 
      const newTabs = actTabs.filter(t => t.id !== tabId);
      setActTabs(newTabs);
      if (activeActTabId === tabId) setActiveActTabId(newTabs[newTabs.length - 1].id);
    }
  };

  const openSaveModal = () => {
    let defaultTitle = (!activeTab.title.includes('Scratchpad') && !activeTab.title.includes('History Query')) ? activeTab.title + ' (Copy)' : '';
    setNewSnippet({ title: defaultTitle, category: 'Custom', type: activeTabType, description: activeSnippetData?.description || '', query: activeQuery });
    setIsModalOpen(true);
  };

  const handleSaveSnippet = async (e) => {
    e.preventDefault();
    if (!newSnippet.title.trim()) return alert("Please provide a Title.");
    try {
      const res = await axios.post('http://127.0.0.1:8000/api/library', newSnippet);
      fetchLibrary(); setIsModalOpen(false); 
      if (activeWorkspace === 'relevance') setRelTabs(prev => prev.map(t => t.id === activeRelTabId ? { ...t, title: res.data.snippet.title, snippetId: res.data.snippet.id, query: res.data.snippet.query, type: res.data.snippet.type } : t));
      else setActTabs(prev => prev.map(t => t.id === activeActTabId ? { ...t, title: res.data.snippet.title, snippetId: res.data.snippet.id, query: res.data.snippet.query } : t));
    } catch (err) { alert("Failed to save snippet."); }
  };

  const handleUpdateCustomQuery = async () => {
    if (!activeSnippetId) return;
    setIsSaving(true);
    try { await axios.put(`http://127.0.0.1:8000/api/library/${activeSnippetId}`, { query: activeQuery }); fetchLibrary(); } catch (err) { alert("Failed to save changes."); }
    setIsSaving(false);
  };

  const saveTitleEdit = async (snippetId, e) => {
    e.stopPropagation();
    if (!editTitleText.trim()) return alert("Title cannot be blank.");
    try {
      await axios.put(`http://127.0.0.1:8000/api/library/${snippetId}`, { title: editTitleText });
      setLibrary(prev => prev.map(item => item.id === snippetId ? { ...item, title: editTitleText } : item));
      setEditingTitleId(null);
      if (activeWorkspace === 'relevance') setRelTabs(prev => prev.map(t => t.snippetId === snippetId ? { ...t, title: editTitleText } : t));
      else setActTabs(prev => prev.map(t => t.snippetId === snippetId ? { ...t, title: editTitleText } : t));
    } catch (err) { console.error(err); }
  };

  const handleDeleteSnippet = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this custom item?")) return;
    try {
      await axios.delete(`http://127.0.0.1:8000/api/library/${id}`);
      if (activeWorkspace === 'relevance') { const tab = relTabs.find(t => t.snippetId === id); if (tab) closeTab({ stopPropagation: () => {} }, tab.id, 'relevance'); } 
      else { const tab = actTabs.find(t => t.snippetId === id); if (tab) closeTab({ stopPropagation: () => {} }, tab.id, 'actionscript'); }
      fetchLibrary();
    } catch (err) { console.error(err); }
  };

  const toggleFavorite = async (snippet, e) => {
    e.stopPropagation();
    try {
      const newStatus = !snippet.isFavorite;
      await axios.put(`http://127.0.0.1:8000/api/library/${snippet.id}`, { isFavorite: newStatus });
      setLibrary(prev => prev.map(item => item.id === snippet.id ? { ...item, isFavorite: newStatus } : item));
    } catch (err) { console.error(err); }
  };

  const saveDescriptionEdit = async (snippetId, e) => {
    e.stopPropagation();
    try {
      await axios.put(`http://127.0.0.1:8000/api/library/${snippetId}`, { description: editDescText });
      setLibrary(prev => prev.map(item => item.id === snippetId ? { ...item, description: editDescText } : item));
      setEditingDescId(null);
    } catch (err) { console.error(err); }
  };

  const handleLocalDescriptionChange = (id, newDesc) => {
    const updated = { ...localDescriptions, [id]: newDesc };
    setLocalDescriptions(updated); localStorage.setItem('bigfix_local_descriptions', JSON.stringify(updated));
  };

  const runCode = async () => {
    setLoadingType('local'); 
    axios.post('http://127.0.0.1:8000/api/history', { query: activeQuery, type: activeTabType }).then(() => fetchHistory()).catch(e => console.error(e));
    
    updateActiveTabOutput(`PS C:\\BigFixStudio> Executing ${activeWorkspace === 'relevance' ? 'Relevance' : 'ActionScript'} locally...`);
    try {
      const route = activeWorkspace === 'relevance' ? 'run-relevance' : 'run-actionscript';
      const response = await axios.post(`http://127.0.0.1:8000/api/${route}`, { query: activeQuery });
      updateActiveTabOutput(response.data.result || 'Executed successfully but returned no standard output.');
    } catch (error) { updateActiveTabOutput('E: Execution Error - ' + (error.response?.data?.detail || error.message)); }
    setLoadingType(null);
  };

  const runSessionRelevance = async () => {
    setLoadingType('api'); 
    axios.post('http://127.0.0.1:8000/api/history', { query: activeQuery, type: 'session-relevance' }).then(() => fetchHistory()).catch(e => console.error(e));
    
    updateActiveTabOutput(`PS C:\\BigFixStudio> Pinging ${apiSettings.url || 'BigFix API'} for Session Relevance...`);
    try {
      const response = await axios.post('http://127.0.0.1:8000/api/run-session-relevance', { query: activeQuery });
      updateActiveTabOutput(response.data.result || 'Execution completed successfully, but returned no results.');
    } catch (error) { 
      if (error.response?.status === 400) { setIsSettingsOpen(true); }
      updateActiveTabOutput('E: API Error - ' + (error.response?.data?.detail || error.message)); 
    }
    setLoadingType(null);
  };

  // --- ASYNCHRONOUS REMOTE CLIENT QUERY LOOP ---
  const runRemoteQuery = async () => {
    if (!remoteTarget.trim()) return alert("Enter a Target Hostname or ID.");
    localStorage.setItem('bigfix_remote_target', remoteTarget);
    setIsRemoteModalOpen(false);
    setLoadingType('remote');
    
    axios.post('http://127.0.0.1:8000/api/history', { query: activeQuery, type: 'client-relevance' }).then(() => fetchHistory()).catch(e => console.error(e));
    updateActiveTabOutput(`PS C:\\BigFixStudio> Dispatching query to target '${remoteTarget}'...`);
    
    try {
        const postRes = await axios.post('http://127.0.0.1:8000/api/run-remote-query', { query: activeQuery, target: remoteTarget });
        const { query_id: queryId, target_id: resolvedId } = postRes.data;
        
        updateActiveTabOutput(`PS C:\\BigFixStudio> Target: ${resolvedId}\nPS C:\\BigFixStudio> Query ID: ${queryId}\nPS C:\\BigFixStudio> Waiting for endpoint to respond...`);
        
        let attempts = 0; const maxAttempts = 40; // 120 sec total timeout
        
        // Store the interval in our React Ref so we can kill it externally
        pollingIntervalRef.current = setInterval(async () => {
            attempts++;
            try {
                const pollRes = await axios.get(`http://127.0.0.1:8000/api/client-query-results/${queryId}`);
                const status = pollRes.data.status;
                
                if (status === 'Responded' || status === 'Error') {
                    clearInterval(pollingIntervalRef.current); pollingIntervalRef.current = null; setLoadingType(null);
                    updateActiveTabOutput(`PS C:\\BigFixStudio> Target: ${resolvedId}\nPS C:\\BigFixStudio> Query ID: ${queryId}\nPS C:\\BigFixStudio> Status: ${status}\n\n${pollRes.data.result}`);
                } else if (attempts >= maxAttempts) {
                    clearInterval(pollingIntervalRef.current); pollingIntervalRef.current = null; setLoadingType(null);
                    updateActiveTabOutput(`PS C:\\BigFixStudio> Target: ${resolvedId}\nPS C:\\BigFixStudio> Query ID: ${queryId}\nE: Timeout - Endpoint did not respond within 120 seconds.\n\nTroubleshooting:\n1. The machine is offline.\n2. UDP Port 52311 is blocked (VPN/Firewall), so the endpoint didn't receive the UDP ping.\n3. The Hostname is misspelled or doesn't exist in BigFix.`);
                } else {
                    updateActiveTabOutput(`PS C:\\BigFixStudio> Target: ${resolvedId}\nPS C:\\BigFixStudio> Query ID: ${queryId}\nPS C:\\BigFixStudio> Waiting for endpoint to respond (Attempt ${attempts}/${maxAttempts}) [Status: ${status}]...`);
                }
            } catch (err) { 
                clearInterval(pollingIntervalRef.current); pollingIntervalRef.current = null; setLoadingType(null); 
                updateActiveTabOutput(`E: Polling Error - ${err.response?.data?.detail || err.message}`); 
            }
        }, 3000);
        
    } catch (error) { setLoadingType(null); updateActiveTabOutput('E: API Error - ' + (error.response?.data?.detail || error.message)); }
  };

  const handleShareSnippet = () => {
    const activeSnippetData = library.find(s => s.id === activeSnippetId);
    const desc = activeSnippetData ? (localDescriptions[activeSnippetData.id] ?? activeSnippetData.description ?? "") : "";
    const title = activeSnippetData ? activeSnippetData.title : activeTab.title;
    const clipboardText = `**${title}**\n*${desc}*\n\`\`\`\n${activeQuery}\n\`\`\``;
    navigator.clipboard.writeText(clipboardText); alert("Copied to clipboard! Ready to paste in Teams/Slack.");
  };

  
  const handleSmartCopy = () => {
    const output = activeTab?.terminalOutput || "";
    // Filter only lines that start with A: or E:, and remove the "A: " prefix so it's pure data
    const cleanOutput = output.split('\n')
        .filter(line => line.startsWith('A: ') || line.startsWith('E: '))
        .map(line => line.substring(3))
        .join('\n');

    if (!cleanOutput) {
        alert("No results found to copy!");
        return;
    }
    
    navigator.clipboard.writeText(cleanOutput);
    alert("Smart Copy successful! Raw results copied to clipboard.");
  };



  const testBesRelevance = async () => {
    setIsBesTestingRel(true); setBesRelResult('PS C:\\BigFixStudio> Executing Relevance...');
    try { const response = await axios.post('http://127.0.0.1:8000/api/run-relevance', { query: besForm.relText || 'true' }); setBesRelResult(response.data.result || 'Executed successfully but returned no standard output.'); } catch (error) { setBesRelResult('E: Execution Error - ' + (error.response?.data?.detail || error.message)); }
    setIsBesTestingRel(false);
  };

  const testBesActionScript = async () => {
    setIsBesTestingAct(true); setBesActResult('PS C:\\BigFixStudio> Executing ActionScript...');
    try { const response = await axios.post('http://127.0.0.1:8000/api/run-actionscript', { query: besForm.actText }); setBesActResult(response.data.result || 'Executed successfully but returned no standard output.'); } catch (error) { setBesActResult('E: Execution Error - ' + (error.response?.data?.detail || error.message)); }
    setIsBesTestingAct(false);
  };

  const handleGenerateBes = async (e) => {
    if (e) e.preventDefault(); 

    const title = besForm?.title || "Custom_Fixlet";
    const rel = besForm?.relText || "";
    const act = besForm?.actText || "";

    if (!title.trim()) return alert("Please provide a name for this Fixlet.");
    
    if (!rel.trim() || !act.trim()) {
      const missing = []; 
      if (!rel.trim()) missing.push("Relevance"); 
      if (!act.trim()) missing.push("ActionScript");
      if (!window.confirm(`Warning: Your Fixlet is missing ${missing.join(" and ")}.\n\nDo you want to generate the .bes file anyway?`)) return;
    }
    
    try {
      // SMART URL: Uses 8000 for browser testing, but uses relative paths for the compiled .exe!
      const baseUrl = window.location.port === '5173' ? 'http://127.0.0.1:8000' : '';
      
      const response = await axios.post(`${baseUrl}/api/export-bes`, { 
          title: title, 
          relevance: rel || 'true', 
          actionscript: act 
      });
      
      const blob = new Blob([response.data.xml], { type: 'text/xml' }); 
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); 
      a.href = url; 
      a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.bes`;
      
      document.body.appendChild(a); 
      a.click(); 
      document.body.removeChild(a); 
      window.URL.revokeObjectURL(url);
      
      setIsBesModalOpen(false); 
      setIsBesMaximized(false);
    } catch (err) { 
        console.error("BES Export Error:", err);
        alert("Failed to generate .bes file. Check backend connection."); 
    }
  };
  
  const handleEditorDidMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => { document.getElementById('run-btn')?.click(); });
    monaco.languages.register({ id: 'bigfix' });
    monaco.languages.registerCompletionItemProvider('bigfix', {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
        return { suggestions: getRelevanceSuggestions(monaco, range) };
      }
    });
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && (e.key === '=' || e.key === '+')) { e.preventDefault(); setUiZoom(z => Math.min(z + 10, 200)); }
      if (e.ctrlKey && e.key === '-') { e.preventDefault(); setUiZoom(z => Math.max(z - 10, 50)); }
      if (e.ctrlKey && e.key === '0') { e.preventDefault(); setUiZoom(100); }
      // NEW SHORTCUT: Add Tab (Ctrl+N)
      if (e.ctrlKey && e.key === 'n') { e.preventDefault(); addScratchpad(activeWorkspace === 'relevance' ? activeTabType : 'actionscript'); }
      
      // NEW SHORTCUT: Kill Polling (Escape)
      if (e.key === 'Escape' && loadingType === 'remote') { e.preventDefault(); cancelPolling(); }
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); if (loadingType === null) runCode(); }
      if (e.ctrlKey && e.key === 's' && activeSnippetId && activeSnippetId.length > 20) { e.preventDefault(); if (!isSaving) handleUpdateCustomQuery(); }
      
    };
    window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeQuery, activeWorkspace, loadingType, activeSnippetId, isSaving, relTabs, actTabs, activeTabType]);

  useEffect(() => {
    const handleMouseMove = (e) => { if (isResizingSidebar) { setSidebarWidth(Math.max(250, Math.min(e.clientX, window.innerWidth - 400))); } if (isResizingTerminal) { setTerminalHeight(Math.max(150, Math.min(window.innerHeight - e.clientY - 30, window.innerHeight * 0.85))); } };
    const handleMouseUp = () => { setIsResizingSidebar(false); setIsResizingTerminal(false); };
    if (isResizingSidebar || isResizingTerminal) { window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp); document.body.style.cursor = isResizingSidebar ? 'col-resize' : 'row-resize'; document.body.style.userSelect = 'none';
    } else { document.body.style.cursor = 'default'; document.body.style.userSelect = 'auto'; }
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isResizingSidebar, isResizingTerminal]);

  const toggleFullscreen = () => { 
    if (window.pywebview && window.pywebview.api) window.pywebview.api.toggle_fullscreen();
    else if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(err => console.log(err));
    else if (document.exitFullscreen) document.exitFullscreen();
  };

  const toggleCategory = (category) => setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  const toggleMaster = (type) => setMasterExpanded(prev => ({ ...prev, [type]: !prev[type] }));
  const filterFn = (item) => { const s = searchQuery.toLowerCase(); const desc = (localDescriptions[item.id] ?? item.description ?? "").toLowerCase(); return (item.title?.toLowerCase().includes(s) || item.query?.toLowerCase().includes(s) || item.category?.toLowerCase().includes(s) || desc.includes(s)); };
  const favorites = library.filter(item => item.isFavorite && filterFn(item) && (activeWorkspace === 'actionscript' ? item.type === 'actionscript' : (item.type === 'client-relevance' || item.type === 'session-relevance')));
  
  const renderGroupedItems = (itemsList) => {
    const grouped = itemsList.reduce((acc, item) => { const catName = (item.category || "Uncategorized").trim().toUpperCase(); if (!acc[catName]) acc[catName] = []; acc[catName].push(item); return acc; }, {});
    if (Object.keys(grouped).length === 0) return <div style={{ padding: '10px', fontSize: '12px', color: colors.textMuted, fontStyle: 'italic' }}>No items found.</div>;
    return Object.entries(grouped).map(([category, items]) => (
      <div key={category} style={{ marginBottom: '10px' }}>
        <div className="cat-header" onClick={() => toggleCategory(category)} style={{ paddingLeft: '15px', color: colors.textMain, fontSize: '12px' }}>{expandedCategories[category] ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {category} ({items.length})</div>
        {expandedCategories[category] && (<div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '10px' }}>{items.map(snippet => <SnippetCard key={snippet.id} snippet={snippet} />)}</div>)}
      </div>
    ));
  };

  const renderTerminalLines = (type, textToRender, searchFilter = '') => {
    if (!textToRender) return null;
    const lines = textToRender.split('\n');
    const filteredLines = searchFilter ? lines.filter(l => l.toLowerCase().includes(searchFilter.toLowerCase())) : lines;
    return filteredLines.map((line, index) => {
      let color = isDark ? '#d1d5db' : '#475569'; let fontWeight = 'normal';
      if (line.startsWith('A:')) { color = '#10b981'; fontWeight = '700'; } 
      else if (line.startsWith('E:')) { color = '#ef4444'; fontWeight = '700'; } 
      else if (line.startsWith('T:')) { color = colors.textMuted; } 
      else if (line.startsWith('PS')) { color = themeColor; } 
      return <div key={index} style={{ color, fontWeight, lineHeight: '1.5', fontSize: '13px', fontFamily: "'JetBrains Mono', monospace" }}>{line}</div>;
    });
  };

  const activeSnippetData = library.find(s => s.id === activeSnippetId);

  const SnippetCard = ({ snippet }) => {
    const isActive = activeSnippetId === snippet.id;
    const descToDisplay = localDescriptions[snippet.id] ?? snippet.description ?? "No description available.";
    return (
      <div onClick={() => openSnippetInTab(snippet)} className={`snippet-item ${isActive ? 'active' : ''}`} style={{ borderLeft: isActive ? `3px solid ${getTabColor(snippet.type)}` : '3px solid transparent' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isActive ? (isDark ? '#ffffff' : '#0f172a') : colors.textTitle, fontSize: '14px', fontWeight: isActive ? '600' : '500', lineHeight: 1.4 }}>
             {snippet.type === 'session-relevance' && <Globe size={12} color="#8b5cf6" />}
             {snippet.title}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {snippet.id.length > 20 && <Trash2 size={16} color="#ff4757" onClick={(e) => handleDeleteSnippet(snippet.id, e)} className="action-icon" />}
            {snippet.isFavorite ? <Star size={16} fill="#f59e0b" color="#f59e0b" onClick={(e) => toggleFavorite(snippet, e)} className="action-icon" /> : <StarOff size={16} color={colors.textMuted} onClick={(e) => toggleFavorite(snippet, e)} style={{ opacity: 0.6 }} className="action-icon" />}
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()} style={{ cursor: 'default' }}>
          {editingDescId === snippet.id ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input autoFocus type="text" className="neu-input" style={{ padding: '6px 10px', fontSize: '12px', width: '100%', background: colors.bgBase, border: `1px solid ${colors.border}` }} value={editDescText} onChange={(e) => setEditDescText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveDescriptionEdit(snippet.id, e)} />
              <button onClick={(e) => saveDescriptionEdit(snippet.id, e)} style={{ background: themeColor, color: '#fff', border: 'none', borderRadius: '4px', padding: '0 8px', cursor: 'pointer' }}><Check size={14} /></button>
            </div>
          ) : (
            <div className="desc-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: isActive ? colors.textMain : colors.textMuted, fontSize: '12px', lineHeight: 1.4, fontStyle: 'italic' }}>
              <span style={{ flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{descToDisplay}</span>
              <Edit2 size={14} color={colors.textMuted} onClick={(e) => { e.stopPropagation(); setEditingDescId(snippet.id); setEditDescText(snippet.description || ""); }} className="edit-icon" />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: `${scaleFactor}vw`, height: `${scaleFactor}vh`, backgroundColor: colors.bgBase, overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        #root { max-width: 100% !important; margin: 0 !important; padding: 0 !important; overflow: hidden; box-sizing: border-box; }
        body { margin: 0; padding: 0; overflow: hidden; background-color: ${colors.bgBase}; color: ${colors.textMain}; font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; box-sizing: border-box; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; transition: background-color 0.3s ease; }
        *, *:before, *:after { box-sizing: inherit; } 
        .neu-panel { background: ${colors.panelBg}; box-shadow: ${shadows.neuOut}; border: ${isDark ? `1px solid ${colors.border}` : `1px solid ${colors.border}`}; border-radius: 8px; transition: all 0.3s ease; }
        .neu-pressed { background: ${colors.panelBg}; border: 1px solid ${colors.border}; border-radius: 8px; transition: all 0.3s ease; }
        .hover-lift { transition: transform 0.15s ease-out, box-shadow 0.15s ease-out; }
        .hover-lift:hover { transform: translateY(-1px); box-shadow: ${isDark ? '0 4px 6px -1px rgba(0,0,0,0.5)' : '0 4px 6px -1px rgba(0,0,0,0.1)'}; }
        .neu-input { width: 100%; padding: 10px 10px 10px 40px; background: ${colors.panelBg}; color: ${colors.textTitle}; border: 1px solid ${colors.border}; outline: none; border-radius: 6px; box-shadow: ${shadows.neuInput}; font-size: 13px; box-sizing: border-box; transition: all 0.3s ease; }
        .neu-input:focus { border-left: 3px solid ${themeColor}; }
        .neu-input::placeholder { color: ${colors.textMuted}; font-weight: 400; }
        .snippet-item { padding: 12px 14px; margin-bottom: 8px; border-radius: 8px; background: transparent; transition: all 0.15s ease-in-out; }
        .snippet-item:hover { background: ${colors.hover}; transform: translateX(3px); }
        .snippet-item.active { background: ${colors.active}; }
        .cat-header { font-size: 13px; font-weight: 700; color: ${colors.textTitle}; letter-spacing: 0.5px; text-transform: uppercase; padding: 12px 10px 6px 10px; display: flex; alignItems: center; gap: 8px; cursor: pointer; transition: color 0.2s; border-bottom: 1px solid ${colors.border}; margin-bottom: 10px; }
        .resizer-horizontal { width: 10px; cursor: col-resize; display: flex; align-items: center; justify-content: center; color: ${colors.textMuted}; transition: color 0.1s; z-index: 10; }
        .resizer-vertical { height: 10px; cursor: row-resize; display: flex; align-items: center; justify-content: center; color: ${colors.textMuted}; transition: color 0.1s; z-index: 10; margin: 4px 0; }
        .nav-tab { font-size: 14px; font-weight: 600; color: ${colors.textMuted}; cursor: pointer; padding: 8px 16px; transition: all 0.2s; border-bottom: 2px solid transparent; }
        .nav-tab:hover { color: ${colors.textTitle}; }
        .nav-tab.active-rel { color: #0ea5e9; border-bottom: 2px solid #0ea5e9; }
        .nav-tab.active-act { color: #d97706; border-bottom: 2px solid #d97706; }
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(2px); display: flex; justify-content: center; align-items: center; z-index: 100; }
        ::-webkit-scrollbar { width: 8px; height: 8px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${colors.border}; border-radius: 4px; }
        .action-icon:hover { transform: scale(1.1); filter: brightness(1.2); }
        .edit-icon { opacity: 0; transition: opacity 0.2s; cursor: pointer; }
        .snippet-item:hover .edit-icon { opacity: 1; }
        .title-hover:hover .edit-icon { opacity: 1; }
        .edit-icon:hover { color: ${themeColor} !important; }
        .title-edit-icon { opacity: 0.6; cursor: pointer; transition: all 0.2s; color: ${colors.textMuted}; }
        .title-edit-icon:hover { opacity: 1; transform: scale(1.1); color: ${themeColor} !important; }
        .editor-tab { transition: all 0.15s; }
        .editor-tab:hover { background: ${colors.editorBg} !important; color: ${colors.textTitle} !important; }
        .tab-close { opacity: 0; transition: opacity 0.15s; }
        .editor-tab:hover .tab-close { opacity: 1; }
      `}</style>

      {/* TOP HEADER */}
      <div style={{ height: '60px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', background: colors.panelBg, borderBottom: `1px solid ${colors.border}`, zIndex: 50, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} style={{ background:'none', border:'none', color: '#0ea5e9', cursor:'pointer', padding: 0 }}>
            {isSidebarOpen ? <PanelLeftClose size={28} /> : <PanelLeft size={28} />}
          </button>
          <img src="/bigfix_logo.png" alt="BigFix Logo" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'contain' }} />
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '800', letterSpacing: '1px', color: colors.textTitle, marginRight: '30px' }}>BIGFIX STUDIO</h1>
          
          <div style={{ display: 'flex', gap: '10px', height: '100%', alignItems: 'flex-end' }}>
            <div onClick={() => setActiveWorkspace('relevance')} className={`nav-tab ${activeWorkspace === 'relevance' ? 'active-rel' : ''}`}>Relevance Evaluator</div>
            <div onClick={() => setActiveWorkspace('actionscript')} className={`nav-tab ${activeWorkspace === 'actionscript' ? 'active-act' : ''}`}>ActionScript Runner</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', color: colors.textMuted, marginRight: '10px' }}>Zoom: {uiZoom}%</div>
          
          {/* --- NEW RELOAD BUTTON --- */}
          <button onClick={() => window.location.reload()} className="hover-lift" title="Reload Window" style={{ display:'flex', alignItems:'center', justifyContent: 'center', padding:'8px', background: colors.buttonBg, color: colors.textTitle, border: `1px solid ${colors.buttonBorder}`, borderRadius:'6px', cursor:'pointer' }}>
            <RefreshCw size={18} />
          </button>

          <button onClick={() => setIsSettingsOpen(true)} className="hover-lift" title="BigFix API Connection Settings" style={{ display:'flex', alignItems:'center', justifyContent: 'center', padding:'8px', background: colors.buttonBg, color: colors.textTitle, border: `1px solid ${colors.buttonBorder}`, borderRadius:'6px', cursor:'pointer' }}><Server size={18} /></button>
          <button onClick={() => { let relText = ''; let actText = ''; if (activeWorkspace === 'relevance' && activeSnippetId && activeSnippetId.length > 20) { relText = activeQuery; } if (activeWorkspace === 'actionscript' && activeSnippetId && activeSnippetId.length > 20) { actText = activeQuery; } setBesForm({ title: 'My Custom Fixlet', relText, actText }); setIsBesModalOpen(true); }} className="hover-lift" title="Generate .bes Fixlet" style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 16px', background: colors.buttonBg, color: colors.textTitle, border: `1px solid ${colors.buttonBorder}`, borderRadius:'6px', cursor:'pointer', fontSize:'13px', fontWeight:'600' }}><Download size={18} /> Export .bes</button>
          <button onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')} className="hover-lift" title="Toggle Theme" style={{ display:'flex', alignItems:'center', justifyContent: 'center', padding:'8px', background: colors.buttonBg, color: colors.textTitle, border: `1px solid ${colors.buttonBorder}`, borderRadius:'6px', cursor:'pointer' }}>{themeMode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
          <button onClick={() => { setNewSnippet({ title: '', category: 'Custom', type: activeWorkspace === 'relevance' ? 'client-relevance' : 'actionscript', description: '', query: '' }); setIsModalOpen(true); }} className="hover-lift" style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 16px', background: colors.buttonBg, color: colors.textTitle, border: `1px solid ${colors.buttonBorder}`, borderRadius:'6px', cursor:'pointer', fontSize:'13px', fontWeight:'600' }}><Plus size={18} /> Add Blank</button>
          <button onClick={toggleFullscreen} className="hover-lift" style={{ padding:'8px', background: colors.buttonBg, color: colors.textTitle, border: `1px solid ${colors.buttonBorder}`, borderRadius:'6px', cursor:'pointer' }}><Maximize size={18} /></button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, padding: '10px', backgroundColor: colors.bgBase, minHeight: 0 }}>
        {/* SIDEBAR */}
        <div className="neu-panel" style={{ display: isSidebarOpen ? 'flex' : 'none', flexDirection: 'column', padding: '15px', width: `${sidebarWidth}px`, minWidth: '250px', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '10px', color: colors.textMuted }} />
              <input type="text" placeholder="Search snippets..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="neu-input" />
            </div>
          </div>
          
          <div style={{ overflowY: 'auto', flex: 1, paddingRight: '8px' }}>
            <div style={{ marginBottom: '15px' }}>
              <div className="cat-header" style={{ color: colors.textTitle, justifyContent: 'space-between' }}>
                <div onClick={() => toggleCategory('History')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>{expandedCategories['History'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}<History size={14} /> RECENT EXECUTIONS</div>
                {expandedCategories['History'] && <span onClick={clearHistory} className="hover-lift" style={{ fontSize: '10px', color: '#ef4444', cursor: 'pointer' }}>CLEAR</span>}
              </div>
              {expandedCategories['History'] && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {historyList.filter(h => activeWorkspace === 'relevance' ? (h.type === 'client-relevance' || h.type === 'session-relevance') : h.type === 'actionscript').length === 0 && <div style={{ textAlign: 'center', margin: '10px 0', color: colors.textMuted, fontStyle: 'italic', fontSize: '12px' }}>No history recorded yet.</div>}
                  {historyList.filter(h => activeWorkspace === 'relevance' ? (h.type === 'client-relevance' || h.type === 'session-relevance') : h.type === 'actionscript').map((item) => (
                    <div key={item.id} onClick={() => openSnippetInTab({ id: `hist-${item.id}`, title: 'History Query', type: item.type, query: item.query })} className="snippet-item" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '2px', padding: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', color: getTabColor(item.type), fontWeight: '700' }}>{item.timestamp}</span>
                        {item.type === 'session-relevance' && <span style={{ fontSize: '9px', background: '#374151', color: '#fff', padding: '2px 4px', borderRadius: '4px' }}>API</span>}
                      </div>
                      <div style={{ fontSize: '12px', color: colors.textMain, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: "'JetBrains Mono', monospace" }}>{item.query}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {favorites.length > 0 && (
              <div style={{ marginBottom: '15px' }}>
                <div className="cat-header" onClick={() => toggleCategory('Favorites')} style={{ color: '#f59e0b' }}>{expandedCategories['Favorites'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />} ★ FAVORITES ({favorites.length})</div>
                {expandedCategories['Favorites'] && (<div style={{ display: 'flex', flexDirection: 'column' }}>{favorites.map(snippet => <SnippetCard key={snippet.id} snippet={snippet} />)}</div>)}
              </div>
            )}

            {activeWorkspace === 'relevance' ? (
                <>
                    <div style={{ marginBottom: '15px' }}>
                        <div className="cat-header" onClick={() => toggleMaster('client')} style={{ color: '#0ea5e9' }}>{masterExpanded['client'] ? <ChevronDown size={16}/> : <ChevronRight size={16}/>} 💻 CLIENT RELEVANCE</div>
                        {masterExpanded['client'] && renderGroupedItems(library.filter(i => (i.type === 'client-relevance' || i.type === 'relevance') && !i.isFavorite && filterFn(i)))}
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                        <div className="cat-header" onClick={() => toggleMaster('session')} style={{ color: '#8b5cf6' }}>{masterExpanded['session'] ? <ChevronDown size={16}/> : <ChevronRight size={16}/>} 🌐 SESSION RELEVANCE</div>
                        {masterExpanded['session'] && renderGroupedItems(library.filter(i => i.type === 'session-relevance' && !i.isFavorite && filterFn(i)))}
                    </div>
                </>
            ) : ( renderGroupedItems(library.filter(i => i.type === 'actionscript' && !i.isFavorite && filterFn(i))) )}
          </div>
        </div>

        {isSidebarOpen && ( <div className={`resizer-horizontal ${isResizingSidebar ? 'active' : ''}`} onMouseDown={() => setIsResizingSidebar(true)}> <GripVertical size={18} /> </div> )}

        {/* RIGHT IDE */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: colors.panelBg, borderRadius: '8px', overflow: 'hidden', border: isDark ? 'none' : `1px solid ${colors.border}`, boxShadow: shadows.neuOut }}>
          
          <div style={{ display: 'flex', background: colors.tabBg, borderBottom: `1px solid ${colors.border}` }}>
              
              {/* FIXED PLUS BUTTON WITH DROPDOWN */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <div onClick={() => activeWorkspace === 'relevance' ? setShowNewTabMenu(!showNewTabMenu) : addScratchpad('actionscript')} 
                       className="hover-lift" title="New Scratchpad Tab (Ctrl+N)" 
                       style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', cursor: 'pointer', color: activeWorkspace === 'relevance' ? '#0ea5e9' : '#d97706', borderRight: `1px solid ${colors.border}`, background: colors.panelBg, zIndex: 5, height: '100%' }}>
                      <Plus size={18} strokeWidth={3} />
                  </div>

                  {showNewTabMenu && activeWorkspace === 'relevance' && (
                      <>
                          <div onClick={() => setShowNewTabMenu(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}></div>
                          <div style={{ position: 'absolute', top: '100%', left: '5px', marginTop: '4px', background: colors.panelBg, border: `1px solid ${colors.border}`, borderRadius: '6px', boxShadow: shadows.neuOut, zIndex: 100, display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '200px' }}>
                              <div onClick={() => addScratchpad('client-relevance')} 
                                   style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#0ea5e9', fontSize: '13px', fontWeight: '600', borderBottom: `1px solid ${colors.border}` }}
                                   onMouseOver={(e) => e.currentTarget.style.background = colors.hover} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                                  <FileCode size={14} /> New Client Query
                              </div>
                              <div onClick={() => addScratchpad('session-relevance')} 
                                   style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#8b5cf6', fontSize: '13px', fontWeight: '600' }}
                                   onMouseOver={(e) => e.currentTarget.style.background = colors.hover} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                                  <Globe size={14} /> New Session Query
                              </div>
                          </div>
                      </>
                  )}
              </div>

              <div style={{ display: 'flex', overflowX: 'auto', flexWrap: 'nowrap', flex: 1 }}>
                  {activeTabs.map(tab => (
                      <div key={tab.id} className="editor-tab" onClick={() => activeWorkspace === 'relevance' ? setActiveRelTabId(tab.id) : setActiveActTabId(tab.id)}
                           style={{ padding: '10px 15px', background: activeTabId === tab.id ? colors.editorBg : 'transparent', borderTop: activeTabId === tab.id ? `2px solid ${getTabColor(tab.type)}` : '2px solid transparent', color: activeTabId === tab.id ? colors.textTitle : colors.textMuted, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', borderRight: `1px solid ${colors.border}`, fontSize: '13px', fontWeight: '500', minWidth: 'fit-content' }}>
                          {tab.type === 'session-relevance' ? <Globe size={14} color={activeTabId === tab.id ? getTabColor(tab.type) : colors.textMuted} /> : <FileCode size={14} color={activeTabId === tab.id ? getTabColor(tab.type) : colors.textMuted} />}
                          {tab.title}
                          {activeTabs.length > 1 && (<div onClick={(e) => closeTab(e, tab.id, activeWorkspace)} className="tab-close hover-lift" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '4px' }}><X size={14} /></div>)}
                      </div>
                  ))}
              </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '15px', minHeight: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '15px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                
                {/* --- CONTEXT AWARE ACTION BUTTONS --- */}
                {activeTabType === 'session-relevance' && (
                   <button id="run-api-btn" onClick={runSessionRelevance} disabled={loadingType !== null} className="hover-lift" title="Evaluate via Root Server REST API" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6px 24px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '6px', cursor: loadingType !== null ? 'wait' : 'pointer', boxShadow: `0 2px 8px rgba(139, 92, 246, 0.3)` }}>
                     <span style={{ fontSize: '14px', fontWeight: '700' }}>{loadingType === 'api' ? 'EVALUATING...' : '🌐 EVALUATE SESSION REL'}</span>
                     <span style={{ fontSize: '10px', fontWeight: '500', opacity: 0.8 }}>(Ctrl+Enter)</span>
                   </button>
                )}

                {activeTabType === 'client-relevance' && (
                   <>
                     {/* --- NEW: Persistent Target Input Box --- */}
                     <div style={{ display: 'flex', alignItems: 'center', background: colors.panelBg, border: `1px solid ${colors.border}`, borderRadius: '6px', padding: '0 8px', height: '42px', boxShadow: shadows.neuInput }}>
                         <Target size={14} color={colors.textMuted} />
                         <input 
                             value={remoteTarget} 
                             onChange={(e) => {
                                 setRemoteTarget(e.target.value);
                                 localStorage.setItem('bigfix_remote_target', e.target.value);
                             }} 
                             placeholder="Hostname or ID" 
                             style={{ background: 'transparent', border: 'none', color: colors.textTitle, fontSize: '13px', width: '140px', padding: '0 8px', outline: 'none', fontWeight: '600' }} 
                         />
                     </div>

                     {loadingType === 'remote' ? (
                         <button onClick={cancelPolling} className="hover-lift" title="Cancel Polling (Esc)" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 16px', background: '#ef4444', color: '#fff', border: `none`, borderRadius: '6px', cursor: 'pointer', boxShadow: `0 2px 8px rgba(239, 68, 68, 0.4)`, height: '42px' }}>
                           <span style={{ fontSize: '12px', fontWeight: '700' }}>🛑 CANCEL</span>
                           <span style={{ fontSize: '9px', fontWeight: '500', opacity: 0.9 }}>(Esc)</span>
                         </button>
                     ) : (
                         <button onClick={runRemoteQuery} disabled={loadingType !== null} className="hover-lift" title="Evaluate on a Remote Endpoint via API" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 16px', background: 'transparent', color: '#10b981', border: `1px solid #10b981`, borderRadius: '6px', cursor: loadingType !== null ? 'wait' : 'pointer', height: '42px' }}>
                           <span style={{ fontSize: '12px', fontWeight: '700' }}>🎯 RUN (REMOTE)</span>
                         </button>
                     )}
                     
                     <button id="run-btn" onClick={runCode} disabled={loadingType !== null} className="hover-lift" title="Evaluate Locally on this machine" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '6px', cursor: loadingType !== null ? 'wait' : 'pointer', boxShadow: `0 2px 8px rgba(14, 165, 233, 0.3)`, height: '42px' }}>
                       <span style={{ fontSize: '14px', fontWeight: '700' }}>{loadingType === 'local' ? 'EXECUTING...' : '▶ RUN (LOCAL)'}</span>
                       <span style={{ fontSize: '10px', fontWeight: '500', opacity: 0.8 }}>(Ctrl+Enter)</span>
                     </button>
                   </>
                )}
                

                {activeTabType === 'actionscript' && (
                    <button id="run-btn" onClick={runCode} disabled={loadingType !== null} className="hover-lift" title="Test Script Locally" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6px 24px', background: '#d97706', color: '#fff', border: 'none', borderRadius: '6px', cursor: loadingType !== null ? 'wait' : 'pointer', boxShadow: `0 2px 8px rgba(217, 119, 6, 0.3)` }}>
                       <span style={{ fontSize: '14px', fontWeight: '700' }}>{loadingType === 'local' ? 'EXECUTING...' : '▶ RUN SCRIPT'}</span>
                       <span style={{ fontSize: '10px', fontWeight: '500', opacity: 0.8 }}>(Ctrl+Enter)</span>
                    </button>
                )}

                <div style={{ width: '1px', background: colors.border, margin: '0 5px' }}></div>

                {activeSnippetId && activeSnippetId.length > 20 && !activeSnippetId.startsWith('hist-') ? (
                   <button onClick={handleUpdateCustomQuery} disabled={isSaving} className="hover-lift" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: colors.buttonBg, color: colors.textTitle, border: `1px solid ${colors.buttonBorder}`, borderRadius: '6px', cursor: isSaving ? 'wait' : 'pointer', fontSize: '13px', fontWeight: '600' }}><Save size={16} color={themeColor} /> {isSaving ? 'Saving...' : 'Update Code'}</button>
                ) : (
                   <button onClick={openSaveModal} className="hover-lift" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: colors.buttonBg, color: colors.textTitle, border: `1px solid ${colors.buttonBorder}`, borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}><Save size={16} color={themeColor} /> Save to Library</button>
                )}

                <button onClick={() => setAutoSuggest(s => !s)} className="hover-lift" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: colors.buttonBg, color: colors.textTitle, border: `1px solid ${colors.buttonBorder}`, borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}><Zap size={16} color={autoSuggest ? '#f59e0b' : colors.textMuted} /> {autoSuggest ? 'Auto-Suggest: ON' : 'Auto-Suggest: OFF'}</button>
                <button onClick={handleShareSnippet} className="hover-lift" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: colors.buttonBg, color: colors.textTitle, border: `1px solid ${colors.buttonBorder}`, borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}><Share2 size={16} color={colors.textMuted}/> Share</button>
                <button onClick={() => setWordWrap(w => w === 'on' ? 'off' : 'on')} className="hover-lift" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: colors.buttonBg, color: colors.textTitle, border: `1px solid ${colors.buttonBorder}`, borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}><WrapText size={16} color={colors.textMuted}/> {wordWrap === 'on' ? 'Wrap: ON' : 'Wrap: OFF'}</button>
              </div>
            </div>

            {/* DETAILS PANEL */}
            <div style={{ padding: '15px', marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '8px', background: colors.panelInner, flexShrink: 0, borderRadius: '8px', border: isDark ? 'none' : `1px solid ${colors.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '8px', background: colors.iconBg, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {activeTabType === 'session-relevance' ? <Globe size={20} color={themeColor} /> : <FileCode size={20} color={themeColor} />}
                        </div>
                        <div>
                            <div style={{ fontSize: '11px', color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px', letterSpacing: '0.5px' }}>Name</div>
                            {editingTitleId === activeSnippetData?.id && activeSnippetData && !activeTab.title.includes('Scratchpad') ? (
                               <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                   <input autoFocus type="text" className="neu-input" style={{ padding: '4px 8px', fontSize: '16px', width: '250px', fontWeight: '600', background: colors.bgBase, border: `1px solid ${colors.border}` }} value={editTitleText} onChange={(e) => setEditTitleText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveTitleEdit(activeSnippetData.id, e)} />
                                   <button onClick={(e) => saveTitleEdit(activeSnippetData.id, e)} style={{ background: themeColor, color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer' }}><Check size={16} /></button>
                               </div>
                            ) : (
                               <div style={{ display: 'flex', alignItems: 'center' }}>
                                   <h3 className="title-hover" style={{ margin: 0, color: colors.textTitle, fontSize: '18px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                     {activeTab.title}
                                     {activeSnippetData && activeSnippetData.id.length > 20 && !activeTab.title.includes('History') && (<Edit2 size={14} color={colors.textMain} onClick={(e) => { e.stopPropagation(); setEditingTitleId(activeSnippetData.id); setEditTitleText(activeSnippetData.title); }} className="title-edit-icon" title="Edit Name" />)}
                                   </h3>
                                   
                                   {/* TYPE TOGGLE FOR SCRATCHPADS */}
                                   {activeWorkspace === 'relevance' && (!activeSnippetId || activeTab.title.includes('Scratchpad')) && (
                                     <div onClick={toggleTabType} className="hover-lift" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '15px', background: colors.bgBase, padding: '4px 8px', borderRadius: '4px', border: `1px solid ${colors.border}`, fontSize: '10px', fontWeight: '700', cursor: 'pointer', color: themeColor }}>
                                       {activeTabType === 'session-relevance' ? <Globe size={12}/> : <FileCode size={12}/>}
                                       {activeTabType === 'session-relevance' ? 'SESSION MODE' : 'CLIENT MODE'}
                                     </div>
                                   )}
                               </div>
                            )}
                        </div>
                    </div>
                    {activeSnippetData && !activeTab.title.includes('History') && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                          <span style={{ padding: '4px 8px', background: themeBgColor, color: themeColor, borderRadius: '4px', fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{activeSnippetData.category}</span>
                          {activeSnippetData.updated_at && (<div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: colors.textMuted, fontWeight: '500' }}><Clock size={12} /><span>{activeSnippetData.updated_at}</span></div>)}
                      </div>
                    )}
                </div>
                {activeSnippetId && !activeTab.title.includes('History') && (
                  <div style={{ marginTop: '5px' }}>
                      <div style={{ fontSize: '11px', color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>Description</div>
                      <textarea value={activeSnippetData ? (localDescriptions[activeSnippetData.id] ?? activeSnippetData.description ?? "") : ""} onChange={(e) => activeSnippetData && handleLocalDescriptionChange(activeSnippetData.id, e.target.value)} disabled={!activeSnippetData} placeholder="Add description..." style={{ width: '100%', background: 'transparent', border: `1px solid ${colors.border}`, color: colors.textMain, padding: '8px', borderRadius: '6px', fontSize: '13px', resize: 'vertical', minHeight: '40px', fontFamily: "'Inter', sans-serif", outline: 'none' }} onFocus={(e) => e.target.style.border = `1px solid ${themeColor}`} onBlur={(e) => e.target.style.border = `1px solid ${colors.border}`} />
                  </div>
                )}
            </div>
            
            <div style={{ flex: 1, borderRadius: '8px', overflow: 'hidden', background: colors.editorBg, minHeight: 0, border: isDark ? 'none' : `1px solid ${colors.border}` }}>
              <Editor height="100%" language={activeWorkspace === 'relevance' ? 'bigfix' : 'bat'} theme={themeMode === 'dark' ? 'vs-dark' : 'light'} value={activeQuery} onChange={handleQueryChange} onMount={handleEditorDidMount} options={{ minimap: { enabled: false }, fontSize: 15, fontFamily: "'JetBrains Mono', monospace", padding: { top: 15 }, lineHeight: 24, wordWrap: wordWrap, quickSuggestions: autoSuggest, wordBasedSuggestions: false }} />
            </div>
          </div>

          <div className={`resizer-vertical ${isResizingTerminal ? 'active' : ''}`} onMouseDown={() => setIsResizingTerminal(true)}> <GripHorizontal size={18} /> </div>

          <div className="neu-pressed" style={{ height: `${terminalHeight}px`, display: 'flex', flexDirection: 'column', padding: '15px', flexShrink: 0, borderTop: isDark ? 'none' : `1px solid ${colors.border}` }}>
             <div style={{ fontSize: '14px', fontWeight: '700', color: colors.textMuted, letterSpacing: '1px', marginBottom: '10px', display:'flex', justifyContent:'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <span>TERMINAL OUTPUT</span>
                  <div style={{ position: 'relative' }}>
                    <Search size={12} style={{ position: 'absolute', left: '8px', top: '7px', color: colors.textMuted }} />
                    <input type="text" placeholder="Filter logs..." value={terminalSearch} onChange={(e) => setTerminalSearch(e.target.value)} style={{ padding: '4px 8px 4px 26px', fontSize: '11px', width: '180px', background: colors.panelInner, color: colors.textTitle, border: `1px solid ${colors.border}`, borderRadius: '4px', outline: 'none' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <span style={{ cursor:'pointer', color: colors.textMuted, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '700' }} onClick={handleSmartCopy} className="hover-lift">
                        <Copy size={12} /> SMART COPY
                    </span>
                    <span style={{ cursor:'pointer', color: themeColor, fontSize: '11px', fontWeight: '700' }} onClick={() => { updateActiveTabOutput('Ready...'); setTerminalSearch(''); }}>
                        CLEAR CONSOLE
                    </span>
                </div>
             </div>
             <div style={{ flex: 1, overflowY: 'auto', padding: '10px', background: colors.terminalBg, borderRadius: '8px', border: `1px solid ${colors.border}` }}>
                <div style={{ margin: 0 }}>{renderTerminalLines(activeWorkspace, activeTab?.terminalOutput || '', terminalSearch)}</div>
             </div>
          </div>
        </div>
      </div>

      {/* --- TARGET MODAL FOR REMOTE CLIENT QUERY --- */}
      {isRemoteModalOpen && (
        <div className="modal-overlay">
          <div className="neu-panel" style={{ width: '450px', padding: '25px', display: 'flex', flexDirection: 'column', gap: '15px', background: colors.panelBg }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h2 style={{ margin: 0, color: '#10b981', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}><Target size={22} /> Target Endpoint</h2>
                <button onClick={() => setIsRemoteModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={22} /></button>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: colors.textMuted, lineHeight: '1.5' }}>Enter a Computer ID or Hostname. If you enter a hostname, the API will attempt to resolve it automatically.</p>
            <div style={{ padding: '15px', background: colors.panelInner, borderRadius: '8px', border: `1px solid ${colors.border}` }}>
                <label style={{ fontSize:'13px', color: colors.textMain, marginBottom:'6px', display:'block', fontWeight:'600' }}>Hostname or ID</label>
                <input autoFocus className="neu-input" style={{ padding: '10px', background: colors.bgBase, border: `1px solid ${colors.border}`, fontSize: '16px', fontWeight: '600', letterSpacing: '1px' }} value={remoteTarget} onChange={e => setRemoteTarget(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runRemoteQuery()} placeholder="e.g. 12345678 or SRV-DB-01" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button onClick={() => setIsRemoteModalOpen(false)} style={{ padding:'8px 16px', background:'transparent', color: colors.textMuted, border:'none', cursor:'pointer', fontWeight:'600', fontSize:'14px' }}>Cancel</button>
              <button onClick={runRemoteQuery} className="hover-lift" style={{ padding:'8px 24px', background: '#10b981', color:'#fff', border:'none', borderRadius:'6px', cursor: 'pointer', fontWeight:'700', fontSize:'14px' }}>DISPATCH QUERY</button>
            </div>
          </div>
        </div>
      )}

      {/* --- SETTINGS MODAL --- */}
      {isSettingsOpen && (
        <div className="modal-overlay">
          <div className="neu-panel" style={{ width: '500px', padding: '25px', display: 'flex', flexDirection: 'column', gap: '15px', background: colors.panelBg }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}><h2 style={{ margin: 0, color: colors.textTitle, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}><Server size={22} color={themeColor} /> BigFix API Connection</h2><button onClick={() => { setIsSettingsOpen(false); setTestConnResult(''); }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={22} /></button></div>
            <p style={{ margin: 0, fontSize: '13px', color: colors.textMuted, lineHeight: '1.5' }}>Configure your Root Server details to evaluate queries instantly via the REST API.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '15px', background: colors.panelInner, borderRadius: '8px', border: `1px solid ${colors.border}` }}>
                <div><label style={{ fontSize:'13px', color: colors.textMain, marginBottom:'6px', display:'block', fontWeight:'600' }}>Root Server URL</label><input className="neu-input" style={{ padding: '8px', background: colors.bgBase, border: `1px solid ${colors.border}` }} value={apiSettings.url} onChange={e => setApiSettings({...apiSettings, url: e.target.value})} placeholder="https://your-root-server:52311" /></div>
                <div style={{ display: 'flex', gap: '15px' }}><div style={{ flex: 1 }}><label style={{ fontSize:'13px', color: colors.textMain, marginBottom:'6px', display:'block', fontWeight:'600' }}>Username</label><input className="neu-input" style={{ padding: '8px', background: colors.bgBase, border: `1px solid ${colors.border}` }} value={apiSettings.username} onChange={e => setApiSettings({...apiSettings, username: e.target.value})} placeholder="API User" /></div><div style={{ flex: 1 }}><label style={{ fontSize:'13px', color: colors.textMain, marginBottom:'6px', display:'block', fontWeight:'600' }}>Password</label><input type="password" className="neu-input" style={{ padding: '8px', background: colors.bgBase, border: `1px solid ${colors.border}` }} value={apiSettings.password} onChange={e => setApiSettings({...apiSettings, password: e.target.value})} placeholder="••••••••" /></div></div>
            </div>
            {testConnResult && (<div style={{ padding: '10px', fontSize: '12px', fontWeight: '600', color: testConnResult.includes('❌') ? '#ef4444' : '#10b981', background: colors.panelInner, border: `1px solid ${colors.border}`, borderRadius: '6px' }}>{testConnResult}</div>)}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
              <button onClick={handleTestConnection} className="hover-lift" style={{ padding:'8px 16px', background: 'transparent', color: themeColor, border: `1px solid ${themeColor}`, borderRadius:'6px', cursor:'pointer', fontWeight:'600', fontSize:'13px' }}>Test Connection</button>
              <div style={{ display: 'flex', gap: '10px' }}><button onClick={() => { setIsSettingsOpen(false); setTestConnResult(''); }} style={{ padding:'8px 16px', background:'transparent', color: colors.textMuted, border:'none', cursor:'pointer', fontWeight:'600', fontSize:'14px' }}>Cancel</button><button onClick={handleSaveSettings} disabled={isSavingSettings} className="hover-lift" style={{ padding:'8px 16px', background: themeColor, color:'#fff', border:'none', borderRadius:'6px', cursor: isSavingSettings ? 'wait' : 'pointer', fontWeight:'600', fontSize:'14px' }}>{isSavingSettings ? 'Saving...' : 'Save Connection'}</button></div>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD/SAVE SNIPPET MODAL --- */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="neu-panel" style={{ width: '600px', padding: '25px', display: 'flex', flexDirection: 'column', gap: '15px', background: colors.panelBg }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2 style={{ margin: 0, color: colors.textTitle, fontSize: '20px' }}>Save Query to Library</h2></div>
            <div style={{ display: 'flex', gap: '15px' }}><div style={{ flex: 1 }}><label style={{ fontSize:'13px', color: colors.textMain, marginBottom:'6px', display:'block', fontWeight:'600' }}>Title *</label><input className="neu-input" style={{ padding: '8px', background: colors.bgBase, border: `1px solid ${colors.border}` }} value={newSnippet.title} onChange={e => setNewSnippet({...newSnippet, title: e.target.value})} /></div>{activeWorkspace === 'relevance' && (<div style={{ flex: 1 }}><label style={{ fontSize:'13px', color: colors.textMain, marginBottom:'6px', display:'block', fontWeight:'600' }}>Type</label><select className="neu-input" style={{ padding: '8px', background: colors.bgBase, border: `1px solid ${colors.border}`, cursor: 'pointer' }} value={newSnippet.type} onChange={e => setNewSnippet({...newSnippet, type: e.target.value})}><option value="client-relevance">Client Relevance (Local/Remote)</option><option value="session-relevance">Session Relevance (API)</option></select></div>)}</div>
            <div style={{ display: 'flex', gap: '15px' }}><div style={{ flex: 1 }}><label style={{ fontSize:'13px', color: colors.textMain, marginBottom:'6px', display:'block', fontWeight:'600' }}>Category</label><input className="neu-input" style={{ padding: '8px', background: colors.bgBase, border: `1px solid ${colors.border}` }} value={newSnippet.category} onChange={e => setNewSnippet({...newSnippet, category: e.target.value})} /></div></div>
            <div><label style={{ fontSize:'13px', color: colors.textMain, marginBottom:'6px', display:'block', fontWeight:'600' }}>Description</label><input className="neu-input" style={{ padding: '8px', background: colors.bgBase, border: `1px solid ${colors.border}` }} value={newSnippet.description} onChange={e => setNewSnippet({...newSnippet, description: e.target.value})} /></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}><button onClick={() => setIsModalOpen(false)} style={{ padding:'8px 16px', background:'transparent', color: colors.textMuted, border:'none', cursor:'pointer', fontWeight:'600', fontSize:'14px' }}>Cancel</button><button onClick={handleSaveSnippet} className="hover-lift" style={{ padding:'8px 16px', background: themeColor, color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer', fontWeight:'600', fontSize:'14px' }}>Save Item</button></div>
          </div>
        </div>
      )}

      {/* --- EXPORT TO .BES MODAL --- */}
      {isBesModalOpen && (
        <div className="modal-overlay">
          <div className="neu-panel bes-modal" style={{ width: isBesMaximized ? '95vw' : '800px', height: isBesMaximized ? '95vh' : 'auto', maxHeight: '95vh', display: 'flex', flexDirection: 'column', gap: '15px', background: colors.panelBg, padding: '25px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2 style={{ margin: 0, color: '#10b981', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}><Download size={22} /> Generate BigFix Fixlet (.bes)</h2><div style={{ display: 'flex', gap: '10px' }}><button onClick={() => setIsBesMaximized(!isBesMaximized)} className="hover-lift" title={isBesMaximized ? "Restore Size" : "Maximize Screen"} style={{ background: 'transparent', border: 'none', color: colors.textMuted, cursor: 'pointer' }}>{isBesMaximized ? <Shrink size={18} /> : <Maximize size={18} />}</button><button onClick={() => setIsBesModalOpen(false)} className="hover-lift" title="Close" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={22} /></button></div></div>
            <div style={{ display: 'flex', flexDirection: isBesMaximized ? 'row' : 'column', gap: '20px', flex: 1, overflow: 'hidden' }}>
                <div style={{ flex: isBesMaximized ? '1' : 'none', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px', paddingRight: '10px' }}>
                    <div style={{ padding: '15px', background: colors.panelInner, borderRadius: '8px', border: `1px solid ${colors.border}` }}><label style={{ fontSize:'13px', color: colors.textMain, marginBottom:'6px', display:'block', fontWeight:'600' }}>Fixlet Title *</label><input className="neu-input" style={{ padding: '8px', background: colors.bgBase, border: `1px solid ${colors.border}` }} value={besForm.title} onChange={e => setBesForm({...besForm, title: e.target.value})} placeholder="e.g. Deploy Chrome Update" /></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <label style={{ fontSize:'13px', color: '#0ea5e9', fontWeight:'700' }}>1. Relevance Code</label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Search size={12} color={colors.textMuted}/><input placeholder="Search library to load..." value={relSearch} style={{ padding: '4px 8px', fontSize: '11px', width: '220px', background: colors.bgBase, color: colors.textTitle, border: `1px solid ${colors.border}`, borderRadius: '4px', outline: 'none' }} onFocus={() => setShowRelDropdown(true)} onBlur={() => setTimeout(() => setShowRelDropdown(false), 200)} onChange={(e) => setRelSearch(e.target.value)}/>
                                {showRelDropdown && (<div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', width: '220px', maxHeight: '150px', overflowY: 'auto', background: colors.panelBg, border: `1px solid ${colors.border}`, borderRadius: '6px', boxShadow: shadows.neuOut, zIndex: 1000 }}>{library.filter(i => (i.type === 'client-relevance' || i.type === 'relevance') && i.title.toLowerCase().includes(relSearch.toLowerCase())).map(item => (<div key={item.id} style={{ padding: '8px 10px', fontSize: '11px', color: colors.textTitle, cursor: 'pointer', borderBottom: `1px solid ${colors.border}` }} onMouseDown={() => { setBesForm(prev => ({...prev, relText: item.query})); setRelSearch(''); setShowRelDropdown(false); }} onMouseOver={(e) => e.currentTarget.style.background = colors.hover} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>{item.title}</div>))}</div>)}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}><textarea value={besForm.relText} onChange={e => setBesForm({...besForm, relText: e.target.value})} placeholder="Enter Relevance here... (Leave blank to default to 'true')" style={{ flex: 1, height: isBesMaximized ? '180px' : '80px', background: colors.editorBg, border: `1px solid ${colors.border}`, color: colors.textTitle, padding: '10px', borderRadius: '6px', fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", resize: 'none', outline: 'none' }} /><button onClick={testBesRelevance} disabled={isBesTestingRel} className="hover-lift" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 15px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '6px', cursor: isBesTestingRel ? 'wait' : 'pointer', fontWeight: '700', fontSize: '11px' }}><Play size={16} style={{ marginBottom: '4px' }}/> {isBesTestingRel ? 'Running...' : 'TEST'}</button></div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <label style={{ fontSize:'13px', color: '#d97706', fontWeight:'700' }}>2. ActionScript Code</label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Search size={12} color={colors.textMuted}/><input placeholder="Search library to load..." value={actSearch} style={{ padding: '4px 8px', fontSize: '11px', width: '220px', background: colors.bgBase, color: colors.textTitle, border: `1px solid ${colors.border}`, borderRadius: '4px', outline: 'none' }} onFocus={() => setShowActDropdown(true)} onBlur={() => setTimeout(() => setShowActDropdown(false), 200)} onChange={(e) => setActSearch(e.target.value)}/>
                                {showActDropdown && (<div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', width: '220px', maxHeight: '150px', overflowY: 'auto', background: colors.panelBg, border: `1px solid ${colors.border}`, borderRadius: '6px', boxShadow: shadows.neuOut, zIndex: 1000 }}>{library.filter(i => i.type === 'actionscript' && i.title.toLowerCase().includes(actSearch.toLowerCase())).map(item => (<div key={item.id} style={{ padding: '8px 10px', fontSize: '11px', color: colors.textTitle, cursor: 'pointer', borderBottom: `1px solid ${colors.border}` }} onMouseDown={() => { setBesForm(prev => ({...prev, actText: item.query})); setActSearch(''); setShowActDropdown(false); }} onMouseOver={(e) => e.currentTarget.style.background = colors.hover} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>{item.title}</div>))}</div>)}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}><textarea value={besForm.actText} onChange={e => setBesForm({...besForm, actText: e.target.value})} placeholder="Enter ActionScript here..." style={{ flex: 1, height: isBesMaximized ? '220px' : '100px', background: colors.editorBg, border: `1px solid ${colors.border}`, color: colors.textTitle, padding: '10px', borderRadius: '6px', fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", resize: 'none', outline: 'none' }} /><button onClick={testBesActionScript} disabled={isBesTestingAct} className="hover-lift" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 15px', background: '#d97706', color: '#fff', border: 'none', borderRadius: '6px', cursor: isBesTestingAct ? 'wait' : 'pointer', fontWeight: '700', fontSize: '11px' }}><Play size={16} style={{ marginBottom: '4px' }}/> {isBesTestingAct ? 'Running...' : 'TEST'}</button></div>
                    </div>
                </div>
                <div style={{ width: isBesMaximized ? '45%' : '100%', height: isBesMaximized ? '100%' : '200px', display: 'flex', flexDirection: 'column', gap: '15px', overflow: 'hidden' }}>
                    <div className="neu-pressed" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10px', border: isDark ? 'none' : `1px solid ${colors.border}`, background: colors.panelBg }}><div style={{ fontSize: '11px', color: '#0ea5e9', fontWeight: '800', marginBottom: '8px', letterSpacing: '0.5px' }}>RELEVANCE TEST OUTPUT</div><div style={{ flex: 1, overflowY: 'auto', background: colors.terminalBg, borderRadius: '6px', border: `1px solid ${colors.border}`, padding: '8px' }}>{renderTerminalLines('relevance', besRelResult)}</div></div>
                    <div className="neu-pressed" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10px', border: isDark ? 'none' : `1px solid ${colors.border}`, background: colors.panelBg }}><div style={{ fontSize: '11px', color: '#d97706', fontWeight: '800', marginBottom: '8px', letterSpacing: '0.5px' }}>ACTIONSCRIPT TEST OUTPUT</div><div style={{ flex: 1, overflowY: 'auto', background: colors.terminalBg, borderRadius: '6px', border: `1px solid ${colors.border}`, padding: '8px' }}>{renderTerminalLines('actionscript', besActResult)}</div></div>
                </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: `1px solid ${colors.border}` }}><button onClick={() => setIsBesModalOpen(false)} style={{ padding:'8px 16px', background:'transparent', color: colors.textMuted, border:'none', cursor:'pointer', fontWeight:'600', fontSize:'14px' }}>Cancel</button><button onClick={handleGenerateBes} className="hover-lift" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding:'8px 24px', background: '#10b981', color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer', fontWeight:'800', fontSize:'14px' }}><Download size={18} /> DOWNLOAD .BES</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;