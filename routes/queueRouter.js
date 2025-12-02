import express from 'express'
import { cancelJobById, getNextJob, getQueue } from '../controllers/queueController.js'
import requireAuth from '../middleware/requireAuth.js'
import requireAdmin from '../middleware/requireAdmin.js'


export const queueRouter = express.Router()

queueRouter.get('/', getQueue)

queueRouter.get('/next', getNextJob)

queueRouter.patch('/cancel/:id', requireAuth, requireAdmin, cancelJobById)