import React, { useState, useEffect } from 'react';
import { Check, ChevronDown, ChevronRight, Link as LinkIcon, Trash2, Edit, Plus, X, LogOut, Users, TrendingUp, BookOpen, Menu, FileText, Video, File } from 'lucide-react';
import { supabase } from './supabaseClient';

// --- HELPER FUNCTIONS (Pure logic, no state) ---

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

// --- SUB-COMPONENTS (Defined OUTSIDE to preserve state) ---

const LoginScreen = ({ users, onLogin, loading }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent_50%)]"></div>
      <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 w-full max-w-md border border-purple-100">
        <div className="text-center mb-8">
          <div className="relative inline-block">
            <BookOpen className="w-16 h-16 text-purple-600 mx-auto mb-4" />
            <div className="absolute -inset-2 bg-purple-400/20 blur-xl rounded-full"></div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Training Portal</h1>
          <p className="text-gray-600 mt-2">Sign in to access your training</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              placeholder="Enter username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && onLogin(username, password)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              placeholder="Enter password"
            />
          </div>
          <button
            onClick={() => onLogin(username, password)}
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-2.5 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all font-medium shadow-lg shadow-purple-500/30 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Sign In'}
          </button>
        </div>
      </div>
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
      <a
        href={material.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center space-x-3 flex-1 text-purple-600 hover:text-purple-700"
      >
        {getIcon(material.type)}
        <div>
          <div className="text-sm font-medium">{material.name}</div>
          <div className="text-xs text-gray-500 capitalize">{material.type}</div>
        </div>
      </a>
      <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(material)}
          className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
        >
          <Edit className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onDelete(material.id)}
          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
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
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Safety Guidelines PDF"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          autoFocus
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          <option value="document">Document</option>
          <option value="video">Video</option>
          <option value="link">Link</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/material"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      </div>
      <div className="flex space-x-2">
        <button
          onClick={handleSubmit}
          className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
        >
          {initialData ? 'Update' : 'Add'} Material
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

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
              <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100">
                <Menu className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Training Portal</h1>
                <p className="text-sm text-gray-600">{currentUser.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right hidden sm:block">
                <div className="text-xs text-gray-500 uppercase tracking-wider">Progress</div>
                <div className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                  {userProg.percentage}%
                </div>
              </div>
              <button onClick={onLogout} className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
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
                  <button
                    key={path.id}
                    onClick={() => { setSelectedPath(path.id); setShowMobileMenu(false); }}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                      selectedPath === path.id
                        ? 'bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-700 font-medium shadow-sm'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
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
                <p className="text-gray-600">Choose a training path from the menu to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {trainingPaths.find(p => p.id === selectedPath)?.categories.map(category => {
                  const isCompleted = getCategoryProgress(progress, currentUser.id, selectedPath, category.id);
                  const isExpanded = expandedCategories[category.id];
                  const materials = category.materials || [];

                  return (
                    <div key={category.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 hover:shadow-md transition-shadow">
                      <div
                        className="p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => setExpandedCategories(prev => ({ ...prev, [category.id]: !prev[category.id] }))}
                      >
                        <div className="flex items-center space-x-3 flex-1">
                          {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                          <h3 className="font-medium text-gray-900">{category.name}</h3>
                          <span className="text-xs text-gray-500">({materials.length} materials)</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); onToggleComplete(selectedPath, category.id); }}
                          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                            isCompleted
                              ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 shadow-sm'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <Check className="w-4 h-4" />
                          <span className="text-sm font-medium">{isCompleted ? 'Completed' : 'Mark Complete'}</span>
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-gray-100 p-5 bg-gradient-to-br from-gray-50 to-purple-50/30">
                          {materials.length > 0 ? (
                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold text-gray-700 mb-3">Training Materials</h4>
                              {materials.map(material => (
                                <MaterialItem key={material.id} material={material} onDelete={() => {}} onEdit={() => {}} />
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 italic text-center py-4">No materials available yet</p>
                          )}
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Manager Dashboard</h1>
              <p className="text-sm text-gray-600">{currentUser.name} - {managerBranch?.name}</p>
            </div>
            <div className="flex items-center space-x-4">
              <button onClick={() => onChangeView('training')} className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors font-medium">My Training</button>
              <button onClick={onLogout} className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-600">Total Staff</p><p className="text-3xl font-bold text-gray-900">{branchStaff.length}</p></div>
              <Users className="w-12 h-12 text-purple-600" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-purple-100">Branch Progress</p><p className="text-3xl font-bold">{branchProg.percentage}%</p></div>
              <TrendingUp className="w-12 h-12 text-purple-200" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-600">Total Modules</p><p className="text-3xl font-bold text-gray-900">{trainingPaths.reduce((sum, path) => sum + path.categories.length, 0)}</p></div>
              <BookOpen className="w-12 h-12 text-indigo-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-purple-50"><h2 className="text-lg font-semibold text-gray-900">Staff Progress</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Member</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th></tr></thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {branchStaff.map(staff => {
                  const prog = getUserProgress(trainingPaths, progress, staff.id);
                  return (
                    <tr key={staff.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{staff.name}</div><div className="text-sm text-gray-500">{staff.username}</div></td>
                      <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{prog.completed} / {prog.total}</div></td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center"><div className="w-full bg-gray-200 rounded-full h-2 mr-2"><div className="bg-gradient-to-r from-purple-600 to-indigo-600 h-2 rounded-full transition-all" style={{ width: `${prog.percentage}%` }}></div></div><span className="text-sm font-medium text-gray-700">{prog.percentage}%</span></div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminDashboard = ({ currentUser, users, branches, trainingPaths, progress, onLogout, onRenamePath, onAddPath, onDeletePath, onAddCategory, onUpdateCategory, onDeleteCategory, onRenameCategory, onAddMaterial, onUpdateMaterial, onDeleteMaterial }) => {
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Admin Dashboard</h1>
              <p className="text-sm text-gray-600">{currentUser.name}</p>
            </div>
            <button onClick={onLogout} className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 border-b border-gray-200">
          <div className="flex space-x-8">
            <button onClick={() => setActiveTab('overview')} className={`pb-4 px-2 font-medium transition-colors ${activeTab === 'overview' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>Overview</button>
            <button onClick={() => setActiveTab('manage')} className={`pb-4 px-2 font-medium transition-colors ${activeTab === 'manage' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>Manage Training</button>
          </div>
        </div>

        {activeTab === 'overview' ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {branches.map(branch => {
                const branchProg = getBranchProgress(users, trainingPaths, progress, branch.id);
                const manager = users.find(u => u.id === branch.managerId);
                return (
                  <div key={branch.id} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div><h3 className="text-lg font-semibold text-gray-900">{branch.name}</h3><p className="text-sm text-gray-600">Manager: {manager?.name}</p></div>
                      <div className="text-right"><div className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">{branchProg.percentage}%</div><div className="text-sm text-gray-600">{branchProg.staffCount} staff</div></div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5"><div className="bg-gradient-to-r from-purple-600 to-indigo-600 h-2.5 rounded-full transition-all" style={{ width: `${branchProg.percentage}%` }}></div></div>
                    <div className="mt-2 text-sm text-gray-600">{branchProg.completed} / {branchProg.total} modules completed</div>
                  </div>
                );
              })}
            </div>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-purple-50"><h2 className="text-lg font-semibold text-gray-900">All Staff Progress</h2></div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Member</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th></tr></thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {users.filter(u => u.role === 'staff').map(staff => {
                      const prog = getUserProgress(trainingPaths, progress, staff.id);
                      const branch = branches.find(b => b.id === staff.branchId);
                      return (
                        <tr key={staff.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{staff.name}</div></td>
                          <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{branch?.name}</div></td>
                          <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{prog.completed} / {prog.total}</div></td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center"><div className="w-full bg-gray-200 rounded-full h-2 mr-2"><div className="bg-gradient-to-r from-purple-600 to-indigo-600 h-2 rounded-full transition-all" style={{ width: `${prog.percentage}%` }}></div></div><span className="text-sm font-medium text-gray-700">{prog.percentage}%</span></div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-6">
            {/* Add Path Button */}
            <div className="flex justify-end">
              <button
                onClick={() => setShowAddPath(true)}
                className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all font-medium shadow-lg shadow-purple-500/30"
              >
                <Plus className="w-5 h-5" />
                <span>Add Training Path</span>
              </button>
            </div>

            {/* Add Path Form */}
            {showAddPath && (
              <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-purple-300">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Training Path</h3>
                <div className="flex items-center space-x-3">
                  <input
                    type="text"
                    value={newPathName}
                    onChange={(e) => setNewPathName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && newPathName && onAddPath(newPathName, () => { setShowAddPath(false); setNewPathName(''); })}
                    placeholder="Enter path name (e.g., Marketing)"
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    autoFocus
                  />
                  <button
                    onClick={() => newPathName && onAddPath(newPathName, () => { setShowAddPath(false); setNewPathName(''); })}
                    className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => { setShowAddPath(false); setNewPathName(''); }}
                    className="p-2.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Training Paths */}
            {trainingPaths.map(path => (
              <div key={path.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  {editingPath === path.id ? (
                    <input
                      type="text"
                      defaultValue={path.name}
                      onBlur={(e) => { onRenamePath(path.id, e.target.value); setEditingPath(null); }}
                      onKeyPress={(e) => { if (e.key === 'Enter') { onRenamePath(path.id, e.target.value); setEditingPath(null); } }}
                      className="text-lg font-semibold px-3 py-1.5 border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      autoFocus
                    />
                  ) : (
                    <div className="flex items-center space-x-3">
                      <h2 className="text-lg font-semibold text-gray-900">{path.name}</h2>
                      <button onClick={() => setEditingPath(path.id)} className="p-1.5 hover:bg-purple-100 rounded transition-colors"><Edit className="w-4 h-4 text-purple-600" /></button>
                      <button onClick={() => onDeletePath(path.id)} className="p-1.5 hover:bg-red-100 rounded transition-colors"><Trash2 className="w-4 h-4 text-red-600" /></button>
                    </div>
                  )}
                  <button onClick={() => setShowAddCategory(path.id)} className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium shadow-md">
                    <Plus className="w-4 h-4" />
                    <span>Add Category</span>
                  </button>
                </div>

                {showAddCategory === path.id && (
                  <div className="px-6 py-4 bg-gradient-to-br from-purple-50 to-indigo-50 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                      <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && newCategoryName && onAddCategory(path.id, newCategoryName, () => { setShowAddCategory(null); setNewCategoryName(''); })} placeholder="Category name" className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" autoFocus />
                      <button onClick={() => newCategoryName && onAddCategory(path.id, newCategoryName, () => { setShowAddCategory(null); setNewCategoryName(''); })} className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium">Add</button>
                      <button onClick={() => { setShowAddCategory(null); setNewCategoryName(''); }} className="p-2.5 text-gray-600 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                    </div>
                  </div>
                )}

                <div className="divide-y divide-gray-100">
                  {path.categories.map(category => {
                    const materials = category.materials || [];
                    return (
                      <div key={category.id} className="p-6 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between mb-4">
                          {editingCategory === category.id ? (
                            <input
                              type="text"
                              defaultValue={category.name}
                              onBlur={(e) => { onRenameCategory(path.id, category.id, e.target.value); setEditingCategory(null); }}
                              onKeyPress={(e) => { if (e.key === 'Enter') { onRenameCategory(path.id, category.id, e.target.value); setEditingCategory(null); } }}
                              className="font-medium text-gray-900 px-3 py-1.5 border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                              autoFocus
                            />
                          ) : (
                            <div className="flex items-center space-x-2">
                              <h3 className="font-medium text-gray-900">{category.name}</h3>
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{materials.length} materials</span>
                              <button onClick={() => setEditingCategory(category.id)} className="p-1 hover:bg-gray-100 rounded"><Edit className="w-3.5 h-3.5 text-gray-600" /></button>
                            </div>
                          )}
                          <button onClick={() => onDeleteCategory(path.id, category.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>

                        {/* Materials Section */}
                        <div className="space-y-3 mt-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-gray-700">Training Materials</h4>
                            <button
                              onClick={() => setShowAddMaterial(category.id)}
                              className="flex items-center space-x-1.5 px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors font-medium"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Material</span>
                            </button>
                          </div>

                          {showAddMaterial === category.id && (
                            <MaterialForm
                              onSave={(materialData) => {
                                onAddMaterial(path.id, category.id, materialData);
                                setShowAddMaterial(null);
                              }}
                              onCancel={() => setShowAddMaterial(null)}
                            />
                          )}

                          {editingMaterial?.categoryId === category.id && (
                            <MaterialForm
                              initialData={editingMaterial.data}
                              onSave={(materialData) => {
                                onUpdateMaterial(path.id, category.id, editingMaterial.data.id, materialData);
                                setEditingMaterial(null);
                              }}
                              onCancel={() => setEditingMaterial(null)}
                            />
                          )}

                          {materials.length > 0 ? (
                            <div className="space-y-2">
                              {materials.map(material => (
                                <MaterialItem
                                  key={material.id}
                                  material={material}
                                  onDelete={(materialId) => onDeleteMaterial(path.id, category.id, materialId)}
                                  onEdit={(material) => setEditingMaterial({ categoryId: category.id, data: material })}
                                />
                              ))}
                            </div>
                          ) : (
                            !showAddMaterial && (
                              <p className="text-sm text-gray-500 italic text-center py-4 bg-gray-50 rounded-lg">No materials added yet</p>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
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

  // Load Data
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

  // Handlers
  const handleLogin = (username, password) => {
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      setCurrentUser(user);
      setView(user.role === 'admin' ? 'admin-dashboard' : user.role === 'manager' ? 'manager-dashboard' : 'training');
    } else {
      alert('Invalid credentials');
    }
  };

  const handleLogout = () => {
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
    if (confirm('Are you sure you want to delete this training path? All categories and materials will be removed.')) {
      setTrainingPaths(prev => prev.filter(path => path.id !== pathId));
      await supabase.from('training_paths').delete().match({ id: pathId });
    }
  };

  const addCategory = async (pathId, categoryName, onSuccess) => {
    const newId = `cat-${Date.now()}`;
    const newCategory = { id: newId, path_id: pathId, name: categoryName, materials: [] };

    setTrainingPaths(prev => prev.map(path => {
      if (path.id === pathId) return { ...path, categories: [...path.categories, newCategory] };
      return path;
    }));
    if (onSuccess) onSuccess();

    await supabase.from('categories').insert({ id: newId, path_id: pathId, name: categoryName });
  };

  const updateCategory = async (pathId, categoryId, field, value) => {
    setTrainingPaths(prev => prev.map(path => {
      if (path.id === pathId) {
        return {
          ...path,
          categories: path.categories.map(cat => cat.id === categoryId ? { ...cat, [field]: value } : cat)
        };
      }
      return path;
    }));
    await supabase.from('categories').update({ [field]: value }).match({ id: categoryId });
  };

  const deleteCategory = async (pathId, categoryId) => {
    if (confirm('Are you sure you want to delete this category?')) {
      setTrainingPaths(prev => prev.map(path => {
        if (path.id === pathId) return { ...path, categories: path.categories.filter(cat => cat.id !== categoryId) };
        return path;
      }));
      await supabase.from('categories').delete().match({ id: categoryId });
    }
  };

  const renamePath = async (pathId, newName) => {
    setTrainingPaths(prev => prev.map(path => path.id === pathId ? { ...path, name: newName } : path));
    await supabase.from('training_paths').update({ name: newName }).match({ id: pathId });
  };

  const renameCategory = async (pathId, categoryId, newName) => {
    updateCategory(pathId, categoryId, 'name', newName);
  };

  const addMaterial = async (pathId, categoryId, materialData) => {
    const newId = `mat-${Date.now()}`;
    const newMaterial = { id: newId, category_id: categoryId, ...materialData };

    setTrainingPaths(prev => prev.map(path => {
      if (path.id === pathId) {
        return {
          ...path,
          categories: path.categories.map(cat => {
            if (cat.id === categoryId) {
              return { ...cat, materials: [...(cat.materials || []), newMaterial] };
            }
            return cat;
          })
        };
      }
      return path;
    }));

    await supabase.from('materials').insert(newMaterial);
  };

  const updateMaterial = async (pathId, categoryId, materialId, materialData) => {
    setTrainingPaths(prev => prev.map(path => {
      if (path.id === pathId) {
        return {
          ...path,
          categories: path.categories.map(cat => {
            if (cat.id === categoryId) {
              return {
                ...cat,
                materials: (cat.materials || []).map(mat => mat.id === materialId ? { ...mat, ...materialData } : mat)
              };
            }
            return cat;
          })
        };
      }
      return path;
    }));

    await supabase.from('materials').update(materialData).match({ id: materialId });
  };

  const deleteMaterial = async (pathId, categoryId, materialId) => {
    if (confirm('Are you sure you want to delete this material?')) {
      setTrainingPaths(prev => prev.map(path => {
        if (path.id === pathId) {
          return {
            ...path,
            categories: path.categories.map(cat => {
              if (cat.id === categoryId) {
                return { ...cat, materials: (cat.materials || []).filter(mat => mat.id !== materialId) };
              }
              return cat;
            })
          };
        }
        return path;
      }));

      await supabase.from('materials').delete().match({ id: materialId });
    }
  };

  // Main Render
  if (!currentUser) {
    return <LoginScreen users={users} onLogin={handleLogin} loading={loading} />;
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
