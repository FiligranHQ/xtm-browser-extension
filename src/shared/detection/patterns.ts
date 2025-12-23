/**
 * Observable Detection Patterns
 *
 * Comprehensive regex patterns for detecting various types of observables
 * in text content. These patterns are designed to be accurate while
 * minimizing false positives.
 *
 * Also supports defanged indicators (e.g., example[.]com, hxxp://, 192[.]168[.]1[.]1)
 */

import type { ObservableType, HashType } from '../types/observables';
import { escapeRegex } from './matching';

// ============================================================================
// Defanging/Refanging Utilities
// ============================================================================

/**
 * Refang a defanged indicator - convert it back to normal format
 * Used to convert detected defanged indicators to their real form for OpenCTI lookup
 *
 * Common defanging patterns:
 * - [.] or (.) or {.} → .
 * - [@] or (@) or {@} → @
 * - hxxp:// or hXXp:// → http://
 * - hxxps:// or hXXps:// → https://
 * - [://] or (:/) → ://
 * - [/] → /
 */
export function refangIndicator(value: string): string {
    return value
        // Replace bracketed/parenthesized/braced dots: [.] (.) {.}
        .replace(/\[\.\]|\(\.\)|\{\.\}/g, '.')
        // Replace bracketed/parenthesized/braced at signs: [@] (@) {@}
        .replace(/\[@\]|\(@\)|\{@\}/g, '@')
        // Replace hxxp/hXXp variants with http
        .replace(/hxxps?:\/\//gi, (match) => match.toLowerCase().replace('xx', 'tt'))
        .replace(/h\[xx\]ps?:\/\//gi, (match) => match.toLowerCase().replace('[xx]', 'tt'))
        // Replace [://] or (:/) with ://
        .replace(/\[:\/\/\]|\(:\/\)/g, '://')
        // Replace [/] or (/) with /
        .replace(/\[\/\]|\(\/\)/g, '/')
        // Replace meow with http (another common defang)
        .replace(/^meow:\/\//gi, 'http://')
        // Remove any remaining square brackets that might wrap parts
        .replace(/\[([^\]]+)\]/g, '$1');
}

/**
 * Check if a value appears to be defanged
 */
export function isDefanged(value: string): boolean {
    return /\[\.\]|\(\.\)|\{\.\}|\[@\]|\(@\)|hxxp|h\[xx\]p|\[:\/\/\]/i.test(value);
}

/**
 * Generate common defanged variants of a clean value for highlighting
 * This is the reverse of refangIndicator - given a clean value, generate
 * all common defanged forms that might appear in documents
 * 
 * Common defanging patterns (reverse of refangIndicator):
 * - . → [.] or (.) or {.}
 * - @ → [@] or (@)
 * - http:// → hxxp:// or hXXp://
 * - https:// → hxxps:// or hXXps://
 * 
 * For IPs like 192.168.1.1, common defanging includes:
 * - Last dot only: 192.168.1[.]1 (most common)
 * - All dots: 192[.]168[.]1[.]1
 * - Mixed: various combinations
 */
export function generateDefangedVariants(cleanValue: string): string[] {
    if (!cleanValue) return [];
    
    const variants: string[] = [];
    
    // Handle URLs with http/https
    if (cleanValue.match(/^https?:\/\//i)) {
        // hxxp/hxxps variants
        variants.push(cleanValue.replace(/^http:/i, 'hxxp:'));
        variants.push(cleanValue.replace(/^https:/i, 'hxxps:'));
        variants.push(cleanValue.replace(/^http:/i, 'hXXp:'));
        variants.push(cleanValue.replace(/^https:/i, 'hXXps:'));
    }
    
    // Handle dots - most important for IPs and domains
    if (cleanValue.includes('.')) {
        // Bracket defanging [.] - most common
        const bracketDefanged = cleanValue.replace(/\./g, '[.]');
        if (!variants.includes(bracketDefanged)) {
            variants.push(bracketDefanged);
        }
        
        // Paren defanging (.) - also common
        const parenDefanged = cleanValue.replace(/\./g, '(.)');
        if (!variants.includes(parenDefanged)) {
            variants.push(parenDefanged);
        }
        
        // For IPs and domains, also try last-dot-only defanging (very common in reports)
        // e.g., 192.168.1[.]1 instead of 192[.]168[.]1[.]1
        const lastDotIndex = cleanValue.lastIndexOf('.');
        if (lastDotIndex > 0 && lastDotIndex < cleanValue.length - 1) {
            const lastDotBracket = cleanValue.slice(0, lastDotIndex) + '[.]' + cleanValue.slice(lastDotIndex + 1);
            if (!variants.includes(lastDotBracket)) {
                variants.push(lastDotBracket);
            }
            const lastDotParen = cleanValue.slice(0, lastDotIndex) + '(.)' + cleanValue.slice(lastDotIndex + 1);
            if (!variants.includes(lastDotParen)) {
                variants.push(lastDotParen);
            }
        }
        
        // Curly brace defanging {.} - less common but seen
        const curlyDefanged = cleanValue.replace(/\./g, '{.}');
        if (!variants.includes(curlyDefanged)) {
            variants.push(curlyDefanged);
        }
    }
    
    // Handle @ for emails
    if (cleanValue.includes('@')) {
        const bracketAt = cleanValue.replace(/@/g, '[@]');
        if (!variants.includes(bracketAt)) {
            variants.push(bracketAt);
        }
        const parenAt = cleanValue.replace(/@/g, '(@)');
        if (!variants.includes(parenAt)) {
            variants.push(parenAt);
        }
        
        // Combination: both @ and . defanged
        if (cleanValue.includes('.')) {
            const bothDefanged = cleanValue.replace(/@/g, '[@]').replace(/\./g, '[.]');
            if (!variants.includes(bothDefanged)) {
                variants.push(bothDefanged);
            }
        }
    }
    
    return variants;
}

// ============================================================================
// IP Address Patterns
// ============================================================================

// IPv4: Standard dotted decimal notation AND defanged versions
// Matches: 192.168.1.1, 10.0.0.1, 255.255.255.255
// Defanged: 192[.]168[.]1[.]1, 192(.)168(.)1(.)1
// Excludes: Version numbers like 1.2.3.4 when preceded by 'v' or followed by common extensions
export const IPV4_PATTERN = /(?<![.\d\w])(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\.|\[\.\]|\(\.\)|\{\.\})){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?![.\d\]]|\.(?:js|css|html|php|asp|json|xml|txt|pdf|doc|exe|dll|zip|tar|gz|png|jpg|gif|svg|woff|ttf))/g;

// IPv6: Full and compressed formats
// Matches: 2001:0db8:85a3:0000:0000:8a2e:0370:7334, ::1, fe80::1
export const IPV6_PATTERN = /(?:(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}|:(?::[0-9a-fA-F]{1,4}){1,7}|::(?:[fF]{4}:)?(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?))(?![:\w])/g;

// ============================================================================
// Domain and URL Patterns
// ============================================================================

// Common TLDs for domain matching
const TLD_LIST = 'com|net|org|edu|gov|mil|int|co|io|ai|app|dev|cloud|tech|info|biz|name|pro|museum|aero|coop|travel|jobs|mobi|tel|asia|cat|xxx|post|mail|onion|bit|i2p|eth|crypto|nft|web3|zil|crypto|luxe|xyz|online|site|website|store|shop|blog|news|media|agency|studio|design|digital|marketing|consulting|solutions|services|systems|network|technology|software|hardware|security|cyber|data|analytics|platform|exchange|finance|bank|money|capital|fund|invest|trade|market|forex|crypto|token|coin|chain|block|ledger|wallet|pay|cash|credit|debit|loan|insurance|health|medical|pharma|bio|life|care|clinic|hospital|doctor|nurse|patient|therapy|fitness|gym|sport|game|play|music|video|photo|art|design|fashion|beauty|food|restaurant|cafe|bar|hotel|travel|tour|flight|car|auto|moto|bike|boat|ship|plane|train|bus|taxi|uber|lyft|amazon|google|apple|microsoft|facebook|twitter|instagram|linkedin|youtube|tiktok|snapchat|whatsapp|telegram|signal|discord|slack|zoom|teams|meet|webex|skype|outlook|gmail|yahoo|hotmail|icloud|proton|tutanota|fastmail|zoho|mailchimp|sendgrid|mailgun|postmark|ses|sns|sqs|s3|ec2|rds|lambda|cloudfront|route53|elb|alb|nlb|vpc|iam|kms|ssm|secrets|parameter|config|cloudwatch|cloudtrail|guardduty|inspector|macie|securityhub|detective|artifact|codepipeline|codebuild|codecommit|codedeploy|codestar|cloud9|cloudshell|amplify|appsync|cognito|pinpoint|lex|polly|rekognition|textract|comprehend|translate|transcribe|personalize|forecast|fraud|lookout|panorama|robomaker|ground|iot|greengrass|freertos|sitewise|twinmaker|fleetwise|healthlake|omics|braket|deadline|simspace|nimble|thinkbox|lumberyard|gamelift|gamesparks|uk|us|eu|de|fr|it|es|nl|be|at|ch|pl|cz|sk|hu|ro|bg|hr|si|rs|ua|ru|by|kz|uz|tm|tj|kg|az|ge|am|md|ee|lv|lt|fi|se|no|dk|is|ie|pt|gr|cy|mt|tr|il|ae|sa|qa|kw|bh|om|jo|lb|sy|iq|ir|pk|in|bd|lk|np|bt|mm|th|vn|la|kh|my|sg|id|ph|tw|hk|mo|jp|kr|kp|mn|cn|au|nz|fj|pg|sb|vu|nc|pf|ws|to|tv|ki|nr|fm|mh|pw|gu|mp|as|vi|pr|mx|gt|bz|sv|hn|ni|cr|pa|cu|jm|ht|do|tt|bb|gd|vc|lc|dm|ag|kn|bs|tc|ky|vg|ai|ms|aw|cw|sx|bq|gp|mq|gf|sr|gy|br|ar|cl|pe|ec|co|ve|bo|py|uy|fk|gs|sh|ac|io|sc|mu|re|yt|km|mg|mz|zw|za|na|bw|sz|ls|ao|zm|mw|tz|ke|ug|rw|bi|cd|cg|ga|gq|cm|cf|td|ne|ng|bj|tg|gh|ci|bf|ml|sn|gm|gw|gn|sl|lr|mr|eh|ma|dz|tn|ly|eg|sd|ss|er|et|dj|so|sbs';

// Domain name: Standard domain with TLD AND defanged versions
// Matches: example.com, sub.domain.co.uk
// Defanged: example[.]com, sub[.]domain[.]co[.]uk, example(.)com
// Excludes: Common file paths and partial matches
export const DOMAIN_PATTERN = new RegExp(
    `(?<![.\\w@/\\]])(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.|\\[\\.\\]|\\(\\.\\)|\\{\\.\\}))+(?:${TLD_LIST})(?![.\\w\\]])`,
    'gi'
);

// URL: Full URL with protocol AND defanged versions
// Matches: https://example.com/path?query=value
// Defanged: hxxps://example[.]com/path, hxxp://evil[.]com
export const URL_PATTERN = /(?:https?|hxxps?|h\[xx\]ps?|meow):\/\/(?:www(?:\.|\[\.\]|\(\.\)))?[-a-zA-Z0-9@:%._+~#=[\](){}]{1,256}(?:\.|\[\.\]|\(\.\))[a-zA-Z0-9()[\]{}]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=[\]]*)/gi;

// ============================================================================
// Email Pattern
// ============================================================================

// Email addresses AND defanged versions
// Matches: user@example.com, user.name+tag@sub.domain.co.uk
// Defanged: user[@]example[.]com, user[@]example(.)com
export const EMAIL_PATTERN = /(?<![.\w\]])[\w.+-]+(?:@|\[@\]|\(@\)|\{@\})(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.|\[\.\]|\(\.\)|\{\.\}))+[a-zA-Z]{2,}(?![.\w\]])/g;

// ============================================================================
// Hash Patterns
// ============================================================================

// MD5: 32 hex characters
// Matches: d41d8cd98f00b204e9800998ecf8427e
export const MD5_PATTERN = /(?<![a-fA-F0-9])[a-fA-F0-9]{32}(?![a-fA-F0-9])/g;

// SHA-1: 40 hex characters
// Matches: da39a3ee5e6b4b0d3255bfef95601890afd80709
export const SHA1_PATTERN = /(?<![a-fA-F0-9])[a-fA-F0-9]{40}(?![a-fA-F0-9])/g;

// SHA-256: 64 hex characters
// Matches: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
export const SHA256_PATTERN = /(?<![a-fA-F0-9])[a-fA-F0-9]{64}(?![a-fA-F0-9])/g;

// SHA-512: 128 hex characters
export const SHA512_PATTERN = /(?<![a-fA-F0-9])[a-fA-F0-9]{128}(?![a-fA-F0-9])/g;

// SSDEEP: Fuzzy hash format
// Matches: 3:AXGBicFlgVNhBGcL6wCrFQEv:AXGHsNhxLsr2C
// Requires: block size (1-6 digits), two hash parts with at least 6 characters each
// This prevents matching time formats like 8:50:23
export const SSDEEP_PATTERN = /(?<![:\d])\d{1,6}:[a-zA-Z0-9/+]{6,}:[a-zA-Z0-9/+]{6,}(?![:\da-zA-Z])/g;

// ============================================================================
// File Name Pattern
// ============================================================================

// Safe file extensions that don't conflict with domain TLDs
// EXCLUDES extensions that could be TLDs: .com, .net, .org, .io, .ai, .co, .me, .tv, .fm, .am, .so, .is, .it, .to, .be, .de, .fr, .uk, .us, .eu, .ca, .au, .ru, .cn, .in, .jp, .br, .pl, .nl, .ch, .at, .dk, .fi, .no, .se, .cz, .hu, .ro, .pt, .gr, .tr, .mx, .ar, .cl, .za, .nz, .sg, .hk, .tw, .kr, .my, .th, .id, .ph, .vn, etc.
// INCLUDES common executable, document, archive, script, and malware-related extensions
const FILE_EXTENSIONS = [
  // Executables & Libraries (Windows)
  'exe', 'dll', 'sys', 'drv', 'ocx', 'cpl', 'scr', 'msi', 'msp', 'msu', 'cab', 'efi',
  // Executables (Mac/Linux)
  'dmg', 'pkg', 'deb', 'rpm', 'appimage', 'snap', 'flatpak', 'run', 'bin', 'elf', 'dylib',
  // Scripts (potentially malicious)
  'bat', 'cmd', 'ps1', 'psm1', 'psd1', 'vbs', 'vbe', 'wsf', 'wsh', 'hta', 'js', 'jse', 
  'sh', 'bash', 'zsh', 'csh', 'ksh', 'py', 'pyc', 'pyw', 'rb', 'php', 'pl', 'pm',
  // Documents (common targets for malware)
  'doc', 'docx', 'docm', 'dot', 'dotx', 'dotm',
  'xls', 'xlsx', 'xlsm', 'xlt', 'xltx', 'xltm', 'xlsb', 'xlam',
  'ppt', 'pptx', 'pptm', 'pot', 'potx', 'potm', 'ppam', 'pps', 'ppsx', 'ppsm',
  'pdf', 'rtf', 'odt', 'ods', 'odp', 'odg',
  // Archives
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'lz', 'lzma', 'lzo',
  'tgz', 'tbz2', 'txz', 'tlz', 'arj', 'ace', 'cab', 'lzh', 'uue', 'z',
  // Disk Images
  'iso', 'img', 'vhd', 'vhdx', 'vmdk', 'ova', 'ovf', 'qcow', 'qcow2',
  // Java
  'jar', 'war', 'ear', 'class', 'jnlp',
  // Mobile
  'apk', 'aab', 'ipa', 'xap', 'appx', 'msix',
  // Shortcuts & Links
  'lnk', 'url', 'desktop', 'webloc',
  // Configuration & Data (often targeted)
  'reg', 'inf', 'ini', 'cfg', 'conf', 'config', 'yml', 'yaml', 'toml', 'json', 'xml',
  // Database
  'db', 'sqlite', 'sqlite3', 'mdb', 'accdb', 'dbf',
  // Fonts (can contain malware)
  'ttf', 'otf', 'woff', 'woff2', 'eot', 'fon',
  // Other potentially dangerous (excluding .com which is a TLD)
  'chm', 'hlp', 'cnt', 'swf', 'fla', 'as', 'pif',
].join('|');

// File name pattern: matches filename.extension
// Requirements:
// - File name: 1-200 characters, alphanumeric, hyphens, underscores, dots (for multi-ext like .tar.gz)
// - Extension: one of the safe extensions listed above
// - NOT preceded by @ (would be email), / or \ (would be path context we might want to skip)
// - Word boundaries to avoid partial matches
// NOTE: Spaces are NOT allowed in base filename to prevent matching sentence fragments
//       File names like "My Document.pdf" will be caught by the validate function or quoted variants
export const FILE_NAME_PATTERN = new RegExp(
  `(?<![/@\\\\])\\b([a-zA-Z0-9][a-zA-Z0-9_.()-]{0,199})\\.(${FILE_EXTENSIONS})\\b`,
  'gi'
);

// List of extensions for validation
export const VALID_FILE_EXTENSIONS = new Set(FILE_EXTENSIONS.split('|'));

// ============================================================================
// MAC Address Pattern
// ============================================================================

// MAC Address: Various formats
// Matches: 00:1A:2B:3C:4D:5E, 00-1A-2B-3C-4D-5E, 001A.2B3C.4D5E
export const MAC_PATTERN = /(?<![:\w])(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}(?![:\w])|(?<![.\w])(?:[0-9A-Fa-f]{4}\.){2}[0-9A-Fa-f]{4}(?![.\w])/g;

// ============================================================================
// Cryptocurrency Patterns
// ============================================================================

// Bitcoin address (Legacy, SegWit, Bech32)
// Matches: 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2, bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4
export const BITCOIN_PATTERN = /(?<![a-zA-Z0-9])(?:[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{39,59})(?![a-zA-Z0-9])/g;

// Ethereum address
// Matches: 0x742d35Cc6634C0532925a3b844Bc9e7595f3fEeA
export const ETHEREUM_PATTERN = /(?<![a-zA-Z0-9])0x[a-fA-F0-9]{40}(?![a-zA-Z0-9])/g;

// ============================================================================
// Vulnerability Pattern
// ============================================================================

// CVE identifier
// Matches: CVE-2021-44228, CVE-2022-0001, CVE-2024-38178, CVE-2025-66478
// Handles various dash-like characters that may appear in web content:
// - Regular hyphen-minus (-) \u002D
// - Non-breaking hyphen (‑) \u2010
// - Figure dash (‒) \u2011
// - En dash (–) \u2013
// - Em dash (—) \u2014
// - Horizontal bar (―) \u2015
// - Minus sign (−) \u2212
// - Soft hyphen \u00AD
// - Small hyphen-minus \uFE63
// - Fullwidth hyphen-minus \uFF0D
// Also handles zero-width characters that may be inserted by web rendering:
// - Zero-width space \u200B
// - Zero-width non-joiner \u200C
// - Zero-width joiner \u200D
// - Word joiner \u2060
// - Zero-width no-break space (BOM) \uFEFF
// Also allows optional spaces around dashes for malformed content
// CVE sequence numbers can have 4 to 7 digits (officially up to 7)
// Pattern: CVE + optional invisible chars + dash + optional invisible chars + 4 digits (year) + optional invisible chars + dash + optional invisible chars + 4-7 digits (sequence)
const CVE_DASH_CLASS = '[-\\u002D\\u2010\\u2011\\u2012\\u2013\\u2014\\u2015\\u2212\\u00AD\\uFE63\\uFF0D]';
const CVE_INVISIBLE_CLASS = '[\\s\\u200B\\u200C\\u200D\\u2060\\uFEFF]*';
/* eslint-disable no-misleading-character-class -- Intentionally matching various Unicode dash and invisible characters for CVE detection */
export const CVE_PATTERN = new RegExp(
  `CVE${CVE_INVISIBLE_CLASS}${CVE_DASH_CLASS}${CVE_INVISIBLE_CLASS}\\d{4}${CVE_INVISIBLE_CLASS}${CVE_DASH_CLASS}${CVE_INVISIBLE_CLASS}\\d{4,7}`,
  'gi'
);
/* eslint-enable no-misleading-character-class */

// ============================================================================
// ASN Pattern
// ============================================================================

// Autonomous System Number
// Matches: AS12345, ASN12345
export const ASN_PATTERN = /(?<![a-zA-Z])AS[N]?\d{1,10}(?![a-zA-Z0-9])/gi;

// ============================================================================
// Phone Number Patterns
// ============================================================================

// International phone numbers
// Matches: +1-555-123-4567, +44 20 7123 4567, +33 1 42 68 53 00
export const PHONE_PATTERN = /(?<![0-9])(?:\+[1-9]\d{0,2}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}(?![0-9])/g;

// ============================================================================
// IBAN (Bank Account) Pattern
// ============================================================================

// IBAN format: 2 letter country code + 2 check digits + up to 30 alphanumeric
// Matches: DE89370400440532013000, GB82WEST12345698765432
export const IBAN_PATTERN = /\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b/g;

// ============================================================================
// Credit Card (Payment Card) Patterns
// ============================================================================

// Visa, Mastercard, Amex, Discover, etc.
// Matches: 4111-1111-1111-1111, 5500 0000 0000 0004
export const CREDIT_CARD_PATTERN = /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})(?:[-\s]?\d{4})*\b/g;

// ============================================================================
// User Agent Pattern
// ============================================================================

// Browser user agent strings
// Matches: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
export const USER_AGENT_PATTERN = /Mozilla\/\d+\.\d+\s*\([^)]+\)\s*(?:AppleWebKit\/[\d.]+\s*)?(?:\([^)]+\)\s*)?(?:Chrome\/[\d.]+\s*)?(?:Safari\/[\d.]+)?/gi;

// ============================================================================
// Windows Registry Key Pattern
// ============================================================================

// Windows registry paths
// Matches: HKLM\SOFTWARE\Microsoft\Windows, HKEY_CURRENT_USER\Software
export const REGISTRY_PATTERN = /\b(?:HKEY_(?:LOCAL_MACHINE|CURRENT_USER|CLASSES_ROOT|USERS|CURRENT_CONFIG)|HK(?:LM|CU|CR|U|CC))(?:\\[A-Za-z0-9_\-. ]+)+\b/gi;

// ============================================================================
// X.509 Certificate Fingerprint Pattern
// ============================================================================

// SHA-1 and SHA-256 fingerprints with colons (certificate format)
// Matches: A1:B2:C3:D4:E5:F6:..., aa:bb:cc:dd:ee:ff:...
export const CERT_FINGERPRINT_PATTERN = /\b(?:[0-9A-Fa-f]{2}:){19}[0-9A-Fa-f]{2}\b|\b(?:[0-9A-Fa-f]{2}:){31}[0-9A-Fa-f]{2}\b/g;

// ============================================================================
// JARM Fingerprint Pattern
// ============================================================================

// JARM TLS fingerprints (62 hex characters)
export const JARM_PATTERN = /\b[0-9a-f]{62}\b/gi;

// ============================================================================
// JA3/JA3S Hash Pattern  
// ============================================================================

// JA3 fingerprints (32 hex characters, similar to MD5 but specifically for TLS)
// Using context to differentiate from generic MD5
export const JA3_PATTERN = /\bja3[s]?[:\s=]+[a-f0-9]{32}\b/gi;

// ============================================================================
// Detection Configuration
// ============================================================================

export interface PatternConfig {
    pattern: RegExp;
    type: ObservableType;
    hashType?: HashType;
    priority: number;
    validate?: (match: string) => boolean;
}

/**
 * All observable detection patterns with their configuration
 * Priority determines the order of detection (higher = first)
 */
export const OBSERVABLE_PATTERNS: PatternConfig[] = [
    // URLs first (most specific)
    {
        pattern: URL_PATTERN,
        type: 'Url',
        priority: 100,
        validate: (match) => {
            try {
                new URL(match);
                return true;
            } catch {
                return false;
            }
        },
    },

    // Email addresses
    {
        pattern: EMAIL_PATTERN,
        type: 'Email-Addr',
        priority: 95,
    },

    // Hashes (ordered by length to avoid overlap)
    {
        pattern: SHA512_PATTERN,
        type: 'StixFile',
        hashType: 'SHA-512',
        priority: 90,
    },
    {
        pattern: SHA256_PATTERN,
        type: 'StixFile',
        hashType: 'SHA-256',
        priority: 89,
    },
    {
        pattern: SHA1_PATTERN,
        type: 'StixFile',
        hashType: 'SHA-1',
        priority: 88,
    },
    {
        pattern: MD5_PATTERN,
        type: 'StixFile',
        hashType: 'MD5',
        priority: 87,
        validate: (match) => {
            // Exclude UUIDs with dashes (e.g., d41d8cd9-8f00-b204-e980-0998ecf8427e)
            // Note: Do NOT exclude pure 32-char hex strings - those are valid MD5 hashes
            return !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(match);
        },
    },
    {
        pattern: SSDEEP_PATTERN,
        type: 'StixFile',
        hashType: 'SSDEEP',
        priority: 86,
    },
    
    // File names with common extensions
    {
        pattern: FILE_NAME_PATTERN,
        type: 'StixFile',
        priority: 85,
        validate: (match) => {
            // Extract the extension from the match
            const lastDotIndex = match.lastIndexOf('.');
            if (lastDotIndex === -1) return false;
            const ext = match.substring(lastDotIndex + 1).toLowerCase();
            // Validate it's a known safe extension
            if (!VALID_FILE_EXTENSIONS.has(ext)) return false;
            // File name must be at least 2 characters (not just ".exe")
            const fileName = match.substring(0, lastDotIndex);
            if (fileName.length < 1) return false;
            // Exclude patterns that look like version numbers (e.g., "2.0.exe" or "v1.2.3.dll")
            // But allow things like "file2.exe" or "app_v2.exe"
            if (/^v?\d+(\.\d+)+$/i.test(fileName)) return false;
            return true;
        },
    },

    // IP addresses
    {
        pattern: IPV6_PATTERN,
        type: 'IPv6-Addr',
        priority: 80,
    },
    {
        pattern: IPV4_PATTERN,
        type: 'IPv4-Addr',
        priority: 79,
        validate: (match) => {
            // Exclude private/reserved ranges if needed
            const parts = match.split('.').map(Number);
            // Exclude 0.0.0.0 and 255.255.255.255
            if (parts.every(p => p === 0) || parts.every(p => p === 255)) {
                return false;
            }
            return true;
        },
    },

    // Domain names
    {
        pattern: DOMAIN_PATTERN,
        type: 'Domain-Name',
        priority: 70,
        validate: (match) => {
            // Refang the match first to handle defanged domains (e.g., goupdate[.]mywire[.]org)
            const refanged = refangIndicator(match);
            // Must have at least one dot and valid TLD
            const parts = refanged.split('.');
            if (parts.length < 2) return false;
            // Exclude common file extensions misdetected as domains
            const lastPart = parts[parts.length - 1].toLowerCase();
            const excludedExtensions = ['js', 'css', 'html', 'php', 'asp', 'json', 'xml', 'txt'];
            return !excludedExtensions.includes(lastPart);
        },
    },

    // MAC addresses
    {
        pattern: MAC_PATTERN,
        type: 'Mac-Addr',
        priority: 65,
    },

    // Cryptocurrency
    {
        pattern: BITCOIN_PATTERN,
        type: 'Cryptocurrency-Wallet',
        priority: 60,
    },
    {
        pattern: ETHEREUM_PATTERN,
        type: 'Cryptocurrency-Wallet',
        priority: 59,
    },

    // ASN
    {
        pattern: ASN_PATTERN,
        type: 'Autonomous-System',
        priority: 50,
    },

    // Bank Account (IBAN)
    {
        pattern: IBAN_PATTERN,
        type: 'Bank-Account',
        priority: 45,
        validate: (match) => {
            // Basic IBAN validation (length check by country would be more accurate)
            return match.length >= 15 && match.length <= 34;
        },
    },

    // Credit/Payment Card
    {
        pattern: CREDIT_CARD_PATTERN,
        type: 'Payment-Card',
        priority: 44,
        validate: (match) => {
            // Luhn algorithm check for credit card validation
            const digits = match.replace(/[-\s]/g, '');
            let sum = 0;
            let isEven = false;
            for (let i = digits.length - 1; i >= 0; i--) {
                let digit = parseInt(digits[i], 10);
                if (isEven) {
                    digit *= 2;
                    if (digit > 9) digit -= 9;
                }
                sum += digit;
                isEven = !isEven;
            }
            return sum % 10 === 0;
        },
    },

    // User Agent
    {
        pattern: USER_AGENT_PATTERN,
        type: 'User-Agent',
        priority: 40,
    },

    // Windows Registry Key
    {
        pattern: REGISTRY_PATTERN,
        type: 'Windows-Registry-Key',
        priority: 35,
    },

    // X.509 Certificate Fingerprint
    {
        pattern: CERT_FINGERPRINT_PATTERN,
        type: 'X509-Certificate',
        priority: 30,
    },
];

// CVE is special - it maps to Vulnerability entity, not observable
export const CVE_CONFIG = {
    pattern: CVE_PATTERN,
    type: 'Vulnerability' as const,
    priority: 100,
};

// ============================================================================
// MITRE ATT&CK Pattern (Attack Patterns)
// ============================================================================

// MITRE ATT&CK Technique IDs
// Matches: T1480, T1547.001, TA0001 (tactics), S0001 (software), G0001 (groups)
// Supports techniques (T####), sub-techniques (T####.###), tactics (TA####),
// software (S####), and groups (G####)
// Pattern: T/TA/S/G + 4 digits + optional (. + 3 digits for sub-techniques)
export const MITRE_ATTACK_PATTERN = /(?<![a-zA-Z0-9])(?:T[Aa]?\d{4}(?:\.\d{3})?|[SG]\d{4})(?![a-zA-Z0-9])/g;

// ============================================================================
// OpenCTI Entity Name Patterns
// ============================================================================

/**
 * OpenCTI entity types that should be searched by name/alias match
 */
export const OPENCTI_ENTITY_SEARCH_TYPES = [
    'Intrusion-Set',
    'Malware',
    'Threat-Actor',
    'Campaign',
    'Tool',
    'Attack-Pattern',
] as const;

/**
 * Generate a regex pattern for exact word matching
 */
export function createNamePattern(name: string): RegExp {
    // Match whole word only (case insensitive)
    return new RegExp(`\\b${escapeRegex(name)}\\b`, 'gi');
}

// ============================================================================
// Single Value Detection (for context menu / manual input)
// ============================================================================

// Simplified patterns for exact match detection (no lookbehind/lookahead)
const EXACT_IPV4 = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\.|\[\.\]|\(\.\))){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const EXACT_IPV6 = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,7}:$|^:(?::[0-9a-fA-F]{1,4}){1,7}$|^(?:[0-9a-fA-F]{1,4}:)+(?::[0-9a-fA-F]{1,4}){1,6}$/;
const EXACT_DOMAIN = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:(?:\.|\[\.\]|\(\.\))[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const EXACT_URL = /^(?:https?|hxxps?|h\[xx\]ps?):\/\/.+$/i;
const EXACT_EMAIL = /^[\w.+-]+(?:@|\[@\]|\(@\))(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.|\[\.\]|\(\.\)))+[a-zA-Z]{2,}$/;
const EXACT_CVE = /^CVE[-\u2010\u2011\u2012\u2013\u2014\u2212\u00AD]\d{4}[-\u2010\u2011\u2012\u2013\u2014\u2212\u00AD]\d{4,}$/i;
const EXACT_MD5 = /^[a-fA-F0-9]{32}$/;
const EXACT_SHA1 = /^[a-fA-F0-9]{40}$/;
const EXACT_SHA256 = /^[a-fA-F0-9]{64}$/;
const EXACT_SHA512 = /^[a-fA-F0-9]{128}$/;
const EXACT_MITRE = /^T\d{4}(?:\.\d{3})?$/;
const EXACT_MAC = /^(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$|^(?:[0-9A-Fa-f]{4}\.){2}[0-9A-Fa-f]{4}$/;
const EXACT_BITCOIN = /^(?:[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{39,59})$/;

// Common TLDs that should NOT be treated as file extensions
// to avoid conflicts with domain detection
const TLD_EXCLUSIONS = new Set([
  'com', 'net', 'org', 'edu', 'gov', 'mil', 'int', 'io', 'ai', 'co', 'me', 'tv', 'fm', 
  'am', 'so', 'is', 'it', 'to', 'be', 'de', 'fr', 'uk', 'us', 'eu', 'ca', 'au', 'ru', 
  'cn', 'in', 'jp', 'br', 'pl', 'nl', 'ch', 'at', 'dk', 'fi', 'no', 'se', 'cz', 'hu', 
  'ro', 'pt', 'gr', 'tr', 'mx', 'ar', 'cl', 'za', 'nz', 'sg', 'hk', 'tw', 'kr', 'my', 
  'th', 'id', 'ph', 'vn', 'info', 'biz', 'xyz', 'app', 'dev', 'cloud', 'tech'
]);

/** Check if a string looks like a file name with valid extension */
function isValidFileName(text: string): boolean {
  const lastDotIndex = text.lastIndexOf('.');
  if (lastDotIndex <= 0) return false; // No extension or starts with dot
  const ext = text.substring(lastDotIndex + 1).toLowerCase();
  // Exclude extensions that could be domain TLDs
  if (TLD_EXCLUSIONS.has(ext)) return false;
  if (!VALID_FILE_EXTENSIONS.has(ext)) return false;
  const fileName = text.substring(0, lastDotIndex);
  // File name must have at least 1 character before extension
  if (fileName.length < 1) return false;
  // Must not be just a version number
  if (/^v?\d+(\.\d+)+$/i.test(fileName)) return false;
  // Must match valid filename characters
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.\-() ]*$/i.test(fileName)) return false;
  return true;
}
const EXACT_ETHEREUM = /^0x[a-fA-F0-9]{40}$/;
const EXACT_ASN = /^AS[N]?\d{1,10}$/i;

/**
 * Detect the observable/entity type from a single text value.
 * Used by context menu "Add to OpenCTI" and manual input fields.
 * 
 * Returns the ObservableType or entity type string, or empty string if unknown.
 */
export function detectObservableType(text: string): string {
    const trimmed = text.trim();
    if (!trimmed) return '';
    
    // Check patterns in order of specificity
    
    // URL first (most specific with protocol)
    if (EXACT_URL.test(trimmed)) return 'Url';
    
    // Email
    if (EXACT_EMAIL.test(trimmed)) return 'Email-Addr';
    
    // CVE (Vulnerability)
    if (EXACT_CVE.test(trimmed)) return 'Vulnerability';
    
    // MITRE ATT&CK (Attack-Pattern)
    if (EXACT_MITRE.test(trimmed)) return 'Attack-Pattern';
    
    // Hashes (ordered by length)
    if (EXACT_SHA512.test(trimmed)) return 'StixFile';
    if (EXACT_SHA256.test(trimmed)) return 'StixFile';
    if (EXACT_SHA1.test(trimmed)) return 'StixFile';
    if (EXACT_MD5.test(trimmed)) return 'StixFile';
    
    // File names with valid extensions
    if (isValidFileName(trimmed)) return 'StixFile';
    
    // IP addresses
    if (EXACT_IPV6.test(trimmed)) return 'IPv6-Addr';
    if (EXACT_IPV4.test(trimmed)) return 'IPv4-Addr';
    
    // MAC address
    if (EXACT_MAC.test(trimmed)) return 'Mac-Addr';
    
    // Cryptocurrency
    if (EXACT_BITCOIN.test(trimmed)) return 'Cryptocurrency-Wallet';
    if (EXACT_ETHEREUM.test(trimmed)) return 'Cryptocurrency-Wallet';
    
    // ASN
    if (EXACT_ASN.test(trimmed)) return 'Autonomous-System';
    
    // Domain (must be last as it's the most generic)
    if (EXACT_DOMAIN.test(trimmed)) return 'Domain-Name';
    
    // Unknown type - user must select manually
    return '';
}

