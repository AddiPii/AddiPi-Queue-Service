const requireUser = (req, res, next) => {
    if (!req.user){
        res.status(403).json({error: 'Authentication required'})
        return
    }

    next()
}

export default requireUser
