import { Request, Response} from 'express'
import db from '../database/connection';
import convertToMinutes from '../utils/convertToMinute';

interface ScheduleItem{
    week_day: number;
    from: string;
    to:string;
}

export default class ClassesController{
    async index(request: Request, response: Response) {
        const filters = request.query;

        const subject = filters.subject as string;
        const week_day = filters.week_day as string;
        const time = filters. time as string;

        if (!filters.week_day || !filters.subject || !filters.time) {
            return response.status(400).json({
                error: 'faltou os menes'
            });
        }

        const timeInMinutes = convertToMinutes(time as string);

        const classes = await db('classes')
        .whereExists(function() {
            this.select('class_schedule.*')
                .from('class_schedule')
                .whereRaw('`class_schedule`.`classes_id` = `classes`. `id`')
                .whereRaw('`class_schedule`.`week_day` = ??', [Number(week_day)])
                .whereRaw('`class_schedule`.`from` <= ??', [timeInMinutes])
                .whereRaw('`class_schedule`.`to` > ??', [timeInMinutes])
        })
        .where('classes.subject', '=', subject) 
        .join('users', 'classes.user_id', '=', 'users.id') 
        .select(['classes.*', 'users.*']);

return response.json(classes);
    }



    async create(request: Request, response: Response) {
        const {
            name,
            avatar,
            whatsapp,
            bio, 
            subject,
            cost,
            schedule
        }= request.body;

        const trx = await db.transaction();
        try{
            const insertedUsersId = await trx('users').insert({
                name,
                avatar,
                whatsapp,
                bio,
            })

            const user_id = insertedUsersId[0];

            const insertedClassesIds = await trx('classes').insert({
                subject,
                cost,
                user_id,
            })

            const classes_id = insertedClassesIds[0];

            const classSchedule = schedule.map((scheduleItem:ScheduleItem) => {
                return {
                    week_day: scheduleItem.week_day,
                    from: convertToMinutes(scheduleItem.from),
                    to: convertToMinutes(scheduleItem.to),
                    classes_id,
                };
            })

            await trx('class_schedule').insert(classSchedule);

            await trx.commit();
            

            return response.status(201).send();
        } catch(err){
            trx.rollback();
            return response.status(400).json({
                error: 'unexpected error creating class'
            })
        }
    }
}