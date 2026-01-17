// 投递记录管理页面（飞书多维表格风格）
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Plus, 
  Search, 
  Filter, 
  Download,
  Trash2,
  Edit2,
  Calendar,
  Building2,
  Briefcase,
  Loader2,
  X,
  ChevronDown,
  Trophy
} from 'lucide-react';
import {
  getApplications,
  createApplication,
  updateApplication,
  deleteApplication,
  getApplicationStats,
  getCompanyList,
  getCompanyStats,
  STATUS_CONFIG,
  type JobApplication,
  type ApplicationStatus
} from '../../lib/job-applications';
import { getCreations, type Creation } from '../../lib/creations';
import { getVersions, type Version } from '../../lib/version-manager';
import { Confirm } from '../../shared/Confirm';

interface Props {
  userId: string;
  onBack: () => void;
}

export default function JobApplicationsPage({ userId, onBack }: Props) {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [filteredApps, setFilteredApps] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingApp, setEditingApp] = useState<JobApplication | null>(null);
  const [stats, setStats] = useState<any>(null);

  // 表单数据
  const [creations, setCreations] = useState<Creation[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [companyList, setCompanyList] = useState<Array<{ name: string; url?: string; count: number }>>([]);
  const [companyStats, setCompanyStats] = useState<Array<{ company: string; url?: string; count: number }>>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showErrorAlert, setShowErrorAlert] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [pendingVersionSwitch, setPendingVersionSwitch] = useState<Version | null>(null);
  const [formData, setFormData] = useState({
    creation_id: '',
    version_id: '',
    company_name: '',
    company_url: '',
    position: '',
    application_date: new Date().toISOString().split('T')[0],
    status: 'pending' as ApplicationStatus,
    current_stage: '',
    notes: '',
    salary_range: ''
  });

  useEffect(() => {
    loadData();
  }, [userId]);

  useEffect(() => {
    filterApplications();
  }, [applications, searchQuery, statusFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [appsData, statsData, creationsData, companiesData, companyStatsData] = await Promise.all([
        getApplications(userId),
        getApplicationStats(userId),
        getCreations(userId, 'resume'),
        getCompanyList(userId),
        getCompanyStats(userId)
      ]);
      setApplications(appsData);
      setStats(statsData);
      setCreations(creationsData);
      setCompanyList(companiesData);
      setCompanyStats(companyStatsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterApplications = () => {
    let filtered = applications;

    // 状态筛选
    if (statusFilter !== 'all') {
      filtered = filtered.filter(app => app.status === statusFilter);
    }

    // 搜索筛选
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(app =>
        app.company_name.toLowerCase().includes(query) ||
        app.position.toLowerCase().includes(query) ||
        app.creation?.title.toLowerCase().includes(query)
      );
    }

    setFilteredApps(filtered);
  };

  const handleCreationChange = async (creationId: string) => {
    setFormData({ ...formData, creation_id: creationId, version_id: '' });
    if (creationId) {
      const versionsData = await getVersions(creationId);
      setVersions(versionsData);
    } else {
      setVersions([]);
    }
  };

  const handleSubmit = async () => {
    if (!formData.creation_id || !formData.version_id || !formData.company_name || !formData.position) {
      setShowErrorAlert({ show: true, message: '请填写必填项（简历、版本、公司名称、职位名称）' });
      return;
    }

    try {
      if (editingApp) {
        await updateApplication(editingApp.id, formData);
      } else {
        await createApplication({
          user_id: userId,
          ...formData
        });
      }
      await loadData();
      handleCloseDialog();
    } catch (error) {
      console.error('Failed to save application:', error);
      setShowErrorAlert({ show: true, message: '保存失败，请重试' });
    }
  };

  const handleEdit = async (app: JobApplication) => {
    setEditingApp(app);
    setFormData({
      creation_id: app.creation_id,
      version_id: app.version_id,
      company_name: app.company_name,
      company_url: app.company_url || '',
      position: app.position,
      application_date: app.application_date.split('T')[0],
      status: app.status,
      current_stage: app.current_stage || '',
      notes: app.notes || '',
      salary_range: app.salary_range || ''
    });
    
    const versionsData = await getVersions(app.creation_id);
    setVersions(versionsData);
    setShowAddDialog(true);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setShowDeleteConfirm(false);
    
    try {
      await deleteApplication(id);
      await loadData();
    } catch (error) {
      console.error('Failed to delete application:', error);
      setShowErrorAlert({ show: true, message: '删除失败，请重试' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleCloseDialog = () => {
    setShowAddDialog(false);
    setEditingApp(null);
    setFormData({
      creation_id: '',
      version_id: '',
      company_name: '',
      company_url: '',
      position: '',
      application_date: new Date().toISOString().split('T')[0],
      status: 'pending',
      current_stage: '',
      notes: '',
      salary_range: ''
    });
    setVersions([]);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-50">
      {/* 头部 */}
      <div className="flex-shrink-0 bg-white px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="text-gray-600 hover:text-gray-900"
            >
              ← 返回
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">投递记录</h1>
              <p className="text-sm text-gray-600">管理你的求职投递和面试进度</p>
            </div>
          </div>
          
          <button
            onClick={() => setShowAddDialog(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-5 h-5" />
            新增投递
          </button>
        </div>

        {/* 统计卡片 */}
        {stats && (
          <>
            <div className="grid grid-cols-5 gap-4 mb-4">
              {/* 总投递 - 深色背景 */}
              <div className="bg-gray-900 border-2 border-gray-900 p-4">
                <div className="flex items-center justify-between mb-2">
                  <Briefcase className="w-5 h-5 text-white" />
                </div>
                <div className="text-2xl font-bold text-white">{stats.total}</div>
                <div className="text-sm text-gray-300">总投递</div>
              </div>
              
              {/* 待回复 */}
              <div className="bg-gray-50 border-2 border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <Calendar className="w-5 h-5 text-gray-600" />
                </div>
                <div className="text-2xl font-bold text-gray-600">{stats.pending}</div>
                <div className="text-sm text-gray-600">待回复</div>
              </div>
              
              {/* 面试中 */}
              <div className="bg-blue-50 border-2 border-blue-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-blue-700">{stats.interview}</div>
                <div className="text-sm text-blue-600">面试中</div>
              </div>
              
              {/* 已Offer */}
              <div className="bg-green-50 border-2 border-green-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <Trophy className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-2xl font-bold text-green-700">{stats.offer}</div>
                <div className="text-sm text-green-600">已Offer</div>
              </div>
              
              {/* 已拒绝 */}
              <div className="bg-red-50 border-2 border-red-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <X className="w-5 h-5 text-red-600" />
                </div>
                <div className="text-2xl font-bold text-red-700">{stats.rejected}</div>
                <div className="text-sm text-red-600">已拒绝</div>
              </div>
            </div>

            {/* 可视化图表 - 公司投递分布 */}
            {companyStats.length > 0 && (
              <div className="bg-white border-2 border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">公司投递分布（Top 10）</h3>
                <div className="space-y-2">
                  {companyStats.map((item, index) => {
                    const maxCount = companyStats[0].count;
                    const percentage = (item.count / maxCount) * 100;
                    
                    return (
                      <div key={index} className="flex items-center gap-3">
                        <div className="w-32 flex items-center gap-2">
                          <span className="text-sm text-gray-700 truncate flex-1" title={item.company}>
                            {item.company}
                          </span>
                          {item.url && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 text-xs bg-blue-600 text-white hover:bg-blue-700 transition-colors rounded flex-shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              投递
                            </a>
                          )}
                        </div>
                        <div className="flex-1 flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 h-8 relative overflow-hidden rounded">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 flex items-center justify-end px-2"
                              style={{ width: `${percentage}%` }}
                            >
                              {percentage > 20 && (
                                <span className="text-xs font-semibold text-white">
                                  {item.count}
                                </span>
                              )}
                            </div>
                          </div>
                          {percentage <= 20 && (
                            <span className="text-xs font-semibold text-gray-700 w-6">
                              {item.count}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 工具栏 */}
      <div className="flex-shrink-0 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          {/* 搜索 */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索公司、职位、简历..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none rounded"
            />
          </div>

          {/* 状态筛选 */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none rounded"
          >
            <option value="all">全部状态</option>
            <option value="pending">待回复</option>
            <option value="interview">面试中</option>
            <option value="offer">已Offer</option>
            <option value="rejected">已拒绝</option>
            <option value="accepted">已接受</option>
          </select>
        </div>
      </div>

      {/* 表格 */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="text-center py-20">
            <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {searchQuery || statusFilter !== 'all' ? '没有找到匹配的记录' : '还没有投递记录'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchQuery || statusFilter !== 'all' ? '试试调整筛选条件' : '开始记录你的求职投递吧'}
            </p>
          </div>
        ) : (
          <div className="bg-white border-2 border-gray-900 rounded-lg overflow-hidden shadow-sm">
            {/* 表头 */}
            <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-900 font-semibold text-sm text-gray-700">
              <div className="col-span-2">投递日期</div>
              <div className="col-span-2">公司</div>
              <div className="col-span-2">职位</div>
              <div className="col-span-2">使用简历</div>
              <div className="col-span-1">状态</div>
              <div className="col-span-2">当前阶段</div>
              <div className="col-span-1 text-right">操作</div>
            </div>

            {/* 表格内容 */}
            {filteredApps.map((app, index) => (
              <div
                key={app.id}
                className={`grid grid-cols-12 gap-4 px-6 py-4 hover:bg-blue-50 transition-colors items-center ${
                  index !== filteredApps.length - 1 ? 'border-b border-gray-200' : ''
                }`}
              >
                <div className="col-span-2 text-sm text-gray-600">
                  {formatDate(app.application_date)}
                </div>
                <div className="col-span-2 font-medium text-gray-900">
                  {app.company_name}
                </div>
                <div className="col-span-2 text-gray-700">
                  {app.position}
                </div>
                <div className="col-span-2 text-sm text-gray-600">
                  {app.creation?.title}
                  <span className="text-gray-400 ml-1">
                    (v{app.version?.version_number})
                  </span>
                </div>
                <div className="col-span-1">
                  <span className={`inline-block px-2 py-1 text-xs border rounded ${STATUS_CONFIG[app.status].color}`}>
                    {STATUS_CONFIG[app.status].label}
                  </span>
                </div>
                <div className="col-span-2 text-sm text-gray-600">
                  {app.current_stage || '-'}
                </div>
                <div className="col-span-1 flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleEdit(app)}
                    className="p-1 hover:bg-gray-100 transition-colors"
                    title="编辑"
                  >
                    <Edit2 className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    onClick={() => {
                      setDeletingId(app.id);
                      setShowDeleteConfirm(true);
                    }}
                    className="p-1 hover:bg-red-50 transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 新增/编辑对话框 */}
      {showAddDialog && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={handleCloseDialog}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white border-2 border-gray-900 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">
                {editingApp ? '编辑投递记录' : '新增投递记录'}
              </h3>
              <button
                onClick={handleCloseDialog}
                className="p-1 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 简历选择 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    使用简历 *
                  </label>
                  <select
                    value={formData.creation_id}
                    onChange={(e) => handleCreationChange(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                  >
                    <option value="">选择简历项目</option>
                    {creations.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    简历版本 *
                  </label>
                  <select
                    value={formData.version_id}
                    onChange={(e) => setFormData({ ...formData, version_id: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                    disabled={!formData.creation_id}
                  >
                    <option value="">选择版本</option>
                    {versions.map(v => (
                      <option key={v.id} value={v.id}>
                        v{v.version_number} - {v.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 公司和职位 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    公司名称 *
                  </label>
                  <input
                    type="text"
                    list="company-list"
                    value={formData.company_name}
                    onChange={(e) => {
                      const selectedCompany = companyList.find(c => c.name === e.target.value);
                      setFormData({ 
                        ...formData, 
                        company_name: e.target.value,
                        company_url: selectedCompany?.url || formData.company_url
                      });
                    }}
                    placeholder="输入或选择公司"
                    className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                  />
                  <datalist id="company-list">
                    {companyList.map((company, idx) => (
                      <option key={idx} value={company.name} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    职位名称 *
                  </label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                  />
                </div>
              </div>

              {/* 公司招聘链接 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  公司招聘链接
                </label>
                <input
                  type="url"
                  value={formData.company_url}
                  onChange={(e) => setFormData({ ...formData, company_url: e.target.value })}
                  placeholder="https://careers.company.com"
                  className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  填写后可在图表中快速跳转到该公司招聘页面
                </p>
              </div>

              {/* 投递日期和状态 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    投递日期 *
                  </label>
                  <input
                    type="date"
                    value={formData.application_date}
                    onChange={(e) => setFormData({ ...formData, application_date: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    当前状态
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as ApplicationStatus })}
                    className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                  >
                    {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 当前阶段和薪资 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    当前阶段
                  </label>
                  <input
                    type="text"
                    placeholder="如：一面、二面、HR面"
                    value={formData.current_stage}
                    onChange={(e) => setFormData({ ...formData, current_stage: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    薪资范围
                  </label>
                  <input
                    type="text"
                    placeholder="如：15-20K"
                    value={formData.salary_range}
                    onChange={(e) => setFormData({ ...formData, salary_range: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                  />
                </div>
              </div>

              {/* 备注 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  备注
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCloseDialog}
                className="flex-1 px-4 py-2 border-2 border-gray-300 hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 transition-colors"
              >
                {editingApp ? '保存' : '创建'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 删除确认对话框 */}
      <Confirm
        isOpen={showDeleteConfirm}
        title="删除投递记录"
        message="确定要删除这条投递记录吗？此操作无法撤销。"
        confirmText="删除"
        cancelText="取消"
        danger={true}
        onConfirm={() => deletingId && handleDelete(deletingId)}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setDeletingId(null);
        }}
      />

      {/* 错误提示对话框 */}
      {showErrorAlert.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowErrorAlert({ show: false, message: '' })} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">提示</h3>
              <p className="text-gray-500 text-sm">{showErrorAlert.message}</p>
            </div>
            <div className="flex border-t border-gray-100">
              <button
                onClick={() => setShowErrorAlert({ show: false, message: '' })}
                className="flex-1 py-3 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
