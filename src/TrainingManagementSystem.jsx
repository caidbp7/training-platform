import React, { useState, useEffect } from 'react';
import { Check, ChevronDown, ChevronRight, Link as LinkIcon, Trash2, Edit, Plus, X, LogOut, Users, TrendingUp, BookOpen, Menu, FileText, Video, File, UploadCloud, UserPlus, Building, MapPin } from 'lucide-react';
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

const parseCSV = (text) => {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuote = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuote) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuote = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++;
        currentRow.push(currentField.trim());
        if (currentRow.some(field => field)) rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }
  
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(field => field)) rows.push(currentRow);
  }
  
  if (rows.length === 0) return [];
  const headers = rows[0].map(h => h.toLowerCase().replace(/^\ufeff/, ''));
  
  return rows.slice(1).map(row => {
    const entry = {};
    headers.forEach((h, i) => {
      entry[h] = row[i] || ''; 
    });
    return entry;
  });
};

// --- SUB-COMPONENTS ---

const LoginScreen = ({ onLogin, loading }) => {
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
            {loading ? 'Logging in...' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
};

const BulkUploadButton = ({ onUploadComplete, type = 'materials' }) => {
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
        
        if (type === 'branches') {
          await handleBranchUpload(data);
        } else if (type === 'users') {
          await handleUserUpload(data);
        } else {
          await handleMaterialUpload(data);
        }
        
      } catch (error) {
        console.error(error);
        alert('Error parsing CSV. Please check the file format.');
      } finally {
        setUploading(false);
        e.target.value = null;
      }
    };

    reader.readAsText(file);
  };

  const handleUserUpload = async (data) => {
    let successCount = 0;
    let skippedCount = 0;
    let errorDetails = [];

    // Create temporary client for bulk user creation
    const tempSupabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });

    for (const row of data) {
      // Validate required fields
      if (!row.name || !row.username || !row.password || !row.role) {
        skippedCount++;
        errorDetails.push(`Row skipped: Missing required fields (name: ${row.name}, username: ${row.username})`);
        continue;
      }

      // Validate role
      const validRoles = ['staff', 'manager', 'admin'];
      if (!validRoles.includes(row.role.toLowerCase())) {
        skippedCount++;
        errorDetails.push(`Row skipped: Invalid role "${row.role}" for user ${row.username}`);
        continue;
      }

      // For staff and manager, validate branch
      if ((row.role.toLowerCase() === 'staff' || row.role.toLowerCase() === 'manager') && !row.branch) {
        skippedCount++;
        errorDetails.push(`Row skipped: Branch required for ${row.role} user ${row.username}`);
        continue;
      }

      try {
        // Find branch by name if specified
        let branchId = null;
        if (row.branch) {
          const { data: branchData } = await supabase
            .from('branches')
            .select('id')
            .eq('name', row.branch)
            .single();
          
          if (!branchData) {
            skippedCount++;
            errorDetails.push(`Row skipped: Branch "${row.branch}" not found for user ${row.username}`);
            continue;
          }
          branchId = branchData.id;
        }

        const email = row.username.includes('@') ? row.username : `${row.username}@portal.com`;

        // Create auth user
        const { data: authData, error: authError } = await tempSupabase.auth.signUp({
          email: email,
          password: row.password,
          options: {
            data: {
              username: row.username,
              name: row.name,
              role: row.role.toLowerCase(),
              branchId: branchId
            }
          }
        });

        if (authError) {
          skippedCount++;
          errorDetails.push(`Error creating user ${row.username}: ${authError.message}`);
          continue;
        }

        successCount++;
        
      } catch (error) {
        skippedCount++;
        errorDetails.push(`Error processing user ${row.username}: ${error.message}`);
      }
    }

    // Show detailed results
    let message = `User Import Complete!\n✓ Successfully created: ${successCount}\n✗ Skipped: ${skippedCount}`;
    
    if (errorDetails.length > 0 && errorDetails.length <= 10) {
      message += '\n\nDetails:\n' + errorDetails.join('\n');
    } else if (errorDetails.length > 10) {
      message += '\n\nShowing first 10 errors:\n' + errorDetails.slice(0, 10).join('\n');
      message += `\n... and ${errorDetails.length - 10} more`;
    }

    alert(message);
    onUploadComplete();
  };

  const handleBranchUpload = async (data) => {
    let successCount = 0;
    let skippedCount = 0;

    for (const row of data) {
      if (!row['branch name']) {
        skippedCount++;
        continue;
      }

      const newId = `branch-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      await supabase.from('branches').insert({
        id: newId,
        name: row['branch name'],
        region: row.region || null,
        managerId: null
      });
      
      successCount++;
    }

    alert(`Branch Import Complete!\nAdded: ${successCount}\nSkipped: ${skippedCount}`);
    onUploadComplete();
  };

  const handleMaterialUpload = async (data) => {
    let successCount = 0;
    let skippedCount = 0;

    for (const row of data) {
      if (!row.path || !row.category || !row['material name']) {
        skippedCount++;
        continue;
      }

      let pathId;
      const { data: existingPaths } = await supabase.from('training_paths').select('id').eq('name', row.path).single();
      
      if (existingPaths) {
        pathId = existingPaths.id;
      } else {
        const newId = `path-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        await supabase.from('training_paths').insert({ id: newId, name: row.path });
        pathId = newId;
      }

      let categoryId;
      const { data: existingCats } = await supabase.from('categories').select('id').eq('name', row.category).eq('path_id', pathId).single();
      
      if (existingCats) {
        categoryId = existingCats.id;
      } else {
        const newCatId = `cat-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        await supabase.from('categories').insert({ id: newCatId, path_id: pathId, name: row.category });
        categoryId = newCatId;
      }

      const newMatId = `mat-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      await supabase.from('materials').insert({
        id: newMatId,
        category_id: categoryId,
        name: row['material name'],
        type: row.type?.toLowerCase() || 'document',
        url: row.url || ''
      });
      
      successCount++;
    }

    alert(`Material Import Complete!\nAdded: ${successCount}\nSkipped: ${skippedCount}`);
    onUploadComplete();
  };

  const getButtonText = () => {
    if (uploading) return 'Importing...';
    if (type === 'branches') return 'Bulk Import Branches CSV';
    if (type === 'users') return 'Bulk Import Users CSV';
    return 'Bulk Import CSV';
  };

  return (
    <div className="relative">
      <input type="file" accept=".csv" onChange={handleFileUpload} disabled={uploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
      <button disabled={uploading} className="flex items-center space-x-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium shadow-sm">
        <UploadCloud className="w-5 h-5 text-purple-600" />
        <span>{getButtonText()}</span>
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

const UserForm = ({ onSave, onCancel, initialData = null, branches }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [username, setUsername] = useState(initialData?.username || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(initialData?.role || 'staff');
  const [branchId, setBranchId] = useState(initialData?.branchId || '');

  const handleSubmit = () => {
    if (!name || !username || (!initialData && !password)) {
      alert('Please fill in all required fields');
      return;
    }
    
    if ((role === 'staff' || role === 'manager') && !branchId) {
      alert('Please select a branch for staff and manager users');
      return;
    }

    const userData = {
      name,
      username,
      role,
      branchId: role === 'admin' ? null : branchId
    };

    if (password) userData.password = password;
    onSave(userData);
  };

  return (
    <div className="space-y-4 p-6 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border-2 border-purple-200">
      <h3 className="text-lg font-semibold text-gray-900">{initialData ? 'Edit User' : 'Add New User'}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" autoFocus /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Username *</label><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password {initialData && '(leave blank to keep)'}</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder={initialData ? 'Unchanged' : 'Password'} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
            <option value="staff">Staff</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        {(role === 'staff' || role === 'manager') && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Branch *</label>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
              <option value="">Select a branch</option>
              {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name} {branch.region && `(${branch.region})`}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="flex space-x-3 pt-2">
        <button onClick={handleSubmit} className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium">{initialData ? 'Update User' : 'Create User'}</button>
        <button onClick={onCancel} className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
      </div>
    </div>
  );
};

const BranchForm = ({ onSave, onCancel, initialData = null, users }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [region, setRegion] = useState(initialData?.region || '');
  const [managerId, setManagerId] = useState(initialData?.managerId || '');
  const managers = users.filter(u => u.role === 'manager');

  const handleSubmit = () => {
    if (!name) { alert('Please enter a branch name'); return; }
    onSave({ name, region: region || null, managerId: managerId || null });
  };

  return (
    <div className="space-y-4 p-6 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border-2 border-indigo-200">
      <h3 className="text-lg font-semibold text-gray-900">{initialData ? 'Edit Branch' : 'Add New Branch'}</h3>
      <div className="space-y-3">
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Branch Name *</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Downtown Location" className="w-full px-3 py-2 border border-gray-300 rounded-lg" autoFocus /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Region</label><input type="text" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g., North, South, East, West" className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Manager</label>
          <select value={managerId} onChange={(e) => setManagerId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
            <option value="">No manager assigned</option>
            {managers.map(manager => <option key={manager.id} value={manager.id}>{manager.name}</option>)}
          </select>
        </div>
      </div>
      <div className="flex space-x-3 pt-2">
        <button onClick={handleSubmit} className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">{initialData ? 'Update Branch' : 'Create Branch'}</button>
        <button onClick={onCancel} className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
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

const AdminDashboard = ({ currentUser, users, branches, trainingPaths, progress, onLogout, onRenamePath, onAddPath, onDeletePath, onAddCategory, onUpdateCategory, onDeleteCategory, onRenameCategory, onAddMaterial, onUpdateMaterial, onDeleteMaterial, onRefreshData, onAddUser, onUpdateUser, onDeleteUser, onAddBranch, onUpdateBranch, onDeleteBranch }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [editingPath, setEditingPath] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [showAddCategory, setShowAddCategory] = useState(null);
  const [showAddPath, setShowAddPath] = useState(false);
  const [showAddMaterial, setShowAddMaterial] = useState(null);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newPathName, setNewPathName] = useState('');
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);

  // Group branches by region
  const branchesByRegion = branches.reduce((acc, branch) => {
    const region = branch.region || 'Unassigned';
    if (!acc[region]) acc[region] = [];
    acc[region].push(branch);
    return acc;
  }, {});

  const regions = Object.keys(branchesByRegion).sort();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1><p className="text-sm text-gray-600">{currentUser.name}</p></div>
          <button onClick={onLogout} className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"><LogOut className="w-4 h-4" /><span>Logout</span></button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 border-b border-gray-200 flex space-x-8 overflow-x-auto">
          <button onClick={() => setActiveTab('overview')} className={`pb-4 px-2 font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'overview' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Overview</button>
          <button onClick={() => setActiveTab('manage')} className={`pb-4 px-2 font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'manage' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Manage Training</button>
          <button onClick={() => setActiveTab('users')} className={`pb-4 px-2 font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'users' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Manage Users</button>
          <button onClick={() => setActiveTab('branches')} className={`pb-4 px-2 font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'branches' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Manage Branches</button>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-8">
            {regions.map(region => (
              <div key={region}>
                <div className="flex items-center space-x-2 mb-4">
                  <MapPin className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-xl font-bold text-gray-900">{region}</h2>
                  <span className="text-sm text-gray-500">({branchesByRegion[region].length} branches)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {branchesByRegion[region].map(branch => {
                    const branchProg = getBranchProgress(users, trainingPaths, progress, branch.id);
                    return (
                      <div key={branch.id} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow">
                        <div className="flex justify-between mb-4">
                          <h3 className="text-lg font-semibold text-gray-900">{branch.name}</h3>
                          <div className="text-right"><div className="text-2xl font-bold text-purple-600">{branchProg.percentage}%</div></div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5"><div className="bg-purple-600 h-2.5 rounded-full" style={{ width: `${branchProg.percentage}%` }}></div></div>
                        <div className="mt-3 text-sm text-gray-600">{branchProg.staffCount} staff • {branchProg.completed}/{branchProg.total} modules</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'manage' && (
          <div className="space-y-6">
            <div className="flex justify-end space-x-3">
              <BulkUploadButton onUploadComplete={onRefreshData} type="materials" />
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

        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex justify-end space-x-3">
              <BulkUploadButton onUploadComplete={onRefreshData} type="users" />
              <button
                onClick={() => setShowAddUser(true)}
                className="flex items-center space-x-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow-md font-medium"
              >
                <UserPlus className="w-5 h-5" />
                <span>Add User</span>
              </button>
            </div>

            {showAddUser && (
              <UserForm
                branches={branches}
                onSave={(userData) => {
                  onAddUser(userData);
                  setShowAddUser(false);
                }}
                onCancel={() => setShowAddUser(false)}
              />
            )}

            {editingUser && (
              <UserForm
                initialData={editingUser}
                branches={branches}
                onSave={(userData) => {
                  onUpdateUser(editingUser.id, userData);
                  setEditingUser(null);
                }}
                onCancel={() => setEditingUser(null)}
              />
            )}

            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">All Users</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {users.map(user => {
                      const userBranch = branches.find(b => b.id === user.branchId);
                      return (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{user.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{user.username}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              user.role === 'admin' ? 'bg-red-100 text-red-700' :
                              user.role === 'manager' ? 'bg-blue-100 text-blue-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {userBranch?.name || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            <button
                              onClick={() => setEditingUser(user)}
                              className="text-purple-600 hover:text-purple-700 mr-3"
                            >
                              <Edit className="w-4 h-4 inline" />
                            </button>
                            <button
                              onClick={() => onDeleteUser(user.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4 inline" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'branches' && (
          <div className="space-y-6">
            <div className="flex justify-end space-x-3">
              <BulkUploadButton onUploadComplete={onRefreshData} type="branches" />
              <button
                onClick={() => setShowAddBranch(true)}
                className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md font-medium"
              >
                <Building className="w-5 h-5" />
                <span>Add Branch</span>
              </button>
            </div>

            {showAddBranch && (
              <BranchForm
                users={users}
                onSave={(branchData) => {
                  onAddBranch(branchData);
                  setShowAddBranch(false);
                }}
                onCancel={() => setShowAddBranch(false)}
              />
            )}

            {editingBranch && (
              <BranchForm
                initialData={editingBranch}
                users={users}
                onSave={(branchData) => {
                  onUpdateBranch(editingBranch.id, branchData);
                  setEditingBranch(null);
                }}
                onCancel={() => setEditingBranch(null)}
              />
            )}

            <div className="space-y-8">
              {regions.map(region => (
                <div key={region}>
                  <div className="flex items-center space-x-2 mb-4">
                    <MapPin className="w-5 h-5 text-indigo-600" />
                    <h2 className="text-xl font-bold text-gray-900">{region}</h2>
                    <span className="text-sm text-gray-500">({branchesByRegion[region].length} branches)</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {branchesByRegion[region].map(branch => {
                      const manager = users.find(u => u.id === branch.managerId);
                      const branchProg = getBranchProgress(users, trainingPaths, progress, branch.id);
                      
                      return (
                        <div key={branch.id} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-gray-900">{branch.name}</h3>
                              <p className="text-sm text-gray-600 mt-1">Manager: {manager?.name || 'Not assigned'}</p>
                              <p className="text-sm text-gray-600">{branchProg.staffCount} staff members</p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => setEditingBranch(branch)}
                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => onDeleteBranch(branch.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className="mt-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-gray-600">Branch Progress</span>
                              <span className="text-sm font-semibold text-indigo-600">{branchProg.percentage}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div className="bg-indigo-600 h-2.5 rounded-full transition-all" style={{ width: `${branchProg.percentage}%` }}></div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
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
          if (p.completed) {
            progressMap[`${p.user_id}-${p.path_id}-${p.category_id}`] = true;
          }
        });
        setProgress(progressMap);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLogin = async (username, password) => {
    setLoading(true);
    const email = username.includes('@') ? username : `${username}@portal.com`; 
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      alert('Login failed: ' + error.message);
      setLoading(false);
    } else {
      const { data: userProfile } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (userProfile) {
        setCurrentUser(userProfile);
        if (userProfile.role === 'admin') setView('admin-dashboard');
        else if (userProfile.role === 'manager') setView('manager-dashboard');
        else setView('training');
      } else {
        alert('User profile not found. Please contact support.');
      }
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setView('login');
  };

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

  const addUser = async (userData) => {
    const email = userData.username.includes('@') ? userData.username : `${userData.username}@portal.com`;
    
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: userData.password,
      options: {
        data: {
          username: userData.username,
          name: userData.name,
          role: userData.role,
          branchId: userData.branchId
        }
      }
    });

    if (error) {
      alert('Error creating user: ' + error.message);
    } else {
      alert('User created successfully!');
      const { data: newUsers } = await supabase.from('users').select('*');
      if (newUsers) setUsers(newUsers);
    }
  };

  const updateUser = async (userId, userData) => {
    const { password, ...safeUserData } = userData;
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...safeUserData } : u));
    await supabase.from('users').update(safeUserData).match({ id: userId });
  };

  const deleteUser = async (userId) => {
    if (confirm('Delete this user? All their progress will be lost.')) {
      setUsers(prev => prev.filter(u => u.id !== userId));
      await supabase.from('users').delete().match({ id: userId });
    }
  };

  const addBranch = async (branchData) => {
    const newId = `branch-${Date.now()}`;
    const newBranch = { id: newId, ...branchData };
    setBranches(prev => [...prev, newBranch]);
    await supabase.from('branches').insert(newBranch);
  };

  const updateBranch = async (branchId, branchData) => {
    setBranches(prev => prev.map(b => b.id === branchId ? { ...b, ...branchData } : b));
    await supabase.from('branches').update(branchData).match({ id: branchId });
  };

  const deleteBranch = async (branchId) => {
    const branchUsers = users.filter(u => u.branchId === branchId);
    if (branchUsers.length > 0) {
      alert(`Cannot delete branch. It has ${branchUsers.length} users assigned.`);
      return;
    }
    if (confirm('Delete this branch?')) {
      setBranches(prev => prev.filter(b => b.id !== branchId));
      await supabase.from('branches').delete().match({ id: branchId });
    }
  };

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} loading={loading} />;
  }

  if (view === 'admin-dashboard') {
    return (
      <AdminDashboard
        currentUser={currentUser}
        users={users}
        branches={branches}
        trainingPaths={trainingPaths}
        progress={progress}
        onLogout={handleLogout}
        onRenamePath={renamePath}
        onAddPath={addPath}
        onDeletePath={deletePath}
        onAddCategory={addCategory}
        onUpdateCategory={updateCategory}
        onDeleteCategory={deleteCategory}
        onRenameCategory={renameCategory}
        onAddMaterial={addMaterial}
        onUpdateMaterial={updateMaterial}
        onDeleteMaterial={deleteMaterial}
        onRefreshData={loadData}
        onAddUser={addUser}
        onUpdateUser={updateUser}
        onDeleteUser={deleteUser}
        onAddBranch={addBranch}
        onUpdateBranch={updateBranch}
        onDeleteBranch={deleteBranch}
      />
    );
  }

  if (view === 'manager-dashboard') {
    return (
      <ManagerDashboard
        currentUser={currentUser}
        users={users}
        branches={branches}
        trainingPaths={trainingPaths}
        progress={progress}
        onLogout={handleLogout}
        onChangeView={setView}
      />
    );
  }

  return (
    <TrainingView
      currentUser={currentUser}
      trainingPaths={trainingPaths}
      progress={progress}
      onToggleComplete={toggleCategoryCompletion}
      onLogout={handleLogout}
    />
  );
};

export default TrainingManagementSystem;
