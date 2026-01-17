// 简历编辑器组件（表单编辑，支持 Markdown）
import { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { 
  User, 
  GraduationCap, 
  Briefcase, 
  FolderGit2, 
  Award,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  X,
  Users,
  Trophy,
  FileCheck
} from 'lucide-react';
import { 
  type ResumeData, 
  type EducationItem, 
  type ExperienceItem, 
  type ProjectItem, 
  type SkillCategory,
  type CampusExperienceItem,
  type AwardItem,
  type CertificateItem,
  type ResumeType
} from '../../types/resume';

interface Props {
  data: ResumeData;
  photoData: string | null;
  onChange: (data: ResumeData) => void;
  onPhotoChange: (photo: string | null) => void;
}

export default function ResumeEditor({ data, photoData, onChange, onPhotoChange }: Props) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['personalInfo', 'experience', 'education'])
  );

  const isCampus = data.resumeType === 'campus';

  // 日期格式化辅助函数
  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    if (dateStr === '至今') return null;
    const [year, month] = dateStr.split('-').map(Number);
    if (!year || !month) return null;
    return new Date(year, month - 1);
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  // 处理照片上传
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件');
      return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
      alert('图片大小不能超过 2MB');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      onPhotoChange(result);
    };
    reader.readAsDataURL(file);
  };

  const updatePersonalInfo = (field: string, value: any) => {
    onChange({
      ...data,
      personalInfo: { ...data.personalInfo, [field]: value }
    });
  };

  const addEducation = () => {
    onChange({
      ...data,
      education: [
        ...data.education,
        {
          id: Date.now().toString(),
          school: '',
          degree: '',
          major: '',
          startDate: '',
          endDate: ''
        }
      ]
    });
  };

  const updateEducation = (id: string, field: string, value: any) => {
    onChange({
      ...data,
      education: data.education.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    });
  };

  const deleteEducation = (id: string) => {
    onChange({
      ...data,
      education: data.education.filter(item => item.id !== id)
    });
  };

  const addExperience = () => {
    onChange({
      ...data,
      experience: [
        ...data.experience,
        {
          id: Date.now().toString(),
          company: '',
          position: '',
          startDate: '',
          endDate: '',
          description: ''
        }
      ]
    });
  };

  const updateExperience = (id: string, field: string, value: any) => {
    onChange({
      ...data,
      experience: data.experience.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    });
  };

  const deleteExperience = (id: string) => {
    onChange({
      ...data,
      experience: data.experience.filter(item => item.id !== id)
    });
  };

  const addProject = () => {
    onChange({
      ...data,
      projects: [
        ...data.projects,
        {
          id: Date.now().toString(),
          name: '',
          description: ''
        }
      ]
    });
  };

  const updateProject = (id: string, field: string, value: any) => {
    onChange({
      ...data,
      projects: data.projects.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    });
  };

  const deleteProject = (id: string) => {
    onChange({
      ...data,
      projects: data.projects.filter(item => item.id !== id)
    });
  };

  const addSkillCategory = () => {
    onChange({
      ...data,
      skills: [
        ...data.skills,
        {
          id: Date.now().toString(),
          category: '',
          skills: []
        }
      ]
    });
  };

  const updateSkillCategory = (id: string, field: string, value: any) => {
    onChange({
      ...data,
      skills: data.skills.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    });
  };

  const deleteSkillCategory = (id: string) => {
    onChange({
      ...data,
      skills: data.skills.filter(item => item.id !== id)
    });
  };

  // 校园经历管理
  const addCampusExperience = () => {
    onChange({
      ...data,
      campusExperience: [
        ...(data.campusExperience || []),
        {
          id: Date.now().toString(),
          organization: '',
          position: '',
          startDate: '',
          endDate: '',
          description: ''
        }
      ]
    });
  };

  const updateCampusExperience = (id: string, field: string, value: any) => {
    onChange({
      ...data,
      campusExperience: (data.campusExperience || []).map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    });
  };

  const deleteCampusExperience = (id: string) => {
    onChange({
      ...data,
      campusExperience: (data.campusExperience || []).filter(item => item.id !== id)
    });
  };

  // 获奖荣誉管理
  const addAward = () => {
    onChange({
      ...data,
      awards: [
        ...(data.awards || []),
        {
          id: Date.now().toString(),
          name: '',
          date: ''
        }
      ]
    });
  };

  const updateAward = (id: string, field: string, value: any) => {
    onChange({
      ...data,
      awards: (data.awards || []).map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    });
  };

  const deleteAward = (id: string) => {
    onChange({
      ...data,
      awards: (data.awards || []).filter(item => item.id !== id)
    });
  };

  // 证书管理
  const addCertificate = () => {
    onChange({
      ...data,
      certificates: [
        ...(data.certificates || []),
        {
          id: Date.now().toString(),
          name: '',
          date: ''
        }
      ]
    });
  };

  const updateCertificate = (id: string, field: string, value: any) => {
    onChange({
      ...data,
      certificates: (data.certificates || []).map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    });
  };

  const deleteCertificate = (id: string) => {
    onChange({
      ...data,
      certificates: (data.certificates || []).filter(item => item.id !== id)
    });
  };

  // 检查区块完成状态
  const checkSectionCompletion = (section: string): boolean => {
    switch (section) {
      case 'personalInfo':
        return !!(
          data.personalInfo.name?.trim() &&
          data.personalInfo.email?.trim() &&
          data.personalInfo.phone?.trim()
        );
      
      case 'education':
        return data.education.length > 0 && data.education.every(edu =>
          edu.school?.trim() &&
          edu.degree?.trim() &&
          edu.major?.trim() &&
          edu.startDate?.trim() &&
          edu.endDate?.trim()
        );
      
      case 'experience':
        return data.experience.length > 0 && data.experience.every(exp =>
          exp.company?.trim() &&
          exp.position?.trim() &&
          exp.startDate?.trim() &&
          exp.endDate?.trim() &&
          exp.description?.trim()
        );
      
      case 'projects':
        return data.projects.length > 0 && data.projects.every(proj =>
          proj.name?.trim() &&
          proj.description?.trim()
        );
      
      case 'skills':
        return data.skills.length > 0 && data.skills.every(skill =>
          skill.category?.trim() &&
          skill.skills.length > 0
        );
      
      default:
        return false;
    }
  };

  const SectionHeader = ({ icon: Icon, title, section, optional = false }: any) => {
    const isCompleted = !optional && checkSectionCompletion(section);
    
    return (
      <button
        onClick={() => toggleSection(section)}
        className={`w-full flex items-center justify-between p-4 border-b-2 transition-colors ${
          isCompleted 
            ? 'bg-green-50 border-green-200 hover:bg-green-100' 
            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
        }`}
      >
        <div className="flex items-center gap-3">
          <Icon className={`w-5 h-5 ${isCompleted ? 'text-green-700' : 'text-gray-700'}`} />
          <h3 className={`font-semibold ${isCompleted ? 'text-green-900' : 'text-gray-900'}`}>
            {title}
          </h3>
        </div>
        {expandedSections.has(section) ? (
          <ChevronUp className="w-5 h-5 text-gray-600" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-600" />
        )}
      </button>
    );
  };

  return (
    <div className="p-6 space-y-4">
      {/* 简历类型选择 */}
      <div className="border-2 border-gray-900 bg-gray-50 p-4 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          简历类型
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="resumeType"
              value="social"
              checked={data.resumeType !== 'campus'}
              onChange={() => onChange({ ...data, resumeType: 'social' })}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium">社招简历</span>
            <span className="text-xs text-gray-500">（有工作经验）</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="resumeType"
              value="campus"
              checked={data.resumeType === 'campus'}
              onChange={() => onChange({ ...data, resumeType: 'campus' })}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium">校招简历</span>
            <span className="text-xs text-gray-500">（应届生）</span>
          </label>
        </div>
      </div>

      {/* 基本信息 */}
      <div className="border-2 border-gray-200">
        <SectionHeader icon={User} title="基本信息" section="personalInfo" />
        {expandedSections.has('personalInfo') && (
          <div className="p-6 space-y-4">
            {/* 照片上传 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                个人照片（存储在本地）
              </label>
              <div className="flex items-center gap-4">
                {photoData ? (
                  <div className="relative">
                    <img
                      src={photoData}
                      alt="照片"
                      className="w-28 h-36 object-cover border-2 border-gray-300"
                    />
                    <button
                      onClick={() => onPhotoChange(null)}
                      className="absolute -top-2 -right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="w-28 h-36 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-gray-400 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <ImageIcon className="w-8 h-8 text-gray-400" />
                  </label>
                )}
                <div className="text-sm text-gray-500">
                  <p>建议尺寸：295x413px</p>
                  <p>最大 2MB</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="姓名 *"
                value={data.personalInfo.name}
                onChange={(e) => updatePersonalInfo('name', e.target.value)}
                className="px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
              />
              <input
                type="text"
                placeholder="微信号"
                value={data.personalInfo.wechat || ''}
                onChange={(e) => updatePersonalInfo('wechat', e.target.value)}
                className="px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <input
                type="email"
                placeholder="邮箱 *"
                value={data.personalInfo.email}
                onChange={(e) => updatePersonalInfo('email', e.target.value)}
                className="px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
              />
              <input
                type="tel"
                placeholder="电话 *"
                value={data.personalInfo.phone}
                onChange={(e) => updatePersonalInfo('phone', e.target.value)}
                className="px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
              />
            </div>

            {/* 自我评价 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                自我评价（可选，支持 Markdown）
              </label>
              <textarea
                placeholder="简要介绍自己的优势、特长、职业目标等&#10;支持 Markdown 格式：**粗体**、- 列表"
                value={data.personalInfo.summary || ''}
                onChange={(e) => updatePersonalInfo('summary', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none resize-none font-mono text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* 教育背景 */}
      <div className="border-2 border-gray-200">
        <SectionHeader icon={GraduationCap} title="教育背景" section="education" />
        {expandedSections.has('education') && (
          <div className="p-6 space-y-4">
            {data.education.map((edu, index) => (
              <div key={edu.id} className="p-4 border-2 border-gray-200 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">教育 {index + 1}</span>
                  <button
                    onClick={() => deleteEducation(edu.id)}
                    className="p-1 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="学校名称 *"
                  value={edu.school}
                  onChange={(e) => updateEducation(edu.id, 'school', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                />

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="学位 *"
                    value={edu.degree}
                    onChange={(e) => updateEducation(edu.id, 'degree', e.target.value)}
                    className="px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                  />
                  <input
                    type="text"
                    placeholder="专业 *"
                    value={edu.major}
                    onChange={(e) => updateEducation(edu.id, 'major', e.target.value)}
                    className="px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                  />
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">开始时间</label>
                      <DatePicker
                        selected={parseDate(edu.startDate)}
                        onChange={(date) => updateEducation(edu.id, 'startDate', formatDate(date))}
                        dateFormat="yyyy-MM"
                        showMonthYearPicker
                        placeholderText="选择日期"
                        className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">结束时间</label>
                      <DatePicker
                        selected={edu.endDate === '至今' ? null : parseDate(edu.endDate)}
                        onChange={(date) => updateEducation(edu.id, 'endDate', formatDate(date))}
                        dateFormat="yyyy-MM"
                        showMonthYearPicker
                        placeholderText="选择日期"
                        disabled={edu.endDate === '至今'}
                        className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">GPA</label>
                      <input
                        type="text"
                        placeholder="GPA"
                        value={edu.gpa || ''}
                        onChange={(e) => updateEducation(edu.id, 'gpa', e.target.value)}
                        className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={edu.endDate === '至今'}
                      onChange={(e) => updateEducation(edu.id, 'endDate', e.target.checked ? '至今' : '')}
                      className="w-4 h-4"
                    />
                    <span>至今（在读）</span>
                  </label>
                </div>

                {isCampus && (
                  <input
                    type="text"
                    placeholder="排名（如：专业前 10%）"
                    value={edu.ranking || ''}
                    onChange={(e) => updateEducation(edu.id, 'ranking', e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                  />
                )}

                <textarea
                  placeholder="主修课程（支持 Markdown）&#10;示例：数据结构、算法设计、操作系统、计算机网络"
                  value={edu.courses || ''}
                  onChange={(e) => updateEducation(edu.id, 'courses', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none resize-none font-mono text-sm"
                />

                <textarea
                  placeholder="获奖经历（用顿号分隔）&#10;示例：国家奖学金（2023）、优秀学生干部（2022）、数学建模竞赛一等奖"
                  value={edu.achievements || ''}
                  onChange={(e) => updateEducation(edu.id, 'achievements', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none resize-none font-mono text-sm"
                />
              </div>
            ))}

            <button
              onClick={addEducation}
              className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              添加教育背景
            </button>
          </div>
        )}
      </div>

      {/* 工作经验 / 实习经历 */}
      <div className="border-2 border-gray-200">
        <SectionHeader 
          icon={Briefcase} 
          title={isCampus ? "实习经历" : "工作经验"} 
          section="experience" 
        />
        {expandedSections.has('experience') && (
          <div className="p-6 space-y-4">
            {data.experience.map((exp, index) => (
              <div key={exp.id} className="p-4 border-2 border-gray-200 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">经历 {index + 1}</span>
                  <button
                    onClick={() => deleteExperience(exp.id)}
                    className="p-1 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="公司名称 *"
                  value={exp.company}
                  onChange={(e) => updateExperience(exp.id, 'company', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                />

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="职位 *"
                    value={exp.position}
                    onChange={(e) => updateExperience(exp.id, 'position', e.target.value)}
                    className="px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                  />
                  <input
                    type="text"
                    placeholder="地点"
                    value={exp.location || ''}
                    onChange={(e) => updateExperience(exp.id, 'location', e.target.value)}
                    className="px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">开始时间</label>
                    <DatePicker
                      selected={parseDate(exp.startDate)}
                      onChange={(date) => updateExperience(exp.id, 'startDate', formatDate(date))}
                      dateFormat="yyyy-MM"
                      showMonthYearPicker
                      placeholderText="选择日期"
                      className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">结束时间</label>
                    <div className="flex gap-2">
                      <DatePicker
                        selected={exp.endDate === '至今' ? null : parseDate(exp.endDate)}
                        onChange={(date) => updateExperience(exp.id, 'endDate', formatDate(date))}
                        dateFormat="yyyy-MM"
                        showMonthYearPicker
                        placeholderText="选择日期"
                        disabled={exp.endDate === '至今'}
                        className="flex-1 px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none disabled:bg-gray-100"
                      />
                      <label className="flex items-center gap-1 text-sm whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={exp.endDate === '至今'}
                          onChange={(e) => updateExperience(exp.id, 'endDate', e.target.checked ? '至今' : '')}
                          className="w-4 h-4"
                        />
                        至今
                      </label>
                    </div>
                  </div>
                </div>

                <textarea
                  placeholder="主要职责（支持 Markdown，如：**粗体**、- 列表）"
                  value={exp.description}
                  onChange={(e) => updateExperience(exp.id, 'description', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none resize-none font-mono text-sm"
                />

                <textarea
                  placeholder="主要成就（可选，支持 Markdown，如：- 列表项）"
                  value={exp.achievements || ''}
                  onChange={(e) => updateExperience(exp.id, 'achievements', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none resize-none font-mono text-sm"
                />
              </div>
            ))}

            <button
              onClick={addExperience}
              className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              添加工作经验
            </button>
          </div>
        )}
      </div>

      {/* 项目经历 */}
      <div className="border-2 border-gray-200">
        <SectionHeader icon={FolderGit2} title="项目经历" section="projects" />
        {expandedSections.has('projects') && (
          <div className="p-6 space-y-4">
            {data.projects.map((proj, index) => (
              <div key={proj.id} className="p-4 border-2 border-gray-200 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">项目 {index + 1}</span>
                  <button
                    onClick={() => deleteProject(proj.id)}
                    className="p-1 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="项目名称 *"
                  value={proj.name}
                  onChange={(e) => updateProject(proj.id, 'name', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                />

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="角色（如：前端开发）"
                    value={proj.role || ''}
                    onChange={(e) => updateProject(proj.id, 'role', e.target.value)}
                    className="px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                  />
                  <input
                    type="url"
                    placeholder="GitHub 链接（可选）"
                    value={proj.link || ''}
                    onChange={(e) => updateProject(proj.id, 'link', e.target.value)}
                    className="px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">开始时间（可选）</label>
                    <DatePicker
                      selected={parseDate(proj.startDate || '')}
                      onChange={(date) => updateProject(proj.id, 'startDate', formatDate(date))}
                      dateFormat="yyyy-MM"
                      showMonthYearPicker
                      placeholderText="选择日期"
                      isClearable
                      className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">结束时间（可选）</label>
                    <DatePicker
                      selected={parseDate(proj.endDate || '')}
                      onChange={(date) => updateProject(proj.id, 'endDate', formatDate(date))}
                      dateFormat="yyyy-MM"
                      showMonthYearPicker
                      placeholderText="选择日期"
                      isClearable
                      className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                    />
                  </div>
                </div>

                <textarea
                  placeholder="项目描述（支持 Markdown）"
                  value={proj.description}
                  onChange={(e) => updateProject(proj.id, 'description', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none resize-none font-mono text-sm"
                />

                <textarea
                  placeholder="项目亮点（可选，支持 Markdown，如：- 列表项）"
                  value={proj.highlights || ''}
                  onChange={(e) => updateProject(proj.id, 'highlights', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none resize-none font-mono text-sm"
                />

                <input
                  type="text"
                  placeholder="技术栈（用顿号分隔，如：React、Node.js、MySQL）"
                  value={proj.technologies?.join('、') || ''}
                  onBlur={(e) => updateProject(proj.id, 'technologies', e.target.value.split('、').map(s => s.trim()).filter(Boolean))}
                  onChange={(e) => {
                    // 临时更新显示值，不立即分割
                    const tempValue = e.target.value;
                    updateProject(proj.id, 'technologies', [tempValue]);
                  }}
                  className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                />
              </div>
            ))}

            <button
              onClick={addProject}
              className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              添加项目经历
            </button>
          </div>
        )}
      </div>

      {/* 专业技能 */}
      <div className="border-2 border-gray-200">
        <SectionHeader icon={Award} title="专业技能" section="skills" />
        {expandedSections.has('skills') && (
          <div className="p-6 space-y-4">
            {data.skills.map((skill, index) => (
              <div key={skill.id} className="p-4 border-2 border-gray-200 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">技能分类 {index + 1}</span>
                  <button
                    onClick={() => deleteSkillCategory(skill.id)}
                    className="p-1 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="分类名称（如：后端开发）"
                  value={skill.category}
                  onChange={(e) => updateSkillCategory(skill.id, 'category', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                />

                <input
                  type="text"
                  placeholder="技能列表（用顿号分隔，如：Java、Spring Boot、MySQL）"
                  value={skill.skills.join('、')}
                  onBlur={(e) => updateSkillCategory(skill.id, 'skills', e.target.value.split('、').map(s => s.trim()).filter(Boolean))}
                  onChange={(e) => {
                    // 临时更新显示值，不立即分割
                    const tempValue = e.target.value;
                    updateSkillCategory(skill.id, 'skills', [tempValue]);
                  }}
                  className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                />
              </div>
            ))}

            <button
              onClick={addSkillCategory}
              className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              添加技能分类
            </button>
          </div>
        )}
      </div>

      {/* 校招特有：校园经历 */}
      {isCampus && (
        <div className="border-2 border-gray-200">
          <SectionHeader icon={Users} title="校园经历（可选）" section="campusExperience" optional={true} />
          {expandedSections.has('campusExperience') && (
            <div className="p-6 space-y-4">
              {(data.campusExperience || []).map((exp, index) => (
                <div key={exp.id} className="p-4 border-2 border-gray-200 space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">经历 {index + 1}</span>
                    <button
                      onClick={() => deleteCampusExperience(exp.id)}
                      className="p-1 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="组织/社团名称 *"
                    value={exp.organization}
                    onChange={(e) => updateCampusExperience(exp.id, 'organization', e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                  />

                  <input
                    type="text"
                    placeholder="职位 *"
                    value={exp.position}
                    onChange={(e) => updateCampusExperience(exp.id, 'position', e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">开始时间</label>
                      <DatePicker
                        selected={parseDate(exp.startDate)}
                        onChange={(date) => updateCampusExperience(exp.id, 'startDate', formatDate(date))}
                        dateFormat="yyyy-MM"
                        showMonthYearPicker
                        placeholderText="选择日期"
                        className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">结束时间</label>
                      <DatePicker
                        selected={parseDate(exp.endDate)}
                        onChange={(date) => updateCampusExperience(exp.id, 'endDate', formatDate(date))}
                        dateFormat="yyyy-MM"
                        showMonthYearPicker
                        placeholderText="选择日期"
                        className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                      />
                    </div>
                  </div>

                  <textarea
                    placeholder="工作描述（支持 Markdown）"
                    value={exp.description}
                    onChange={(e) => updateCampusExperience(exp.id, 'description', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none resize-none font-mono text-sm"
                  />
                </div>
              ))}

              <button
                onClick={addCampusExperience}
                className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                添加校园经历
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
