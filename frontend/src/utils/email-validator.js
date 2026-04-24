/**
 * Frontend Email Validation Utility
 * Matches backend validation to prevent test/probe emails
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
];

export function isBlockedEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const cleanEmail = email.toLowerCase().trim();
    return BLOCKED_EMAIL_PATTERNS.some(pattern => pattern.test(cleanEmail));
}

export function validateEmail(email) {
    if (!email) {
        return { 
            valid: false, 
            error: 'Email is required' 
        };
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check for blocked email patterns
    if (isBlockedEmail(cleanEmail)) {
        return { 
            valid: false, 
            error: 'Test emails and temporary services are not allowed' 
        };
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
        return { valid: false, error: 'Invalid email format' };
    }

    return { valid: true };
}
