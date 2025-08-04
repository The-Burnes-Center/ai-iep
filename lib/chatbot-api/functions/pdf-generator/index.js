const puppeteer = require('puppeteer-core');
const chromium = require("@sparticuz/chromium");

// Set graphics mode to false for Lambda
chromium.setGraphicsMode = false;

exports.handler = async (event, context) => {
  let browser = null;
  try {
    console.log('PDF Generation Lambda started');
    
    // Parse the request body
    let body;
    if (typeof event.body === 'string') {
      body = JSON.parse(event.body);
    } else {
      body = event.body;
    }
    
    const { document: iepDocument, preferredLanguage, fileName } = body;
    
    if (!iepDocument) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'IEP document is required' })
      };
    }

    // Helper function to get language display name
    const getLanguageDisplayName = (language) => {
      const languageNames = {
        'en': 'English',
        'es': 'Spanish (Español)',
        'vi': 'Vietnamese (Tiếng Việt)',
        'zh': 'Chinese (中文)',
      };
      return languageNames[language] || language.toUpperCase();
    };

    // Helper function to process markdown-like content to HTML
    const processContent = (content) => {
      if (!content) return '';
      
      let processed = content
        // Convert headers first
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        // Convert bold and italic
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Handle lists first
        .replace(/^[-*+]\s(.*)$/gim, '<li>$1</li>');
      
      // Wrap consecutive list items in ul tags
      processed = processed.replace(/(<li>.*?<\/li>(?:\s*<li>.*?<\/li>)*)/gs, '<ul>$1</ul>');
      
      // Split into paragraphs and handle line breaks
      const lines = processed.split('\n');
      const paragraphs = [];
      let currentParagraph = '';
      
      for (let line of lines) {
        const trimmedLine = line.trim();
        
        // Skip empty lines between paragraphs
        if (trimmedLine === '') {
          if (currentParagraph) {
            paragraphs.push(currentParagraph);
            currentParagraph = '';
          }
          continue;
        }
        
        // If line is a header or list, treat as separate block
        if (trimmedLine.startsWith('<h') || trimmedLine.startsWith('<ul>') || trimmedLine.startsWith('<li>')) {
          if (currentParagraph) {
            paragraphs.push(currentParagraph);
            currentParagraph = '';
          }
          paragraphs.push(trimmedLine);
          continue;
        }
        
        // Add to current paragraph
        if (currentParagraph) {
          currentParagraph += ' ' + trimmedLine;
        } else {
          currentParagraph = trimmedLine;
        }
      }
      
      // Add final paragraph if exists
      if (currentParagraph) {
        paragraphs.push(currentParagraph);
      }
      
      // Wrap paragraphs and return
      return paragraphs.map(p => {
        if (p.startsWith('<h') || p.startsWith('<ul>') || p.startsWith('<li>')) {
          return p;
        }
        return `<p>${p}</p>`;
      }).join('\n');
    };

    // Generate HTML content for the PDF
    const generateHTMLContent = () => {
      let htmlContent = '';
      
      // Document header
      htmlContent += `
        <div class="document-header">
          <h1>IEP Document Summary and Translations</h1>
          <p class="subtitle">Generated on ${new Date().toLocaleDateString()}</p>
        </div>
      `;

      // Collect available languages
      const availableLanguages = new Set();
      
      // Check for summaries
      Object.keys(iepDocument.summaries || {}).forEach(lang => {
        const summary = iepDocument.summaries[lang];
        if (summary && summary.trim()) {
          availableLanguages.add(lang);
        }
      });
      
      // Check for sections
      Object.keys(iepDocument.sections || {}).forEach(lang => {
        const sections = iepDocument.sections[lang];
        if (sections && sections.length > 0) {
          availableLanguages.add(lang);
        }
      });

      // Order languages: preferred language first (if not English), then English
      const orderedLanguages = [];
      
      if (preferredLanguage !== 'en' && availableLanguages.has(preferredLanguage)) {
        orderedLanguages.push(preferredLanguage);
      }
      
      if (availableLanguages.has('en') && orderedLanguages.length < 2) {
        orderedLanguages.push('en');
      }

      // Generate content for each language
      orderedLanguages.forEach((language) => {
        const isTranslation = language !== 'en';
        
        htmlContent += `
          <div class="language-section" lang="${language}">
            <h2 class="language-header" lang="${language}">
              ${isTranslation ? 'Translation - ' : ''}${getLanguageDisplayName(language)}
            </h2>
        `;

        // Add summary if available
        const summary = iepDocument.summaries && iepDocument.summaries[language];
        if (summary && summary.trim()) {
          htmlContent += `
            <div class="section-container">
              <h3>IEP Summary</h3>
              <div class="section-content" lang="${language}">${processContent(summary)}</div>
            </div>
          `;
        }

        // Get sections for this language
        const languageSections = iepDocument.sections && iepDocument.sections[language];

        if (!languageSections || languageSections.length === 0) {
          if (!summary || !summary.trim()) {
            htmlContent += `
              <p class="empty-content">
                No content available in ${getLanguageDisplayName(language)}
              </p>
            `;
          }
        } else {
          // Add sections header
          htmlContent += `<h3>Key Insights</h3>`;
          
          // Process each section
          languageSections.forEach((section) => {
            if (!section.content || !section.content.trim()) return;

            htmlContent += `
              <div class="section-container">
                <h4>${section.displayName || section.name || 'Section'}</h4>
                <div class="section-content" lang="${language}">${processContent(section.content)}</div>
                ${section.pageNumbers && section.pageNumbers.length > 0 ? 
                  `<p class="page-reference">Reference: Pages ${section.pageNumbers.join(', ')} of original IEP document</p>` : 
                  ''
                }
              </div>
            `;
          });
        }

        htmlContent += `</div>`;
      });

      return htmlContent;
    };

    // Complete HTML document with CSS
    const htmlDocument = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>IEP Document Summary</title>
        <style>
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Noto Sans CJK SC", "Source Han Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "WenQuanYi Micro Hei", sans-serif;
            line-height: 1.6;
            color: #333;
            background: white;
            padding: 25px;
            font-size: 11px;
          }
          
          .document-header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 3px solid #000;
          }
          
          .document-header h1 {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 15px;
            text-align: center;
          }
          
          .subtitle {
            font-size: 12px;
            color: #666;
            text-align: center;
          }
          
          .language-section {
            margin-bottom: 25px;
            padding-bottom: 20px;
            page-break-inside: avoid;
            border-bottom: 2px solid #e0e0e0;
          }
          
          .language-section:last-child {
            border-bottom: none;
          }
          
          .language-section:not(:first-child) {
            page-break-before: always;
          }
          
          .language-header {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 20px;
            margin-top: 15px;
            padding: 12px 0;
            border-bottom: 2px solid #333;
            text-transform: uppercase;
            letter-spacing: 1px;
            page-break-after: avoid;
          }
          
          .section-container {
            margin-bottom: 20px;
            padding-bottom: 15px;
            page-break-inside: avoid;
          }
          
          .section-container h3 {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 12px;
            margin-top: 20px;
            padding-bottom: 5px;
            border-bottom: 1px solid #ccc;
            page-break-after: avoid;
          }
          
          .section-container h4 {
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 10px;
            margin-top: 15px;
            color: #555;
            page-break-after: avoid;
          }
          
          .section-content {
            font-size: 11px;
            line-height: 1.7;
            text-align: justify;
            margin-bottom: 12px;
            text-indent: 0;
          }
          
          .section-content p {
            margin-bottom: 10px;
            text-align: justify;
          }
          
          .page-reference {
            font-size: 9px;
            color: #888;
            font-style: italic;
            margin-top: 8px;
            margin-bottom: 5px;
            text-align: left;
          }
          
          .empty-content {
            font-size: 11px;
            font-style: italic;
            color: #666;
            text-align: center;
            margin: 20px 0;
          }
          
          ul {
            margin: 15px 0 15px 25px;
            padding-left: 10px;
          }
          
          li {
            margin-bottom: 8px;
            line-height: 1.6;
            text-align: justify;
          }
          
          h1, h2, h3, h4 {
            page-break-after: avoid;
          }
          
          strong {
            font-weight: bold;
          }
          
          em {
            font-style: italic;
          }
          
          br {
            line-height: 1.8;
          }
          
          /* Specific font rules for CJK characters */
          *:lang(zh), 
          *:lang(zh-CN),
          *:lang(zh-TW) {
            font-family: "Noto Sans CJK SC", "Source Han Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "WenQuanYi Micro Hei", sans-serif !important;
          }

          *:lang(vi) {
            font-family: "Noto Sans", "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif !important;
          }

          /* Ensure Chinese characters are properly rendered */
          .chinese {
            font-family: "Noto Sans CJK SC", "Source Han Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "WenQuanYi Micro Hei", sans-serif !important;
          }

          @page {
            size: A4;
            margin: 25mm 20mm;
          }
          
          @media print {
            body {
              padding: 15px;
            }
            
            .language-section {
              margin-bottom: 30px;
            }
            
            .section-container {
              margin-bottom: 25px;
            }
          }
        </style>
      </head>
      <body>
        ${generateHTMLContent()}
      </body>
      </html>
    `;

    console.log("Launching browser...");
    const executablePath = process.env.CHROME_EXECUTABLE_PATH || await chromium.executablePath();
    console.log("Executable path:", executablePath);
    
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--disable-gpu',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-extensions',
        '--no-first-run',
        '--disable-default-apps',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--single-process',
        '--font-render-hinting=none',
        '--disable-font-subpixel-positioning',
        '--force-device-scale-factor=1'
      ],
      defaultViewport: chromium.defaultViewport,
      headless: chromium.headless || 'new',
      executablePath: executablePath,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    
    // Use navigation to a data URL
    await page.goto(`data:text/html,${encodeURIComponent(htmlDocument)}`, {
      waitUntil: 'networkidle0'
    });

    const pdf = await page.pdf({
      format: 'A4',
      margin: {
        top: '20mm',
        left: '20mm',
        right: '20mm',
        bottom: '20mm'
      },
      printBackground: true
    });

    // Sanitize the filename for the Content-Disposition header
    const sanitizedFilename = encodeURIComponent(fileName || 'IEP_Summary_and_Translations').replace(/%20/g, "_");

    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=${sanitizedFilename}.pdf`,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: pdf.toString('base64')
    };
  } catch (error) {
    console.error('Error generating PDF:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ 
        error: 'Failed to generate PDF', 
        details: error.message 
      })
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
  }
};