import express from 'express'
import { getNextJob, getQueue } from '../controllers/queueController.js'


export const queueRouter = express.Router()

queueRouter.get('/', getQueue)

queueRouter.get('/next', getNextJob)