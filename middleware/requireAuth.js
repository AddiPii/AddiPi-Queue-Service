import { CONFIG } from '../config.js'

const requireAuth = async (req, res, next) =>{
    try {
        const token = req.headers.authorization?.replace('Bearer ', '')

        if (!token){
            res.status(401).json({error: 'Missing authentication token'})
            return
        }

        const response = await fetch(`${CONFIG.AUTH_SERVICE_URL}/auth/verify`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer${token}`,
                'Content-Type': 'application/json'
            }
        })

        if (!response.ok){
            throw new Error('Authentication failed')
        }

        req.user = response.data.user

        next()
    } catch (err) {
        res.status(401).json({ error: 'Invalid authentication token' });
    }
}

export default requireAuth
