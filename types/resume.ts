// 简历数据类型定义

// 简历类型
export type ResumeType = 'campus' | 'social'; // campus: 校招, social: 社招

export interface ResumeData {
  // 简历类型
  resumeType?: ResumeType;
  
  // 基本信息
  personalInfo: {
    name: string;
    email: string;
    phone: string;
    wechat?: string; // 微信号
    
    // 保留但不使用的字段
    gender?: string; // 性别
    title?: string; // 职位/职称（仅用于项目标识）
    location?: string; // 所在地
    birthDate?: string; // 出生日期
    politicalStatus?: string; // 政治面貌
    summary?: string; // 个人简介（支持 Markdown）
    
    links?: {
      github?: string;
      linkedin?: string;
      website?: string;
      [key: string]: string | undefined;
    };
  };
  
  // 教育背景
  education: EducationItem[];
  
  // 工作经验（社招必填，校招可选）
  experience: ExperienceItem[];
  
  // 项目经历
  projects: ProjectItem[];
  
  // 专业技能
  skills: SkillCategory[];
  
  // 校招特有：校园经历
  campusExperience?: CampusExperienceItem[];
  
  // 校招特有：获奖荣誉
  awards?: AwardItem[];
  
  // 校招特有：证书
  certificates?: CertificateItem[];
  
  // 自定义区块（可扩展）
  customSections?: CustomSection[];
}

export interface EducationItem {
  id: string;
  school: string;
  degree: string; // 学位
  major: string; // 专业
  startDate: string; // YYYY-MM
  endDate: string; // YYYY-MM 或 "至今"
  gpa?: string;
  ranking?: string; // 排名（如：专业前 10%）
  achievements?: string; // 成就（支持 Markdown）
  courses?: string; // 主修课程（支持 Markdown）
}

export interface ExperienceItem {
  id: string;
  company: string;
  position: string;
  location?: string;
  startDate: string; // YYYY-MM
  endDate: string; // YYYY-MM 或 "至今"
  description: string; // 工作描述（支持 Markdown）
  achievements?: string; // 主要成就（支持 Markdown）
}

export interface ProjectItem {
  id: string;
  name: string;
  role?: string; // 角色
  startDate?: string;
  endDate?: string;
  description: string; // 项目描述（支持 Markdown）
  technologies?: string[]; // 技术栈
  link?: string; // 项目链接
  highlights?: string; // 亮点（支持 Markdown）
}

export interface SkillCategory {
  id: string;
  category: string; // 分类名称（如：后端开发、前端开发）
  skills: string[]; // 技能列表
}

// 校招特有：校园经历
export interface CampusExperienceItem {
  id: string;
  organization: string; // 组织/社团名称
  position: string; // 职位
  startDate: string;
  endDate: string;
  description: string; // 描述（支持 Markdown）
}

// 校招特有：获奖荣誉
export interface AwardItem {
  id: string;
  name: string; // 奖项名称
  level?: string; // 级别（如：国家级、省级、校级）
  date: string; // 获奖时间
  description?: string; // 描述
}

// 校招特有：证书
export interface CertificateItem {
  id: string;
  name: string; // 证书名称
  issuer?: string; // 颁发机构
  date: string; // 获得时间
  score?: string; // 分数/等级
}

export interface CustomSection {
  id: string;
  title: string;
  content: string; // 支持 Markdown
  order: number;
}

// 默认简历数据
export const DEFAULT_RESUME_DATA: ResumeData = {
  resumeType: 'social',
  personalInfo: {
    name: '',
    email: '',
    phone: '',
    links: {}
  },
  education: [],
  experience: [],
  projects: [],
  skills: [],
  campusExperience: [],
  awards: [],
  certificates: [],
  customSections: []
};

// 简历模板配置
export interface ResumeTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  // 区块显示顺序
  sectionOrder: string[];
  // 样式配置
  styles?: {
    primaryColor?: string;
    fontFamily?: string;
    fontSize?: string;
  };
}

// 默认模板
export const DEFAULT_TEMPLATE: ResumeTemplate = {
  id: 'default',
  name: '经典模板',
  description: '简洁专业的经典简历模板',
  sectionOrder: ['personalInfo', 'summary', 'experience', 'education', 'projects', 'skills'],
  styles: {
    primaryColor: '#1f2937',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px'
  }
};
