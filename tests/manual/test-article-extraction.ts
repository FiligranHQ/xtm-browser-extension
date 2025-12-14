/**
 * Manual Test Script for Article Extraction and PDF Generation
 * 
 * This script tests the Readability-based article extraction and jsPDF-based PDF generation.
 * 
 * To run this test:
 * 1. Build the extension: npm run build
 * 2. Load the extension in Chrome
 * 3. Navigate to a test URL (e.g., Le Monde article)
 * 4. Open the browser console and run these tests by sending messages to the content script
 * 
 * Test URL: https://www.lemonde.fr/international/article/2025/12/14/ce-que-l-on-sait-de-l-attaque-terroriste-contre-une-fete-juive-en-australie-de-l-arrivee-des-tireurs-a-bondi-beach-a-la-decouverte-d-un-engin-explosif_6657284_3210.html
 */

// Console commands to test from the browser console:

/**
 * Test 1: Get Page Content (should use Readability)
 * 
 * Run this in the browser console on the test page:
 * 
 * chrome.runtime.sendMessage({type: 'GET_PAGE_CONTENT'}, (response) => {
 *   console.log('GET_PAGE_CONTENT Response:', response);
 *   if (response?.success) {
 *     console.log('Title:', response.data.title);
 *     console.log('Description:', response.data.description);
 *     console.log('Content Length:', response.data.content?.length);
 *     console.log('HTML Length:', response.data.html?.length);
 *     console.log('First 500 chars of content:', response.data.content?.substring(0, 500));
 *   }
 * });
 */

/**
 * Test 2: Get Article Content (structured data)
 * 
 * Run this in the browser console:
 * 
 * chrome.runtime.sendMessage({type: 'GET_ARTICLE_CONTENT'}, (response) => {
 *   console.log('GET_ARTICLE_CONTENT Response:', response);
 *   if (response?.success) {
 *     console.log('Title:', response.data.title);
 *     console.log('Description:', response.data.description);
 *     console.log('Excerpt:', response.data.excerpt);
 *     console.log('Byline:', response.data.byline);
 *     console.log('Text Content Length:', response.data.textContent?.length);
 *   }
 * });
 */

/**
 * Test 3: Generate PDF
 * 
 * Run this in the browser console:
 * 
 * chrome.runtime.sendMessage({type: 'GENERATE_PDF'}, (response) => {
 *   console.log('GENERATE_PDF Response:', response);
 *   if (response?.success) {
 *     console.log('Filename:', response.data.filename);
 *     console.log('Base64 Data Length:', response.data.data?.length);
 *     
 *     // Download the PDF to verify it works
 *     const link = document.createElement('a');
 *     link.href = 'data:application/pdf;base64,' + response.data.data;
 *     link.download = response.data.filename;
 *     link.click();
 *     console.log('PDF downloaded - check your downloads folder');
 *   } else {
 *     console.error('PDF generation failed:', response?.error);
 *   }
 * });
 */

/**
 * Test 4: Comprehensive Test (all in one)
 * 
 * Copy and paste this entire block into the browser console:
 */
const runAllTests = () => {
  console.log('=== Starting XTM Article Extraction Tests ===\n');
  
  // Test 1: GET_PAGE_CONTENT
  console.log('Test 1: GET_PAGE_CONTENT');
  chrome.runtime.sendMessage({type: 'GET_PAGE_CONTENT'}, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error:', chrome.runtime.lastError);
      return;
    }
    
    if (response?.success) {
      console.log('✓ Title:', response.data.title);
      console.log('✓ Description (first 200 chars):', response.data.description?.substring(0, 200));
      console.log('✓ Content Length:', response.data.content?.length, 'chars');
      console.log('✓ HTML Length:', response.data.html?.length, 'chars');
      
      // Check content quality - should NOT contain menu items, cookie notices, etc.
      const content = response.data.content || '';
      const badPatterns = ['cookie', 'newsletter', 'subscribe', 'menu', 'navigation'];
      const foundBadPatterns = badPatterns.filter(p => content.toLowerCase().includes(p));
      if (foundBadPatterns.length > 0) {
        console.warn('⚠ Content may contain non-article elements:', foundBadPatterns);
      } else {
        console.log('✓ Content appears clean (no menu/cookie/newsletter text detected)');
      }
    } else {
      console.error('✗ GET_PAGE_CONTENT failed:', response?.error);
    }
    
    // Test 2: GENERATE_PDF
    console.log('\nTest 2: GENERATE_PDF');
    chrome.runtime.sendMessage({type: 'GENERATE_PDF'}, (pdfResponse) => {
      if (chrome.runtime.lastError) {
        console.error('Error:', chrome.runtime.lastError);
        return;
      }
      
      if (pdfResponse?.success && pdfResponse.data) {
        console.log('✓ PDF Filename:', pdfResponse.data.filename);
        console.log('✓ PDF Base64 Length:', pdfResponse.data.data?.length, 'chars');
        
        // Check if PDF has reasonable size
        const pdfSize = (pdfResponse.data.data?.length * 3 / 4) / 1024; // Approximate KB
        console.log('✓ Approximate PDF Size:', pdfSize.toFixed(2), 'KB');
        
        if (pdfSize < 5) {
          console.warn('⚠ PDF seems too small - may be blank');
        } else {
          console.log('✓ PDF size looks reasonable');
          
          // Offer to download
          console.log('\nTo download the PDF, run: downloadTestPDF()');
          (window as any).downloadTestPDF = () => {
            const link = document.createElement('a');
            link.href = 'data:application/pdf;base64,' + pdfResponse.data.data;
            link.download = pdfResponse.data.filename;
            link.click();
            console.log('PDF download started');
          };
        }
      } else {
        console.error('✗ GENERATE_PDF failed:', pdfResponse?.error);
      }
      
      console.log('\n=== Tests Complete ===');
    });
  });
};

// Export for manual execution
console.log(`
=== XTM Article Extraction Test Script Loaded ===

To run all tests, execute in the browser console:
  runAllTests()

Or run individual tests:
  Test 1 (Page Content): See GET_PAGE_CONTENT commands above
  Test 2 (Article Content): See GET_ARTICLE_CONTENT commands above  
  Test 3 (PDF Generation): See GENERATE_PDF commands above

Test URL recommended:
https://www.lemonde.fr/international/article/2025/12/14/ce-que-l-on-sait-de-l-attaque-terroriste-contre-une-fete-juive-en-australie-de-l-arrivee-des-tireurs-a-bondi-beach-a-la-decouverte-d-un-engin-explosif_6657284_3210.html
`);
