export default function handler(req, res) {
    res.status(200).json({
        status: 'ok',
        message: 'Diagnostic endpoint working',
        env: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
    });
}
