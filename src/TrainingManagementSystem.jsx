import React, { useState, useEffect } from 'react';
import { Check, ChevronDown, ChevronRight, Link as LinkIcon, Trash2, Edit, Plus, X, LogOut, Users, TrendingUp, BookOpen, Menu, FileText, Video, File, UploadCloud } from 'lucide-react';
import { supabase } from './supabaseClient';

// --- HELPER FUNCTIONS ---

const getCategoryProgress = (progressMap, userId, pathId, categoryId) => {
  const key = `${userId}-${pathId}-${categoryId}`;
  return progressMap[key] || false;
};

const getUserProgress = (trainingPaths, progressMap, userId) => {
  let completed = 0;
  let total = 0;
  trainingPaths.forEach(path => {
    path.categories.forEach(category => {
      total++;
      if (getCategoryProgress(progressMap, userId, path.id, category.id)) {
        completed++;
      }
    });
  });
  return { completed, total, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
};

const getBranchProgress = (users, trainingPaths, progressMap, branchId) => {
  const branchStaff = users.filter(u => u.branchId === branchId && u.role === 'staff');
  let totalCompleted = 0;
  let totalModules = 0;
  
  branchStaff.forEach(staff => {
    const userProg = getUserProgress(trainingPaths, progressMap, staff.id);
    totalCompleted += userProg.completed;
    totalModules += userProg.total;
  });

  return {
    completed: totalCompleted,
    total: totalModules,
    percentage: totalModules > 0 ? Math.round((totalCompleted / totalModules) * 100) : 0,
    staffCount: branchStaff.length
  };
};

// Simple CSV Parser (No external libraries needed)
const parseCSV = (text) => {
  const lines = text.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const entry = {};
    headers.forEach((h, i) => {
      entry[h] = values[i]?.trim();
    });
    return entry;
  });
};

// --- SUB-COMPONENTS ---

const LoginScreen = ({ users, onLogin, loading }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 w-full max-w-md border border-purple-100">
        <div className="text-center mb-8">
          <BookOpen className="w-16 h-16 text-purple-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Training Portal</h1>
          <p className="text-gray-600 mt-2">Sign in to access your training</p>
        </div>
        <div className="space-y-4">
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg" placeholder="Username" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && onLogin(username, password)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg" placeholder="Password" />
          <button onClick={() => onLogin(username, password)} disabled={loading} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-2.5 rounded-lg font-medium shadow-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50">
            {loading ? 'Loading...' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
};

const BulkUploadButton = ({ onUploadComplete }) => {
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const data = parseCSV(text);
        
        let successCount = 0;

        for (const row of data) {
          // 1. Validate Row
          if (!row.path || !row.category || !row.material || !row.url) continue;

          // 2. Find or Create Path
          let pathId;
          const { data: existingPaths } = await supabase.from('training_paths').select('id').eq('name', row.path).single();
          
          if (existingPaths) {
            pathId = existingPaths.id;
          } else {
            const newId = `path-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            await supabase.from('training_paths').insert({ id: newId, name: row.path });
            pathId = newId;
          }

          // 3. Find or Create Category
          let categoryId;
          const { data: existingCats } = await supabase.from('categories').select('id').eq('name', row.category).eq('path_id', pathId).single();
          
          if (existingCats) {
            categoryId = existingCats.id;
          } else {
            const newCatId = `cat-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            await supabase.from('categories').insert({ id: newCatId, path_id: pathId, name: row.category });
            categoryId = newCatId;
          }

          // 4. Insert Material
          const newMatId = `mat-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
          await supabase.from('materials').insert({
            id: newMatId,
            category_id: categoryId,
            name: row.material, // This maps to "Material Name" in CSV
            type: row.type?.toLowerCase() || 'link',
            url: row.url
          });
          
          successCount++;
        }

        alert(`Successfully imported ${successCount} items!`);
        onUploadComplete();
        
      } catch (error) {
        console.error(error);
        alert('Error parsing CSV. Please check the format.');
      } finally {
        setUploading(false);
        e.target.value = null; // Reset input
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="relative">
      <input
        type="file"
        accept=".csv"
        onChange={handleFileUpload}
        disabled={uploading}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <button disabled={uploading} className="flex items-center space-x-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium shadow-sm">
        <UploadCloud className="w-5 h-5 text-purple-600" />
        <span>{uploading ? 'Importing...' : 'Bulk Import CSV'}</span>
      </button>
    </div>
  );
};

const MaterialItem = ({ material, onDelete, onEdit }) => {
  const getIcon = (type) => {
    switch (type) {
      case 'video': return <Video className="w-4 h-4" />;
      case 'document': return <FileText className="w-4 h-4" />;
      default: return <File className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-purple-300 transition-colors group">
      <a href={material.url} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-3 flex-1 text-purple-600 hover:text-purple-700">
        {getIcon(material.type)}
        <div><div className="text-sm font-medium">{material.name}</div><div className="text-xs text-gray-500 capitalize">{material.type}</div></div>
      </a>
      <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onEdit(material)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"><Edit className="w-3.5 h-3.5" /></button>
        <button onClick={() => onDelete(material.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
};

const MaterialForm = ({ onSave, onCancel, initialData = null }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [type, setType] = useState(initialData?.type || 'document');
  const [url, setUrl] = useState(initialData?.url || '');

  const handleSubmit = () => {
    if (!name || !url) return;
    onSave({ name, type, url });
  };

  return (
    <div className="space-y-3 p-4 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Material Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" autoFocus />
      </div>
      <div className="flex space-x-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="document">Document</option>
            <option value="video">Video</option>
            <option value="link">Link</option>
          </select>
        </div>
        <div className="flex-[2]">
          <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
      </div>
      <div className="flex space-x-2 pt-2">
        <button onClick={handleSubmit} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">{initialData ? 'Update' : 'Add'}</button>
        <button onClick={onCancel} className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">Cancel</button>
      </div>
    </div>
  );
};

// --- MAIN VIEWS ---

const TrainingView = ({ currentUser, trainingPaths, progress, onToggleComplete, onLogout }) => {
  const [selectedPath, setSelectedPath] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const userProg = getUserProgress(trainingPaths, progress, currentUser.id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100"><Menu className="w-6 h-6" /></button>
              <div><h1 className="text-2xl font-bold text-gray-900 tracking-tight">Training Portal</h1><p className="text-sm text-gray-600">{currentUser.name}</p></div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right hidden sm:block">
                <div className="text-xs text-gray-500 uppercase">Progress</div>
                <div className="text-2xl font-bold text-purple-600">{userProg.percentage}%</div>
              </div>
              <button onClick={onLogout} className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"><LogOut className="w-4 h-4" /><span className="hidden sm:inline">Logout</span></button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className={`lg:col-span-1 ${showMobileMenu ? 'block' : 'hidden lg:block'}`}>
            <div className="bg-white rounded-xl shadow-sm p-4 sticky top-4 border border-gray-100">
              <h2 className="font-semibold text-gray-800 mb-4">Training Paths</h2>
              <div className="space-y-2">
                {trainingPaths.map(path => (
                  <button key={path.id} onClick={() => { setSelectedPath(path.id); setShowMobileMenu(false); }} className={`w-full text-left px-4 py-3 rounded-lg transition-all ${selectedPath === path.id ? 'bg-purple-100 text-purple-700 font-medium' : 'hover:bg-gray-50 text-gray-700'}`}>
                    {path.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="lg:col-span-3">
            {!selectedPath ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-100">
                <BookOpen className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Select a Training Path</h2>
                <p className="text-gray-600">Choose a path from the menu to start learning</p>
              </div>
            ) : (
              <div className="space-y-4">
                {trainingPaths.find(p => p.id === selectedPath)?.categories.map(category => {
                  const isCompleted = getCategoryProgress(progress, currentUser.id, selectedPath, category.id);
                  const isExpanded = expandedCategories[category.id];
                  const materials = category.materials || [];

                  return (
                    <div key={category.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 hover:shadow-md transition-shadow">
                      <div className="p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50" onClick={() => setExpandedCategories(prev => ({ ...prev, [category.id]: !prev[category.id] }))}>
                        <div className="flex items-center space-x-3 flex-1">
                          {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                          <h3 className="font-medium text-gray-900">{category.name}</h3>
                          <span className="text-xs text-gray-500">({materials.length})</span>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); onToggleComplete(selectedPath, category.id); }} className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${isCompleted ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                          <Check className="w-4 h-4" />
                          <span className="text-sm font-medium">{isCompleted ? 'Completed' : 'Mark Complete'}</span>
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="border-t border-gray-100 p-5 bg-gray-50">
                          {materials.length > 0 ? (
                            <div className="space-y-2">
                              {materials.map(mat => <MaterialItem key={mat.id} material={mat} onDelete={() => {}} onEdit={() => {}} />)}
                            </div>
                          ) : <p className="text-sm text-gray-500 italic text-center">No materials available</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ManagerDashboard = ({ currentUser, users, branches, trainingPaths, progress, onLogout, onChangeView }) => {
  const managerBranch = branches.find(b => b.id === currentUser.branchId);
  const branchStaff = users.filter(u => u.branchId === currentUser.branchId && u.role === 'staff');
  const branchProg = getBranchProgress(users, trainingPaths, progress, currentUser.branchId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-gray-900">Manager Dashboard</h1><p className="text-sm text-gray-600">{currentUser.name} - {managerBranch?.name}</p></div>
          <div className="flex items-center space-x-4">
            <button onClick={() => onChangeView('training')} className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg">My Training</button>
            <button onClick={onLogout} className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"><LogOut className="w-4 h-4" /><span>Logout</span></button>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6"><div className="flex justify-between"><div><p className="text-sm text-gray-600">Total Staff</p><p className="text-3xl font-bold">{branchStaff.length}</p></div><Users className="w-12 h-12 text-purple-600" /></div></div>
          <div className="bg-purple-600 rounded-xl shadow-lg p-6 text-white"><div className="flex justify-between"><div><p className="text-sm text-purple-100">Branch Progress</p><p className="text-3xl font-bold">{branchProg.percentage}%</p></div><TrendingUp className="w-12 h-12 text-purple-200" /></div></div>
          <div className="bg-white rounded-xl shadow-sm p-6"><div className="flex justify-between"><div><p className="text-sm text-gray-600">Total Modules</p><p className="text-3xl font-bold">{trainingPaths.reduce((sum, path) => sum + path.categories.length, 0)}</p></div><BookOpen className="w-12 h-12 text-indigo-600" /></div></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200"><h2 className="text-lg font-semibold text-gray-900">Staff Progress</h2></div>
          <table className="w-full">
            <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staff</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completed</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th></tr></thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {branchStaff.map(staff => {
                const prog = getUserProgress(trainingPaths, progress, staff.id);
                return (
                  <tr key={staff.id}>
                    <td className="px-6 py-4"><div className="text-sm font-medium text-gray-900">{staff.name}</div></td>
                    <td className="px-6 py-4 text-sm text-gray-900">{prog.completed} / {prog.total}</td>
                    <td className="px-6 py-4"><div className="flex items-center"><div className="w-full bg-gray-200 rounded-full h-2 mr-2"><div className="bg-purple-600 h-2 rounded-full" style={{ width: `${prog.percentage}%` }}></div></div><span className="text-sm text-gray-700">{prog.percentage}%</span></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const AdminDashboard = ({ currentUser, users, branches, trainingPaths, progress, onLogout, onRenamePath, onAddPath, onDeletePath, onAddCategory, onUpdateCategory, onDeleteCategory, onRenameCategory, onAddMaterial, onUpdateMaterial, onDeleteMaterial, onRefreshData }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [editingPath, setEditingPath] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [showAddCategory, setShowAddCategory] = useState(null);
  const [showAddPath, setShowAddPath] = useState(false);
  const [showAddMaterial, setShowAddMaterial] = useState(null);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newPathName, setNewPathName] = useState('');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1><p className="text-sm text-gray-600">{currentUser.name}</p></div>
          <button onClick={onLogout} className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"><LogOut className="w-4 h-4" /><span>Logout</span></button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 border-b border-gray-200 flex space-x-8">
          <button onClick={() => setActiveTab('overview')} className={`pb-4 px-2 font-medium border-b-2 transition-colors ${activeTab === 'overview' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Overview</button>
          <button onClick={() => setActiveTab('manage')} className={`pb-4 px-2 font-medium border-b-2 transition-colors ${activeTab === 'manage' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Manage Training</button>
        </div>

        {activeTab === 'overview' ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {branches.map(branch => {
                const branchProg = getBranchProgress(users, trainingPaths, progress, branch.id);
                return (
                  <div key={branch.id} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <div className="flex justify-between mb-4"><h3 className="text-lg font-semibold text-gray-900">{branch.name}</h3><div className="text-right"><div className="text-2xl font-bold text-purple-600">{branchProg.percentage}%</div></div></div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5"><div className="bg-purple-600 h-2.5 rounded-full" style={{ width: `${branchProg.percentage}%` }}></div></div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-end space-x-3">
              <BulkUploadButton onUploadComplete={onRefreshData} />
              <button onClick={() => setShowAddPath(true)} className="flex items-center space-x-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow-md">
                <Plus className="w-5 h-5" /><span>Add Path</span>
              </button>
            </div>

            {showAddPath && (
              <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-purple-300 flex items-center space-x-3">
                <input type="text" value={newPathName} onChange={(e) => setNewPathName(e.target.value)} placeholder="Path Name" className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg" autoFocus />
                <button onClick={() => newPathName && onAddPath(newPathName, () => { setShowAddPath(false); setNewPathName(''); })} className="px-6 py-2.5 bg-purple-600 text-white rounded-lg">Create</button>
                <button onClick={() => setShowAddPath(false)} className="p-2.5 text-gray-600 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
            )}

            {trainingPaths.map(path => (
              <div key={path.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  {editingPath === path.id ? (
                    <input type="text" defaultValue={path.name} onBlur={(e) => { onRenamePath(path.id, e.target.value); setEditingPath(null); }} className="text-lg font-semibold px-3 py-1.5 border border-purple-300 rounded-lg" autoFocus />
                  ) : (
                    <div className="flex items-center space-x-3"><h2 className="text-lg font-semibold text-gray-900">{path.name}</h2><button onClick={() => setEditingPath(path.id)} className="p-1.5 hover:bg-purple-100 rounded"><Edit className="w-4 h-4 text-purple-600" /></button><button onClick={() => onDeletePath(path.id)} className="p-1.5 hover:bg-red-100 rounded"><Trash2 className="w-4 h-4 text-red-600" /></button></div>
                  )}
                  <button onClick={() => setShowAddCategory(path.id)} className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"><Plus className="w-4 h-4" /><span>Add Category</span></button>
                </div>

                {showAddCategory === path.id && (
                  <div className="px-6 py-4 bg-purple-50 flex items-center space-x-3">
                    <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Category Name" className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg" autoFocus />
                    <button onClick={() => newCategoryName && onAddCategory(path.id, newCategoryName, () => { setShowAddCategory(null); setNewCategoryName(''); })} className="px-6 py-2.5 bg-purple-600 text-white rounded-lg">Add</button>
                    <button onClick={() => setShowAddCategory(null)} className="p-2.5 text-gray-600 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                  </div>
                )}

                <div className="divide-y divide-gray-100">
                  {path.categories.map(category => (
                    <div key={category.id} className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        {editingCategory === category.id ? (
                          <input type="text" defaultValue={category.name} onBlur={(e) => { onRenameCategory(path.id, category.id, e.target.value); setEditingCategory(null); }} className="font-medium text-gray-900 px-3 py-1.5 border border-purple-300 rounded-lg" autoFocus />
                        ) : (
                          <div className="flex items-center space-x-2"><h3 className="font-medium text-gray-900">{category.name}</h3><button onClick={() => setEditingCategory(category.id)} className="p-1 hover:bg-gray-100 rounded"><Edit className="w-3.5 h-3.5 text-gray-600" /></button></div>
                        )}
                        <button onClick={() => onDeleteCategory(path.id, category.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                      </div>
                      
                      {/* Materials List */}
                      <div className="space-y-3 pl-4 border-l-2 border-gray-100">
                        {(category.materials || []).map(mat => (
                          <MaterialItem 
                            key={mat.id} 
                            material={mat} 
                            onDelete={(matId) => onDeleteMaterial(path.id, category.id, matId)}
                            onEdit={(mat) => setEditingMaterial({ categoryId: category.id, data: mat })}
                          />
                        ))}
                        
                        {showAddMaterial === category.id ? (
                          <MaterialForm 
                            onSave={(data) => { onAddMaterial(path.id, category.id, data); setShowAddMaterial(null); }}
                            onCancel={() => setShowAddMaterial(null)}
                          />
                        ) : (
                           !editingMaterial && <button onClick={() => setShowAddMaterial(category.id)} className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center space-x-1"><Plus className="w-3 h-3" /><span>Add Material</span></button>
                        )}

                        {editingMaterial?.categoryId === category.id && (
                          <MaterialForm 
                            initialData={editingMaterial.data}
                            onSave={(data) => { onUpdateMaterial(path.id, category.id, editingMaterial.data.id, data); setEditingMaterial(null); }}
                            onCancel={() => setEditingMaterial(null)}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// --- MAIN PARENT COMPONENT ---

const TrainingManagementSystem = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [branches, setBranches] = useState([]);
  const [users, setUsers] = useState([]);
  const [trainingPaths, setTrainingPaths] = useState([]);
  const [progress, setProgress] = useState({});
  const [view, setView] = useState('login');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: branchesData } = await supabase.from('branches').select('*');
      if (branchesData) setBranches(branchesData);

      const { data: usersData } = await supabase.from('users').select('*');
      if (usersData) setUsers(usersData);

      const { data: pathsData } = await supabase.from('training_paths').select(`*, categories(*, materials(*))`).order('id');
      if (pathsData) {
        const sortedPaths = pathsData.map(path => ({
          ...path,
          categories: path.categories ? path.categories.sort((a, b) => a.name.localeCompare(b.name)) : []
        }));
        setTrainingPaths(sortedPaths);
      }

      const { data: progressData } = await supabase.from('user_progress').select('*');
      if (progressData) {
        const progressMap = {};
        progressData.forEach(p => {
          if (p.completed) progressMap[`${p.user_id}-${p.path_id}-${p.category_id}`] = true;
        });
        setProgress(progressMap);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleLogin = (username, password) => {
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      setCurrentUser(user);
      setView(user.role === 'admin' ? 'admin-dashboard' : user.role === 'manager' ? 'manager-dashboard' : 'training');
    } else {
      alert('Invalid credentials');
    }
  };

  const handleLogout = () => { setCurrentUser(null); setView('login'); };

  const toggleCategoryCompletion = async (pathId, categoryId) => {
    const key = `${currentUser.id}-${pathId}-${categoryId}`;
    const isComplete = progress[key];
    const newValue = !isComplete;
    setProgress(prev => ({ ...prev, [key]: newValue }));
    if (newValue) {
      await supabase.from('user_progress').upsert({ user_id: currentUser.id, path_id: pathId, category_id: categoryId, completed: true });
    } else {
      await supabase.from('user_progress').delete().match({ user_id: currentUser.id, path_id: pathId, category_id: categoryId });
    }
  };

  const addPath = async (pathName, onSuccess) => {
    const newId = `path-${Date.now()}`;
    const newPath = { id: newId, name: pathName, categories: [] };
    setTrainingPaths(prev => [...prev, newPath]);
    if (onSuccess) onSuccess();
    await supabase.from('training_paths').insert({ id: newId, name: pathName });
  };

  const deletePath = async (pathId) => {
    if (confirm('Delete this path?')) {
      setTrainingPaths(prev => prev.filter(p => p.id !== pathId));
      await supabase.from('training_paths').delete().match({ id: pathId });
    }
  };

  const addCategory = async (pathId, categoryName, onSuccess) => {
    const newId = `cat-${Date.now()}`;
    const newCategory = { id: newId, path_id: pathId, name: categoryName, materials: [] };
    setTrainingPaths(prev => prev.map(path => path.id === pathId ? { ...path, categories: [...path.categories, newCategory] } : path));
    if (onSuccess) onSuccess();
    await supabase.from('categories').insert({ id: newId, path_id: pathId, name: categoryName });
  };

  const updateCategory = async (pathId, categoryId, field, value) => {
    setTrainingPaths(prev => prev.map(path => path.id === pathId ? { ...path, categories: path.categories.map(cat => cat.id === categoryId ? { ...cat, [field]: value } : cat) } : path));
    await supabase.from('categories').update({ [field]: value }).match({ id: categoryId });
  };

  const deleteCategory = async (pathId, categoryId) => {
    if (confirm('Delete category?')) {
      setTrainingPaths(prev => prev.map(path => path.id === pathId ? { ...path, categories: path.categories.filter(c => c.id !== categoryId) } : path));
      await supabase.from('categories').delete().match({ id: categoryId });
    }
  };

  const renamePath = async (pathId, newName) => {
    setTrainingPaths(prev => prev.map(path => path.id === pathId ? { ...path, name: newName } : path));
    await supabase.from('training_paths').update({ name: newName }).match({ id: pathId });
  };

  const renameCategory = async (pathId, categoryId, newName) => { updateCategory(pathId, categoryId, 'name', newName); };

  const addMaterial = async (pathId, categoryId, materialData) => {
    const newId = `mat-${Date.now()}`;
    const newMaterial = { id: newId, category_id: categoryId, ...materialData };
    setTrainingPaths(prev => prev.map(path => path.id === pathId ? { ...path, categories: path.categories.map(cat => cat.id === categoryId ? { ...cat, materials: [...(cat.materials || []), newMaterial] } : cat) } : path));
    await supabase.from('materials').insert(newMaterial);
  };

  const updateMaterial = async (pathId, categoryId, materialId, materialData) => {
    setTrainingPaths(prev => prev.map(path => path.id === pathId ? { ...path, categories: path.categories.map(cat => cat.id === categoryId ? { ...cat, materials: (cat.materials || []).map(m => m.id === materialId ? { ...m, ...materialData } : m) } : cat) } : path));
    await supabase.from('materials').update(materialData).match({ id: materialId });
  };

  const deleteMaterial = async (pathId, categoryId, materialId) => {
    if (confirm('Delete material?')) {
      setTrainingPaths(prev => prev.map(path => path.id === pathId ? { ...path, categories: path.categories.map(cat => cat.id === categoryId ? { ...cat, materials: (cat.materials || []).filter(m => m.id !== materialId) } : cat) } : path));
      await supabase.from('materials').delete().match({ id: materialId });
    }
  };

  if (!currentUser) return <LoginScreen users={users} onLogin={handleLogin} loading={loading} />;
  if (view === 'admin-dashboard') return <AdminDashboard currentUser={currentUser} users={users} branches={branches} trainingPaths={trainingPaths} progress={progress} onLogout={handleLogout} onRenamePath={renamePath} onAddPath={addPath} onDeletePath={deletePath} onAddCategory={addCategory} onUpdateCategory={updateCategory} onDeleteCategory={deleteCategory} onRenameCategory={renameCategory} onAddMaterial={addMaterial} onUpdateMaterial={updateMaterial} onDeleteMaterial={deleteMaterial} onRefreshData={loadData} />;
  if (view === 'manager-dashboard') return <ManagerDashboard currentUser={currentUser} users={users} branches={branches} trainingPaths={trainingPaths} progress={progress} onLogout={handleLogout} onChangeView={setView} />;
  return <TrainingView currentUser={currentUser} trainingPaths={trainingPaths} progress={progress} onToggleComplete={toggleCategoryCompletion} onLogout={handleLogout} />;
};

export default TrainingManagementSystem;
