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
      
      return content
        // Convert headers
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        // Convert bold and italic
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Convert line breaks
        .replace(/\n/g, '<br>')
        // Handle lists (basic)
        .replace(/^[-*+]\s(.*)$/gim, '<li>$1</li>')
        // Wrap consecutive list items in ul tags
        .replace(/(<li>.*<\/li>)/gs, (match) => {
          if (!match.includes('<ul>')) {
            return '<ul>' + match + '</ul>';
          }
          return match;
        });
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
          <div class="language-section">
            <h2 class="language-header">
              ${isTranslation ? 'Translation - ' : ''}${getLanguageDisplayName(language)}
            </h2>
        `;

        // Add summary if available
        const summary = iepDocument.summaries && iepDocument.summaries[language];
        if (summary && summary.trim()) {
          htmlContent += `
            <div class="section-container">
              <h3>IEP Summary</h3>
              <div class="section-content">${processContent(summary)}</div>
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
                <div class="section-content">${processContent(section.content)}</div>
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
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
            line-height: 1.6;
            color: #333;
            background: white;
            padding: 20px;
            font-size: 11px;
          }
          
          .document-header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 15px;
            border-bottom: 2px solid #000;
          }
          
          .document-header h1 {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          
          .subtitle {
            font-size: 12px;
            color: #666;
          }
          
          .language-section {
            margin-bottom: 25px;
            page-break-inside: avoid;
          }
          
          .language-header {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 1px solid #333;
            page-break-after: avoid;
          }
          
          .section-container {
            margin-bottom: 20px;
            page-break-inside: avoid;
          }
          
          .section-container h3 {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 10px;
            page-break-after: avoid;
          }
          
          .section-container h4 {
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 8px;
            page-break-after: avoid;
          }
          
          .section-content {
            font-size: 11px;
            line-height: 1.6;
            text-align: justify;
            margin-bottom: 8px;
          }
          
          .page-reference {
            font-size: 9px;
            color: #888;
            font-style: italic;
            margin-top: 5px;
          }
          
          .empty-content {
            font-size: 11px;
            font-style: italic;
            color: #666;
            text-align: center;
            margin: 20px 0;
          }
          
          ul {
            margin: 10px 0 10px 20px;
          }
          
          li {
            margin-bottom: 5px;
          }
          
          h1, h2, h3, h4 {
            page-break-after: avoid;
          }
          
          @page {
            size: A4;
            margin: 20mm;
          }
          
          @media print {
            body {
              padding: 0;
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
    const executablePath = process.env.CHROME_EXECUTABLE_PATH || await chromium.executablePath;
    browser = await puppeteer.launch({
      args: [...chromium.args, '--disable-gpu', '--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: chromium.defaultViewport,
      headless: chromium.headless,
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