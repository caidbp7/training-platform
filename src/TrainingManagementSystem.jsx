import React, { useState, useEffect } from 'react';
import { Check, ChevronDown, ChevronRight, Upload, Link as LinkIcon, Trash2, Edit, Plus, X, LogOut, Users, TrendingUp, BookOpen, Menu } from 'lucide-react';
import { supabase } from './supabaseClient'; // Make sure you created this file!

const TrainingManagementSystem = () => {
  // 1. Initialize State
  const [currentUser, setCurrentUser] = useState(null);
  const [branches, setBranches] = useState([]);
  const [users, setUsers] = useState([]);
  const [trainingPaths, setTrainingPaths] = useState([]);
  const [progress, setProgress] = useState({});
  const [view, setView] = useState('login');
  const [selectedPath, setSelectedPath] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [editingPath, setEditingPath] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [showAddCategory, setShowAddCategory] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [loading, setLoading] = useState(true);

  // 2. Data Loading (Supabase)
  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch Branches
      const { data: branchesData } = await supabase.from('branches').select('*');
      if (branchesData) setBranches(branchesData);

      // Fetch Users
      const { data: usersData } = await supabase.from('users').select('*');
      if (usersData) setUsers(usersData);

      // Fetch Paths & Categories (Joined)
      const { data: pathsData } = await supabase
        .from('training_paths')
        .select(`*, categories(*)`)
        .order('id');
      
      if (pathsData) {
        // Sort categories to ensure they stay in order
        const sortedPaths = pathsData.map(path => ({
          ...path,
          categories: path.categories ? path.categories.sort((a, b) => a.name.localeCompare(b.name)) : []
        }));
        setTrainingPaths(sortedPaths);
      }

      // Fetch Progress
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

  // 3. Handlers (Supabase Updates)

  const handleLogin = (username, password) => {
    // Note: For production, you should use supabase.auth.signInWithPassword()
    // This maintains your existing simple logic but checks against the DB users
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
    setSelectedPath(null);
  };

  const toggleCategoryCompletion = async (pathId, categoryId) => {
    const key = `${currentUser.id}-${pathId}-${categoryId}`;
    const isComplete = progress[key];
    const newValue = !isComplete;

    // 1. Optimistic UI Update (Instant feedback)
    setProgress(prev => ({ ...prev, [key]: newValue }));

    // 2. Database Update
    if (newValue) {
      await supabase.from('user_progress').upsert({
        user_id: currentUser.id,
        path_id: pathId,
        category_id: categoryId,
        completed: true
      });
    } else {
      await supabase.from('user_progress').delete()
        .match({ user_id: currentUser.id, path_id: pathId, category_id: categoryId });
    }
  };

  const addCategory = async (pathId, categoryName) => {
    const newId = `cat-${Date.now()}`;
    const newCategory = {
      id: newId,
      path_id: pathId,
      name: categoryName,
      documentation: '',
      video: ''
    };

    // Optimistic Update
    setTrainingPaths(prev => prev.map(path => {
      if (path.id === pathId) {
        return { ...path, categories: [...path.categories, newCategory] };
      }
      return path;
    }));
    setShowAddCategory(null);
    setNewCategoryName('');

    // Database Update
    await supabase.from('categories').insert(newCategory);
  };

  const updateCategory = async (pathId, categoryId, field, value) => {
    // Optimistic Update
    setTrainingPaths(prev => prev.map(path => {
      if (path.id === pathId) {
        return {
          ...path,
          categories: path.categories.map(cat => 
            cat.id === categoryId ? { ...cat, [field]: value } : cat
          )
        };
      }
      return path;
    }));

    // Database Update
    await supabase.from('categories')
      .update({ [field]: value })
      .match({ id: categoryId });
  };

  const deleteCategory = async (pathId, categoryId) => {
    if (confirm('Are you sure you want to delete this category?')) {
      // Optimistic Update
      setTrainingPaths(prev => prev.map(path => {
        if (path.id === pathId) {
          return {
            ...path,
            categories: path.categories.filter(cat => cat.id !== categoryId)
          };
        }
        return path;
      }));

      // Database Update
      await supabase.from('categories').delete().match({ id: categoryId });
    }
  };

  const renamePath = async (pathId, newName) => {
    setTrainingPaths(prev => prev.map(path => 
      path.id === pathId ? { ...path, name: newName } : path
    ));
    setEditingPath(null);

    await supabase.from('training_paths')
      .update({ name: newName })
      .match({ id: pathId });
  };

  const renameCategory = async (pathId, categoryId, newName) => {
    updateCategory(pathId, categoryId, 'name', newName);
    setEditingCategory(null);
    // updateCategory handles the DB call
  };

  // 4. Calculations (Same as before)
  const getCategoryProgress = (userId, pathId, categoryId) => {
    const key = `${userId}-${pathId}-${categoryId}`;
    return progress[key] || false;
  };

  const getUserProgress = (userId) => {
    let completed = 0;
    let total = 0;
    trainingPaths.forEach(path => {
      path.categories.forEach(category => {
        total++;
        if (getCategoryProgress(userId, path.id, category.id)) {
          completed++;
        }
      });
    });
    return { completed, total, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
  };

  const getBranchProgress = (branchId) => {
    const branchStaff = users.filter(u => u.branchId === branchId && u.role === 'staff');
    let totalCompleted = 0;
    let totalModules = 0;
    
    branchStaff.forEach(staff => {
      const userProg = getUserProgress(staff.id);
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


  // 5. Views (Login, Staff, Manager, Admin)
  
  const LoginScreen = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <BookOpen className="w-16 h-16 text-indigo-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-800">Training Portal</h1>
            <p className="text-gray-600 mt-2">Sign in to access your training</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Enter username"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin(username, password)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Enter password"
              />
            </div>
            
            <button
              onClick={() => handleLogin(username, password)}
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Sign In'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const TrainingView = () => {
    const userProg = getUserProgress(currentUser.id);

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
                >
                  <Menu className="w-6 h-6" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">Training Portal</h1>
                  <p className="text-sm text-gray-600">{currentUser.name}</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right hidden sm:block">
                  <div className="text-sm text-gray-600">Overall Progress</div>
                  <div className="text-2xl font-bold text-indigo-600">{userProg.percentage}%</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
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
              <div className="bg-white rounded-lg shadow-sm p-4 sticky top-4">
                <h2 className="font-semibold text-gray-800 mb-4">Training Paths</h2>
                <div className="space-y-2">
                  {trainingPaths.map(path => (
                    <button
                      key={path.id}
                      onClick={() => {
                        setSelectedPath(path.id);
                        setShowMobileMenu(false);
                      }}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                        selectedPath === path.id
                          ? 'bg-indigo-100 text-indigo-700 font-medium'
                          : 'hover:bg-gray-100 text-gray-700'
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
                <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                  <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h2 className="text-xl font-semibold text-gray-800 mb-2">Select a Training Path</h2>
                  <p className="text-gray-600">Choose a training path from the menu to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {trainingPaths.find(p => p.id === selectedPath)?.categories.map(category => {
                    const isCompleted = getCategoryProgress(currentUser.id, selectedPath, category.id);
                    const isExpanded = expandedCategories[category.id];

                    return (
                      <div key={category.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
                        <div
                          className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                          onClick={() => setExpandedCategories(prev => ({
                            ...prev,
                            [category.id]: !prev[category.id]
                          }))}
                        >
                          <div className="flex items-center space-x-3 flex-1">
                            {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                            <h3 className="font-medium text-gray-800">{category.name}</h3>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCategoryCompletion(selectedPath, category.id);
                            }}
                            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                              isCompleted
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            <Check className="w-4 h-4" />
                            <span className="text-sm font-medium">
                              {isCompleted ? 'Completed' : 'Mark Complete'}
                            </span>
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
                            {category.documentation && (
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Documentation</h4>
                                <a
                                  href={category.documentation}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-700"
                                >
                                  <LinkIcon className="w-4 h-4" />
                                  <span className="text-sm">Open Documentation</span>
                                </a>
                              </div>
                            )}
                            {category.video && (
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Training Video</h4>
                                <a
                                  href={category.video}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-700"
                                >
                                  <LinkIcon className="w-4 h-4" />
                                  <span className="text-sm">Watch Video</span>
                                </a>
                              </div>
                            )}
                            {!category.documentation && !category.video && (
                              <p className="text-sm text-gray-500 italic">No materials available yet</p>
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

  const ManagerDashboard = () => {
    const managerBranch = branches.find(b => b.id === currentUser.branchId);
    const branchStaff = users.filter(u => u.branchId === currentUser.branchId && u.role === 'staff');

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Manager Dashboard</h1>
                <p className="text-sm text-gray-600">{currentUser.name} - {managerBranch?.name}</p>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setView('training')}
                  className="px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                >
                  My Training
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Staff</p>
                  <p className="text-3xl font-bold text-gray-800">{branchStaff.length}</p>
                </div>
                <Users className="w-12 h-12 text-indigo-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Branch Progress</p>
                  <p className="text-3xl font-bold text-indigo-600">
                    {getBranchProgress(currentUser.branchId).percentage}%
                  </p>
                </div>
                <TrendingUp className="w-12 h-12 text-green-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Modules</p>
                  <p className="text-3xl font-bold text-gray-800">
                    {trainingPaths.reduce((sum, path) => sum + path.categories.length, 0)}
                  </p>
                </div>
                <BookOpen className="w-12 h-12 text-purple-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">Staff Progress</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Member</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {branchStaff.map(staff => {
                    const prog = getUserProgress(staff.id);
                    return (
                      <tr key={staff.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{staff.name}</div>
                          <div className="text-sm text-gray-500">{staff.username}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{prog.completed} / {prog.total}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                              <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${prog.percentage}%` }}></div>
                            </div>
                            <span className="text-sm font-medium text-gray-700">{prog.percentage}%</span>
                          </div>
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

  const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('overview');

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
                <p className="text-sm text-gray-600">{currentUser.name}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6 border-b border-gray-200">
            <div className="flex space-x-8">
              <button
                onClick={() => setActiveTab('overview')}
                className={`pb-4 px-2 font-medium transition-colors ${activeTab === 'overview' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('manage')}
                className={`pb-4 px-2 font-medium transition-colors ${activeTab === 'manage' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Manage Training
              </button>
            </div>
          </div>

          {activeTab === 'overview' ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {branches.map(branch => {
                  const branchProg = getBranchProgress(branch.id);
                  const manager = users.find(u => u.id === branch.managerId);
                  
                  return (
                    <div key={branch.id} className="bg-white rounded-lg shadow-sm p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-800">{branch.name}</h3>
                          <p className="text-sm text-gray-600">Manager: {manager?.name}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-indigo-600">{branchProg.percentage}%</div>
                          <div className="text-sm text-gray-600">{branchProg.staffCount} staff</div>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${branchProg.percentage}%` }}></div>
                      </div>
                      <div className="mt-2 text-sm text-gray-600">
                        {branchProg.completed} / {branchProg.total} modules completed
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-800">All Staff Progress</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Member</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.filter(u => u.role === 'staff').map(staff => {
                        const prog = getUserProgress(staff.id);
                        const branch = branches.find(b => b.id === staff.branchId);
                        return (
                          <tr key={staff.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{staff.name}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{branch?.name}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{prog.completed} / {prog.total}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                                  <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${prog.percentage}%` }}></div>
                                </div>
                                <span className="text-sm font-medium text-gray-700">{prog.percentage}%</span>
                              </div>
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
              {trainingPaths.map(path => (
                <div key={path.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <div className="bg-indigo-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    {editingPath === path.id ? (
                      <input
                        type="text"
                        defaultValue={path.name}
                        onBlur={(e) => renamePath(path.id, e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && renamePath(path.id, e.target.value)}
                        className="text-lg font-semibold px-2 py-1 border border-indigo-300 rounded"
                        autoFocus
                      />
                    ) : (
                      <div className="flex items-center space-x-3">
                        <h2 className="text-lg font-semibold text-gray-800">{path.name}</h2>
                        <button
                          onClick={() => setEditingPath(path.id)}
                          className="p-1 hover:bg-indigo-100 rounded"
                        >
                          <Edit className="w-4 h-4 text-indigo-600" />
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => setShowAddCategory(path.id)}
                      className="flex items-center space-x-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Category</span>
                    </button>
                  </div>

                  {showAddCategory === path.id && (
                    <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && newCategoryName && addCategory(path.id, newCategoryName)}
                          placeholder="Category name"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                          autoFocus
                        />
                        <button
                          onClick={() => newCategoryName && addCategory(path.id, newCategoryName)}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => {
                            setShowAddCategory(null);
                            setNewCategoryName('');
                          }}
                          className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="divide-y divide-gray-200">
                    {path.categories.map(category => (
                      <div key={category.id} className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          {editingCategory === category.id ? (
                            <input
                              type="text"
                              defaultValue={category.name}
                              onBlur={(e) => renameCategory(path.id, category.id, e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && renameCategory(path.id, category.id, e.target.value)}
                              className="font-medium text-gray-800 px-2 py-1 border border-gray-300 rounded"
                              autoFocus
                            />
                          ) : (
                            <div className="flex items-center space-x-2">
                              <h3 className="font-medium text-gray-800">{category.name}</h3>
                              <button
                                onClick={() => setEditingCategory(category.id)}
                                className="p-1 hover:bg-gray-100 rounded"
                              >
                                <Edit className="w-3 h-3 text-gray-600" />
                              </button>
                            </div>
                          )}
                          <button
                            onClick={() => deleteCategory(path.id, category.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Documentation URL
                            </label>
                            <div className="flex items-center space-x-2">
                              <LinkIcon className="w-4 h-4 text-gray-400" />
                              <input
                                type="text"
                                value={category.documentation || ''}
                                onChange={(e) => updateCategory(path.id, category.id, 'documentation', e.target.value)}
                                placeholder="https://example.com/documentation.pdf"
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Video URL
                            </label>
                            <div className="flex items-center space-x-2">
                              <LinkIcon className="w-4 h-4 text-gray-400" />
                              <input
                                type="text"
                                value={category.video || ''}
                                onChange={(e) => updateCategory(path.id, category.id, 'video', e.target.value)}
                                placeholder="https://youtube.com/watch?v=..."
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              />
                            </div>
                          </div>
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

  if (!currentUser) {
    return <LoginScreen />;
  }

  if (view === 'admin-dashboard') {
    return <AdminDashboard />;
  }

  if (view === 'manager-dashboard') {
    return <ManagerDashboard />;
  }

  return <TrainingView />;
};

export default TrainingManagementSystem;
