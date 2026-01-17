// HTML 导出工具
export interface ExportOptions {
  filename?: string;
}

/**
 * 导出简历为 HTML 文件
 * 用户可以在浏览器中打开后使用 Ctrl+P 打印为 PDF
 * @param element 要导出的 DOM 元素
 * @param options 导出选项
 */
export async function exportToHTML(
  element: HTMLElement,
  options: ExportOptions = {}
): Promise<void> {
  const {
    filename = '简历.html'
  } = options;

  try {
    // 获取元素的完整 HTML
    const content = element.innerHTML;
    
    // 获取所有相关的样式
    const styles = Array.from(document.styleSheets)
      .map(styleSheet => {
        try {
          return Array.from(styleSheet.cssRules)
            .map(rule => rule.cssText)
            .join('\n');
        } catch (e) {
          // 跨域样式表可能无法访问
          return '';
        }
      })
      .join('\n');

    // 创建完整的 HTML 文档
    const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${filename.replace('.html', '')}</title>
  <style>
    /* 重置样式 */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #f3f4f6;
      padding: 20px;
    }
    
    /* 打印样式 */
    @media print {
      body {
        background: white;
        padding: 0;
      }
      
      .no-print {
        display: none !important;
      }
      
      .resume-container {
        box-shadow: none !important;
        margin: 0 !important;
      }
    }
    
    /* 页面样式 */
    .resume-container {
      background: white;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      max-width: 210mm;
      width: 100%;
      margin: 0 auto;
    }
    
    /* 打印提示 */
    .print-hint {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #111827;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 1000;
    }
    
    .print-hint button {
      background: white;
      color: #111827;
      border: none;
      padding: 8px 16px;
      margin-left: 12px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 600;
    }
    
    .print-hint button:hover {
      background: #f3f4f6;
    }
    
    ${styles}
  </style>
</head>
<body>
  <div class="print-hint no-print">
    <span>按 Ctrl+P (Windows) 或 Cmd+P (Mac) 打印为 PDF</span>
    <button onclick="window.print()">打印</button>
  </div>
  <div class="resume-container">
    ${content}
  </div>
</body>
</html>`;

    // 创建 Blob 并下载
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('HTML 导出失败:', error);
    throw new Error('HTML 导出失败，请重试');
  }
}
