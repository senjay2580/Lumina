// 简历预览组件（实时渲染，支持 Markdown）
import { marked } from 'marked';
import { Mail, Phone, MessageCircle, Github } from 'lucide-react';
import { type ResumeData } from '../../types/resume';

interface Props {
  data: ResumeData;
  photoData: string | null;
}

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true
});

// 渲染 Markdown
const renderMarkdown = (text: string) => {
  if (!text) return '';
  return marked.parse(text);
};

export default function ResumePreview({ data, photoData }: Props) {
  const { personalInfo, education, experience, projects, skills, campusExperience, awards, certificates } = data;
  const isCampus = data.resumeType === 'campus';

  return (
    <div className="bg-white" style={{ width: '210mm' }}>
      {/* A4 纸张样式 */}
      <style>{`
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
        .resume-content ul {
          list-style-type: disc;
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .resume-content ol {
          list-style-type: decimal;
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .resume-content li {
          margin: 0.25em 0;
        }
        .resume-content p {
          margin: 0.5em 0;
        }
        .resume-content strong {
          font-weight: 600;
          color: #111827;
        }
        .resume-content code {
          background-color: #f3f4f6;
          padding: 0.125rem 0.25rem;
          border-radius: 0.25rem;
          font-family: monospace;
          font-size: 0.875em;
        }
      `}</style>
      <div className="p-12 resume-content">
        {/* 头部：基本信息 */}
        <div className="flex gap-8 mb-8 pb-6 border-b-2 border-gray-900">
          {/* 左侧：姓名和联系方式 */}
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              {personalInfo.name || '姓名'}
            </h1>
            
            {/* 联系方式 - 纵向排列，带图标 */}
            <div className="flex flex-col gap-2 text-sm text-gray-600">
              {personalInfo.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 flex-shrink-0" />
                  <span>{personalInfo.email}</span>
                </div>
              )}
              {personalInfo.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 flex-shrink-0" />
                  <span>{personalInfo.phone}</span>
                </div>
              )}
              {personalInfo.wechat && (
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 flex-shrink-0" />
                  <span>WeChat: {personalInfo.wechat}</span>
                </div>
              )}
              {personalInfo.links?.github && (
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{personalInfo.links.github}</span>
                </div>
              )}
            </div>
          </div>
          
          {/* 右侧：照片 */}
          {photoData && (
            <div className="flex-shrink-0">
              <img
                src={photoData}
                alt={personalInfo.name}
                className="w-28 h-36 object-cover border-2 border-gray-300"
              />
            </div>
          )}
        </div>

        {/* 教育背景 */}
        {education.length > 0 && (
          <div className="mb-5">
            <h3 className="text-base font-bold text-blue-700 mb-4 pb-2 px-4 py-2.5 bg-gradient-to-r from-blue-50 to-transparent rounded-lg">
              教育背景
            </h3>
            <div className="space-y-4 ml-4">
              {education.map((edu) => (
                <div key={edu.id}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm text-gray-900">
                        {edu.school || '学校名称'}
                      </h4>
                      <p className="text-sm text-gray-700">
                        {edu.degree || '学位'} · {edu.major || '专业'}
                        {edu.gpa && <span className="font-bold"> · GPA: {edu.gpa}</span>}
                        {isCampus && edu.ranking && <span className="font-bold"> · {edu.ranking}</span>}
                      </p>
                    </div>
                    <div className="text-sm text-gray-600 text-right">
                      {edu.startDate && edu.endDate && (
                        <span>{edu.startDate} - {edu.endDate}</span>
                      )}
                    </div>
                  </div>
                  {edu.courses && (
                    <p className="text-sm text-gray-700 leading-relaxed">
                      <span className="font-bold">主修课程：</span>
                      {edu.courses}
                    </p>
                  )}
                  {edu.achievements && (
                    <p className="text-sm leading-relaxed">
                      <span className="font-bold text-gray-900">获奖经历：</span>
                      <span className="font-bold text-gray-700">{edu.achievements}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 工作经验 / 实习经历 */}
        {experience.length > 0 && (
          <div className="mb-5">
            <h3 className="text-base font-bold text-blue-700 mb-4 pb-2 px-4 py-2.5 bg-gradient-to-r from-blue-50 to-transparent rounded-lg">
              {isCampus ? '实习经历' : '工作经验'}
            </h3>
            <div className="space-y-5 ml-4">
              {experience.map((exp) => (
                <div key={exp.id}>
                  <div className="flex justify-between items-baseline mb-2">
                    <h4 className="text-base font-bold text-gray-900">
                      {exp.company || '公司名称'} · {exp.position || '职位'}
                      {exp.location && <span className="text-sm text-gray-600 font-normal ml-2">({exp.location})</span>}
                    </h4>
                    <div className="text-sm text-gray-600 flex-shrink-0 ml-4">
                      {exp.startDate && exp.endDate && (
                        <span>{exp.startDate} - {exp.endDate}</span>
                      )}
                    </div>
                  </div>
                  
                  {/* 主要职责 */}
                  {exp.description && (
                    <p className="mb-3 text-sm text-gray-700 leading-relaxed">
                      <span className="font-bold text-gray-900">主要职责：</span>
                      {exp.description}
                    </p>
                  )}
                  
                  {/* 主要成就 */}
                  {exp.achievements && (
                    <div 
                      className="text-sm text-gray-700 leading-relaxed [&>ul]:list-disc [&>ul]:ml-5 [&>ul]:space-y-1 [&>ol]:list-decimal [&>ol]:ml-5 [&>ol]:space-y-1"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(exp.achievements) }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 项目经历 */}
        {projects.length > 0 && (
          <div className="mb-5">
            <h3 className="text-base font-bold text-blue-700 mb-4 pb-2 px-4 py-2.5 bg-gradient-to-r from-blue-50 to-transparent rounded-lg">
              项目经历
            </h3>
            <div className="space-y-5 ml-4">
              {projects.map((proj) => (
                <div key={proj.id}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2 flex-1">
                      <h4 className="text-base font-bold text-gray-900">
                        {proj.name || '项目名称'}
                      </h4>
                      {proj.role && (
                        <span className="text-sm text-gray-600">· {proj.role}</span>
                      )}
                      {proj.link && (
                        <a 
                          href={proj.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                        >
                          <Github className="w-3 h-3 flex-shrink-0" />
                          <span>{proj.link.replace('https://', '').replace('http://', '')}</span>
                        </a>
                      )}
                    </div>
                    {proj.startDate && proj.endDate && (
                      <div className="text-sm text-gray-600 flex-shrink-0 ml-4">
                        <span>{proj.startDate} - {proj.endDate}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* 项目描述 */}
                  {proj.description && (
                    <p className="mb-3 text-sm text-gray-700 leading-relaxed">
                      <span className="font-bold text-gray-900">项目描述：</span>
                      {proj.description}
                    </p>
                  )}
                  
                  {/* 核心技术 */}
                  {proj.technologies && proj.technologies.length > 0 && (
                    <div className="mb-3">
                      <span className="text-sm font-bold text-gray-900">核心技术：</span>
                      {proj.technologies.map((tech, idx) => (
                        <span
                          key={idx}
                          className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 text-xs border border-gray-300 ml-2"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {/* 项目亮点 */}
                  {proj.highlights && (
                    <div 
                      className="text-sm text-gray-700 leading-relaxed [&>ul]:list-disc [&>ul]:ml-5 [&>ul]:space-y-1 [&>ol]:list-decimal [&>ol]:ml-5 [&>ol]:space-y-1"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(proj.highlights) }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 专业技能 */}
        {skills.length > 0 && (
          <div className="mb-5">
            <h3 className="text-base font-bold text-blue-700 mb-4 pb-2 px-4 py-2.5 bg-gradient-to-r from-blue-50 to-transparent rounded-lg">
              专业技能
            </h3>
            <div className="space-y-4 ml-4">
              {skills.map((skillCat) => (
                <div key={skillCat.id}>
                  <h4 className="text-sm font-bold text-gray-900 mb-2">
                    {skillCat.category || '分类'}
                  </h4>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {skillCat.skills.map((skill, idx) => (
                      <span key={idx}>
                        {idx > 0 && '、'}
                        <span className="font-medium">{skill}</span>
                      </span>
                    ))}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 校招特有：校园经历 */}
        {isCampus && campusExperience && campusExperience.length > 0 && (
          <div className="mb-5">
            <h3 className="text-base font-bold text-blue-700 mb-4 pb-2 px-4 py-2.5 bg-gradient-to-r from-blue-50 to-transparent rounded-lg">
              校园经历
            </h3>
            <div className="space-y-5 ml-4">
              {campusExperience.map((exp) => (
                <div key={exp.id}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="text-base font-bold text-gray-900">
                        {exp.organization || '组织名称'}
                      </h4>
                      <p className="text-sm text-gray-700">
                        {exp.position || '职位'}
                      </p>
                    </div>
                    <div className="text-sm text-gray-600 text-right">
                      {exp.startDate && exp.endDate && (
                        <span>{exp.startDate} - {exp.endDate}</span>
                      )}
                    </div>
                  </div>
                  {exp.description && (
                    <div 
                      className="text-sm text-gray-700 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(exp.description) }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 自我评价 - 放在最后 */}
        {personalInfo.summary && (
          <div className="mb-5">
            <h3 className="text-base font-bold text-blue-700 mb-3 pb-2 px-4 py-2.5 bg-gradient-to-r from-blue-50 to-transparent rounded-lg">
              自我评价
            </h3>
            <div 
              className="text-sm text-gray-700 leading-relaxed ml-4"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(personalInfo.summary) }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
