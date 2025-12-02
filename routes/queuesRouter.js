import express from 'express'
import { getQueuesByCount } from '../controllers/queuesController.js'
import requireAdmin from '../middleware/requireAdmin.js'
import requireAuth from '../middleware/requireAuth.js'

export const queuesRouter = express.Router()

queuesRouter.get('/', requireAuth, getQueuesByCount)