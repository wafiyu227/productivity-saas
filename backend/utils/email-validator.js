/**
 * Email Validation Utility
 * Prevents test/probe emails and temporary email services from signing up
 */

// Block test/probe/temporary email services
const BLOCKED_EMAIL_PATTERNS = [
    // Test services and identifiers
    /probe-\d+@/i,                          // probe-1775820201024@* 
    /test[\d_-]*@/i,                        // test-* emails
    /temp[\d_-]*@/i,                        // temp-* emails
    /disposable@/i,
    /temporary@/i,
    /spam@/i,
    /fake@/i,
    /noreply@/i,
    /no-?reply@/i,
    /scanner@/i,
    /crawler@/i,
    /bot@/i,
    /vulnerability@/i,
    /security@/i,
    /hack@/i,
    /hack\.me@/i,
    
    // Temporary email services (disposable)
    /@guerrillamail\./i,
    /@tempmail\./i,
    /@throwaway\./i,
    /@10minutemail\./i,
    /@mailinator\./i,
    /@maildrop\./i,
    /@sharklasers\./i,
    /@spam4\.me/i,
    /@binkmail\./i,
    /@trashmail\./i,
    /@yopmail\./i,
    /@joriekol\.resend\.app/i,  // Resend test domain
    /@.*\.resend\.app/i,         // All Resend test subdomains
    /@mailtrap\.io/i,            // Mailtrap test service
    /@ethereal\.email/i,         // Ethereal (Nodemailer test)
    /@testmail\.io/i,
    /@mailtest\.in/i,
    
    // Security scanner/researcher patterns
    /security.*researcher@/i,
    /bug.*bounty@/i,
    /penetration.*test@/i,
    /pentest@/i,
    /argus@/i,
    /tryargus@/i,
    
    // Localhost/testing domains
    /@localhost@/i,
    /@127\.0\.0\.1/i,
    /@example\.com/i,
    /@test\.com/i,
    /@localhost\./i,
    /@example\./i,
    /@test\./i,
];

/**
 * Check if email matches blocked patterns
 * @param {string} email - Email address to check
 * @returns {boolean} true if email is blocked
 */
export function isBlockedEmail(email) {
    if (!email || typeof email !== 'string') return false;
    
    const cleanEmail = email.toLowerCase().trim();
    
    // Check against all blocked patterns
    return BLOCKED_EMAIL_PATTERNS.some(pattern => pattern.test(cleanEmail));
}

/**
 * Validate email address
 * Checks format and blocks test/temporary emails
 * @param {string} email - Email address to validate
 * @returns {object} { valid: boolean, error?: string }
 */
export function validateEmail(email) {
    if (!email) {
        return { 
            valid: false, 
            error: 'Email is required' 
        };
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check for blocked email patterns (test, probe, temporary services)
    if (isBlockedEmail(cleanEmail)) {
        return { 
            valid: false, 
            error: 'Test emails and temporary email services are not allowed. Please use your real work email address.' 
        };
    }

    // Basic email format check (RFC 5322 simplified)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
        return { valid: false, error: 'Invalid email format' };
    }

    // Domain length check (max 255 chars)
    const [localPart, domain] = cleanEmail.split('@');
    if (domain.length > 255) {
        return { valid: false, error: 'Domain name too long' };
    }

    // Check for multiple @ signs
    if (cleanEmail.split('@').length !== 2) {
        return { valid: false, error: 'Invalid email format' };
    }

    return { valid: true };
}

/**
 * Get user-friendly error message for blocked email
 * @param {string} email - Email address
 * @returns {string} error message
 */
export function getBlockedEmailReason(email) {
    if (!email) return 'Email is required';
    
    const cleanEmail = email.toLowerCase().trim();

    // Return specific reason based on pattern matched
    if (cleanEmail.includes('probe-')) return 'Security probe/scanner emails are not allowed';
    if (cleanEmail.includes('test')) return 'Test email addresses are not allowed';
    if (cleanEmail.includes('temp')) return 'Temporary email services are not allowed';
    if (cleanEmail.includes('resend.app')) return 'Temporary email services are not allowed';
    if (cleanEmail.includes('mailinator') || cleanEmail.includes('guerrilla')) {
        return 'Disposable email services are not allowed';
    }
    
    return 'This email address cannot be used for signup';
}

export default {
    isBlockedEmail,
    validateEmail,
    getBlockedEmailReason
};
